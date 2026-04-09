'use client';

import React from 'react';
import { useTickerStore } from '@/store/tickerStore';

interface MarqueeItem {
  id: string;
  type: 'new' | 'grad';
  symbol: string;
  creator?: string;
}

/**
 * Horizontal scrolling marquee ticker — Limiance Exchange signature element.
 * Shows live token launches and graduations below the TopBar.
 */
export function MarqueeTicker() {
  const trades = useTickerStore((s) => s.trades);

  // Build marquee items from recent trades — deduplicate by symbol
  const seen = new Set<string>();
  const items: MarqueeItem[] = [];
  for (const trade of trades) {
    if (seen.has(trade.tokenSymbol)) continue;
    seen.add(trade.tokenSymbol);
    items.push({
      id: trade.id,
      type: trade.type === 'buy' ? 'new' : 'new',
      symbol: trade.tokenSymbol,
      creator: trade.walletAddress?.slice(0, 6),
    });
    if (items.length >= 12) break;
  }

  // Fallback items when no real data
  const displayItems = items.length > 0 ? items : [
    { id: '1', type: 'new' as const, symbol: 'LAUNCH', creator: 'Limiance' },
    { id: '2', type: 'new' as const, symbol: 'SOL', creator: 'solana' },
    { id: '3', type: 'grad' as const, symbol: 'MOON', creator: 'trader1' },
    { id: '4', type: 'new' as const, symbol: 'ALPHA', creator: 'builder' },
    { id: '5', type: 'grad' as const, symbol: 'BETA', creator: 'dev' },
    { id: '6', type: 'new' as const, symbol: 'GAMMA', creator: 'anon' },
  ];

  // Double items for seamless loop
  const doubled = [...displayItems, ...displayItems];

  return (
    <div className="marquee-wrapper">
      <div className="marquee-track">
        {doubled.map((item, i) => (
          <div
            key={`${item.id}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {/* Badge */}
            <span
              style={{
                background: item.type === 'new' ? 'var(--brand)' : 'var(--graduation)',
                color: item.type === 'new' ? '#FFFFFF' : '#000000',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {item.type === 'new' ? '🟢 NEW' : '🎉 GRAD'}
            </span>

            {/* Token info */}
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 13,
                color: 'var(--text-secondary)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                ${item.symbol}
              </span>
              {item.type === 'new'
                ? ` just launched by @${item.creator}`
                : ` graduated to Raydium`}
            </span>

            {/* Separator dot */}
            <span
              style={{
                color: 'var(--text-muted)',
                fontSize: 10,
              }}
            >
              ·
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
