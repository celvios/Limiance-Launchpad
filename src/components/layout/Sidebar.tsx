'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Plus, User } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { LimianceLogo } from '@/components/ui/LimianceLogo';
import { formatAddress } from '@/lib/format';
import { useQuery } from '@tanstack/react-query';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
  isCreate?: boolean;
}

export function Sidebar() {
  const pathname = usePathname();
  const { publicKey, connected } = useWallet();
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

  const navItems: NavItem[] = [
    { icon: <Home size={20} />, label: 'Feed', href: '/' },
    { icon: <Compass size={20} />, label: 'Explore', href: '/explore' },
    { icon: <Plus size={20} />, label: 'Create', href: '/create', isCreate: true },
    {
      icon: <User size={20} />,
      label: 'Profile',
      href: connected && publicKey ? `/profile/${publicKey.toBase58()}` : '/profile',
    },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        id="sidebar-desktop"
        style={{
          width: '240px',
          height: '100vh',
          position: 'sticky',
          top: 0,
          display: 'flex',
          flexDirection: 'column',
          background: '#080b14',
          borderRight: '1px solid rgba(59, 130, 246, 0.08)',
          padding: 'var(--space-4)',
          flexShrink: 0,
          overflowY: 'auto',
        }}
        className="sidebar-desktop"
      >
        {/* Logo Lockup: [Logo] Limiance | Launch */}
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            textDecoration: 'none',
            padding: 'var(--space-2) var(--space-2)',
            marginBottom: 'var(--space-5)',
          }}
        >
          <LimianceLogo size={28} showText={false} />
          <span className="logo-lockup-text" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            marginLeft: 8,
          }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '0.5px',
              }}
            >
              Limiance
            </span>
          </span>
        </Link>

        {/* Navigation */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flex: 1 }}>
          {navItems.map((item) => {
            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

            if (item.isCreate) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  id="nav-create"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3)',
                    background: 'var(--brand)',
                    color: '#FFFFFF',
                    borderRadius: 'var(--radius-md)',
                    textDecoration: 'none',
                    fontFamily: 'var(--font-ui)',
                    fontSize: '15px',
                    fontWeight: 600,
                    transition: 'all var(--duration-fast)',
                    marginTop: 'var(--space-2)',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                id={`nav-${item.label.toLowerCase()}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3)',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--brand-dim)' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--brand)' : '2px solid transparent',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '15px',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all var(--duration-fast)',
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom — Wallet */}
        <div
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 'var(--space-4)',
          }}
        >
          {connected && publicKey ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-2)',
              }}
            >
              {/* Avatar placeholder */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--brand-dim)',
                  border: '1px solid var(--brand-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  flexShrink: 0,
                }}
              >
                🟢
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatAddress(publicKey.toBase58())}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                  }}
                >
                  {balance !== undefined ? `${balance.toFixed(2)} SOL` : '— SOL'}
                </div>
              </div>
            </div>
          ) : (
            <ConnectButton />
          )}
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav
        id="mobile-nav"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '64px',
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border)',
          display: 'none',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 40,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        className="mobile-nav"
      >
        {navItems.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);

          if (item.isCreate) {
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'var(--brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  marginTop: '-16px',
                  boxShadow: '0 4px 16px var(--brand-dim)',
                }}
              >
                {item.icon}
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                color: isActive ? 'var(--brand)' : 'var(--text-muted)',
                textDecoration: 'none',
                fontSize: '11px',
                fontFamily: 'var(--font-ui)',
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
