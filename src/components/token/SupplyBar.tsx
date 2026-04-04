'use client';

import React, { useEffect, useState } from 'react';
import { formatNumber } from '@/lib/format';

interface SupplyBarProps {
  currentSupply: number;
  graduationThreshold: number;
  isGraduated: boolean;
}

export function SupplyBar({ currentSupply, graduationThreshold, isGraduated }: SupplyBarProps) {
  const [animatedWidth, setAnimatedWidth] = useState(0);
  const percent = Math.min((currentSupply / graduationThreshold) * 100, 100);
  const remaining = graduationThreshold - currentSupply;
  const isNearGrad = percent >= 75 && !isGraduated;
  const isPulsing = percent > 90 && !isGraduated;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedWidth(percent), 200);
    return () => clearTimeout(timer);
  }, [percent]);

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          marginBottom: 'var(--space-2)',
        }}
      >
        Supply:{' '}
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
          {formatNumber(currentSupply, 0)}
        </span>{' '}
        /{' '}
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          {formatNumber(graduationThreshold, 0)}
        </span>{' '}
        tokens minted
      </div>

      {/* Bar */}
      <div
        style={{
          width: '100%',
          height: 12,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 'var(--radius-sm)',
            width: `${animatedWidth}%`,
            background: isNearGrad || isGraduated ? 'var(--graduation)' : 'var(--buy)',
            transition: 'width 800ms var(--ease-default)',
            ...(isPulsing ? { animation: 'supplyPulse 2s infinite' } : {}),
          }}
        />
      </div>

      {/* Label */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          color: 'var(--text-muted)',
          marginTop: 'var(--space-2)',
        }}
      >
        {isGraduated
          ? '✓ Graduated to Raydium'
          : `${percent.toFixed(0)}% · ${formatNumber(remaining, 0)} tokens to Raydium graduation`}
      </div>
    </div>
  );
}
