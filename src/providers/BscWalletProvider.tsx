'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BSC_CHAIN_ID, BSC_RPC_URL, GAS_CURRENCY } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';
import { loginWithWallet, clearSession, verifyEmailOtp } from '@/lib/session';

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

interface BscWalletContextValue {
  address: string | null;
  email: string | null;
  authType: 'wallet' | 'email' | null;
  connected: boolean;
  chainId: number | null;
  signMessage?: (msg: Uint8Array | string) => Promise<Uint8Array | string>;
  connect: () => Promise<void>;
  connectEmail: (
    email: string,
    code: string,
    wallet: { embeddedSignerAddress: string; smartAccountAddress: string },
  ) => Promise<void>;
  disconnect: () => void;
  switchToBsc: () => Promise<void>;
}

const BscWalletContext = createContext<BscWalletContextValue | null>(null);

function AuthGate({ children }: { children: React.ReactNode }) {
  useAuth();
  return <>{children}</>;
}

function normalizeAddress(address: string | null | undefined) {
  return address ? address.toLowerCase() : null;
}

export function BscWalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [authType, setAuthType] = useState<'wallet' | 'email' | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!window.ethereum) return;
    const [accounts, rawChainId] = await Promise.all([
      window.ethereum.request({ method: 'eth_accounts' }) as Promise<string[]>,
      window.ethereum.request({ method: 'eth_chainId' }) as Promise<string>,
    ]);
    setAddress(normalizeAddress(accounts[0]));
    if (accounts[0]) setAuthType('wallet');
    setChainId(Number.parseInt(rawChainId, 16));
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      window.open('https://metamask.io/download/', '_blank');
      return;
    }
    const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
    const normalizedAddress = normalizeAddress(accounts[0]);
    setAddress(normalizedAddress);
    setEmail(null);
    setAuthType('wallet');
    const rawChainId = (await window.ethereum.request({ method: 'eth_chainId' })) as string;
    setChainId(Number.parseInt(rawChainId, 16));
    // Trigger sign-in immediately after the user explicitly connected.
    // This is the ONLY place we should prompt MetaMask for a signature.
    if (normalizedAddress) {
      try {
        const signFn = async (msg: Uint8Array | string) => {
          const text = typeof msg === 'string' ? msg : new TextDecoder().decode(msg);
          return (await window.ethereum!.request({
            method: 'personal_sign',
            params: [text, normalizedAddress],
          })) as string;
        };
        await loginWithWallet(normalizedAddress, signFn);
      } catch {
        // Non-fatal: user may have dismissed the signature. They can re-try.
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    if (address) clearSession(address);
    setAddress(null);
    setEmail(null);
    setAuthType(null);
  }, [address]);

  const connectEmail = useCallback(async (
    nextEmail: string,
    code: string,
    wallet: { embeddedSignerAddress: string; smartAccountAddress: string },
  ) => {
    const session = await verifyEmailOtp(nextEmail, code, wallet);
    setAddress(normalizeAddress(session.wallet));
    setEmail(session.email);
    setAuthType('email');
    setChainId(BSC_CHAIN_ID);
  }, []);

  const switchToBsc = useCallback(async () => {
    if (!window.ethereum) return;
    const chainIdHex = `0x${BSC_CHAIN_ID.toString(16)}`;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
    } catch {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: chainIdHex,
          chainName: BSC_CHAIN_ID === 56 ? 'BNB Smart Chain' : 'BNB Smart Chain Testnet',
          nativeCurrency: { name: GAS_CURRENCY, symbol: GAS_CURRENCY, decimals: 18 },
          rpcUrls: [BSC_RPC_URL],
          blockExplorerUrls: [BSC_CHAIN_ID === 56 ? 'https://bscscan.com' : 'https://testnet.bscscan.com'],
        }],
      });
    }
    await refresh();
  }, [refresh]);

  const signMessage = useCallback(async (msg: Uint8Array | string) => {
    if (!window.ethereum || !address) throw new Error('Wallet not connected');
    const text = typeof msg === 'string' ? msg : new TextDecoder().decode(msg);
    const signature = (await window.ethereum.request({
      method: 'personal_sign',
      params: [text, address],
    })) as string;
    return signature;
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!window.ethereum?.on) return;
    const handleAccounts = (accounts: unknown) => {
      const next = Array.isArray(accounts) ? String(accounts[0] ?? '') : '';
      setAddress(normalizeAddress(next));
      if (next) {
        setEmail(null);
        setAuthType('wallet');
      }
    };
    const handleChain = (nextChainId: unknown) => {
      if (typeof nextChainId === 'string') setChainId(Number.parseInt(nextChainId, 16));
    };
    window.ethereum.on('accountsChanged', handleAccounts);
    window.ethereum.on('chainChanged', handleChain);
    return () => {
      window.ethereum?.removeListener?.('accountsChanged', handleAccounts);
      window.ethereum?.removeListener?.('chainChanged', handleChain);
    };
  }, []);

  const value = useMemo(
    () => ({
      address,
      email,
      authType,
      connected: !!address,
      chainId,
      signMessage: authType === 'wallet' ? signMessage : undefined,
      connect,
      connectEmail,
      disconnect,
      switchToBsc,
    }),
    [address, email, authType, chainId, signMessage, connect, connectEmail, disconnect, switchToBsc],
  );

  return (
    <BscWalletContext.Provider value={value}>
      <AuthGate>{children}</AuthGate>
    </BscWalletContext.Provider>
  );
}

export function useBscWallet() {
  const value = useContext(BscWalletContext);
  if (!value) throw new Error('useBscWallet must be used within BscWalletProvider');
  return value;
}

export function useWallet() {
  return useBscWallet();
}

export function useConnection() {
  return {
    connection: {
      async getBalance(walletAddress: string) {
        const res = await fetch(BSC_RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getBalance',
            params: [walletAddress, 'latest'],
          }),
        });
        const data = (await res.json()) as { result?: string };
        return Number(BigInt(data.result ?? '0x0'));
      },
    },
  };
}

