import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/constants';

/**
 * Fetches the calling user's platform token balance (in raw wei string)
 * for a specific token on the internal bonding curve.
 */
export function useUserTokenBalance(tokenAddress: string | null | undefined, walletAddress: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['userTokenBalance', tokenAddress, walletAddress],
    queryFn: async (): Promise<bigint> => {
      if (!tokenAddress || !walletAddress) return 0n;
      const res = await fetch(
        `${API_BASE_URL}/tokens/${tokenAddress}/my-balance?wallet=${walletAddress}`
      );
      if (!res.ok) return 0n;
      const data = await res.json();
      return BigInt(data.amount ?? '0');
    },
    enabled: !!tokenAddress && !!walletAddress,
    refetchInterval: 10_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['userTokenBalance', tokenAddress, walletAddress] });
  };

  return {
    tokenBalanceWei: query.data ?? 0n,
    /** Amount in human-readable token units (18 decimals) */
    tokenBalance: Number(query.data ?? 0n) / 1e18,
    isLoading: query.isLoading,
    invalidate,
  };
}
