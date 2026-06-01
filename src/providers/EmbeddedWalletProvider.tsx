'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { BSC_CHAIN_ID, BSC_RPC_URL, PRIVY_APP_ID } from '@/lib/constants';
import type { EmbeddedWalletLink } from '@/lib/embeddedWallet';

type EmbeddedWalletContextValue = {
  configured: boolean;
  isLoading: boolean;
  error: string | null;
  connectEmailWallet: (email: string) => Promise<EmbeddedWalletLink>;
};

const EmbeddedWalletContext = createContext<EmbeddedWalletContextValue | null>(null);

declare global {
  interface Window {
    __limianceEmbeddedWallet?: EmbeddedWalletLink;
  }
}

function fallbackLink(): EmbeddedWalletLink | null {
  if (typeof window === 'undefined') return null;
  return window.__limianceEmbeddedWallet ?? null;
}

async function optionalRuntimeImport(packageName: string): Promise<unknown | null> {
  try {
    const runtimeImport = new Function('name', 'return import(name)') as (name: string) => Promise<unknown>;
    return await runtimeImport(packageName);
  } catch {
    return null;
  }
}

export function EmbeddedWalletProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectEmailWallet = useCallback(async (_email: string): Promise<EmbeddedWalletLink> => {
    setIsLoading(true);
    setError(null);
    try {
      const injected = fallbackLink();
      if (injected) return injected;

      if (!PRIVY_APP_ID) {
        throw new Error('NEXT_PUBLIC_PRIVY_APP_ID is required for embedded email wallets.');
      }

      const privy = await optionalRuntimeImport('@privy-io/react-auth');
      if (!privy) {
        throw new Error('Privy SDK is not installed. Run npm install after updating package.json.');
      }

      throw new Error(
        `Privy app ${PRIVY_APP_ID} is installed. Configure Privy smart wallets with Pimlico bundler/paymaster URLs for BSC ${BSC_CHAIN_ID} (${BSC_RPC_URL}) before enabling headless wallet creation.`,
      );
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : 'Embedded wallet setup failed';
      setError(message);
      throw nextError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      configured: Boolean(PRIVY_APP_ID),
      isLoading,
      error,
      connectEmailWallet,
    }),
    [connectEmailWallet, error, isLoading],
  );

  return (
    <EmbeddedWalletContext.Provider value={value}>
      {children}
    </EmbeddedWalletContext.Provider>
  );
}

export function useEmbeddedWallet() {
  const value = useContext(EmbeddedWalletContext);
  if (!value) throw new Error('useEmbeddedWallet must be used within EmbeddedWalletProvider');
  return value;
}
