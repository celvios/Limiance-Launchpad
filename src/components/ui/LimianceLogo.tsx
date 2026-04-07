'use client';

import React from 'react';
import Image from 'next/image';

interface LimianceLogoProps {
  /** Controls the height of the logo in px. Width auto-scales from aspect ratio (~3.5:1). */
  size?: number;
  showText?: boolean;
  className?: string;
}

/**
 * Limiance / Afriq logo — renders the full brand mark (icon + wordmark) from /logo.png.
 * The image already contains the "Limiance" text, so no separate text label is needed.
 * Uses mix-blend-mode: lighten to seamlessly blend with any dark background.
 */
export function LimianceLogo({ size = 32, className = '' }: LimianceLogoProps) {
  // The logo image is roughly 3.5:1 aspect ratio (wide with wordmark)
  const width = Math.round(size * 3.5);

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      <Image
        src="/logo.png"
        alt="Limiance Logo"
        width={width}
        height={size}
        style={{
          display: 'block',
          objectFit: 'contain',
          mixBlendMode: 'lighten',
        }}
        priority
      />
    </div>
  );
}
