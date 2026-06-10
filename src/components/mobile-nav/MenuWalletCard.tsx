'use client';

import React from 'react';
import { useWallet } from '@/providers/BscWalletProvider';
import { useProfileTokens, useProfileHoldings } from '@/hooks/useProfile';

export function MenuWalletCard() {
  const { address } = useWallet();

  const { data: tokens } = useProfileTokens(address || '');
  const { data: holdings } = useProfileHoldings(address || '');

  // Sum the real USDT value of every holding
  const portfolioValue = holdings?.holdings?.reduce((sum, h) => sum + h.value, 0) ?? 0;
  const realTokensHeld = holdings?.holdings?.length || 0;
  const realCreated = tokens?.length || 0;
  const realGraduated = tokens?.filter((t: any) => t.isGraduated).length || 0;

  if (!address) return null;

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}
    >
      {/* Portfolio Value */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Portfolio Value
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', color: 'var(--buy)', fontWeight: 600 }}>
            {portfolioValue > 0 ? `$${portfolioValue.toFixed(2)}` : '—'}
          </div>
        </div>
      </div>

      {/* Bottom Row: Stats Trio */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Tokens Held
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>
            {realTokensHeld}
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Created
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>
            {realCreated}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Graduated
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: realGraduated > 0 ? 'var(--graduation)' : 'var(--text-muted)', fontWeight: 600 }}>
            {realGraduated}
          </div>
        </div>
      </div>
    </div>
  );
}



