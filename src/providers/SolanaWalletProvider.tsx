'use client';

import React, { useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { RPC_URL } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';

/**
 * Inner component: mounts inside WalletProvider so it can access useWallet().
 * Triggers the SIWS auto-login when a wallet connects.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  useAuth(); // side-effect: auto-login on wallet connect
  return <>{children}</>;
}

export function SolanaWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new BackpackWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <AuthGate>{children}</AuthGate>
      </WalletProvider>
    </ConnectionProvider>
  );
}
