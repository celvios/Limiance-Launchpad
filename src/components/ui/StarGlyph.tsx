'use client';

import React from 'react';

interface StarGlyphProps {
  size?: number;
  opacity?: number;
  color?: string;
  style?: React.CSSProperties;
  animate?: boolean;
}

/**
 * Decorative star glyph — Limiance Exchange signature element.
 * Scattered asymmetrically at low opacity for spatial decoration.
 */
export function StarGlyph({
  size = 16,
  opacity = 0.12,
  color = 'var(--brand)',
  style,
  animate = false,
}: StarGlyphProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        fontSize: size,
        color,
        opacity,
        userSelect: 'none',
        pointerEvents: 'none',
        display: 'inline-block',
        ...(animate ? { animation: 'starFloat 4s ease-in-out infinite' } : {}),
        ...style,
      }}
    >
      ✦
    </span>
  );
}
