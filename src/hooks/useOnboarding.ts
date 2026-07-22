import { useCallback, useMemo, useRef, useState } from 'react';
import { useWallet } from '@/providers/BscWalletProvider';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/constants';
import { useUIStore } from '@/store/uiStore';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true'; // Only mock when explicitly enabled
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
  const { address, token: walletToken } = useWallet();
  const queryClient = useQueryClient();
  const walletAddress = address ?? '';

  const [profileLoading, setProfileLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const checkedRef = useRef(false);
  // Reset the checked flag whenever the wallet address changes (reconnect, switch accounts)
  const prevAddressRef = useRef<string>('');
  if (prevAddressRef.current !== walletAddress) {
    prevAddressRef.current = walletAddress;
    checkedRef.current = false;
  }

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
            const taken = ['admin', 'test', 'launch', 'bsc'].includes(
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
      if (!address) throw new Error('Wallet not connected');

      setCreating(true);
      setCreateError(null);

      try {
        if (USE_MOCK) {
          await delay(1200);
          markWalletOnboarded(walletAddress);
        } else {
          // Use the live token from BscWalletProvider state — never rely on localStorage
          const token = walletToken;
          if (!token) {
            throw new Error('Session expired — please reconnect your wallet.');
          }

          const res = await fetch(`${API_BASE_URL}/profiles`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              walletAddress: walletAddress.toLowerCase(),
              username: params.username,
              profilePicUri: params.profilePicUri,
              coverUri: params.coverUri,
            }),
          });

          if (!res.ok) {
            const err = (await res.json().catch(() => ({ error: `Server error ${res.status}` }))) as { error: string };
            if (res.status === 429) {
              throw new Error('Too many attempts. Please wait a minute and try again.');
            }
            throw new Error(err.error || `Failed to create profile (${res.status})`);
          }

          const body = (await res.json().catch(() => null)) as { profile?: unknown } | null;
          if (body?.profile) {
            queryClient.setQueryData(['profile', walletAddress], body.profile);
          }
        }

        // Invalidate profile queries so the rest of the app picks up the new profile
        queryClient.invalidateQueries({ queryKey: ['profile', walletAddress] });

        setNeedsOnboarding(false);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'An error occurred while creating profile';
        setCreateError(msg);
        if (msg.includes('Session expired')) {
          useUIStore.getState().openWalletDrawer();
        }
        return false;
      } finally {
        setCreating(false);
      }
    },
    [address, walletAddress, walletToken, queryClient]
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

        const { uploadToIPFS } = await import('@/lib/pinata');
        const uri = await uploadToIPFS(file);
        return uri;
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


