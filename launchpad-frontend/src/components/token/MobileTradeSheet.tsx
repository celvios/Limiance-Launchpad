'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TradePanel } from '@/components/token/TradePanel';
import type { TokenDetail } from '@/lib/types';

interface MobileTradeSheetProps {
  token: TokenDetail;
  mode: 'buy' | 'sell';
  isOpen: boolean;
  onClose: () => void;
}

/**
 * MobileTradeSheet — bottom sheet overlay for mobile trading.
 * Slides up from bottom, covers 65% of viewport, dismissible by:
 * - Backdrop tap
 * - Drag handle pull-down
 * - Close button
 */
export function MobileTradeSheet({ token, isOpen, onClose }: MobileTradeSheetProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    startYRef.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientY - startYRef.current;
    // Only allow dragging downward
    if (delta > 0) {
      setDragOffset(delta);
    }
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    // Dismiss if dragged more than 100px
    if (dragOffset > 100) {
      onClose();
    }
    setDragOffset(0);
  }, [dragOffset, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--overlay-soft)',
          zIndex: 50,
          animation: 'fadeIn 200ms var(--ease-default)',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '65vh',
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
          zIndex: 51,
          display: 'flex',
          flexDirection: 'column',
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging ? 'none' : 'transform 350ms var(--ease-default)',
          animation: 'slideUpSheet 350ms var(--ease-default)',
        }}
      >
        {/* Drag handle */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: 'var(--space-3)',
            cursor: 'grab',
          }}
        >
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--border-active)',
            }}
          />
        </div>

        {/* Trade panel content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 var(--space-4) var(--space-4)',
          }}
        >
          <TradePanel token={token} />
        </div>
      </div>
    </>
  );
}
