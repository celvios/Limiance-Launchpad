'use client';

import React, { useState, memo } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { useTickerStore, type TradeEvent } from '@/store/tickerStore';
import { formatNumber, formatTimeAgo } from '@/lib/format';

export function LiveTicker() {
  const trades = useTickerStore((s) => s.trades);
  const wsStatus = useTickerStore((s) => s.wsStatus);
  const [isPaused, setIsPaused] = useState(false);

  const statusColor = wsStatus === 'connected'
    ? 'var(--buy)'
    : wsStatus === 'reconnecting'
      ? 'var(--graduation)'
      : 'var(--sell)';

  const statusGlow = wsStatus === 'connected'
    ? '0 0 8px var(--buy)'
    : wsStatus === 'reconnecting'
      ? '0 0 8px var(--graduation)'
      : 'none';

  return (
    <aside
      id="live-ticker"
      style={{
        width: '320px',
        height: '100vh',
        position: 'sticky',
        top: 0,
        borderLeft: '1px solid rgba(59, 130, 246, 0.08)',
        background: '#080b14',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflowY: 'auto',
      }}
      className="ticker-desktop"
    >
      {/* Header */}
      <div
        style={{
          padding: 'var(--space-4)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '18px',
            color: 'var(--text-primary)',
            letterSpacing: '2px',
          }}
        >
          LIVE TRADES
        </h3>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColor,
            boxShadow: statusGlow,
            transition: 'all var(--duration-base)',
          }}
          title={`WebSocket: ${wsStatus}`}
        />
      </div>

      {/* Trade rows */}
      <div
        style={{ flex: 1, overflowY: 'auto' }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {trades.length === 0 ? (
          <div
            style={{
              padding: 'var(--space-6)',
              textAlign: 'center',
              fontFamily: 'var(--font-ui)',
              fontSize: '13px',
              color: 'var(--text-muted)',
            }}
          >
            Waiting for trades...
          </div>
        ) : (
          trades.map((trade, index) => (
            <TickerRow key={trade.id} trade={trade} index={index} isPaused={isPaused} />
          ))
        )}
      </div>
    </aside>
  );
}

const TickerRow = memo(function TickerRow({
  trade,
  index,
  isPaused,
}: {
  trade: TradeEvent;
  index: number;
  isPaused: boolean;
}) {
  const isNew = index < 3 && Date.now() - trade.timestamp < 10_000;

  return (
    <Link
      href={`/token/${trade.tokenMint}`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-3) var(--space-4)',
          background: trade.isWhale ? 'var(--bg-elevated)' : 'var(--bg-card)',
          cursor: 'pointer',
          transition: 'background var(--duration-fast)',
          borderBottom: '1px solid var(--border)',
          // Animate only the newest entries
          ...(isNew
            ? {
                animation: 'tradeEnter 300ms var(--ease-default) both',
              }
            : {}),
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-elevated)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = trade.isWhale
            ? 'var(--bg-elevated)'
            : 'var(--bg-card)';
        }}
      >
        {trade.isWhale && <span style={{ fontSize: '12px' }}>🐋</span>}
        <Badge variant={trade.type}>{trade.type.toUpperCase()}</Badge>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            color: 'var(--text-primary)',
            fontWeight: 600,
          }}
        >
          ${trade.tokenSymbol}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: trade.type === 'buy' ? 'var(--buy)' : 'var(--sell)',
            flex: 1,
          }}
        >
          {trade.type === 'buy' ? '+' : '-'}
          {formatNumber(trade.amount, 0)}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-muted)',
          }}
        >
          {trade.solAmount.toFixed(2)} SOL
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--text-muted)',
          }}
        >
          {formatTimeAgo(trade.timestamp)}
        </span>
      </div>
    </Link>
  );
});
