'use client';

import React from 'react';
import Link from 'next/link';
import { useTickerStore } from '@/store/tickerStore';
import { useQuery } from '@tanstack/react-query';
import { fetchHomeActivity } from '@/lib/api';
import type { HomeActivity } from '@/lib/types';
import { useWatchlistStore } from '@/store/watchlistStore';

interface MarqueeItem {
  id: string;
  activity: HomeActivity;
}

function actor(activity: HomeActivity): string {
  return activity.username ? `@${activity.username}` : 'A user';
}

function activityText(activity: HomeActivity): string {
  const symbol = activity.tokenSymbol ? `$${activity.tokenSymbol}` : 'a token';
  switch (activity.type) {
    case 'buy': return `${actor(activity)} bought ${activity.usdt?.toFixed(2) ?? '0.00'} USDT of ${symbol}`;
    case 'sell': return `${actor(activity)} sold ${activity.usdt?.toFixed(2) ?? '0.00'} USDT of ${symbol}`;
    case 'comment': return `${actor(activity)} commented on ${symbol}`;
    case 'watch': return `${actor(activity)} is watching ${symbol}`;
    case 'follow': return `${actor(activity)} followed ${activity.followingUsername ? `@${activity.followingUsername}` : 'a creator'}`;
    case 'launch': return `${actor(activity)} launched ${symbol}`;
    default: return `New activity on ${symbol}`;
  }
}

function activityColor(type: HomeActivity['type']): string {
  if (type === 'buy') return 'var(--buy)';
  if (type === 'sell') return 'var(--sell)';
  if (type === 'launch') return 'var(--brand)';
  return 'var(--bg-elevated)';
}

export function MarqueeTicker() {
  const trades = useTickerStore((s) => s.trades);
  const watchedMints = useWatchlistStore((s) => s.watchlist);
  const { data: recentActivity } = useQuery({
    queryKey: ['homeActivity', watchedMints],
    queryFn: () => fetchHomeActivity(24),
    enabled: watchedMints.length > 0,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });

  const seen = new Set<string>();
  const items: MarqueeItem[] = [];
  const isWatched = (activity: HomeActivity) => Boolean(activity.tokenMint && watchedMints.includes(activity.tokenMint));

  for (const activity of recentActivity?.activities ?? []) {
    if (!isWatched(activity)) continue;
    if (seen.has(activity.id)) continue;
    seen.add(activity.id);
    items.push({ id: activity.id, activity });
    if (items.length >= 16) break;
  }

  for (const trade of trades) {
    if (!watchedMints.includes(trade.tokenMint)) continue;
    if (items.length >= 16 || seen.has(trade.id)) continue;
    seen.add(trade.id);
    items.push({
      id: trade.id,
      activity: {
        id: trade.id,
        type: trade.type,
        timestamp: trade.timestamp,
        walletAddress: trade.walletAddress,
        username: trade.walletHandle ?? null,
        tokenMint: trade.tokenMint,
        tokenSymbol: trade.tokenSymbol,
        tokenName: null,
        amount: trade.amount,
        usdt: trade.solAmount,
      },
    });
  }

  const doubled = items.length > 0 ? [...items, ...items] : [];
  if (doubled.length === 0) {
    return <div className="marquee-wrapper"><div className="marquee-track">Watch a token to see its activity...</div></div>;
  }

  return (
    <div className="marquee-wrapper" aria-label="Recent platform activity">
      <div className="marquee-track">
        {doubled.map((item, index) => {
          const content = (
            <div key={`${item.id}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', flexShrink: 0 }}>
              <span style={{ background: activityColor(item.activity.type), color: item.activity.type === 'watch' || item.activity.type === 'follow' || item.activity.type === 'comment' ? 'var(--text-primary)' : '#FFFFFF', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '2px 6px', borderRadius: 'var(--radius-sm)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {item.activity.type}
              </span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-secondary)' }}>
                {activityText(item.activity)}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>.</span>
            </div>
          );
          return item.activity.tokenMint ? (
            <Link key={`${item.id}-${index}`} href={`/token/${item.activity.tokenMint}`} style={{ textDecoration: 'none' }}>{content}</Link>
          ) : content;
        })}
      </div>
    </div>
  );
}
