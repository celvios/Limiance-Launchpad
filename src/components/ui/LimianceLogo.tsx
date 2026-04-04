'use client';

import React from 'react';

interface LimianceLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

/**
 * Limiance logo — the brand mark as an inline SVG.
 * Stylized blue "L" with an upward branch and rounded blob terminals.
 * Matches the Limiance brand identity exactly.
 */
export function LimianceLogo({ size = 32, className = '' }: LimianceLogoProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Limiance"
        style={{ display: 'block' }}
      >
        {/*
          Limiance logo — solid filled blue mark.
          Stylized "L" with upward-right branch and blob terminals.
        */}
        {/* Main body: vertical stem + curve down + branch up-right */}
        <path
          d={`
            M 28 12
            C 21 12, 16 17, 16 24
            L 16 48
            C 16 52, 18 55, 21 57
            L 38 70
            C 42 73, 44 77, 44 82
            C 44 89, 50 94, 57 94
            C 64 94, 69 89, 69 82
            C 69 75, 65 70, 60 67
            L 42 54
            C 38 52, 36 48, 36 44
            L 36 40
            L 50 30
            C 54 27, 58 24, 62 22
            C 66 20, 70 16, 70 11
            C 70 5, 65 1, 59 1
            C 53 1, 49 5, 49 11
            C 49 14, 48 17, 45 20
            L 36 28
            L 36 24
            C 36 17, 31 12, 28 12
            Z
          `}
          fill="var(--brand)"
        />
      </svg>
    </div>
  );
}
