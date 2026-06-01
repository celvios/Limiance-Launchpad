'use client';

import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@/providers/BscWalletProvider';
import { loginWithWallet, getAuthToken, clearSession } from '@/lib/session';

export interface AuthState {
  isAuthenticated: boolean;
  isLoggingIn: boolean;
  token: string | null;
  login: () => Promise<void>;
  logout: () => void;
}

export function useAuth(): AuthState {
  const { address, signMessage, connected } = useWallet();
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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
      console.error('[useAuth] EVM login failed:', error);
    } finally {
      setIsLoggingIn(false);
    }
  }, [address, signMessage]);

  const logout = useCallback(() => {
    if (address) clearSession(address);
    setToken(null);
  }, [address]);

  useEffect(() => {
    if (connected && address && signMessage) login();
  }, [connected, address, signMessage, login]);

  useEffect(() => {
    if (!connected && address) logout();
  }, [connected, address, logout]);

  return {
    isAuthenticated: !!token,
    isLoggingIn,
    token,
    login,
    logout,
  };
}
