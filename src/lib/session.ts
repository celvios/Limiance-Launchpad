/**
 * Session manager — SIWS (Sign-In With Solana) JWT session.
 *
 * The user signs ONE generic message per session. The backend verifies it
 * and returns a JWT that is cached in localStorage for 24 hours.
 * All authenticated API calls send this token as `Authorization: Bearer <token>`
 * instead of re-signing per-action messages.
 *
 * Usage:
 *   const token = await loginWithWallet(walletAddress, signMessage);
 *   // token is also retrievable cheaply via:
 *   const token = getAuthToken(walletAddress);  // null if not logged in
 */

import { API_BASE_URL } from './constants';

const SESSION_TTL_MS = 24 * 60 * 60 * 1_000; // 24 h (mirrors JWT expiry)

interface StoredSession {
  walletAddress: string;
  token: string;   // JWT
  expiresAt: number;
}

function storageKey(walletAddress: string) {
  return `limiance:jwt:${walletAddress}`;
}

function loadStoredSession(walletAddress: string): StoredSession | null {
  try {
    const raw = localStorage.getItem(storageKey(walletAddress));
    if (!raw) return null;
    const session: StoredSession = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(storageKey(walletAddress));
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function saveStoredSession(session: StoredSession) {
  try {
    localStorage.setItem(storageKey(session.walletAddress), JSON.stringify(session));
  } catch {
    // localStorage unavailable (SSR / private mode) — fail silently
  }
}

export function clearSession(walletAddress: string) {
  try {
    localStorage.removeItem(storageKey(walletAddress));
    // Also clear legacy key format from the old session system
    localStorage.removeItem(`limiance:session:${walletAddress}`);
  } catch {}
}

/**
 * Return the cached JWT for the given wallet, or null if not authenticated.
 * Does NOT prompt the user — call loginWithWallet() to create a session.
 */
export function getAuthToken(walletAddress: string): string | null {
  return loadStoredSession(walletAddress)?.token ?? null;
}

/**
 * Build the login message. Must match backend/src/routes/auth.ts exactly.
 */
function buildLoginMessage(timestamp: number): string {
  return `Limiance Launchpad\n\nSign to authenticate your session.\n\nThis request will not trigger any blockchain transaction or cost any gas.\n\nTimestamp: ${timestamp}`;
}

/**
 * Log in with the wallet — prompts signMessage ONCE per session, then caches the JWT.
 *
 * @param walletAddress  Connected wallet public key (base58).
 * @param signMessage    `signMessage` from `useWallet()`.
 * @returns  JWT string (cached — does not re-prompt if already logged in).
 */
export async function loginWithWallet(
  walletAddress: string,
  signMessage: (msg: Uint8Array) => Promise<Uint8Array>
): Promise<string> {
  // Return cached token if still valid
  const cached = loadStoredSession(walletAddress);
  if (cached) return cached.token;

  // Prompt the user — only happens ONCE per session
  const timestamp = Date.now();
  const message = buildLoginMessage(timestamp);
  const encoded = new TextEncoder().encode(message);
  const sig = await signMessage(encoded);
  const signature = Buffer.from(sig).toString('base64');

  // Exchange signature for JWT
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, signature, timestamp }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Login failed: ${res.status}`);
  }

  const data = await res.json() as { token: string };

  saveStoredSession({
    walletAddress,
    token: data.token,
    expiresAt: timestamp + SESSION_TTL_MS,
  });

  return data.token;
}

/**
 * @deprecated Use loginWithWallet() instead.
 * Kept for backward compatibility — returns a fake { signature, timestamp } pair
 * by performing a full JWT login and extracting the token.
 */
export async function getOrCreateSession(
  walletAddress: string,
  signMessage: (msg: Uint8Array) => Promise<Uint8Array>
): Promise<{ signature: string; timestamp: number }> {
  const token = await loginWithWallet(walletAddress, signMessage);
  // Return the token as "signature" and 0 as timestamp — callers that used this
  // old API are being migrated; this shim prevents crashes during transition.
  return { signature: token, timestamp: 0 };
}
