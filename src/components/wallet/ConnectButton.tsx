'use client';

import React from 'react';
import { useUIStore } from '@/store/uiStore';
import { useWallet } from '@/providers/BscWalletProvider';

export function ConnectButton() {
  const openWalletDrawer = useUIStore((s) => s.openWalletDrawer);
  const { connected, isAuthenticated } = useWallet();

  // If they are fully authenticated, this button shouldn't be rendered anyway,
  // but if it is, we can say 'Connected'
  if (isAuthenticated) return null;

  const label = connected ? 'Sign In' : 'Connect Wallet';

  return (
    <button
      onClick={openWalletDrawer}
      id="connect-wallet-btn"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '40px',
        padding: '0 var(--space-4)',
        background: connected ? 'var(--buy)' : 'var(--brand)',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        color: '#FFFFFF',
        fontFamily: 'var(--font-ui)',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all var(--duration-fast)',
        width: '100%',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.filter = 'brightness(1.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter = 'brightness(1)';
      }}
    >
      {label}
    </button>
  );
}
