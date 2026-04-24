'use client';

/**
 * useAuth — SIWS (Sign-In With Solana) session hook.
 *
 * Watches wallet connect/disconnect events and automatically:
 *  - Logs in (prompts ONE signMessage popup) when a wallet connects
 *  - Clears the session on disconnect
 *
 * Usage:
 *   const { isAuthenticated, isLoggingIn, token, login, logout } = useAuth();
 */

import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { loginWithWallet, getAuthToken, clearSession } from '@/lib/session';

export interface AuthState {
  /** True once the JWT session has been established. */
  isAuthenticated: boolean;
  /** True while the login signMessage popup is pending. */
  isLoggingIn: boolean;
  /** The JWT token, or null if not authenticated. */
  token: string | null;
  /** Manually trigger login (e.g. if autoLogin failed). */
  login: () => Promise<void>;
  /** Clear the session and mark as unauthenticated. */
  logout: () => void;
}

export function useAuth(): AuthState {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const login = useCallback(async () => {
    if (!walletAddress || !signMessage) return;

    // Already have a valid cached token — no popup needed
    const cached = getAuthToken(walletAddress);
    if (cached) {
      setToken(cached);
      return;
    }

    setIsLoggingIn(true);
    try {
      const jwt = await loginWithWallet(walletAddress, signMessage);
      setToken(jwt);
    } catch (err) {
      console.error('[useAuth] Login failed:', err);
      // Don't block the UI — user can retry or continue without social actions
    } finally {
      setIsLoggingIn(false);
    }
  }, [walletAddress, signMessage]);

  const logout = useCallback(() => {
    if (walletAddress) clearSession(walletAddress);
    setToken(null);
  }, [walletAddress]);

  // Auto-login whenever the wallet connects
  useEffect(() => {
    if (connected && walletAddress && signMessage) {
      login();
    }
  }, [connected, walletAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear session on disconnect
  useEffect(() => {
    if (!connected && walletAddress) {
      logout();
    }
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isAuthenticated: !!token,
    isLoggingIn,
    token,
    login,
    logout,
  };
}
