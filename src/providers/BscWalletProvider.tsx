'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BSC_CHAIN_ID, BSC_RPC_URL, GAS_CURRENCY } from '@/lib/constants';
import { loginWithWallet, getAuthToken, getSessionExpiry, clearAllSessions, clearSession, verifyEmailOtp } from '@/lib/session';

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
  // Wallet
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
  // Auth (inlined — no circular dependency)
  isAuthenticated: boolean;
  isLoggingIn: boolean;
  token: string | null;
  login: () => Promise<void>;
  logout: () => void;
  // For embedded wallet (Privy) login
  setEmbeddedSession: (walletAddress: string, email: string, token: string) => void;
}

const BscWalletContext = createContext<BscWalletContextValue | null>(null);

function normalizeAddress(addr: string | null | undefined) {
  return addr ? addr.toLowerCase() : null;
}

export function BscWalletProvider({ children }: { children: React.ReactNode }) {
  // ── Wallet state ──
  const [address, setAddress] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [authType, setAuthType] = useState<'wallet' | 'email' | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  // ── Auth state (inlined from useAuth to avoid circular dependency) ──
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const authTypeRef = React.useRef<'wallet' | 'email' | null>(null);
  useEffect(() => {
    authTypeRef.current = authType;
  }, [authType]);

  // ── signMessage (defined early so login can reference it) ──
  const signMessage = useCallback(async (msg: Uint8Array | string) => {
    if (!window.ethereum || !address) throw new Error('Wallet not connected');
    const text = typeof msg === 'string' ? msg : new TextDecoder().decode(msg);
    const signature = (await window.ethereum.request({
      method: 'personal_sign',
      params: [text, address],
    })) as string;
    return signature;
  }, []);

  // ── Auth functions ──
  const login = useCallback(async () => {
    if (!address || !signMessage) return;
    const cached = getAuthToken(address);
    if (cached) {
      setToken(cached);
      return;
    }
    setIsLoggingIn(true);
    try {
      const jwt = await loginWithWallet(address, signMessage);
      setToken(jwt);
    } catch (error) {
      console.error('[auth] EVM login failed:', error);
      throw error;
    } finally {
      setIsLoggingIn(false);
    }
  }, [address, signMessage]);

  const logout = useCallback(() => {
    clearAllSessions();
    setToken(null);
    setAddress(null);
    setEmail(null);
    setAuthType(null);
  }, [address]);

  // ── Wallet functions ──
  const refresh = useCallback(async () => {
    if (!window.ethereum) return;
    const [accounts, rawChainId] = await Promise.all([
      window.ethereum.request({ method: 'eth_accounts' }) as Promise<string[]>,
      window.ethereum.request({ method: 'eth_chainId' }) as Promise<string>,
    ]);
    
    if (authTypeRef.current === 'email') return; // Do not override email session
    
    const addr = normalizeAddress(accounts[0]);
    setAddress(addr);
    if (addr) {
      setAuthType('wallet');
      // Restore cached session without signing
      const cached = getAuthToken(addr);
      if (cached) setToken(cached);
    }
    setChainId(Number.parseInt(rawChainId, 16));
  }, [address]);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      window.open('https://metamask.io/download/', '_blank');
      return;
    }
    const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
    setAddress(normalizeAddress(accounts[0]));
    setEmail(null);
    setAuthType('wallet');
    const rawChainId = (await window.ethereum.request({ method: 'eth_chainId' })) as string;
    setChainId(Number.parseInt(rawChainId, 16));
    // Restore cached session if one exists (no MetaMask popup)
    const addr = normalizeAddress(accounts[0]);
    if (addr) {
      const cached = getAuthToken(addr);
      if (cached) setToken(cached);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (address) clearSession(address);
    setToken(null);
    authTypeRef.current = null;
    setAddress(null);
    setChainId(BSC_CHAIN_ID);
    setEmail(null);
    setAuthType(null);
  }, []);

  const connectEmail = useCallback(async (
    nextEmail: string,
    code: string,
    wallet: { embeddedSignerAddress: string; smartAccountAddress: string },
  ) => {
    const session = await verifyEmailOtp(nextEmail, code, wallet);
    authTypeRef.current = 'email';
    setAddress(normalizeAddress(session.wallet));
    setEmail(session.email);
    setAuthType('email');
    setChainId(BSC_CHAIN_ID);
    // Email sessions get a token from the server directly
    const cached = getAuthToken(normalizeAddress(session.wallet) ?? '');
    if (cached) setToken(cached);
  }, []);

  const setEmbeddedSession = useCallback((walletAddress: string, email: string, token: string) => {
    const addr = normalizeAddress(walletAddress);
    authTypeRef.current = 'email';
    setAddress(addr);
    setEmail(email);
    setAuthType('email');
    setChainId(BSC_CHAIN_ID);
    setToken(token);
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

  // ── Effects ──
  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!address || !token) return;

    const expiresAt = getSessionExpiry(address);
    if (!expiresAt) return;

    const expire = () => {
      clearAllSessions();
      setToken(null);
      setAddress(null);
      setEmail(null);
      setAuthType(null);
      window.dispatchEvent(new Event('limiance:session-expired'));
    };
    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      expire();
      return;
    }
    const timeout = window.setTimeout(expire, delay);
    return () => window.clearTimeout(timeout);
  }, [address, token]);

  useEffect(() => {
    if (!window.ethereum?.on) return;
    const handleAccounts = (accounts: unknown) => {
      if (authTypeRef.current === 'email') return; // Do not let window.ethereum override embedded email sessions

      const next = Array.isArray(accounts) ? String(accounts[0] ?? '') : '';
      const addr = normalizeAddress(next);
      setAddress(addr);
      if (addr) {
        setEmail(null);
        setAuthType('wallet');
        const cached = getAuthToken(addr);
        if (cached) setToken(cached);
      } else {
        setToken(null);
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
      isAuthenticated: !!token,
      isLoggingIn,
      token,
      login,
      logout,
      setEmbeddedSession,
    }),
    [address, email, authType, chainId, signMessage, connect, connectEmail, disconnect, switchToBsc, token, isLoggingIn, login, logout, setEmbeddedSession],
  );

  return (
    <BscWalletContext.Provider value={value}>
      {children}
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
