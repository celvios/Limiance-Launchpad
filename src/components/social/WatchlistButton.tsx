'use client';

import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { addTokenToWatchlist, removeTokenFromWatchlist } from '@/lib/api';
import { getAuthToken } from '@/lib/session';
import { useWallet } from '@/providers/BscWalletProvider';
import { useWatchlistStore } from '@/store/watchlistStore';
import { useUIStore } from '@/store/uiStore';

interface WatchlistButtonProps {
  mint: string;
  size?: number;
}

export function WatchlistButton({ mint, size = 18 }: WatchlistButtonProps) {
  const { isWatching, toggle } = useWatchlistStore();
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const [isAnimating, setIsAnimating] = useState(false);
  const watched = isWatching(mint);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nextWatched = !watched;
    toggle(mint);
    if (nextWatched) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 400);
    }

    const token = address ? getAuthToken(address) : null;
    if (!address || !token) return;

    try {
      if (nextWatched) {
        await addTokenToWatchlist(address, mint, token);
      } else {
        await removeTokenFromWatchlist(address, mint, token);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['feed'] }),
        queryClient.invalidateQueries({ queryKey: ['token-detail', mint] }),
        queryClient.invalidateQueries({ queryKey: ['explore'] }),
      ]);
    } catch (error) {
      toggle(mint);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to update watchlist',
      });
      console.error('[WatchlistButton] Failed to sync watchlist:', error);
    }
  };

  return (
    <button
      onClick={handleClick}
      aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 'var(--space-1)',
        color: watched ? 'var(--sell)' : 'var(--text-muted)',
        transition: 'color var(--duration-fast), transform var(--duration-fast)',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: isAnimating ? 'scale(1.3)' : 'scale(1)',
      }}
      onMouseEnter={(e) => {
        if (!watched) {
          e.currentTarget.style.color = 'var(--text-secondary)';
        }
      }}
      onMouseLeave={(e) => {
        if (!watched) {
          e.currentTarget.style.color = 'var(--text-muted)';
        }
      }}
    >
      <Heart
        size={size}
        fill={watched ? 'var(--sell)' : 'none'}
        strokeWidth={watched ? 0 : 2}
      />
    </button>
  );
}
