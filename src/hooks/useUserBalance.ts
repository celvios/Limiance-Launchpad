import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { useWallet } from '@/providers/BscWalletProvider';

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

  // Query to fetch the balance
  const balanceQuery = useQuery({
    queryKey: ['userBalance', wallet],
    queryFn: async (): Promise<UserBalance[]> => {
      if (!wallet) return [];
      const res = await fetch(`/api/deposits/balance/${wallet}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch balance');
      const data = await res.json();
      return data.balances;
    },
    enabled: !!wallet,
    refetchInterval: 10000, // Poll every 10s for updates
  });

  const depositAddressQuery = useQuery({
    queryKey: ['depositAddress', wallet],
    queryFn: async (): Promise<string> => {
      if (!wallet) return '';
      const res = await fetch(`/api/users/me/deposit-address`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch deposit address');
      const data = await res.json();
      return data.vaultAddress;
    },
    enabled: !!wallet && !!token,
  });

  // Mutation to mock deposit on testnet
  const testnetDepositMutation = useMutation({
    mutationFn: async ({ amount, txHash }: { amount: string; txHash: string }) => {
      if (!token) throw new Error('Not authenticated');
      const res = await fetch('/api/deposits/testnet-credit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount, txHash }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to deposit');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userBalance', wallet] });
    },
  });

  // Mutation to withdraw
  const withdrawMutation = useMutation({
    mutationFn: async ({ amount, destination }: { amount: string; destination: string }) => {
      if (!token) throw new Error('Not authenticated');
      const res = await fetch('/api/deposits/withdraw', {
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

  // Helper to get total available USDT (sum of all available, though usually just one row)
  const totalAvailableUSDT = balanceQuery.data
    ?.filter((b) => b.asset === '0x0000000000000000000000000000000000000000') // Native/Default
    .reduce((acc, b) => acc + BigInt(b.available), 0n) ?? 0n;

  return {
    balances: balanceQuery.data,
    depositAddress: depositAddressQuery.data,
    totalAvailableUSDT,
    isLoading: balanceQuery.isLoading || depositAddressQuery.isLoading,
    error: balanceQuery.error || depositAddressQuery.error,
    testnetDeposit: testnetDepositMutation.mutateAsync,
    isDepositing: testnetDepositMutation.isPending,
    withdraw: withdrawMutation.mutateAsync,
    isWithdrawing: withdrawMutation.isPending,
  };
}
