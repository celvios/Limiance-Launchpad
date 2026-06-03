import { API_BASE_URL } from './constants';

const SESSION_TTL_MS = 24 * 60 * 60 * 1_000;

interface StoredSession {
  walletAddress: string;
  email?: string;
  authType?: 'wallet' | 'email';
  token: string;
  expiresAt: number;
}

function storageKey(walletAddress: string) {
  return `limiance:jwt:${walletAddress.toLowerCase()}`;
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
  } catch {}
}

export function saveEmailSession(session: {
  walletAddress: string;
  email: string;
  token: string;
  expiresAt?: number;
}) {
  saveStoredSession({
    walletAddress: session.walletAddress,
    email: session.email,
    authType: 'email',
    token: session.token,
    expiresAt: session.expiresAt ?? Date.now() + SESSION_TTL_MS,
  });
}

export function clearSession(walletAddress: string) {
  try {
    localStorage.removeItem(storageKey(walletAddress));
  } catch {}
}

export function getAuthToken(walletAddress: string): string | null {
  return loadStoredSession(walletAddress)?.token ?? null;
}

/**
 * Returns the cached JWT for the given wallet, or throws a user-friendly error
 * if none exists. Use this in action hooks (profile, comments, trades) instead
 * of `loginWithWallet` — we never want to trigger a MetaMask signature request
 * as a side-effect of a user action.
 */
export function requireAuthToken(walletAddress: string): string {
  const token = getAuthToken(walletAddress);
  if (!token) {
    throw new Error('Session expired — please reconnect your wallet to continue.');
  }
  return token;
}

function buildLoginMessage(timestamp: number): string {
  return `Limiance Launchpad\n\nSign to authenticate your BSC session.\n\nThis request will not trigger any blockchain transaction or cost gas.\n\nTimestamp: ${timestamp}`;
}

export async function loginWithWallet(
  walletAddress: string,
  signMessage: (msg: Uint8Array | string) => Promise<Uint8Array | string>,
): Promise<string> {
  const cached = loadStoredSession(walletAddress);
  if (cached) return cached.token;

  const timestamp = Date.now();
  const message = buildLoginMessage(timestamp);
  const signed = await signMessage(message);
  const signature = typeof signed === 'string' ? signed : `0x${Buffer.from(signed).toString('hex')}`;

  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress: walletAddress.toLowerCase(), signature, timestamp }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Login failed: ${res.status}`);
  }

  const data = await res.json() as { token: string };
  saveStoredSession({ walletAddress, token: data.token, expiresAt: timestamp + SESSION_TTL_MS });
  return data.token;
}

export async function requestEmailOtp(email: string): Promise<{ devCode?: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/email/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `OTP request failed: ${res.status}`);
  }
  return res.json() as Promise<{ devCode?: string }>;
}

export async function verifyEmailOtp(
  email: string,
  code: string,
  wallet: {
    embeddedSignerAddress: string;
    smartAccountAddress: string;
  },
): Promise<{
  token: string;
  wallet: string;
  email: string;
  authType: 'email';
  smartAccountAddress?: string | null;
}> {
  const res = await fetch(`${API_BASE_URL}/auth/email/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, ...wallet }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Email login failed: ${res.status}`);
  }
  const data = await res.json() as {
    token: string;
    wallet: string;
    email: string;
    authType: 'email';
    smartAccountAddress?: string | null;
  };
  saveEmailSession({ walletAddress: data.wallet, email: data.email, token: data.token });
  return data;
}

export async function getOrCreateSession(
  walletAddress: string,
  signMessage: (msg: Uint8Array | string) => Promise<Uint8Array | string>,
): Promise<{ signature: string; timestamp: number }> {
  const token = await loginWithWallet(walletAddress, signMessage);
  return { signature: token, timestamp: 0 };
}
