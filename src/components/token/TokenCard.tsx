'use client';

import React, { memo, useState, useRef } from 'react';
import Link from 'next/link';
import { Sparkline } from '@/components/token/Sparkline';
import { formatNumber, formatTimeAgo } from '@/lib/format';
import { ipfsToGateway } from '@/lib/pinata';
import type { TokenCardData } from '@/lib/types';

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
    marketCap,
    sparklineData,
    index = 0,
  } = props;

  const [isHovered, setIsHovered] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);



  const formatMarketCap = (mc: number): string => {
    if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(1)}M`;
    if (mc >= 1_000) return `$${(mc / 1_000).toFixed(1)}K`;
    return `$${formatNumber(mc, 0)}`;
  };

  return (
    <Link
      href={`/token/${mint}`}
      style={{ textDecoration: 'none', display: 'block', height: '100%' }}
    >
      <div
        ref={cardRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          background: 'var(--bg-base)',
          border: '1px solid transparent', // remove card border, keep flat
          display: 'flex',
          flexDirection: 'column',
          cursor: 'pointer',
          transition: 'all 150ms var(--ease-default)',
          transform: isHovered ? 'translateY(-2px)' : 'none',
          animation: 'cardEnter 300ms var(--ease-default) both',
          animationDelay: `${(index % 12) * 50}ms`,
          height: '100%',
        }}
      >
        {/* Token image container */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1/1',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          {props.imageUri && !imageFailed ? (
            <img
              src={ipfsToGateway(props.imageUri)}
              alt={symbol}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-display)',
                fontSize: '32px',
                color: 'var(--text-muted)',
              }}
            >
              {symbol.slice(0, 2)}
            </div>
          )}

          {/* Sparkline Overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '60%',
              height: '40px',
              background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.4))',
            }}
          >
            <Sparkline data={sparklineData} width={150} height={40} />
          </div>
        </div>

        {/* Content Section */}
        <div
          style={{
            padding: 'var(--space-2) 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            flex: 1,
          }}
        >
          {/* Title and Market Cap */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 'var(--space-2)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {name} <span style={{ color: 'var(--text-muted)' }}>${symbol}</span>
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {formatMarketCap(marketCap)} MC
            </span>
          </div>

          {/* Creator & time */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: 'var(--font-ui)',
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}
          >
            {/* Minimal avatar placeholder or creator pic if you had one in props */}
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#fff' }}>
              {creatorHandle?.slice(0, 1).toUpperCase()}
            </div>
            <span>{creatorHandle}</span>
            <span style={{ margin: '0 2px' }}>·</span>
            <span>{formatTimeAgo(createdAt)}</span>
          </div>

          {/* Bio */}
          <p
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
              margin: '4px 0 0 0',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
});
