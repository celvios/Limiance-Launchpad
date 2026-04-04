'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useCallback, useState } from 'react';
import { useTickerStore } from '@/store/tickerStore';
import { fetchTokenDetail } from '@/lib/api';

/**
 * useTokenPrice — combines polling with WebSocket trade events.
 * - Active tokens (trade in last 5min): poll RPC every 5s
 * - Inactive tokens: poll every 15s
 * - On WebSocket trade event for this token: update immediately
 * - Pauses polling when tab is hidden (VisibilityAPI)
 */
export function useTokenPrice(mint: string) {
  const queryClient = useQueryClient();
  const trades = useTickerStore((s) => s.trades);
  const lastProcessedRef = useRef<string | null>(null);
  const [isTabVisible, setIsTabVisible] = useState(true);

  // Track tab visibility — uses state so refetchInterval re-evaluates on change
  useEffect(() => {
    const handleVisibility = () => {
      setIsTabVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Check if there was a recent trade for this token
  const recentTradeForToken = trades.find((t) => t.tokenMint === mint);
  const hasRecentTrade = recentTradeForToken
    ? Date.now() - recentTradeForToken.timestamp < 300_000 // 5 minutes
    : false;

  // Poll interval depends on activity
  const refetchInterval = hasRecentTrade ? 5_000 : 15_000;

  const query = useQuery({
    queryKey: ['token-price', mint],
    queryFn: async () => {
      const detail = await fetchTokenDetail(mint);
      return {
        price: detail.price,
        priceChange24h: detail.priceChange24h,
        currentSupply: detail.currentSupply,
        marketCap: detail.marketCap,
        status: detail.status,
      };
    },
    staleTime: 3_000,
    refetchInterval: isTabVisible ? refetchInterval : false,
    enabled: !!mint,
  });

  // React to WebSocket trade events for this token — update immediately
  const handleWsTrade = useCallback(() => {
    if (!recentTradeForToken || recentTradeForToken.id === lastProcessedRef.current) return;
    lastProcessedRef.current = recentTradeForToken.id;

    // Optimistic price update from trade data
    queryClient.setQueryData(
      ['token-price', mint],
      (old: { price: number; priceChange24h: number; currentSupply: number; marketCap: number; status: string } | undefined) => {
        if (!old) return old;

        // Simple heuristic: buy = price up, sell = price down
        const impact = recentTradeForToken.type === 'buy'
          ? 1 + recentTradeForToken.solAmount * 0.001
          : 1 - recentTradeForToken.solAmount * 0.001;
        const newPrice = old.price * Math.max(0.1, impact);

        const supplyDelta = recentTradeForToken.type === 'buy'
          ? recentTradeForToken.amount
          : -recentTradeForToken.amount;

        return {
          ...old,
          price: newPrice,
          currentSupply: Math.max(0, old.currentSupply + supplyDelta),
          marketCap: newPrice * (old.currentSupply + supplyDelta),
        };
      }
    );

    // Also invalidate to get real data on next poll
    queryClient.invalidateQueries({ queryKey: ['token-detail', mint] });
  }, [mint, recentTradeForToken, queryClient]);

  useEffect(() => {
    handleWsTrade();
  }, [handleWsTrade]);

  return query;
}
