'use client';

import React from 'react';
import { useUIStore } from '@/store/uiStore';

export function ConnectButton() {
  const openWalletDrawer = useUIStore((s) => s.openWalletDrawer);

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
        background: 'var(--brand)',
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
        e.currentTarget.style.background = 'var(--brand-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--brand)';
      }}
    >
      Connect Wallet
    </button>
  );
}
