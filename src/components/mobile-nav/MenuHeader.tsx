'use client';

import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Copy, ExternalLink, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { formatAddress } from '@/lib/format';
import { useUIStore } from '@/store/uiStore';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { LimianceLogo } from '@/components/ui/LimianceLogo';

export function MenuHeader() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const { addToast } = useUIStore();

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

  const handleCopy = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      addToast({ type: 'success', message: 'Address copied to clipboard' });
    }
  };

  const handleSolscan = () => {
    if (publicKey) {
      window.open(`https://solscan.io/account/${publicKey.toBase58()}`, '_blank');
    }
  };

  if (!connected || !publicKey) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-6) var(--space-4) var(--space-5)',
          gap: 'var(--space-5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <LimianceLogo size={32} />
        </div>
        <ConnectButton />
      </div>
    );
  }

  // Connected state
  return (
    <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
      {/* Cover Image Strip */}
      <div
        style={{
          width: '100%',
          height: '80px',
          background: 'var(--bg-elevated)', // Sub with actual cover image if fetched later
          position: 'relative',
        }}
      >
        <div
          className="drawer-cover-fade"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '40px',
            background: 'linear-gradient(to bottom, transparent, var(--bg-card))',
          }}
        />
      </div>

      <div style={{ padding: '0 var(--space-4)', position: 'relative', marginTop: '-28px' }}>
        {/* Avatar */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--bg-elevated)',
            border: '3px solid var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--space-2)',
            overflow: 'hidden',
          }}
        >
          {/* Default user avatar. Can integrate dicebear or fetched avatar later */}
          <User size={28} color="var(--text-muted)" />
        </div>

        {/* User Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              fontWeight: 700,
              color: '#FFFFFF',
            }}
          >
            @user_{publicKey.toBase58().slice(0, 4).toLowerCase()}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'var(--text-muted)',
              }}
            >
              {formatAddress(publicKey.toBase58())}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--buy)',
              }}
            >
              {balance !== undefined ? `${balance.toFixed(2)} SOL` : '— SOL'}
            </span>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <button 
                onClick={handleCopy}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                <Copy size={12} />
              </button>
              <button 
                onClick={handleSolscan}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                <ExternalLink size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
