'use client';

import React, { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { BrandHeadline } from '@/components/ui/BrandHeadline';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { TokenCard } from '@/components/token/TokenCard';
import { useTokenFeed } from '@/hooks/useTokenFeed';
import { useFeedStore } from '@/store/feedStore';
import type { FeedFilter, SortOption } from '@/lib/types';

const FEED_FILTERS: { id: FeedFilter; label: string }[] = [
  { id: 'forYou', label: 'For You' },
  { id: 'new', label: 'New' },
  { id: 'trending', label: 'Trending' },
  { id: 'following', label: 'Following' },
];

const SORTS: { id: SortOption; label: string }[] = [
  { id: 'marketCap', label: 'Market Cap' },
  { id: 'volume24h', label: '24h Volume' },
  { id: 'age', label: 'Age' },
  { id: 'holders', label: 'Holders' },
];

export default function FeedPage() {
  const router = useRouter();
  const { activeFilter, setFilter, activeSort, setSort } = useFeedStore();
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useTokenFeed();

  const allTokens = data?.pages.flatMap((page) => page.tokens) ?? [];
  const currentSort = SORTS.find((s) => s.id === activeSort);

  const sentinelRef = useRef<HTMLDivElement>(null);

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
      style={{
        width: '100%',
        margin: '0 auto',
        padding: 'var(--space-5)',
        minHeight: '100%',
      }}
    >
      {/* Sticky filter bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--bg-base)',
          paddingBottom: 'var(--space-4)',
          borderBottom: '1px solid var(--border)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            flexWrap: 'wrap',
          }}
        >
          {/* Filter pills */}
          {FEED_FILTERS.map((filter) => {
            const isActive = filter.id === activeFilter;
            return (
              <button
                key={filter.id}
                onClick={() => setFilter(filter.id)}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  background: isActive
                    ? 'var(--brand)'
                    : 'var(--bg-elevated)',
                  color: isActive
                    ? '#FFFFFF'
                    : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all var(--duration-fast)',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                {filter.label}
              </button>
            );
          })}

          {/* Sort dropdown */}
          <div style={{ marginLeft: 'auto', position: 'relative' }}>
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-ui)',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--duration-fast)',
              }}
            >
              {currentSort?.label || 'Sort'}
              <ChevronDown size={14} />
            </button>

            {showSortDropdown && (
              <>
                {/* Invisible backdrop to close dropdown */}
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9,
                  }}
                  onClick={() => setShowSortDropdown(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 'var(--space-1)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-dropdown)',
                    zIndex: 10,
                    minWidth: 140,
                    overflow: 'hidden',
                  }}
                >
                  {SORTS.map((sort) => (
                    <button
                      key={sort.id}
                      onClick={() => {
                        setSort(sort.id);
                        setShowSortDropdown(false);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: 'var(--space-2) var(--space-3)',
                        background:
                          sort.id === activeSort
                            ? 'var(--bg-elevated)'
                            : 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--border)',
                        fontFamily: 'var(--font-ui)',
                        fontSize: '13px',
                        color:
                          sort.id === activeSort
                            ? 'var(--text-primary)'
                            : 'var(--text-secondary)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background var(--duration-fast)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          'var(--bg-elevated)';
                      }}
                      onMouseLeave={(e) => {
                        if (sort.id !== activeSort) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      {sort.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Token feed */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        {/* Loading state */}
        {isLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-3)',
                  height: 300,
                  animation: 'shimmer 1.5s infinite',
                  backgroundImage: `linear-gradient(90deg, var(--bg-card) 0%, var(--bg-elevated) 50%, var(--bg-card) 100%)`,
                  backgroundSize: '200% 100%',
                }}
              />
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>
              Something went wrong
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                fontFamily: 'var(--font-ui)', fontSize: '14px', color: '#FFFFFF', background: 'var(--brand)', border: 'none', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        )}

        {/* Native CSS Grid token list */}
        {!isLoading && !isError && allTokens.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 'var(--space-4)',
              width: '100%',
            }}
          >
            {allTokens.map((token, i) => (
              <TokenCard key={token.mint} {...token} index={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && allTokens.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-9)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
              No tokens yet.
            </div>
            <Link href="/create" style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--brand)', textDecoration: 'none' }}>
              Be the first to launch →
            </Link>
          </div>
        )}

        {/* Loading more indicator */}
        {isFetchingNextPage && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
             <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', height: 300, animation: 'shimmer 1.5s infinite' }} />
             <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', height: 300, animation: 'shimmer 1.5s infinite' }} />
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} style={{ height: 1 }} />
      </div>
    </div>
  );
}
