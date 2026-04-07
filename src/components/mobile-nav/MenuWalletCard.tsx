'use client';

import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

export function MenuWalletCard() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();

  const { data: balance } = useQuery({
    queryKey: ['sol-balance', publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return 0;
      const lamports = await connection.getBalance(publicKey);
      return lamports / LAMPORTS_PER_SOL;
    },
    enabled: !!publicKey,
    refetchInterval: 15000,
  });

  // Since we don't have a real backend to fetch these for now, we'll use mocked data that looks exactly like the design.
  const portfolioValue = balance ? balance * 2.4 : 0; // Mock multiplier
  const mockTokensHeld = 8;
  const mockCreated = 3;
  const mockGraduated = 1;

  if (!publicKey) return null;

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
            SOL Balance
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', color: '#FFFFFF', fontWeight: 600 }}>
            {balance !== undefined ? `${balance.toFixed(2)} SOL` : '— SOL'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Portfolio Value
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', color: 'var(--buy)', fontWeight: 600 }}>
            {portfolioValue > 0 ? `${portfolioValue.toFixed(1)} SOL` : '— SOL'}
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
            {mockTokensHeld}
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Created
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>
            {mockCreated}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Graduated
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: mockGraduated > 0 ? 'var(--graduation)' : 'var(--text-muted)', fontWeight: 600 }}>
            {mockGraduated}
          </div>
        </div>
      </div>
    </div>
  );
}
