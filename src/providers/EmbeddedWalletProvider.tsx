'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useWallet } from './BscWalletProvider';
import { getPimlicoSmartAccount } from '@/lib/pimlico';
import { toViemAccount } from '@privy-io/react-auth';
import { PRIVY_APP_ID, API_BASE_URL } from '@/lib/constants';

function normalizeAddress(addr: string | null | undefined): string | null {
  return addr ? addr.toLowerCase() : null;
}

type EmbeddedWalletContextValue = {
  configured: boolean;
  isLoading: boolean;
  error: string | null;
  smartAccountAddress: string | null;
  smartAccountClient: any | null;
};

const EmbeddedWalletContext = createContext<EmbeddedWalletContextValue | null>(null);

export function EmbeddedWalletProvider({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { connected, address } = useWallet();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [smartAccountClient, setSmartAccountClient] = useState<any>(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !authenticated || !user || connected || isLoading) return;

    // Find the embedded wallet
    const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
    if (!embeddedWallet) return; // Might be still creating

    // Capture in a non-undefined local for the closure
    const wallet = embeddedWallet;
    let isMounted = true;

    async function setupPimlicoAndLogin() {
      if (!isMounted) return;
      setIsLoading(true);
      setError(null);

      try {
        // Convert Privy wallet to Viem account
        console.log('[EmbeddedWallet] Setting up viem account...');
        const viemAccount = await toViemAccount({ wallet });

        // Derive Pimlico Smart Account
        console.log('[EmbeddedWallet] Fetching Pimlico smart account...');
        const { smartAccountAddress: saAddr, smartAccountClient: saClient } = await getPimlicoSmartAccount(viemAccount);
        
        if (!isMounted) return;
        setSmartAccountAddress(saAddr);
        setSmartAccountClient(saClient);

        console.log('[EmbeddedWallet] Getting Ethereum provider...');
        const provider = await wallet.getEthereumProvider();

        // Authenticate with backend using the EOA to sign, but storing the SA
        const timestamp = Date.now();
        const message = `Limiance Launchpad\n\nSign to authenticate your BSC session.\n\nThis request will not trigger any blockchain transaction or cost gas.\n\nTimestamp: ${timestamp}`;
        
        // EOA signs the message
        console.log('[EmbeddedWallet] Requesting personal_sign...');
        const signature = await provider.request({
          method: 'personal_sign',
          params: [message, wallet.address],
        });
        console.log('[EmbeddedWallet] Received signature! Sending to backend...');

        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: wallet.address,
            signature,
            timestamp,
            smartAccountAddress: saAddr,
            email: user?.email?.address,
          }),
        });
        console.log('[EmbeddedWallet] Backend response status:', res.status);

        if (!res.ok) {
          throw new Error('Failed to authenticate with backend');
        }

        const data = await res.json();
        
        // Use a hidden hook from BscWalletProvider if possible, or just let BscWalletProvider see the auth state
        // Actually, we can just call loginWithWallet, but loginWithWallet triggers metamask. 
        // We need to inject our token and address manually. We can do that by just reloading or using BscWalletProvider's internal state.
        
        // BscWalletProvider handles its state by checking localStorage and fetching /api/auth/me on mount.
        // We can just set the token in localStorage and dispatch an event or call a method on BscWalletProvider.
        // wait, we can just reload the page for now, or let BscWalletProvider fetch `me`.
        localStorage.setItem(`token_${normalizeAddress(saAddr)}`, data.token);
        localStorage.setItem(`token_${normalizeAddress(wallet.address)}`, data.token);
        
        // We can use window.location.reload() to make BscWalletProvider pick it up, 
        // but better to just use a custom event.
        window.dispatchEvent(new Event('auth_state_changed'));
        
        // But since we are in EmbeddedWalletProvider, we could just reload for simplicity since this is one-time login
        window.location.reload();

      } catch (err) {
        console.error('Failed to setup smart account:', err);
        const msg = err instanceof Error ? err.message : 'Failed to setup smart account';
        alert(`Login Error: ${msg}`);
        if (isMounted) setError(msg);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    setupPimlicoAndLogin();

    return () => {
      isMounted = false;
    };
  }, [ready, authenticated, user, wallets, connected]); // Removed isLoading to prevent self-cancelling

  return (
    <EmbeddedWalletContext.Provider
      value={{
        configured: Boolean(PRIVY_APP_ID),
        isLoading,
        error,
        smartAccountAddress,
        smartAccountClient,
      }}
    >
      {children}
    </EmbeddedWalletContext.Provider>
  );
}

export function useEmbeddedWallet() {
  const value = useContext(EmbeddedWalletContext);
  if (!value) throw new Error('useEmbeddedWallet must be used within EmbeddedWalletProvider');
  return value;
}
