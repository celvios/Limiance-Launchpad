'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTickerStore, type TradeEvent, type GraduationEvent } from '@/store/tickerStore';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080';

// ── Mock trade data for simulated WS ──
const MOCK_SYMBOLS = ['PEPE', 'DOGE', 'MOON', 'FROG', 'BONK', 'GIGA', 'DEGEN', 'NEAR'];
const MOCK_MINTS = [
  '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  '6pVz9bE1hM3iK5oQ7sU9wY1aD3fH5jL7nP9rT1vX3zA',
  '9mWe3AG2xQ5oN7sU1wY3bD5fH7jL9nP1rT3vX5zA8Kp',
  '2nXo4RE6gU9qS3yW5dF7hJ1lN3pR5tV7xB9zD1cE3fG',
  'HnTe6PE8iW3sU5aY7fH9jL1nP3rT5vX7zB9cD1eF3gA',
];

function generateMockTrade(): TradeEvent {
  const idx = Math.floor(Math.random() * MOCK_SYMBOLS.length);
  const isBuy = Math.random() > 0.4;
  const amount = Math.floor(100 + Math.random() * 10000);
  const sol = parseFloat((amount * (0.00001 + Math.random() * 0.01)).toFixed(4));
  const isWhale = sol > 10;

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let wallet = '';
  for (let i = 0; i < 44; i++) wallet += chars[Math.floor(Math.random() * chars.length)];

  return {
    id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: isBuy ? 'buy' : 'sell',
    tokenMint: MOCK_MINTS[idx % MOCK_MINTS.length],
    tokenSymbol: MOCK_SYMBOLS[idx],
    amount,
    solAmount: sol,
    walletAddress: wallet,
    txSignature: `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    isWhale,
  };
}

/**
 * WebSocket client hook — connects to Forge's WS server or runs a mock simulator.
 * Feeds into tickerStore ring buffer. Auto-reconnects with exponential backoff.
 */
export function useTradeTicker() {
  const addTrade = useTickerStore((s) => s.addTrade);
  const setWsStatus = useTickerStore((s) => s.setWsStatus);
  const wsRef = useRef<WebSocket | null>(null);
  const mockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryRef = useRef(0);
  const mountedRef = useRef(true);

  const handleGraduation = useCallback((event: GraduationEvent) => {
    // Dispatch graduation via BroadcastChannel for cross-tab notification
    try {
      const channel = new BroadcastChannel('launchpad-events');
      channel.postMessage({ type: 'graduation', data: event });
      channel.close();
    } catch {
      // BroadcastChannel not supported
    }

    // Also dispatch a custom DOM event so the token page can pick it up
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('token-graduation', { detail: event })
      );
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (USE_MOCK) {
      // Mock WS simulator — generate random trades every 2-4 seconds
      setWsStatus('connected');

      // Immediately populate with 5 initial trades
      for (let i = 0; i < 5; i++) {
        const trade = generateMockTrade();
        trade.timestamp = Date.now() - (5 - i) * 3000;
        addTrade(trade);
      }

      const tick = () => {
        if (!mountedRef.current) return;
        addTrade(generateMockTrade());
      };

      // Random interval between 2-4s
      const setupInterval = () => {
        const delay = 2000 + Math.random() * 2000;
        mockIntervalRef.current = setTimeout(() => {
          tick();
          if (mountedRef.current) setupInterval();
        }, delay) as unknown as ReturnType<typeof setInterval>;
      };

      setupInterval();

      return () => {
        mountedRef.current = false;
        if (mockIntervalRef.current) clearTimeout(mockIntervalRef.current as unknown as number);
      };
    }

    // Real WebSocket connection
    const connect = () => {
      if (!mountedRef.current) return;

      setWsStatus('reconnecting');
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        retryRef.current = 0;
        setWsStatus('connected');
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data) as TradeEvent | GraduationEvent;
          if ('type' in data && data.type === 'graduation') {
            handleGraduation(data as GraduationEvent);
          } else {
            addTrade(data as TradeEvent);
          }
        } catch {
          // malformed message
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setWsStatus('disconnected');
        // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
        const delay = Math.min(1000 * Math.pow(2, retryRef.current), 30000);
        retryRef.current += 1;
        setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      mountedRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [addTrade, setWsStatus, handleGraduation]);
}
