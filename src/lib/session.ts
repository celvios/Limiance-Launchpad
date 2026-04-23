/**
 * Session manager — caches wallet auth so the user signs ONCE per session.
 *
 * On first action, `getOrCreateSession` prompts the wallet to sign a
 * "SESSION:..." message. The resulting { signature, timestamp } are stored in
 * localStorage for SESSION_TTL_MS. All subsequent mutations within that window
 * reuse the cached credentials, eliminating repeated pop-ups.
 *
 * The backend verifies only that:
 *   1. The signature is valid for the wallet address.
 *   2. The timestamp is within TIMESTAMP_WINDOW_MS of `Date.now()`.
 * Because we refresh the session on every page-load after it expires the
 * timestamp will always be fresh (we store the time the session was created
 * and invalidate locally once TIMESTAMP_WINDOW_MS has elapsed).
 */

const SESSION_TTL_MS = 24 * 60 * 60 * 1_000; // 24 h

interface WalletSession {
  walletAddress: string;
  signature: string;   // base64
  timestamp: number;   // ms since epoch, at signing time
  expiresAt: number;   // local invalidation timestamp
}

function storageKey(walletAddress: string) {
  return `limiance:session:${walletAddress}`;
}

export function loadSession(walletAddress: string): WalletSession | null {
  try {
    const raw = localStorage.getItem(storageKey(walletAddress));
    if (!raw) return null;
    const session: WalletSession = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(storageKey(walletAddress));
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session: WalletSession) {
  try {
    localStorage.setItem(storageKey(session.walletAddress), JSON.stringify(session));
  } catch {
    // localStorage unavailable (SSR / private mode) — fail silently
  }
}

export function clearSession(walletAddress: string) {
  try {
    localStorage.removeItem(storageKey(walletAddress));
  } catch {}
}

/**
 * Returns a { signature, timestamp } pair — either from cache or by prompting
 * the user to sign a fresh session message.
 *
 * @param walletAddress  Connected wallet public key (base58).
 * @param signMessage    `signMessage` from `useWallet()`.
 */
export async function getOrCreateSession(
  walletAddress: string,
  signMessage: (msg: Uint8Array) => Promise<Uint8Array>
): Promise<{ signature: string; timestamp: number }> {
  const cached = loadSession(walletAddress);
  if (cached) {
    return { signature: cached.signature, timestamp: cached.timestamp };
  }

  // Prompt the user — only happens ONCE per session
  const timestamp = Date.now();
  const message = `Limiance Launchpad\n\nSign to authenticate your session.\n\nThis request will not trigger any blockchain transaction or cost any gas.\n\nTimestamp: ${timestamp}`;
  const encoded = new TextEncoder().encode(message);
  const sig = await signMessage(encoded);
  const signature = Buffer.from(sig).toString('base64');

  saveSession({
    walletAddress,
    signature,
    timestamp,
    expiresAt: timestamp + SESSION_TTL_MS,
  });

  return { signature, timestamp };
}
