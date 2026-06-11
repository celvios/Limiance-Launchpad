'use client';

import React from 'react';
import { useTickerStore } from '@/store/tickerStore';
import { useQuery } from '@tanstack/react-query';
import { fetchFeedTokens } from '@/lib/api';

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
  
  // Fetch real recent tokens as fallback/initial data
  const { data: recentTokens } = useQuery({
    queryKey: ['marqueeFallback'],
    queryFn: () => fetchFeedTokens({ filter: 'new', limit: 10 }),
    staleTime: 60_000,
  });

  // Build marquee items from recent trades — deduplicate by symbol
  const seen = new Set<string>();
  const items: MarqueeItem[] = [];
  
  // First add live trades from WebSocket
  for (const trade of trades) {
    if (seen.has(trade.tokenSymbol)) continue;
    seen.add(trade.tokenSymbol);
    items.push({
      id: trade.id,
      type: trade.type === 'buy' ? 'new' : 'new', // or map 'grad' if you have grad events
      symbol: trade.tokenSymbol,
      creator: trade.walletAddress?.slice(0, 6),
    });
    if (items.length >= 12) break;
  }

  // Then backfill with real tokens from the API if we don't have enough
  if (items.length < 12 && recentTokens?.tokens) {
    for (const token of recentTokens.tokens) {
      if (seen.has(token.symbol)) continue;
      seen.add(token.symbol);
      items.push({
        id: token.mint,
        type: token.status === 'graduated' ? 'grad' : 'new',
        symbol: token.symbol,
        creator: token.creator.slice(0, 6),
      });
      if (items.length >= 12) break;
    }
  }

  // If literally nothing exists (empty DB and no trades), show empty array
  const displayItems = items;

  // Double items for seamless loop (only if we have items)
  const doubled = displayItems.length > 0 ? [...displayItems, ...displayItems] : [];

  if (doubled.length === 0) {
    return <div className="marquee-wrapper"><div className="marquee-track">Waiting for trades...</div></div>;
  }

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
                : ` graduated to PancakeSwap`}
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

