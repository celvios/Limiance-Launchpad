'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { BscWalletProvider } from '@/providers/BscWalletProvider';
import { EmbeddedWalletProvider } from '@/providers/EmbeddedWalletProvider';
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
import { CommentModal } from '@/components/token/CommentModal';
import { MobileLivePulse } from '@/components/layout/MobileLivePulse';
import { LiveActivitySheet } from '@/components/layout/LiveActivitySheet';
import { DepositDetectedModal } from '@/components/wallet/DepositDetectedModal';

import { PrivyProvider } from '@privy-io/react-auth';
import { BSC_CHAIN_ID, BSC_RPC_URL, PRIVY_APP_ID } from '@/lib/constants';

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
      <CommentModal />
      <MobileLivePulse />
      <LiveActivitySheet />
      <DepositDetectedModal />
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const bscChain = {
    id: BSC_CHAIN_ID,
    name: BSC_CHAIN_ID === 56 ? 'BNB Smart Chain' : 'BNB Smart Chain Testnet',
    network: BSC_CHAIN_ID === 56 ? 'bsc' : 'bsc-testnet',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: {
      default: { http: [BSC_RPC_URL] },
      public: { http: [BSC_RPC_URL] },
    },
    blockExplorers: {
      default: { name: 'BscScan', url: BSC_CHAIN_ID === 56 ? 'https://bscscan.com' : 'https://testnet.bscscan.com' },
    },
  };

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID || "no-app-id-found"}
      config={{
        loginMethods: ['email'],
        appearance: {
          theme: 'dark',
          accentColor: '#10B981',
          logo: 'https://placehold.co/400x400/png',
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        defaultChain: bscChain,
        supportedChains: [bscChain],
      }}
    >
      <ReactQueryProvider>
        <BscWalletProvider>
          <EmbeddedWalletProvider>
            <AppShellInner>{children}</AppShellInner>
          </EmbeddedWalletProvider>
        </BscWalletProvider>
      </ReactQueryProvider>
    </PrivyProvider>
  );
}
