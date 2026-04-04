'use client';

import React, { useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Tabs } from '@/components/ui/Tabs';
import { BrandHeadline } from '@/components/ui/BrandHeadline';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { TokenCard } from '@/components/token/TokenCard';
import { FeaturedRow } from '@/components/feed/FeaturedRow';
import { SwipeableCard } from '@/components/feed/SwipeableCard';
import { useTokenFeed } from '@/hooks/useTokenFeed';
import { useFeedStore } from '@/store/feedStore';
import type { FeedFilter } from '@/lib/types';

const FEED_TABS = [
  { id: 'forYou', label: 'For You' },
  { id: 'new', label: 'New' },
  { id: 'trending', label: 'Trending' },
  { id: 'following', label: 'Following' },
];

const ESTIMATED_CARD_HEIGHT = 340;

export default function FeedPage() {
  const router = useRouter();
  const { activeFilter, setFilter } = useFeedStore();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useTokenFeed();

  const allTokens = data?.pages.flatMap((page) => page.tokens) ?? [];

  const parentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: allTokens.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    overscan: 3,
    gap: 16,
  });

  // Infinite scroll — IntersectionObserver on sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div
      ref={parentRef}
      style={{
        maxWidth: '680px',
        margin: '0 auto',
        padding: 'var(--space-5)',
        height: '100%',
        overflowY: 'auto',
      }}
      className="hide-scrollbar"
    >
      {/* Brand headline */}
      <BrandHeadline
        before="What's happening on"
        highlight="Limiance"
        as="h1"
        size={28}
        style={{ marginBottom: 'var(--space-5)' }}
      />

      {/* Featured row */}
      <FeaturedRow />

      {/* Filter tabs */}
      <Tabs
        tabs={FEED_TABS}
        activeTab={activeFilter}
        onTabChange={(id) => setFilter(id as FeedFilter)}
      />

      {/* Token feed */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          marginTop: 'var(--space-4)',
        }}
      >
        {/* Loading state */}
        {isLoading && (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard
                key={`skeleton-${i}`}
                className="token-card"
                style={{
                  animationDelay: `${i * 50}ms`,
                }}
              />
            ))}
          </>
        )}

        {/* Error state */}
        {isError && (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--space-8)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '16px',
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-3)',
              }}
            >
              Something went wrong
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                color: '#FFFFFF',
                background: 'var(--brand)',
                border: 'none',
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'background var(--duration-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--brand)'; }}
            >
              Try again
            </button>
          </div>
        )}

        {/* Virtualized token list */}
        {!isLoading && !isError && allTokens.length > 0 && (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const token = allTokens[virtualRow.index];
              return (
                <div
                  key={token.mint}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <SwipeableCard
                    mint={token.mint}
                    onSwipeLeft={() => router.push(`/token/${token.mint}`)}
                  >
                    <TokenCard {...token} index={virtualRow.index} />
                  </SwipeableCard>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && allTokens.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--space-9)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '28px',
                color: 'var(--text-muted)',
                fontWeight: 700,
                marginBottom: 'var(--space-3)',
              }}
            >
              No tokens yet.
            </div>
            <Link
              href="/create"
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                color: 'var(--brand)',
                textDecoration: 'none',
              }}
            >
              Be the first to launch →
            </Link>
          </div>
        )}

        {/* Loading more indicator */}
        {isFetchingNextPage && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} style={{ height: 1 }} />
      </div>
    </div>
  );
}

