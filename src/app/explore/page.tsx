'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { TokenCardCompact } from '@/components/token/TokenCardCompact';
import { useExploreTokens } from '@/hooks/useExploreTokens';
import { Button } from '@/components/ui/Button';
import { BrandHeadline } from '@/components/ui/BrandHeadline';
import type { ExploreFilter, SortOption } from '@/lib/types';

const FILTERS: { id: ExploreFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'trending', label: 'Trending' },
  { id: 'nearGraduation', label: 'Near Graduation' },
  { id: 'graduated', label: 'Graduated' },
];

const SORTS: { id: SortOption; label: string }[] = [
  { id: 'marketCap', label: 'Market Cap' },
  { id: 'volume24h', label: '24h Volume' },
  { id: 'age', label: 'Age' },
  { id: 'holders', label: 'Holders' },
];

export default function ExplorePage() {
  const [activeFilter, setActiveFilter] = useState<ExploreFilter>('all');
  const [activeSort, setActiveSort] = useState<SortOption>('marketCap');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useExploreTokens(activeFilter, activeSort);

  const allTokens = data?.pages.flatMap((page) => page.tokens) ?? [];
  const currentSort = SORTS.find((s) => s.id === activeSort);

  return (
    <div style={{ padding: 'var(--space-5)' }}>
      {/* Brand headline */}
      <BrandHeadline
        before="Find your next"
        highlight="trade."
        as="h1"
        size={28}
        style={{ marginBottom: 'var(--space-5)' }}
      />
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
          {FILTERS.map((filter) => {
            const isActive = filter.id === activeFilter;
            return (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
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
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }
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
              {currentSort?.label}
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
                        setActiveSort(sort.id);
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

      {/* Token grid */}
      {isLoading && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-3)',
                height: 160,
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

      {/* Token grid - populated */}
      {!isLoading && !isError && allTokens.length > 0 && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 'var(--space-4)',
            }}
          >
            {allTokens.map((token, i) => (
              <TokenCardCompact key={token.mint} token={token} index={i} />
            ))}
          </div>

          {/* Load more button */}
          {hasNextPage && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginTop: 'var(--space-6)',
              }}
            >
              <Button
                variant="outline"
                size="md"
                isLoading={isFetchingNextPage}
                onClick={() => fetchNextPage()}
              >
                Load 24 more
              </Button>
            </div>
          )}
        </>
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
              letterSpacing: '2px',
              marginBottom: 'var(--space-3)',
            }}
          >
            No tokens found.
          </div>
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '14px',
              color: 'var(--text-muted)',
            }}
          >
            Try a different filter or sort option.
          </div>
        </div>
      )}
    </div>
  );
}
