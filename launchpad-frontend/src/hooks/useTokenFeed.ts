'use client';

/* ── useTokenFeed ──
 * Infinite query hook for the Feed page.
 * Reads filter/tags from feedStore, fetches through api.ts.
 * When real endpoints are ready, this hook stays unchanged —
 * only api.ts needs updating.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { useFeedStore } from '@/store/feedStore';
import { fetchFeedTokens } from '@/lib/api';
import type { TokenListResponse } from '@/lib/types';

export function useTokenFeed() {
  const filter = useFeedStore((s) => s.activeFilter);
  const tags = useFeedStore((s) => s.activeTags);

  return useInfiniteQuery<TokenListResponse>({
    queryKey: ['feed', filter, tags],
    queryFn: ({ pageParam }) =>
      fetchFeedTokens({
        filter,
        tags,
        cursor: pageParam as string | undefined,
        limit: 6,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    staleTime: 30_000,
  });
}
