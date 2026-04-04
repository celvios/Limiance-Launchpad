'use client';

import React, { memo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { MessageCircle, Share2, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Sparkline } from '@/components/token/Sparkline';
import { WatchlistButton } from '@/components/social/WatchlistButton';
import { formatNumber, formatTimeAgo } from '@/lib/format';
import type { TokenCardData } from '@/lib/types';

const HOUR = 3_600_000;

interface TokenCardProps extends TokenCardData {
  index?: number; // for stagger animation delay
}

export const TokenCard = memo(function TokenCard(props: TokenCardProps) {
  const {
    mint,
    symbol,
    name,
    description,
    creatorHandle,
    createdAt,
    curveType,
    price,
    priceChange24h,
    marketCap,
    sparklineData,
    currentSupply,
    graduationThreshold,
    commentCount,
    status,
    index = 0,
  } = props;

  const [isHovered, setIsHovered] = useState(false);
  const [supplyWidth, setSupplyWidth] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const isNew = Date.now() - createdAt < HOUR;
  const isGraduated = status === 'graduated';
  const supplyPercent = Math.min(
    (currentSupply / graduationThreshold) * 100,
    100
  );
  const isNearGrad = supplyPercent >= 75 && !isGraduated;
  const remaining = graduationThreshold - currentSupply;

  // Animate supply bar on mount
  useEffect(() => {
    const timer = setTimeout(() => setSupplyWidth(supplyPercent), 100);
    return () => clearTimeout(timer);
  }, [supplyPercent]);

  const formatPrice = (p: number): string => {
    if (p < 0.001) return p.toFixed(6);
    if (p < 1) return p.toFixed(4);
    return formatNumber(p, 2);
  };

  const formatMarketCap = (mc: number): string => {
    if (mc >= 1_000_000) return `${(mc / 1_000_000).toFixed(1)}M`;
    if (mc >= 1_000) return `${(mc / 1_000).toFixed(1)}K`;
    return formatNumber(mc, 0);
  };

  return (
    <Link
      href={`/token/${mint}`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div
        ref={cardRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          background: 'var(--bg-card)',
          border: `1px solid ${isHovered ? 'var(--border-active)' : 'var(--border)'}`,
          borderLeft: isGraduated
            ? '4px solid var(--graduation)'
            : '4px solid var(--brand)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          cursor: 'pointer',
          transition: 'all 150ms var(--ease-default)',
          transform: isHovered ? 'scale(1.01)' : 'scale(1)',
          animation: 'cardEnter 300ms var(--ease-default) both',
          animationDelay: `${index * 50}ms`,
          position: 'relative',
        }}
      >
        {/* Header Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-3)',
          }}
        >
          {/* Token image placeholder */}
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              color: 'var(--text-muted)',
              flexShrink: 0,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {symbol.slice(0, 2)}
            {isNew && (
              <div
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: 'var(--new)',
                  border: '2px solid var(--bg-card)',
                }}
              />
            )}
          </div>

          {/* Title + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                ${symbol}
              </span>
              <Badge variant="curve">{curveType.toUpperCase()}</Badge>
              {isNew && <Badge variant="new">NEW</Badge>}
              {isGraduated && <Badge variant="grad">GRADUATED</Badge>}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                color: 'var(--text-secondary)',
                marginTop: '2px',
              }}
            >
              {name}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '12px',
                color: 'var(--text-muted)',
                marginTop: '2px',
              }}
            >
              by @{creatorHandle} · {formatTimeAgo(createdAt)}
            </div>
          </div>

          {/* Watchlist heart */}
          <WatchlistButton mint={mint} size={18} />
        </div>

        {/* Description */}
        <p
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {description}
        </p>

        {/* Stats Row */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-3)',
          }}
        >
          <div
            style={{
              flex: 1,
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-2) var(--space-3)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '10px',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Price
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                color: 'var(--text-primary)',
                marginTop: '2px',
              }}
            >
              {formatPrice(price)} SOL
            </div>
          </div>

          <div
            style={{
              flex: 1,
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-2) var(--space-3)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '10px',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              24h
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                color:
                  priceChange24h >= 0 ? 'var(--buy)' : 'var(--sell)',
                marginTop: '2px',
              }}
            >
              {priceChange24h >= 0 ? '+' : ''}
              {priceChange24h.toFixed(1)}%
            </div>
          </div>

          <div
            style={{
              flex: 1,
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-2) var(--space-3)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '10px',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Mkt Cap
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                color: 'var(--text-primary)',
                marginTop: '2px',
              }}
            >
              {formatMarketCap(marketCap)} SOL
            </div>
          </div>
        </div>

        {/* Sparkline */}
        <Sparkline data={sparklineData} width={600} height={32} />

        {/* Supply Bar */}
        <div>
          <div
            style={{
              width: '100%',
              height: 6,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--border)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                borderRadius: 'var(--radius-sm)',
                width: `${supplyWidth}%`,
                background: isNearGrad || isGraduated ? 'var(--graduation)' : 'var(--buy)',
                transition: 'width 800ms var(--ease-default)',
                ...(supplyPercent > 90 && !isGraduated
                  ? { animation: 'supplyPulse 2s infinite' }
                  : {}),
              }}
            />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: 'var(--space-1)',
            }}
          >
            {isGraduated
              ? '✓ Graduated to Raydium'
              : `${supplyPercent.toFixed(0)}% — ${formatNumber(remaining, 0)} to graduation`}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            paddingTop: 'var(--space-1)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--buy)',
              background: 'var(--buy-dim)',
              padding: 'var(--space-1) var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            BUY ↗
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: 'var(--font-ui)',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
          >
            <MessageCircle size={14} />
            {commentCount}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: 'var(--font-ui)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <Share2 size={14} />
          </span>
          {isGraduated && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontFamily: 'var(--font-ui)',
                fontSize: '12px',
                color: 'var(--graduation)',
                marginLeft: 'auto',
              }}
            >
              <ExternalLink size={14} />
              Raydium
            </span>
          )}
        </div>
      </div>
    </Link>
  );
});
