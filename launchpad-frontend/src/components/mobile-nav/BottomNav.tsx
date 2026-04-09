'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Plus, Heart, Menu, X } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useWatchlistStore } from '@/store/watchlistStore';

export function BottomNav() {
  const pathname = usePathname();
  const { isMobileMenuOpen, setMobileMenuOpen } = useUIStore();
  const watchlistCount = useWatchlistStore((s) => s.count());

  const tabs = [
    { id: 'feed', label: 'Feed', icon: Home, href: '/' },
    { id: 'explore', label: 'Explore', icon: Compass, href: '/explore' },
    { id: 'launch', label: 'Launch', icon: Plus, href: '/create', isLaunch: true },
    { id: 'watch', label: 'Watch', icon: Heart, href: '/profile#watchlist', hasBadge: true },
    { id: 'menu', label: 'Menu', icon: isMobileMenuOpen ? X : Menu, action: () => setMobileMenuOpen(!isMobileMenuOpen) },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(64px + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 50,
      }}
      className="bottom-nav"
    >
      {tabs.map((tab) => {
        const isActive = tab.href ? (tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)) : isMobileMenuOpen;
        const Icon = tab.icon;

        if (tab.isLaunch) {
          return (
            <div key={tab.id} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
              <Link
                href={tab.href as string}
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: isActive ? 'var(--brand-hover)' : 'var(--brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  marginTop: '-10px',
                  boxShadow: '0 0 0 4px var(--bg-card), 0 4px 16px rgba(59, 130, 246, 0.4)',
                  transition: 'transform 100ms, background 100ms, box-shadow 100ms',
                }}
                onPointerDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.95)';
                  e.currentTarget.style.boxShadow = '0 0 0 4px var(--bg-card), 0 2px 8px rgba(59, 130, 246, 0.6)';
                }}
                onPointerUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 0 0 4px var(--bg-card), 0 4px 16px rgba(59, 130, 246, 0.4)';
                }}
                onPointerLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 0 0 4px var(--bg-card), 0 4px 16px rgba(59, 130, 246, 0.4)';
                }}
              >
                <Icon size={24} />
              </Link>
            </div>
          );
        }

        const InnerContent = (
          <>
            <div style={{ position: 'relative' }}>
              {/* @ts-ignore */}
              <Icon 
                size={22} 
                style={{
                  color: isActive ? 'var(--brand)' : 'var(--text-muted)',
                  animation: isActive ? 'tabActivate 200ms var(--ease-spring)' : 'none',
                }}
              />
              {tab.hasBadge && watchlistCount > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-6px',
                    background: 'var(--brand)',
                    color: '#fff',
                    fontSize: '9px',
                    fontWeight: 700,
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {watchlistCount > 9 ? '9+' : watchlistCount}
                </div>
              )}
            </div>
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-ui)',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--brand)' : 'var(--text-muted)',
                marginTop: '4px',
              }}
            >
              {tab.label}
            </span>
            <style jsx>{`
              @keyframes tabActivate {
                0%   { transform: scale(1); }
                50%  { transform: scale(1.2); }
                100% { transform: scale(1); }
              }
            `}</style>
          </>
        );

        const commonStyle: React.CSSProperties = {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          borderTop: `2px solid ${isActive ? 'var(--brand)' : 'transparent'}`,
          background: 'transparent',
          borderLeft: 'none',
          borderRight: 'none',
          borderBottom: 'none',
          padding: 0,
        };

        if (tab.action) {
          return (
            <button key={tab.id} onClick={tab.action} style={commonStyle}>
              {InnerContent}
            </button>
          );
        }

        return (
          <Link key={tab.id} href={tab.href as string} style={commonStyle}>
            {InnerContent}
          </Link>
        );
      })}
    </nav>
  );
}
