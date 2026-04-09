import { useCallback, useMemo, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/constants';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA !== 'false';
const ONBOARDED_KEY = 'limiance-onboarded';

/* ── Helpers ── */

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getOnboardedWallets(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(ONBOARDED_KEY) || '[]');
  } catch {
    return [];
  }
}

function markWalletOnboarded(wallet: string) {
  const wallets = getOnboardedWallets();
  if (!wallets.includes(wallet)) {
    wallets.push(wallet);
    localStorage.setItem(ONBOARDED_KEY, JSON.stringify(wallets));
  }
}

function isWalletOnboarded(wallet: string): boolean {
  return getOnboardedWallets().includes(wallet);
}

/* ── Username validation result ── */
export type UsernameStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'taken'
  | 'too_short'
  | 'too_long'
  | 'invalid_chars';

/* ── Hook ── */

export function useOnboarding() {
  const { publicKey, signMessage } = useWallet();
  const queryClient = useQueryClient();
  const walletAddress = publicKey?.toBase58() ?? '';

  const [profileLoading, setProfileLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const checkedRef = useRef(false);

  /* ── Check if wallet needs onboarding ── */
  const checkProfile = useCallback(async () => {
    if (!walletAddress || checkedRef.current) return;
    checkedRef.current = true;
    setProfileLoading(true);

    try {
      if (USE_MOCK) {
        await delay(300);
        const onboarded = isWalletOnboarded(walletAddress);
        setNeedsOnboarding(!onboarded);
      } else {
        const res = await fetch(`${API_BASE_URL}/profiles/${walletAddress}`);
        if (res.status === 404) {
          setNeedsOnboarding(true);
        } else if (res.ok) {
          setNeedsOnboarding(false);
        }
      }
    } catch {
      // Network error — don't block the user
      setNeedsOnboarding(false);
    } finally {
      setProfileLoading(false);
    }
  }, [walletAddress]);

  /* ── Username availability check (debounced) ── */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const checkUsername = useCallback(
    (username: string, callback: (status: UsernameStatus) => void) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      // Instant local validation
      if (!username || username.length === 0) {
        callback('idle');
        return;
      }
      if (username.length < 3) {
        callback('too_short');
        return;
      }
      if (username.length > 20) {
        callback('too_long');
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        callback('invalid_chars');
        return;
      }

      callback('checking');

      debounceRef.current = setTimeout(async () => {
        try {
          if (USE_MOCK) {
            await delay(600);
            // Mock: "admin", "test", "launch" are taken
            const taken = ['admin', 'test', 'launch', 'solana'].includes(
              username.toLowerCase()
            );
            callback(taken ? 'taken' : 'available');
          } else {
            const res = await fetch(
              `${API_BASE_URL}/profiles/check-username/${encodeURIComponent(username)}`
            );
            const data = (await res.json()) as { available: boolean };
            callback(data.available ? 'available' : 'taken');
          }
        } catch {
          // On error, assume available and let server validate on create
          callback('available');
        }
      }, 500);
    },
    []
  );

  /* ── Create profile ── */
  const createProfile = useCallback(
    async (params: {
      username: string;
      profilePicUri: string | null;
      coverUri: string | null;
    }) => {
      if (!publicKey) throw new Error('Wallet not connected');

      setCreating(true);
      setCreateError(null);

      try {
        if (USE_MOCK) {
          await delay(1200);
          markWalletOnboarded(walletAddress);
        } else {
          const timestamp = Date.now();
          const message = `ACTION:ONBOARD|DATA:${params.username}|TIMESTAMP:${timestamp}`;

          let signatureBase58 = '';
          if (signMessage) {
            const sig = await signMessage(new TextEncoder().encode(message));
            // Convert Uint8Array to base58 using the same method as @solana/web3.js
            signatureBase58 = Buffer.from(sig).toString('base64');
          }

          const res = await fetch(`${API_BASE_URL}/profiles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletAddress,
              username: params.username,
              profilePicUri: params.profilePicUri,
              coverUri: params.coverUri,
              signature: signatureBase58,
              timestamp,
            }),
          });

          if (!res.ok) {
            const err = (await res.json()) as { error: string };
            throw new Error(err.error || 'Failed to create profile');
          }
        }

        // Invalidate profile queries so the rest of the app picks up the new profile
        queryClient.invalidateQueries({ queryKey: ['profile', walletAddress] });

        setNeedsOnboarding(false);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong';
        setCreateError(msg);
        return false;
      } finally {
        setCreating(false);
      }
    },
    [publicKey, walletAddress, signMessage, queryClient]
  );

  /* ── Upload file to IPFS ── */
  const uploadFile = useCallback(
    async (file: File): Promise<string | null> => {
      try {
        if (USE_MOCK) {
          await delay(1500);
          // Return a fake IPFS URI
          const hash = Array.from({ length: 46 }, () =>
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(
              Math.floor(Math.random() * 62)
            )
          ).join('');
          return `ipfs://${hash}`;
        }

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${API_BASE_URL}/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) throw new Error('Upload failed');
        const data = (await res.json()) as { uri: string };
        return data.uri;
      } catch {
        return null;
      }
    },
    []
  );

  /* ── Generate DiceBear avatar URL ── */
  const diceBearUrl = useMemo(() => {
    if (!walletAddress) return '';
    return `https://api.dicebear.com/7.x/identicon/svg?seed=${walletAddress}`;
  }, [walletAddress]);

  return {
    needsOnboarding,
    profileLoading,
    checkProfile,
    checkUsername,
    createProfile,
    uploadFile,
    creating,
    createError,
    diceBearUrl,
    walletAddress,
  };
}
