'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useWallet } from './BscWalletProvider';
import { getPimlicoSmartAccount } from '@/lib/pimlico';
import { toViemAccount } from '@privy-io/react-auth';
import { PRIVY_APP_ID, API_BASE_URL } from '@/lib/constants';
import { saveEmailSession, getEmailSession } from '@/lib/session';
import { useRouter } from 'next/navigation';

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
  const { connected, address, setEmbeddedSession } = useWallet();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [hasLoggedIn, setHasLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [smartAccountClient, setSmartAccountClient] = useState<any>(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(null);

  useEffect(() => {
    // If we are missing dependencies, wait.
    if (!ready || !authenticated || !user || connected || isLoading) return;

    // Find the embedded wallet
    const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
    if (!embeddedWallet) return; // Might be still creating

    // If already have a valid cached session, restore it immediately without re-running Pimlico
    const cachedSession = getEmailSession(embeddedWallet.address);
    if (cachedSession) {
      if (!connected) {
        const restoreAddr = cachedSession.smartAccountAddress ?? embeddedWallet.address;
        setEmbeddedSession(restoreAddr, cachedSession.email, cachedSession.token);
      }
      if (!hasLoggedIn) setHasLoggedIn(true);
      return;
    }

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
        
        // Save the session using the centralized session logic
        if (data.token) {
          // Save session with smartAccountAddress so page refresh can restore it instantly
          saveEmailSession({
            walletAddress: wallet.address,
            email: user?.email?.address || '',
            token: data.token,
            smartAccountAddress: saAddr,
          });
          saveEmailSession({
            walletAddress: saAddr,
            email: user?.email?.address || '',
            token: data.token,
            smartAccountAddress: saAddr,
          });
          setHasLoggedIn(true);

          // Inject the SMART ACCOUNT address into BscWalletProvider.
          setEmbeddedSession(saAddr, user?.email?.address || '', data.token);

          // Redirect to home
          router.push('/');
        }

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
