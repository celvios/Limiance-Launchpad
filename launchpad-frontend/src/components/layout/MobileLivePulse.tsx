'use client';

import React, { useEffect, useState } from 'react';
import { useTickerStore } from '@/store/tickerStore';
import { useUIStore } from '@/store/uiStore';
import { formatTimeAgo } from '@/lib/format';

export function MobileLivePulse() {
  const trades = useTickerStore((s) => s.trades);
  const setLiveActivitySheetOpen = useUIStore((s) => s.setLiveActivitySheetOpen);
  const latestTrade = trades[0];

  const [animating, setAnimating] = useState(false);
  const [displayedTradeId, setDisplayedTradeId] = useState<string | null>(null);

  // Trigger re-animation when trade changes
  useEffect(() => {
    if (latestTrade && latestTrade.id !== displayedTradeId) {
      setAnimating(true);
      setDisplayedTradeId(latestTrade.id);
      const timer = setTimeout(() => setAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [latestTrade, displayedTradeId]);

  if (!latestTrade) return null;

  const shortAddress = `${latestTrade.walletAddress.slice(0, 4)}...${latestTrade.walletAddress.slice(-2)}`;
  const textString = `@${shortAddress} ${latestTrade.type} ${latestTrade.solAmount} SOL of $${latestTrade.tokenSymbol} · ${formatTimeAgo(latestTrade.timestamp)}`;

  return (
    <div
      onClick={() => setLiveActivitySheetOpen(true)}
      className="md:hidden"
      style={{
        position: 'fixed',
        bottom: 'calc(64px + env(safe-area-inset-bottom))', /* Above BottomNav */
        left: 0,
        right: 0,
        height: '36px',
        background: 'var(--bg-elevated)',
        borderTop: '1px solid var(--border)',
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--space-4)',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--buy)',
          flexShrink: 0,
          marginRight: 'var(--space-3)',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--buy)',
            animation: 'pulseOp 1.5s infinite var(--ease-default)',
          }}
        />
        LIVE
      </div>

      <div style={{ flex: 1, position: 'relative', height: '100%' }}>
        <div
          key={latestTrade.id}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            fontFamily: 'var(--font-ui)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            animation: animating ? 'slideInRight 300ms var(--ease-spring)' : 'none',
          }}
        >
          {textString}
        </div>
      </div>

      <style jsx>{`
        @keyframes pulseOp {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
