'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useTokenDetail } from '@/hooks/useTokenDetail';
import { TokenHeader } from '@/components/token/TokenHeader';
import { PriceChart } from '@/components/token/PriceChart';
import { SupplyBar } from '@/components/token/SupplyBar';
import { GraduationBanner } from '@/components/token/GraduationBanner';
import { TradePanel } from '@/components/token/TradePanel';
import { ActivityFeed } from '@/components/token/ActivityFeed';
import { useGraduationHandler } from '@/hooks/useGraduationHandler';
import { CommentSection } from '@/components/social/CommentSection';

export function TokenPageClient() {
  const params = useParams();
  const mint = params.mint as string;
  const { data: token, isLoading, isError } = useTokenDetail(mint);

  // Wire graduation handler for this token
  useGraduationHandler(mint);

  if (isLoading) {
    return <TokenPageSkeleton />;
  }

  if (isError || !token) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '32px',
              color: 'var(--text-muted)',
              letterSpacing: '2px',
              marginBottom: 'var(--space-3)',
            }}
          >
            TOKEN NOT FOUND
          </div>
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '14px',
              color: 'var(--text-muted)',
            }}
          >
            The mint address may be invalid or the token doesn&apos;t exist.
          </div>
        </div>
      </div>
    );
  }

  const supplyPercent = (token.currentSupply / token.graduationThreshold) * 100;
  const isGraduated = token.status === 'graduated';
  const isNearGrad = supplyPercent >= 75 && !isGraduated;

  return (
    <div style={{ padding: 'var(--space-4)' }}>
      {/* 2-column layout: content | trade panel */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 400px',
          gap: 'var(--space-5)',
          alignItems: 'start',
        }}
        className="token-page-grid"
      >
        {/* Left column — main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            minWidth: 0,
          }}
        >
          <TokenHeader token={token} />

          <GraduationBanner
            isGraduated={isGraduated}
            isNearGrad={isNearGrad}
            supplyPercent={supplyPercent}
            raydiumPoolAddress={token.raydiumPoolAddress}
          />

          <PriceChart mint={mint} currentPrice={token.price} />

          <SupplyBar
            currentSupply={token.currentSupply}
            graduationThreshold={token.graduationThreshold}
            isGraduated={isGraduated}
          />

          {/* Description */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '12px',
                letterSpacing: '2px',
                color: 'var(--text-muted)',
                marginBottom: 'var(--space-3)',
              }}
            >
              ABOUT
            </div>
            <p
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              {token.description}
            </p>
          </div>

          {/* Token info grid */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '12px',
                letterSpacing: '2px',
                color: 'var(--text-muted)',
                marginBottom: 'var(--space-3)',
              }}
            >
              TOKEN INFO
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 'var(--space-3)',
              }}
            >
              {[
                { label: 'Curve Type', value: token.curveType.toUpperCase() },
                { label: 'Total Supply', value: `${(token.totalSupply / 1000).toFixed(0)}K` },
                { label: 'Holders', value: token.holderCount.toLocaleString() },
                { label: '24h Volume', value: `${token.volume24h.toLocaleString()} SOL` },
                { label: 'Total Raised', value: `${token.totalRaised.toFixed(1)} SOL` },
                { label: 'Platform Fee', value: `${token.platformFee}%` },
              ].map((item) => (
                <div key={item.label}>
                  <div
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '14px',
                      color: 'var(--text-primary)',
                      marginTop: '2px',
                    }}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <ActivityFeed mint={mint} />

          {/* Comments */}
          <CommentSection mint={mint} />
        </div>

        {/* Right column — trade panel (sticky) */}
        <div
          style={{
            position: 'sticky',
            top: 'var(--space-4)',
          }}
        >
          <TradePanel token={token} />

          {/* Dev-only: Test graduation sequence */}
          {process.env.NODE_ENV === 'development' && !isGraduated && (
            <button
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('token-graduation', {
                    detail: {
                      tokenMint: mint,
                      tokenSymbol: token.symbol,
                      raydiumPoolAddress: token.raydiumPoolAddress ?? 'devtest',
                      timestamp: Date.now(),
                    },
                  })
                );
              }}
              style={{
                width: '100%',
                marginTop: 'var(--space-3)',
                padding: 'var(--space-2)',
                background: 'var(--graduation-dim)',
                border: '1px dashed var(--graduation)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--graduation)',
                cursor: 'pointer',
                opacity: 0.7,
                transition: 'opacity var(--duration-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
            >
              ⚡ TEST GRADUATION
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* Skeleton loading state */
function TokenPageSkeleton() {
  const shimmerStyle: React.CSSProperties = {
    backgroundImage: 'linear-gradient(90deg, var(--bg-card) 0%, var(--bg-elevated) 50%, var(--bg-card) 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: 'var(--radius-sm)',
  };

  return (
    <div style={{ padding: 'var(--space-4)' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 400px',
          gap: 'var(--space-5)',
        }}
        className="token-page-grid"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Banner skeleton */}
          <div style={{ ...shimmerStyle, width: '100%', height: 200, borderRadius: 'var(--radius-lg)' }} />
          {/* Title skeleton */}
          <div style={{ padding: '0 var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ ...shimmerStyle, width: 200, height: 40 }} />
            <div style={{ ...shimmerStyle, width: 80, height: 16 }} />
            <div style={{ ...shimmerStyle, width: 300, height: 16 }} />
          </div>
          {/* Chart skeleton */}
          <div
            style={{
              ...shimmerStyle,
              width: '100%',
              height: 350,
              borderRadius: 'var(--radius-lg)',
            }}
          />
          {/* Supply bar skeleton */}
          <div style={{ ...shimmerStyle, width: '100%', height: 80, borderRadius: 'var(--radius-lg)' }} />
        </div>
        {/* Trade panel skeleton */}
        <div style={{ ...shimmerStyle, width: '100%', height: 500, borderRadius: 'var(--radius-lg)' }} />
      </div>
    </div>
  );
}
