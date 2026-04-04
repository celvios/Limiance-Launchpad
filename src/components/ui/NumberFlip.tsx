'use client';

import React, { useEffect, useRef, useState, memo } from 'react';

interface NumberFlipProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
}

/**
 * NumberFlip — each digit is a column that slides up/down on value change.
 * Upward slide if value increasing, downward if decreasing.
 * After settle: digit background flashes buy-dim or sell-dim for 800ms.
 */
export const NumberFlip = memo(function NumberFlip({
  value,
  decimals = 6,
  prefix = '',
  suffix = '',
  fontSize = 14,
  fontFamily = 'var(--font-mono)',
  color = 'var(--text-primary)',
}: NumberFlipProps) {
  const prevValueRef = useRef(value);
  const [displayDigits, setDisplayDigits] = useState<string[]>([]);
  const [animatingIndices, setAnimatingIndices] = useState<Set<number>>(new Set());
  const [direction, setDirection] = useState<'up' | 'down'>('up');
  const [flashColor, setFlashColor] = useState<string | null>(null);

  useEffect(() => {
    const formatted = formatValue(value, decimals);
    const chars = formatted.split('');
    setDisplayDigits(chars);

    if (prevValueRef.current !== value) {
      const isUp = value > prevValueRef.current;
      setDirection(isUp ? 'up' : 'down');

      // Find which digits changed
      const prevFormatted = formatValue(prevValueRef.current, decimals);
      const prevChars = prevFormatted.split('');
      const changed = new Set<number>();
      for (let i = 0; i < Math.max(chars.length, prevChars.length); i++) {
        if (chars[i] !== prevChars[i]) {
          changed.add(i);
        }
      }
      setAnimatingIndices(changed);

      // Flash background
      setFlashColor(isUp ? 'var(--buy-dim)' : 'var(--sell-dim)');
      const flashTimer = setTimeout(() => setFlashColor(null), 800);

      // Clear animation after settle
      const animTimer = setTimeout(() => setAnimatingIndices(new Set()), 350);

      prevValueRef.current = value;

      return () => {
        clearTimeout(flashTimer);
        clearTimeout(animTimer);
      };
    }

    prevValueRef.current = value;
  }, [value, decimals]);

  const digitHeight = fontSize * 1.3;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily,
        fontSize: `${fontSize}px`,
        color,
        borderRadius: 'var(--radius-sm)',
        padding: '0 2px',
        backgroundColor: flashColor ?? 'transparent',
        transition: 'background-color 400ms',
      }}
    >
      {prefix && <span>{prefix}</span>}
      {displayDigits.map((char, i) => {
        const isAnimating = animatingIndices.has(i);
        const isDigit = /\d/.test(char);

        if (!isDigit || !isAnimating) {
          return (
            <span key={`${i}-${char}`} style={{ display: 'inline-block' }}>
              {char}
            </span>
          );
        }

        return (
          <span
            key={`${i}-${char}`}
            style={{
              display: 'inline-block',
              height: `${digitHeight}px`,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                animation: `${direction === 'up' ? 'digitSlideUp' : 'digitSlideDown'} 300ms var(--ease-default) both`,
                animationDelay: `${(i % 6) * 30}ms`,
              }}
            >
              {char}
            </span>
          </span>
        );
      })}
      {suffix && <span>{suffix}</span>}
    </span>
  );
});

function formatValue(val: number, decimals: number): string {
  if (val < 0.001) return val.toFixed(decimals);
  if (val < 1) return val.toFixed(Math.min(decimals, 4));
  return val.toFixed(2);
}
