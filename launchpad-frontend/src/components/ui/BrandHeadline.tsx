'use client';

import React from 'react';

interface BrandHeadlineProps {
  before: string;
  highlight: string;
  after?: string;
  as?: 'h1' | 'h2' | 'h3';
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Limiance brand headline — one word per headline gets brand blue.
 * Pattern from Limiance Exchange: "The Most **Trusted** Platform"
 */
export function BrandHeadline({
  before,
  highlight,
  after,
  as: Tag = 'h2',
  size = 28,
  className = '',
  style,
}: BrandHeadlineProps) {
  return (
    <Tag
      className={className}
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: size,
        fontWeight: 700,
        color: 'var(--text-primary)',
        letterSpacing: '0.5px',
        lineHeight: 1.2,
        ...style,
      }}
    >
      {before}{' '}
      <span style={{ color: 'var(--brand)' }}>{highlight}</span>
      {after && ` ${after}`}
    </Tag>
  );
}
