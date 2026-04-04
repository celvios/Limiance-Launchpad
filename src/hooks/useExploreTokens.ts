'use client';

/* ── useExploreTokens ──
 * Paginated query hook for the Explore page.
 * Uses explicit "load more" pagination, not infinite scroll.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchExploreTokens } from '@/lib/api';
import type { TokenListResponse, ExploreFilter, SortOption } from '@/lib/types';

export function useExploreTokens(filter: ExploreFilter, sort: SortOption) {
  return useInfiniteQuery<TokenListResponse>({
    queryKey: ['explore', filter, sort],
    queryFn: ({ pageParam }) =>
      fetchExploreTokens({
        filter,
        sort,
        cursor: pageParam as string | undefined,
        limit: 24,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    staleTime: 30_000,
  });
}
