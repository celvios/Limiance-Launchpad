'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchFeaturedTokens } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { formatNumber } from '@/lib/format';
import type { TokenCardData } from '@/lib/types';

/* ── FeaturedRow ──
 * Horizontal scrolling row of featured token cards.
 * Shows on the Feed page above the filter tabs.
 */

function FeaturedCard({ token }: { token: TokenCardData }) {
  const formatPrice = (p: number): string => {
    if (p < 0.001) return p.toFixed(6);
    if (p < 1) return p.toFixed(4);
    return formatNumber(p, 2);
  };

  return (
    <Link
      href={`/token/${token.mint}`}
      style={{ textDecoration: 'none', flexShrink: 0 }}
    >
      <div
        style={{
          width: 200,
          background: 'radial-gradient(150% 150% at 50% 0%, rgba(255, 215, 0, 0.12) 0%, rgba(15, 15, 15, 1) 100%)',
          border: '1px solid rgba(255, 215, 0, 0.3)',
          borderLeft: '4px solid #FFD700',
          boxShadow: '0 4px 20px rgba(255, 215, 0, 0.05)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-3)',
          cursor: 'pointer',
          transition: 'all 150ms var(--ease-default)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.8)';
          e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.2)';
          e.currentTarget.style.transform = 'scale(1.02)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.3)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(255, 215, 0, 0.05)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          {/* Token image placeholder */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            {token.symbol.slice(0, 2)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              ${token.symbol}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {token.name}
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--text-primary)',
            }}
          >
            {formatPrice(token.price)} SOL
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color:
                token.priceChange24h >= 0 ? 'var(--buy)' : 'var(--sell)',
            }}
          >
            {token.priceChange24h >= 0 ? '+' : ''}
            {token.priceChange24h.toFixed(1)}%
          </span>
        </div>
        <Badge variant="featured">FEATURED</Badge>
      </div>
    </Link>
  );
}

function FeaturedSkeleton() {
  const shimmerBg = `linear-gradient(90deg, rgba(20,20,20,1) 0%, rgba(255,215,0,0.05) 50%, rgba(20,20,20,1) 100%)`;
  const shimmerStyle: React.CSSProperties = {
    background: shimmerBg,
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: 'var(--radius-sm)',
  };

  return (
    <div
      style={{
        width: 200,
        height: 120,
        background: 'radial-gradient(150% 150% at 50% 0%, rgba(255, 215, 0, 0.05) 0%, rgba(15, 15, 15, 1) 100%)',
        border: '1px solid rgba(255, 215, 0, 0.1)',
        borderLeft: '4px solid rgba(255, 215, 0, 0.2)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-3)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        <div style={{ ...shimmerStyle, width: 32, height: 32, borderRadius: 'var(--radius-md)' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ ...shimmerStyle, width: '60%', height: 12 }} />
          <div style={{ ...shimmerStyle, width: '80%', height: 10 }} />
        </div>
      </div>
      <div style={{ ...shimmerStyle, width: '100%', height: 14 }} />
      <div style={{ ...shimmerStyle, width: '40%', height: 18 }} />
    </div>
  );
}

export function FeaturedRow() {
  const { data: featured, isLoading } = useQuery({
    queryKey: ['featured-tokens'],
    queryFn: fetchFeaturedTokens,
    staleTime: 60_000,
  });

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <div
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: 'var(--space-3)',
        }}
      >
        Featured
      </div>
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          overflowX: 'auto',
          paddingBottom: 'var(--space-2)',
        }}
        className="hide-scrollbar"
      >
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <FeaturedSkeleton key={i} />
            ))
          : featured?.map((token) => (
              <FeaturedCard key={token.mint} token={token} />
            ))}
      </div>
    </div>
  );
}
