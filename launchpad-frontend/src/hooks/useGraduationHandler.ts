'use client';

import { useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/store/uiStore';
import type { GraduationEvent } from '@/store/tickerStore';

/**
 * useGraduationHandler — listens for graduation events from WS + BroadcastChannel.
 * Fires the full graduation animation sequence defined in Phase 3 spec.
 * Optionally scoped to a specific mint — if null, listens for all graduations.
 */
export function useGraduationHandler(mint: string | null = null) {
  const queryClient = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const processingRef = useRef(false);

  const fireGraduation = useCallback(
    async (event: GraduationEvent) => {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        // 1. (200ms) Flash overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
          position: fixed; inset: 0; z-index: 9999;
          background: var(--graduation); opacity: 0;
          pointer-events: none; transition: opacity 150ms;
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => {
          overlay.style.opacity = '0.3';
        });
        await sleep(200);
        overlay.style.opacity = '0';
        await sleep(200);
        overlay.remove();

        // 2. (300ms) Update token status in cache
        queryClient.setQueryData(
          ['token-detail', event.tokenMint],
          (old: Record<string, unknown> | undefined) => {
            if (!old) return old;
            return { ...old, status: 'graduated' };
          }
        );
        queryClient.setQueryData(
          ['token-price', event.tokenMint],
          (old: Record<string, unknown> | undefined) => {
            if (!old) return old;
            return { ...old, status: 'graduated' };
          }
        );

        // 3. (400ms) Confetti burst
        await sleep(100);
        confetti({
          particleCount: 80,
          spread: 70,
          colors: ['#00FF66', '#FF2D55', '#FFE500'],
          origin: { y: 0.6 },
          disableForReducedMotion: true,
        });

        // 4. (800ms) Toast
        await sleep(400);
        addToast({
          type: 'success',
          message: `🎉 $${event.tokenSymbol} graduated to Raydium!`,
          duration: 8000,
        });

        // 5. Invalidate queries so UI refreshes
        queryClient.invalidateQueries({ queryKey: ['token-detail', event.tokenMint] });
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        queryClient.invalidateQueries({ queryKey: ['explore'] });
      } finally {
        processingRef.current = false;
      }
    },
    [queryClient, addToast]
  );

  useEffect(() => {
    // Listen for graduation events via CustomEvent (from useTradeTicker)
    const handleCustomEvent = (e: Event) => {
      const detail = (e as CustomEvent<GraduationEvent>).detail;
      if (mint && detail.tokenMint !== mint) return;
      fireGraduation(detail);
    };

    window.addEventListener('token-graduation', handleCustomEvent);

    // Listen for cross-tab graduation events via BroadcastChannel
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('launchpad-events');
      channel.onmessage = (event) => {
        if (event.data?.type === 'graduation') {
          const gradEvent = event.data.data as GraduationEvent;
          if (mint && gradEvent.tokenMint !== mint) return;
          fireGraduation(gradEvent);
        }
      };
    } catch {
      // BroadcastChannel not supported
    }

    return () => {
      window.removeEventListener('token-graduation', handleCustomEvent);
      channel?.close();
    };
  }, [mint, fireGraduation]);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
