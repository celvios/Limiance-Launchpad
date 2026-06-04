import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { useWallet } from '@/providers/BscWalletProvider';
import { API_BASE_URL } from '@/lib/constants';

interface UserBalance {
  walletAddress: string;
  chainId: number;
  asset: string;
  available: string; // BigInt as string
  consumed: string;
}

export function useUserBalance() {
  const { token } = useAuth();
  const { address: wallet } = useWallet();
  const queryClient = useQueryClient();

  // ── USDT balance ──────────────────────────────────────────────────────────
  const balanceQuery = useQuery({
    queryKey: ['userBalance', wallet],
    queryFn: async (): Promise<UserBalance[]> => {
      if (!wallet) return [];
      const res = await fetch(`${API_BASE_URL}/deposits/balance/${wallet}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch balance');
      const data = await res.json();
      return data.balances ?? [];
    },
    enabled: !!wallet,
    refetchInterval: 8000,
  });

  // ── Deposit address — fetched as soon as wallet + token are present ────────
  const depositAddressQuery = useQuery({
    queryKey: ['depositAddress', wallet],
    queryFn: async (): Promise<string> => {
      if (!wallet || !token) return '';
      const res = await fetch(`${API_BASE_URL}/users/me/deposit-address`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch deposit address');
      const data = await res.json();
      return data.vaultAddress ?? '';
    },
    enabled: !!wallet && !!token,
    staleTime: Infinity, // vault address never changes for a given wallet
    retry: 3,
  });

  // ── Withdraw ──────────────────────────────────────────────────────────────
  const withdrawMutation = useMutation({
    mutationFn: async ({ amount, destination }: { amount: string; destination: string }) => {
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${API_BASE_URL}/deposits/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount, destination }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to withdraw');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userBalance', wallet] });
    },
  });

  // Sum all available USDT (zero address = platform USDT)
  const totalAvailableUSDT = balanceQuery.data
    ?.filter((b) => b.asset === '0x0000000000000000000000000000000000000000')
    .reduce((acc, b) => acc + BigInt(b.available), 0n) ?? 0n;

  return {
    balances: balanceQuery.data,
    depositAddress: depositAddressQuery.data || null,
    totalAvailableUSDT,
    isLoading: balanceQuery.isLoading || depositAddressQuery.isLoading,
    isLoadingAddress: depositAddressQuery.isLoading || depositAddressQuery.isFetching,
    error: balanceQuery.error || depositAddressQuery.error,
    withdraw: withdrawMutation.mutateAsync,
    isWithdrawing: withdrawMutation.isPending,
  };
}
