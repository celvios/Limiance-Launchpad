'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Heart, User, Zap, GraduationCap, Settings, ExternalLink, Power, ChevronRight } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWatchlistStore } from '@/store/watchlistStore';
import { useUIStore } from '@/store/uiStore';

export function MenuNavLinks() {
  const pathname = usePathname();
  const { connected, publicKey, disconnect } = useWallet();
  const watchlistCount = useWatchlistStore((s) => s.count());
  const { setMobileMenuOpen } = useUIStore();
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const handleNavigate = () => {
    setTimeout(() => {
      setMobileMenuOpen(false);
    }, 200);
  };

  const navItems = [
    { label: 'Feed', href: '/', icon: Home },
    { label: 'Explore', href: '/explore', icon: Compass },
    { label: 'Watchlist', href: '/profile#watchlist', icon: Heart, badge: watchlistCount },
    { label: 'Profile', href: connected && publicKey ? `/profile/${publicKey.toBase58()}` : '/profile', icon: User },
    { label: 'Near Graduation', href: '/explore?filter=near-grad', icon: Zap, iconColor: 'var(--graduation)' },
    { label: 'Graduated', href: '/explore?filter=graduated', icon: GraduationCap },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Primary Links */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {navItems.map((item, index) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href.split('?')[0].split('#')[0]);
          
          return (
            <React.Fragment key={item.label}>
              <Link
                href={item.href}
                onClick={handleNavigate}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  height: '52px',
                  textDecoration: 'none',
                  transition: 'background 100ms',
                }}
                onPointerDown={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                onPointerUp={(e) => (e.currentTarget.style.background = 'transparent')}
                onPointerLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <item.icon
                    size={20}
                    style={{
                      color: isActive ? 'var(--brand)' : (item.iconColor || 'var(--text-secondary)'),
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '15px',
                      color: isActive ? 'var(--brand)' : 'var(--text-primary)',
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {item.label}
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  {item.badge !== undefined && item.badge > 0 && (
                    <div
                      style={{
                        background: 'var(--brand)',
                        color: '#FFFFFF',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-xl)',
                      }}
                    >
                      {item.badge > 9 ? '9+' : item.badge}
                    </div>
                  )}
                  {!isActive && <ChevronRight size={16} color="var(--text-muted)" />}
                </div>
              </Link>
              {index < navItems.length - 1 && (
                <div style={{ height: '1px', background: 'var(--border)', width: '100%' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexDirection: 'column' }}>
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '52px',
            background: 'transparent',
            border: 'none',
            borderTop: '1px solid var(--border)',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Settings size={20} color="var(--text-secondary)" />
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', color: 'var(--text-primary)' }}>
              Settings
            </span>
          </div>
          <ChevronRight size={16} color="var(--text-muted)" />
        </button>

        <a
          href="https://afriq.example.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '52px',
            textDecoration: 'none',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <ExternalLink size={20} color="var(--text-secondary)" />
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', color: 'var(--text-secondary)' }}>
              Afriq Exchange
            </span>
          </div>
          <ExternalLink size={16} color="var(--text-muted)" />
        </a>

        {connected && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              height: showDisconnectConfirm ? '88px' : '52px',
              borderTop: '1px solid var(--border)',
              transition: 'height 200ms',
              overflow: 'hidden',
            }}
          >
            {!showDisconnectConfirm ? (
              <button
                onClick={() => setShowDisconnectConfirm(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  height: '52px',
                  width: '100%',
                }}
              >
                <Power size={20} color="var(--sell)" />
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', color: 'var(--sell)' }}>
                  Disconnect Wallet
                </span>
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)' }}>
                  Are you sure you want to disconnect?
                </span>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <button
                    onClick={() => setShowDisconnectConfirm(false)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-ui)',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      disconnect();
                      setShowDisconnectConfirm(false);
                      handleNavigate();
                    }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      background: 'var(--sell)',
                      border: '1px solid var(--sell)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#FFFFFF',
                      fontFamily: 'var(--font-ui)',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
