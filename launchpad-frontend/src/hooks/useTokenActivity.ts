'use client';

/**
 * useTokenActivity — cursor-paginated trade activity feed for a token.
 *
 * Wraps fetchTokenActivity from api.ts with react-query's useInfiniteQuery.
 * Data refreshes every 10 seconds and on window focus.
 */
import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchTokenActivity } from '@/lib/api';

const ACTIVITY_STALE_MS = 5_000;
const ACTIVITY_REFETCH_MS = 10_000;

export function useTokenActivity(mint: string | null | undefined) {
  return useInfiniteQuery({
    queryKey: ['activity', mint],
    queryFn: ({ pageParam }) =>
      fetchTokenActivity(mint!, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!mint,
    staleTime: ACTIVITY_STALE_MS,
    refetchInterval: ACTIVITY_REFETCH_MS,
    refetchOnWindowFocus: true,
  });
}
