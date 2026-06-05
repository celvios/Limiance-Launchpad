'use client';

import React from 'react';
import { useTokenActivity } from '@/hooks/useTokenDetail';
import { formatTimeAgo, formatNumber } from '@/lib/format';

interface OrderBookProps {
  mint: string;
}

export function OrderBook({ mint }: OrderBookProps) {
  const { data, isLoading } = useTokenActivity(mint);

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        fontFamily: 'var(--font-mono)',
        display: 'flex',
        flexDirection: 'column',
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
        ORDER BOOK
      </div>

      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          padding: 'var(--space-2) var(--space-4)',
          fontSize: '10px',
          color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ flex: 1 }}>Price (USDT)</div>
        <div style={{ flex: 1, textAlign: 'right' }}>Amount</div>
        <div style={{ flex: 1, textAlign: 'right' }}>Time</div>
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
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: 12,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-elevated)',
                  animation: 'shimmer 1.5s infinite',
                }}
              />
              <div
                style={{
                  flex: 1,
                  height: 12,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-elevated)',
                  animation: 'shimmer 1.5s infinite',
                }}
              />
              <div
                style={{
                  flex: 1,
                  height: 12,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-elevated)',
                  animation: 'shimmer 1.5s infinite',
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {data?.trades.map((trade) => {
            const isBuy = trade.type === 'buy';
            const color = isBuy ? 'var(--buy)' : 'var(--sell)';
            const bgHover = isBuy ? 'var(--buy-dim)' : 'var(--sell-dim)';
            const price = trade.pricePerToken 
              ? trade.pricePerToken 
              : (trade.tokenAmount > 0 ? trade.solAmount / trade.tokenAmount : 0);

            return (
              <div
                key={trade.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: 'var(--space-2) var(--space-4)',
                  fontSize: '12px',
                  cursor: 'default',
                  transition: 'background var(--duration-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = bgHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {/* Price */}
                <div style={{ flex: 1, color: color, fontWeight: 500 }}>
                  {price.toFixed(7)}
                </div>

                {/* Amount */}
                <div style={{ flex: 1, textAlign: 'right', color: 'var(--text-primary)' }}>
                  {formatNumber(trade.tokenAmount, 0)}
                </div>

                {/* Time */}
                <div style={{ flex: 1, textAlign: 'right', color: 'var(--text-muted)' }}>
                  {formatTimeAgo(trade.timestamp)}
                </div>
              </div>
            );
          })}

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
              No trades yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
