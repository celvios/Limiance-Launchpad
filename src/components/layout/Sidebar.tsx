'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Plus, User } from 'lucide-react';
import { useWallet } from '@/providers/BscWalletProvider';
import { useConnection } from '@/providers/BscWalletProvider';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { LimianceLogo } from '@/components/ui/LimianceLogo';
import { formatAddress } from '@/lib/format';
import { useQuery } from '@tanstack/react-query';
import { usePrivy } from '@privy-io/react-auth';
import { Power } from 'lucide-react';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
  isCreate?: boolean;
}

export function Sidebar() {
  const pathname = usePathname();
  const { address, connected, isAuthenticated, disconnect } = useWallet();
  const { connection } = useConnection();
  const { user, logout: privyLogout } = usePrivy();

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

  const navItems: NavItem[] = [
    { icon: <Home size={20} />, label: 'Feed', href: '/' },
    { icon: <Compass size={20} />, label: 'Explore', href: '/explore' },
    { icon: <Plus size={20} />, label: 'Create', href: '/create', isCreate: true },
    {
      icon: <User size={20} />,
      label: 'Profile',
      href: connected && address ? `/profile/${address}` : '/profile',
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
        {/* Logo Lockup */}
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
            padding: 'var(--space-2) var(--space-2)',
            marginBottom: 'var(--space-5)',
          }}
        >
          <LimianceLogo size={28} />
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
          {isAuthenticated && address ? (
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
                  {user?.email?.address ? user.email.address : formatAddress(address)}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--buy)',
                  }}
                >
                  Connected
                </div>
              </div>
              
              <button
                onClick={async () => {
                  disconnect();
                  try {
                    await privyLogout();
                  } catch (err) {
                    console.error('Privy logout failed', err);
                  }
                }}
                title="Disconnect"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 'var(--space-2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Power size={18} />
              </button>
            </div>
          ) : (
            <ConnectButton />
          )}
        </div>
      </aside>
    </>
  );
}
