'use client';

import React, { useRef, useState, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { useWatchlistStore } from '@/store/watchlistStore';

interface SwipeableCardProps {
  children: React.ReactNode;
  mint: string;
  onSwipeLeft?: () => void; // quick-buy
}

const SWIPE_THRESHOLD = 80;
const DRAG_ELASTIC = 0.4;

/**
 * SwipeableCard — wraps feed cards with swipe gesture support.
 * - Swipe right (> 80px): add/remove from watchlist
 * - Swipe left (> 80px): triggers onSwipeLeft callback (quick-buy)
 * - Visual feedback with revealed icons behind the card
 */
export function SwipeableCard({ children, mint, onSwipeLeft }: SwipeableCardProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeAction, setSwipeAction] = useState<'none' | 'watchlist' | 'buy'>('none');
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizontalRef = useRef(false);
  const hasTriggeredRef = useRef(false);

  const { isWatching, toggle } = useWatchlistStore();
  const isInWatchlist = isWatching(mint);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isHorizontalRef.current = false;
    hasTriggeredRef.current = false;
    setIsSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping) return;

    const deltaX = e.touches[0].clientX - startXRef.current;
    const deltaY = e.touches[0].clientY - startYRef.current;

    // Determine swipe direction on first significant move
    if (!isHorizontalRef.current && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      return;
    }

    if (!isHorizontalRef.current) {
      isHorizontalRef.current = Math.abs(deltaX) > Math.abs(deltaY);
      if (!isHorizontalRef.current) {
        // Vertical scroll — abort
        setIsSwiping(false);
        return;
      }
    }

    // Apply elastic drag resistance
    const elasticOffset = deltaX * DRAG_ELASTIC;
    setOffsetX(elasticOffset);

    // Update feedback
    if (elasticOffset > SWIPE_THRESHOLD * DRAG_ELASTIC) {
      setSwipeAction('watchlist');
    } else if (elasticOffset < -SWIPE_THRESHOLD * DRAG_ELASTIC) {
      setSwipeAction('buy');
    } else {
      setSwipeAction('none');
    }
  }, [isSwiping]);

  const handleTouchEnd = useCallback(() => {
    if (!hasTriggeredRef.current) {
      if (swipeAction === 'watchlist') {
        toggle(mint);
        hasTriggeredRef.current = true;
      } else if (swipeAction === 'buy' && onSwipeLeft) {
        onSwipeLeft();
        hasTriggeredRef.current = true;
      }
    }

    // Snap back
    setOffsetX(0);
    setIsSwiping(false);
    setSwipeAction('none');
  }, [swipeAction, mint, toggle, onSwipeLeft]);

  const watchlistTriggered = swipeAction === 'watchlist';
  const buyTriggered = swipeAction === 'buy';

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      {/* Left reveal: Watchlist heart (swipe right) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: watchlistTriggered ? 1 : 0.3,
          transition: isSwiping ? 'none' : 'opacity 200ms',
          pointerEvents: 'none',
        }}
      >
        <Heart
          size={28}
          fill={isInWatchlist ? 'var(--sell)' : watchlistTriggered ? 'var(--buy)' : 'none'}
          style={{
            color: watchlistTriggered ? 'var(--buy)' : 'var(--text-muted)',
            animation: watchlistTriggered ? 'swipeRevealRight 200ms var(--ease-spring)' : 'none',
          }}
        />
      </div>

      {/* Right reveal: Quick buy (swipe left) */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: buyTriggered ? 1 : 0.3,
          transition: isSwiping ? 'none' : 'opacity 200ms',
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '14px',
            color: buyTriggered ? 'var(--buy)' : 'var(--text-muted)',
            letterSpacing: '2px',
            animation: buyTriggered ? 'swipeRevealLeft 200ms var(--ease-spring)' : 'none',
          }}
        >
          BUY
        </span>
      </div>

      {/* Card content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isSwiping ? 'none' : 'transform 300ms var(--ease-spring)',
          position: 'relative',
          zIndex: 1,
          background: 'var(--bg-base)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
