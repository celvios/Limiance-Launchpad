'use client';

import React from 'react';
import { useWallet } from '@/providers/BscWalletProvider';
import { useConnection } from '@/providers/BscWalletProvider';
import { useQuery } from '@tanstack/react-query';
import { useProfileTokens, useProfileHoldings, useProfileNetworth } from '@/hooks/useProfile';

export function MenuWalletCard() {
  const { address } = useWallet();
  const { connection } = useConnection();

  const { data: balance } = useQuery({
    queryKey: ['bnb-balance', address],
    queryFn: async () => {
      if (!address) return 0;
      const wei = await connection.getBalance(address);
      return wei / 1e18;
    },
    enabled: !!address,
    refetchInterval: 15000,
  });

  const { data: networth } = useProfileNetworth(address || '');
  const { data: tokens } = useProfileTokens(address || '');
  const { data: holdings } = useProfileHoldings(address || '');

  const portfolioValue = networth && networth.length > 0 ? networth[networth.length - 1].value : 0;
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
      {/* Top Row: Balance & Portfolio */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Gas Balance
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', color: '#FFFFFF', fontWeight: 600 }}>
            {balance !== undefined ? `${balance.toFixed(2)} BNB gas` : '— BNB gas'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Portfolio Value
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', color: 'var(--buy)', fontWeight: 600 }}>
            {portfolioValue > 0 ? `${portfolioValue.toFixed(1)} USDT` : '— USDT'}
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



