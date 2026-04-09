'use client';

import React, { memo, useState, useEffect } from 'react';
import Link from 'next/link';
import { formatNumber } from '@/lib/format';
import type { TokenCardData } from '@/lib/types';

/* ── TokenCardCompact ──
 * Lightweight card for the Explore grid.
 * Shows: image, symbol, price change, name, price, supply bar.
 */

interface TokenCardCompactProps {
  token: TokenCardData;
  index?: number;
}

export const TokenCardCompact = memo(function TokenCardCompact({
  token,
  index = 0,
}: TokenCardCompactProps) {
  const {
    mint,
    symbol,
    name,
    price,
    priceChange24h,
    currentSupply,
    graduationThreshold,
    status,
  } = token;

  const [isHovered, setIsHovered] = useState(false);
  const [supplyWidth, setSupplyWidth] = useState(0);

  const supplyPercent = Math.min(
    (currentSupply / graduationThreshold) * 100,
    100
  );
  const isGraduated = status === 'graduated';
  const isNearGrad = supplyPercent >= 75 && !isGraduated;

  useEffect(() => {
    const timer = setTimeout(() => setSupplyWidth(supplyPercent), 100);
    return () => clearTimeout(timer);
  }, [supplyPercent]);

  const formatPrice = (p: number): string => {
    if (p < 0.001) return p.toFixed(6);
    if (p < 1) return p.toFixed(4);
    return formatNumber(p, 2);
  };

  return (
    <Link
      href={`/token/${mint}`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          background: isHovered ? 'var(--bg-elevated)' : 'var(--bg-card)',
          border: `1px solid ${isHovered ? 'var(--border-active)' : 'var(--border)'}`,
          borderLeft: isGraduated ? '4px solid var(--graduation)' : '4px solid var(--brand)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-3)',
          cursor: 'pointer',
          transition: 'all 150ms var(--ease-default)',
          animation: 'cardEnter 300ms var(--ease-default) both',
          animationDelay: `${index * 30}ms`,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        {/* Top row: image + symbol + price change */}
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
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: '14px',
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            {symbol.slice(0, 2)}
          </div>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              flex: 1,
            }}
          >
            ${symbol}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color:
                priceChange24h >= 0 ? 'var(--buy)' : 'var(--sell)',
            }}
          >
            {priceChange24h >= 0 ? '+' : ''}
            {priceChange24h.toFixed(1)}%
          </span>
        </div>

        {/* Name */}
        <div
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </div>

        {/* Price */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            color: 'var(--text-primary)',
          }}
        >
          {formatPrice(price)} SOL
        </div>

        {/* Supply bar */}
        <div>
          <div
            style={{
              width: '100%',
              height: 4,
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
                background:
                  isNearGrad || isGraduated
                    ? 'var(--graduation)'
                    : 'var(--buy)',
                transition: 'width 800ms var(--ease-default)',
              }}
            />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-muted)',
              marginTop: '2px',
            }}
          >
            {isGraduated
              ? '✓ Graduated'
              : `${supplyPercent.toFixed(0)}% to grad`}
          </div>
        </div>
      </div>
    </Link>
  );
});
