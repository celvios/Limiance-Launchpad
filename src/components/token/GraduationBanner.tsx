'use client';

import React from 'react';
import { Rocket, ExternalLink } from 'lucide-react';

interface GraduationBannerProps {
  isGraduated: boolean;
  isNearGrad: boolean;
  supplyPercent: number;
  raydiumPoolAddress: string | null;
}

export function GraduationBanner({
  isGraduated,
  isNearGrad,
  supplyPercent,
  raydiumPoolAddress,
}: GraduationBannerProps) {
  if (!isGraduated && !isNearGrad) return null;

  if (isGraduated) {
    return (
      <div
        style={{
          background: `linear-gradient(90deg, var(--graduation-dim) 0%, transparent 100%)`,
          border: '1px solid var(--graduation)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
      >
        <Rocket
          size={24}
          style={{ color: 'var(--graduation)', flexShrink: 0 }}
        />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '16px',
              color: 'var(--graduation)',
              letterSpacing: '1px',
            }}
          >
            GRADUATED TO RAYDIUM
          </div>
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              marginTop: 'var(--space-1)',
            }}
          >
            This token has reached its graduation threshold and is now trading on Raydium DEX.
          </div>
        </div>
        {raydiumPoolAddress && (
          <a
            href={`https://raydium.io/swap/?inputMint=sol&outputMint=${raydiumPoolAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: 'var(--space-2) var(--space-4)',
              background: 'var(--graduation)',
              color: 'var(--bg-base)',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              fontFamily: 'var(--font-ui)',
              fontSize: '13px',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            Trade on Raydium
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    );
  }

  // Near graduation
  return (
    <div
      style={{
        background: `linear-gradient(90deg, var(--graduation-dim) 0%, transparent 100%)`,
        border: '1px solid var(--graduation)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-3) var(--space-4)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        animation: 'supplyPulse 3s infinite',
      }}
    >
      <Rocket
        size={20}
        style={{ color: 'var(--graduation)', flexShrink: 0 }}
      />
      <div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '14px',
            color: 'var(--graduation)',
            letterSpacing: '1px',
          }}
        >
          NEARING GRADUATION
        </div>
        <div
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginTop: '2px',
          }}
        >
          {supplyPercent.toFixed(0)}% of supply minted. Raydium graduation incoming!
        </div>
      </div>
    </div>
  );
}
