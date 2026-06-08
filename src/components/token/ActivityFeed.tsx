'use client';

import React from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { useTokenActivity } from '@/hooks/useTokenDetail';
import { formatAddress, formatDate, formatTimeAgo, formatNumber } from '@/lib/format';

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
        overflowX: 'auto',
        fontFamily: 'var(--font-mono)',
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

      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
        <thead>
          <tr
            style={{
              borderBottom: '1px solid var(--border)',
              fontSize: '10px',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
            }}
          >
            <th style={{ padding: 'var(--space-2) var(--space-4)', fontWeight: 'normal' }}>Date</th>
            <th style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 'normal' }}>Type</th>
            <th style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 'normal' }}>USD</th>
            <th style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 'normal' }}>Amount</th>
            <th style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 'normal' }}>Price</th>
            <th style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 'normal' }}>Maker</th>
            <th style={{ padding: 'var(--space-2) var(--space-4)', fontWeight: 'normal', textAlign: 'center' }}>Txn</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td colSpan={7} style={{ padding: 'var(--space-3) var(--space-4)' }}>
                  <div
                    style={{
                      height: 16,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-elevated)',
                      animation: 'shimmer 1.5s infinite',
                    }}
                  />
                </td>
              </tr>
            ))
          ) : data?.trades.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
                No trades yet.
              </td>
            </tr>
          ) : (
            data?.trades.map((trade) => {
              const isBuy = trade.type === 'buy';
              const color = isBuy ? 'var(--buy)' : 'var(--sell)';
              const bgHover = isBuy ? 'var(--buy-dim)' : 'var(--sell-dim)';
              const price = trade.pricePerToken 
                ? trade.pricePerToken 
                : (trade.tokenAmount > 0 ? trade.solAmount / trade.tokenAmount : 0);

              const dateStr = new Date(trade.timestamp).toLocaleTimeString([], { hour12: false });

              return (
                <tr
                  key={trade.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    fontSize: '12px',
                    transition: 'background var(--duration-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = bgHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <td style={{ padding: 'var(--space-2) var(--space-4)', color: 'var(--text-muted)' }}>
                    {formatDate(trade.timestamp)} {dateStr}
                  </td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', color: color, textTransform: 'uppercase', fontWeight: 'bold' }}>
                    {trade.type}
                  </td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', color: color }}>
                    ${formatNumber(trade.solAmount, 2)}
                  </td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--text-primary)' }}>
                    {formatNumber(trade.tokenAmount, 0)}
                  </td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', color: color }}>
                    ${price < 0.0001 ? price.toFixed(8) : price.toFixed(7)}
                  </td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                    <Link
                      href={`/profile/${trade.walletAddress}`}
                      style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
                    >
                      {trade.walletHandle ? `@${trade.walletHandle}` : formatAddress(trade.walletAddress)}
                    </Link>
                  </td>
                  <td style={{ padding: 'var(--space-2) var(--space-4)', textAlign: 'center' }}>
                    <a
                      href={`https://testnet.bscscan.com/tx/${trade.txSignature}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center' }}
                      title="View Transaction"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
