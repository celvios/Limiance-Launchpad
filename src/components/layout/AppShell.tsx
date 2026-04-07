'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { SolanaWalletProvider } from '@/providers/SolanaWalletProvider';
import { ReactQueryProvider } from '@/providers/ReactQueryProvider';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { LiveTicker } from '@/components/layout/LiveTicker';
import { MarqueeTicker } from '@/components/layout/MarqueeTicker';
import { WalletDrawer } from '@/components/wallet/WalletDrawer';
import { ToastContainer } from '@/components/ui/Toast';
import { GlobalWSProvider } from '@/components/layout/GlobalWSProvider';
import { OnboardingGate } from '@/components/onboarding/OnboardingGate';
import { MobileTopBar } from '@/components/mobile-nav/MobileTopBar';
import { BottomNav } from '@/components/mobile-nav/BottomNav';
import { MenuDrawer } from '@/components/mobile-nav/MenuDrawer';

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Marquee only on Feed and Explore pages
  const showMarquee = pathname === '/' || pathname === '/explore';

  return (
    <>
      <GlobalWSProvider />
      <div
        id="app-shell"
        style={{
          display: 'flex',
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        {/* Left Sidebar — hidden on mobile via .sidebar-wrapper CSS */}
        <div className="sidebar-wrapper">
          <Sidebar />
        </div>

        {/* Center Content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            height: '100vh',
          }}
        >
          <div className="desktop-topbar">
            <TopBar />
          </div>
          <div className="mobile-topbar">
            <MobileTopBar />
          </div>
          {showMarquee && <MarqueeTicker />}
          <main
            id="main-content"
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            <OnboardingGate>{children}</OnboardingGate>
          </main>
        </div>

        {/* Right Ticker — hidden on mobile/tablet via CSS */}
        <div className="ticker-wrapper">
          <LiveTicker />
        </div>
      </div>

      {/* Overlays */}
      <WalletDrawer />
      <ToastContainer />
      <BottomNav />
      <MenuDrawer />
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ReactQueryProvider>
      <SolanaWalletProvider>
        <AppShellInner>{children}</AppShellInner>
      </SolanaWalletProvider>
    </ReactQueryProvider>
  );
}
