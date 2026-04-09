'use client';

import React, { useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { X } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

const WALLET_OPTIONS = [
  { name: 'Phantom', icon: '👻' },
  { name: 'Backpack', icon: '🎒' },
  { name: 'Solflare', icon: '🔆' },
];

export function WalletDrawer() {
  const isOpen = useUIStore((s) => s.isWalletDrawerOpen);
  const closeDrawer = useUIStore((s) => s.closeWalletDrawer);
  const { select, wallets, connect, connected } = useWallet();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    },
    [closeDrawer]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    if (connected && isOpen) {
      closeDrawer();
    }
  }, [connected, isOpen, closeDrawer]);

  const handleSelectWallet = async (walletName: string) => {
    const adapter = wallets.find(
      (w) => w.adapter.name.toLowerCase() === walletName.toLowerCase()
    );
    if (adapter) {
      select(adapter.adapter.name);
      try {
        await connect();
      } catch {
        // Wallet will handle its own error UI
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      {/* Backdrop */}
      <div
        onClick={closeDrawer}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--overlay-hard)',
          animation: 'fadeIn 200ms var(--ease-default)',
        }}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '360px',
          maxWidth: '100vw',
          height: '100vh',
          background: 'var(--bg-card)',
          borderLeft: '1px solid var(--border)',
          animation: 'slideInRight 300ms var(--ease-default)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-5)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            Select Wallet
          </h2>
          <button
            onClick={closeDrawer}
            aria-label="Close wallet drawer"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 'var(--space-1)',
              display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Wallet list */}
        <div
          style={{
            padding: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
        >
          {WALLET_OPTIONS.map((wallet) => {
            const isInstalled = wallets.some(
              (w) =>
                w.adapter.name.toLowerCase() === wallet.name.toLowerCase() &&
                w.readyState === 'Installed'
            );

            return (
              <button
                key={wallet.name}
                onClick={() => handleSelectWallet(wallet.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all var(--duration-fast)',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-active)';
                  e.currentTarget.style.background = 'var(--bg-elevated)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'var(--bg-base)';
                }}
              >
                <span style={{ fontSize: '28px' }}>{wallet.icon}</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '15px',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {wallet.name}
                  </div>
                  {isInstalled && (
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--buy)',
                        marginTop: '2px',
                      }}
                    >
                      Detected
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
