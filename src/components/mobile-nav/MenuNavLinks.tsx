'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Heart, User, Zap, GraduationCap, Power, ChevronRight, LogIn } from 'lucide-react';
import { useWallet } from '@/providers/BscWalletProvider';
import { useWatchlistStore } from '@/store/watchlistStore';
import { useUIStore } from '@/store/uiStore';
import { usePrivy } from '@privy-io/react-auth';
import { useProfile } from '@/hooks/useProfile';

export function MenuNavLinks() {
  const pathname = usePathname();
  const { connected, address, disconnect } = useWallet();
  const { logout: privyLogout, user } = usePrivy();
  const watchlistCount = useWatchlistStore((s) => s.count());
  const { setMobileMenuOpen } = useUIStore();
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const { data: profile } = useProfile(address || '');

  const handleNavigate = () => {
    setTimeout(() => {
      setMobileMenuOpen(false);
    }, 200);
  };

  // Get the email if logged in via email
  const emailAddress = user?.email?.address ?? user?.google?.email ?? null;

  // Derive display identifier
  const displayIdentifier = emailAddress
    ? emailAddress
    : address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  // Capitalize name
  const displayName = profile?.username
    ? profile.username.charAt(0).toUpperCase() + profile.username.slice(1)
    : displayIdentifier;

  const avatarUri = profile?.profilePicUri;
  const resolvedAvatar = avatarUri
    ? avatarUri.startsWith('ipfs://')
      ? `https://gateway.pinata.cloud/ipfs/${avatarUri.replace('ipfs://', '')}`
      : avatarUri
    : null;

  const navItems = [
    { label: 'Feed', href: '/', icon: Home },
    { label: 'Explore', href: '/explore', icon: Compass },
    { label: 'Watchlist', href: '/profile#watchlist', icon: Heart, badge: watchlistCount },
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

      {/* Bottom Actions — Wallet / Profile */}
      <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexDirection: 'column' }}>

        {!connected ? (
          /* Not connected — show Connect Wallet CTA */
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-3)' }}>
            <div
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '12px',
                color: 'var(--text-muted)',
                marginBottom: 'var(--space-3)',
              }}
            >
              Connect your wallet to access all features
            </div>
            <button
              onClick={handleNavigate}
              style={{
                width: '100%',
                height: '44px',
                background: 'var(--brand)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: '#FFFFFF',
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)',
                cursor: 'pointer',
              }}
            >
              <LogIn size={16} />
              Connect Wallet
            </button>
          </div>
        ) : (
          /* Connected — Rich Profile Card */
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

            {/* Profile Card */}
            <Link
              href={`/profile/${address}`}
              onClick={handleNavigate}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                textDecoration: 'none',
                padding: 'var(--space-3)',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                transition: 'border-color 150ms, background 150ms',
              }}
              onPointerDown={(e) => {
                e.currentTarget.style.background = 'var(--bg-card)';
                e.currentTarget.style.borderColor = 'var(--brand)';
              }}
              onPointerUp={(e) => {
                e.currentTarget.style.background = 'var(--bg-elevated)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
              onPointerLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-elevated)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: resolvedAvatar ? 'transparent' : 'var(--brand)',
                  border: '2px solid var(--buy)',
                  boxShadow: '0 0 8px rgba(0,255,102,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontFamily: 'var(--font-display)',
                  fontSize: '16px',
                  color: '#fff',
                }}
              >
                {resolvedAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolvedAvatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  (profile?.username ?? address ?? 'U').slice(0, 1).toUpperCase()
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#FFFFFF',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {displayName}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {displayIdentifier}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-ui)',
                      fontWeight: 600,
                      color: 'var(--buy)',
                      background: 'rgba(0,255,102,0.1)',
                      padding: '1px 6px',
                      borderRadius: '999px',
                      flexShrink: 0,
                    }}
                  >
                    Connected
                  </span>
                </div>
              </div>

              <ChevronRight size={16} color="var(--text-muted)" />
            </Link>

            {/* Disconnect */}
            <div
              style={{
                height: showDisconnectConfirm ? '80px' : '44px',
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
                    justifyContent: 'center',
                    gap: 'var(--space-2)',
                    background: 'transparent',
                    border: '1px solid var(--sell)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0 var(--space-4)',
                    cursor: 'pointer',
                    height: '44px',
                    width: '100%',
                  }}
                >
                  <Power size={16} color="var(--sell)" />
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--sell)', fontWeight: 500 }}>
                    Logout
                  </span>
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-primary)' }}>
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
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        disconnect();
                        try {
                          await privyLogout();
                        } catch (err) {
                          console.error('Privy logout failed:', err);
                        }
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
                        cursor: 'pointer',
                      }}
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}




