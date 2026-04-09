'use client';

import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { useWatchlistStore } from '@/store/watchlistStore';

interface WatchlistButtonProps {
  mint: string;
  size?: number;
}

export function WatchlistButton({ mint, size = 18 }: WatchlistButtonProps) {
  const { isWatching, toggle } = useWatchlistStore();
  const [isAnimating, setIsAnimating] = useState(false);
  const watched = isWatching(mint);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(mint);
    if (!watched) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 400);
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
