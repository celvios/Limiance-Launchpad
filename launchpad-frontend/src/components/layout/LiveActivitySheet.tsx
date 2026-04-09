'use client';

import React, { useEffect, useCallback } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useTickerStore } from '@/store/tickerStore';
import { TickerRow } from '@/components/layout/LiveTicker';
import { X } from 'lucide-react';

export function LiveActivitySheet() {
  const isLiveActivitySheetOpen = useUIStore((s) => s.isLiveActivitySheetOpen);
  const setLiveActivitySheetOpen = useUIStore((s) => s.setLiveActivitySheetOpen);
  const trades = useTickerStore((s) => s.trades);
  const wsStatus = useTickerStore((s) => s.wsStatus);

  const statusColor = wsStatus === 'connected'
    ? 'var(--buy)'
    : wsStatus === 'reconnecting'
      ? 'var(--graduation)'
      : 'var(--sell)';

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLiveActivitySheetOpen(false);
    },
    [setLiveActivitySheetOpen]
  );

  useEffect(() => {
    if (isLiveActivitySheetOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden'; // prevent feed scroll
    } else {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isLiveActivitySheetOpen, handleKeyDown]);

  if (!isLiveActivitySheetOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 55, // Above mobile nav but below modals/toasts
        display: 'flex',
        flexDirection: 'column',
      }}
      className="md:hidden"
    >
      {/* Backdrop */}
      <div
        onClick={() => setLiveActivitySheetOpen(false)}
        style={{
          flex: 1,
          background: 'var(--overlay-soft)',
          animation: 'fadeIn 200ms var(--ease-default)',
        }}
      />

      {/* Sheet Content */}
      <div
        style={{
          height: '70dvh',
          background: 'var(--bg-panel)',
          borderTopLeftRadius: 'var(--radius-xl)',
          borderTopRightRadius: 'var(--radius-xl)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUpSheet 300ms var(--ease-spring)',
          boxShadow: 'var(--shadow-modal)',
          position: 'relative',
        }}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '18px',
                color: 'var(--text-primary)',
                letterSpacing: '1px',
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
                boxShadow: wsStatus === 'connected' ? '0 0 8px var(--buy)' : 'none',
              }}
            />
          </div>

          <button
            onClick={() => setLiveActivitySheetOpen(false)}
            aria-label="Close sheet"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Trade Stream */}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
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
              <TickerRow key={trade.id} trade={trade} index={index} isPaused={false} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
