'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { X, Wallet, ShieldCheck, AlertTriangle, Mail, LogIn, CheckCircle } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useWallet } from '@/providers/BscWalletProvider';
import { BSC_CHAIN_ID } from '@/lib/constants';
import { requestEmailOtp } from '@/lib/session';
import { embeddedWalletConfigStatus } from '@/lib/embeddedWallet';
import { useEmbeddedWallet } from '@/providers/EmbeddedWalletProvider';

export function WalletDrawer() {
  const isOpen = useUIStore((s) => s.isWalletDrawerOpen);
  const closeDrawer = useUIStore((s) => s.closeWalletDrawer);
  const { address, email: connectedEmail, authType, connected, chainId, connect, connectEmail, switchToBsc, isAuthenticated, isLoggingIn, login } = useWallet();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [emailState, setEmailState] = useState<'idle' | 'sent' | 'loading'>('idle');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const embeddedWallet = useEmbeddedWallet();
  const embeddedStatus = embeddedWalletConfigStatus();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer();
    },
    [closeDrawer],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  // Close only after fully authenticated (connected + signed in)
  useEffect(() => {
    if (isAuthenticated && isOpen) closeDrawer();
  }, [isAuthenticated, isOpen, closeDrawer]);

  if (!isOpen) return null;

  const wrongNetwork = connected && chainId !== BSC_CHAIN_ID;

  const handleConnect = async () => {
    setConnectError(null);
    setIsConnecting(true);
    try {
      await connect();
    } catch (err: unknown) {
      // MetaMask errors are plain objects with a `code` field, not Error instances
      const code = (err as { code?: number })?.code;
      // 4001 = user rejected — silently ignore, no error banner
      if (code === 4001) return;
      // -32002 = already pending — prompt user to check MetaMask
      if (code === -32002) {
        setConnectError('MetaMask request already pending — please open MetaMask.');
        return;
      }
      const msg =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message ?? 'Could not connect wallet';
      setConnectError(msg);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSignIn = async () => {
    setConnectError(null);
    try {
      await login();
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Sign-in failed');
    }
  };

  const sendCode = async () => {
    setEmailState('loading');
    setEmailError(null);
    try {
      const result = await requestEmailOtp(email);
      setDevCode(result.devCode ?? null);
      setEmailState('sent');
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : 'Could not send login code');
      setEmailState('idle');
    }
  };

  const verifyCode = async () => {
    setEmailState('loading');
    setEmailError(null);
    try {
      const walletLink = await embeddedWallet.connectEmailWallet(email);
      await connectEmail(email, code, walletLink);
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : 'Email login failed');
      setEmailState('sent');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <div
        onClick={closeDrawer}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--overlay-hard)',
          animation: 'fadeIn 200ms var(--ease-default)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: '400px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          animation: 'glassCardEnter 300ms var(--ease-default)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1,
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-5)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: 18, fontWeight: 600 }}>
            Connect Wallet
          </h2>
          <button
            onClick={closeDrawer}
            aria-label="Close wallet drawer"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* ── EVM Wallet ── */}
          {!connected ? (
            // Step 1: Not connected — show connect button
            <button
              id="connect-evm-wallet-btn"
              onClick={handleConnect}
              disabled={isConnecting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-4)',
                background: 'var(--brand)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                cursor: isConnecting ? 'wait' : 'pointer',
                textAlign: 'left',
                width: '100%',
                opacity: isConnecting ? 0.7 : 1,
              }}
            >
              <Wallet size={22} />
              <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }}>
                {isConnecting ? 'Connecting…' : 'Connect EVM Wallet'}
              </div>
            </button>
          ) : !isAuthenticated ? (
            // Step 2: Connected but not signed in — show sign-in button
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <CheckCircle size={20} color="var(--buy)" />
                <div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14 }}>Wallet connected</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {address}
                  </div>
                </div>
              </div>
              <button
                id="sign-in-btn"
                onClick={handleSignIn}
                disabled={isLoggingIn}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-4)',
                  background: 'var(--brand)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  color: '#fff',
                  cursor: isLoggingIn ? 'wait' : 'pointer',
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 600,
                  opacity: isLoggingIn ? 0.7 : 1,
                  width: '100%',
                }}
              >
                <LogIn size={18} />
                {isLoggingIn ? 'Signing in…' : 'Sign In to Continue'}
              </button>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
                A signature request will appear in MetaMask. This does not cost gas.
              </p>
            </div>
          ) : (
            // Step 3: Fully authenticated
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-4)',
                background: 'var(--buy-dim)',
                border: '1px solid var(--buy)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--buy)',
              }}
            >
              <ShieldCheck size={22} />
              <div>
                <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }}>Signed in</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, marginTop: 2 }}>
                  {authType === 'email' ? connectedEmail : address}
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {connectError && (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--sell)', textAlign: 'center' }}>
              {connectError}
            </div>
          )}

          {/* Wrong network banner */}
          {wrongNetwork && (
            <button
              onClick={switchToBsc}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-4)',
                background: 'var(--sell-dim)',
                border: '1px solid var(--sell)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--sell)',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <AlertTriangle size={22} />
              <div>
                <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }}>Wrong Network</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 4 }}>
                  Click to switch to BSC
                </div>
              </div>
            </button>
          )}

          {/* Email login (only when Privy is configured) */}
          {embeddedStatus.productionReady && !connected && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
                padding: 'var(--space-4)',
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <Mail size={22} />
                <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }}>Continue with Email</div>
              </div>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
              />
              {emailState === 'sent' && (
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  style={inputStyle}
                />
              )}
              {devCode && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--buy)' }}>
                  Dev code: {devCode}
                </div>
              )}
              {emailError && (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--sell)' }}>
                  {emailError}
                </div>
              )}
              <button
                onClick={emailState === 'sent' ? verifyCode : sendCode}
                disabled={emailState === 'loading' || !email || (emailState === 'sent' && code.length !== 6)}
                style={emailButtonStyle}
              >
                {emailState === 'loading' ? 'Working…' : emailState === 'sent' ? 'Verify Email' : 'Send Login Code'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-3)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-ui)',
  outline: 'none',
  boxSizing: 'border-box',
};

const emailButtonStyle: React.CSSProperties = {
  padding: 'var(--space-3)',
  background: 'var(--brand)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: '#fff',
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
  fontWeight: 600,
};
