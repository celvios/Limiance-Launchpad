'use client';

import React from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { useTokenActivity } from '@/hooks/useTokenDetail';
import { formatAddress, formatTimeAgo, formatNumber } from '@/lib/format';

interface ActivityFeedProps {
  mint: string;
}

export function ActivityFeed({ mint }: ActivityFeedProps) {
  const { data, isLoading } = useTokenActivity(mint);

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--border)',
          fontFamily: 'var(--font-display)',
          fontSize: '12px',
          letterSpacing: '2px',
          color: 'var(--text-muted)',
        }}
      >
        RECENT ACTIVITY
      </div>

      {isLoading ? (
        <div style={{ padding: 'var(--space-4)' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 'var(--space-3)',
                padding: 'var(--space-2) 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 16,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-elevated)',
                  animation: 'shimmer 1.5s infinite',
                  backgroundImage: 'linear-gradient(90deg, var(--bg-elevated) 0%, var(--bg-card) 50%, var(--bg-elevated) 100%)',
                  backgroundSize: '200% 100%',
                }}
              />
              <div
                style={{
                  flex: 1,
                  height: 16,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-elevated)',
                  animation: 'shimmer 1.5s infinite',
                  backgroundImage: 'linear-gradient(90deg, var(--bg-elevated) 0%, var(--bg-card) 50%, var(--bg-elevated) 100%)',
                  backgroundSize: '200% 100%',
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div>
          {data?.trades.map((trade) => (
            <div
              key={trade.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                borderBottom: '1px solid var(--border)',
                transition: 'background var(--duration-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-elevated)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {/* Type badge */}
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  background: trade.type === 'buy' ? 'var(--buy-dim)' : 'var(--sell-dim)',
                  color: trade.type === 'buy' ? 'var(--buy)' : 'var(--sell)',
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}
              >
                {trade.type}
              </span>

              {/* Wallet */}
              <Link
                href={`/profile/${trade.walletAddress}`}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                  minWidth: 80,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {trade.walletHandle
                  ? `@${trade.walletHandle}`
                  : formatAddress(trade.walletAddress)}
              </Link>

              {/* Amounts */}
              <div style={{ flex: 1, textAlign: 'right' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {formatNumber(trade.tokenAmount, 0)} tokens
                </span>
              </div>

              <div style={{ textAlign: 'right', minWidth: 70 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: trade.type === 'buy' ? 'var(--buy)' : 'var(--sell)',
                  }}
                >
                  {trade.solAmount.toFixed(2)} SOL
                </span>
              </div>

              {/* Whale indicator */}
              {trade.isWhale && (
                <span style={{ fontSize: '14px', flexShrink: 0 }} title="Whale trade">
                  🐋
                </span>
              )}

              {/* Time */}
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  minWidth: 40,
                  textAlign: 'right',
                }}
              >
                {formatTimeAgo(trade.timestamp)}
              </span>
            </div>
          ))}

          {data?.trades.length === 0 && (
            <div
              style={{
                padding: 'var(--space-6)',
                textAlign: 'center',
                fontFamily: 'var(--font-ui)',
                fontSize: '13px',
                color: 'var(--text-muted)',
              }}
            >
              No trades yet. Be the first!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
