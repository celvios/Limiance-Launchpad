'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { X } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

interface WalletOption {
  name: string;
  icon: string;
  mobileDeepLink?: (url: string) => string;
  installUrl: string;
}

const WALLET_OPTIONS: WalletOption[] = [
  {
    name: 'Phantom',
    icon: '👻',
    mobileDeepLink: (url) =>
      `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(url)}`,
    installUrl: 'https://phantom.app',
  },
  {
    name: 'Backpack',
    icon: '🎒',
    installUrl: 'https://www.backpack.app',
  },
  {
    name: 'Solflare',
    icon: '🔆',
    mobileDeepLink: (url) =>
      `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(url)}`,
    installUrl: 'https://solflare.com',
  },
];

export function WalletDrawer() {
  const isOpen = useUIStore((s) => s.isWalletDrawerOpen);
  const closeDrawer = useUIStore((s) => s.closeWalletDrawer);
  const { select, wallets, connect, connected } = useWallet();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(
      window.innerWidth < 768 ||
        ('ontouchstart' in window && navigator.maxTouchPoints > 0)
    );
  }, []);

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
    const walletOption = WALLET_OPTIONS.find((w) => w.name === walletName);
    const adapter = wallets.find(
      (w) => w.adapter.name.toLowerCase() === walletName.toLowerCase()
    );

    const isDetected =
      adapter?.readyState === 'Installed' ||
      adapter?.readyState === 'Loadable';

    // On mobile with an undetected wallet, use the deep link to open inside
    // the wallet's in-app browser (Phantom / Solflare support this).
    if (isMobile && !isDetected && walletOption?.mobileDeepLink) {
      window.location.href = walletOption.mobileDeepLink(window.location.href);
      closeDrawer();
      return;
    }

    // On mobile with no deep link support, send to install page
    if (isMobile && !isDetected) {
      window.open(walletOption?.installUrl, '_blank');
      return;
    }

    if (adapter) {
      select(adapter.adapter.name);
      try {
        await connect();
      } catch {
        // Wallet handles its own error UI
      }
    }
  };

  const getWalletLabel = (walletName: string) => {
    const adapter = wallets.find(
      (w) => w.adapter.name.toLowerCase() === walletName.toLowerCase()
    );
    const isDetected =
      adapter?.readyState === 'Installed' ||
      adapter?.readyState === 'Loadable';

    if (isDetected) {
      return { text: 'Detected', color: 'var(--buy)' };
    }
    if (isMobile) {
      const walletOption = WALLET_OPTIONS.find((w) => w.name === walletName);
      if (walletOption?.mobileDeepLink) {
        return { text: 'Open in App', color: 'var(--brand)' };
      }
      return { text: 'Install', color: 'var(--text-muted)' };
    }
    return null;
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

      {/* Panel — bottom sheet on mobile, right drawer on desktop */}
      {isMobile ? (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border)',
            borderRadius: '16px 16px 0 0',
            animation: 'slideUpSheet 300ms var(--ease-default)',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '80vh',
            overflowY: 'auto',
          }}
        >
          {/* Drag handle */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              paddingTop: '12px',
              paddingBottom: '4px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '4px',
                borderRadius: '2px',
                background: 'var(--border)',
              }}
            />
          </div>

          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-4) var(--space-5)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '17px',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Connect Wallet
            </h2>
            <button
              onClick={closeDrawer}
              aria-label="Close"
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
              gap: 'var(--space-3)',
              paddingBottom: 'calc(var(--space-4) + env(safe-area-inset-bottom, 0px))',
            }}
          >
            {WALLET_OPTIONS.map((wallet) => {
              const label = getWalletLabel(wallet.name);
              return (
                <button
                  key={wallet.name}
                  onClick={() => handleSelectWallet(wallet.name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-4)',
                    padding: 'var(--space-4) var(--space-4)',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    width: '100%',
                    minHeight: '64px',
                  }}
                >
                  <span style={{ fontSize: '32px', lineHeight: 1 }}>{wallet.icon}</span>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: '16px',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {wallet.name}
                    </div>
                    {label && (
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '12px',
                          color: label.color,
                          marginTop: '2px',
                        }}
                      >
                        {label.text}
                      </div>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '18px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    →
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Desktop: right-side drawer */
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
              const label = getWalletLabel(wallet.name);
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
                    {label && (
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          color: label.color,
                          marginTop: '2px',
                        }}
                      >
                        {label.text}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
