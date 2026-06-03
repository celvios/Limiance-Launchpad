'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { X, Wallet, ShieldCheck, AlertTriangle, Mail } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useWallet } from '@/providers/BscWalletProvider';
import { BSC_CHAIN_ID } from '@/lib/constants';
import { requestEmailOtp } from '@/lib/session';
import { embeddedWalletConfigStatus } from '@/lib/embeddedWallet';
import { useEmbeddedWallet } from '@/providers/EmbeddedWalletProvider';

export function WalletDrawer() {
  const isOpen = useUIStore((s) => s.isWalletDrawerOpen);
  const closeDrawer = useUIStore((s) => s.closeWalletDrawer);
  const { address, email: connectedEmail, authType, connected, chainId, connect, connectEmail, switchToBsc } = useWallet();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [emailState, setEmailState] = useState<'idle' | 'sent' | 'loading'>('idle');
  const [emailError, setEmailError] = useState<string | null>(null);
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

  useEffect(() => {
    if (connected && chainId === BSC_CHAIN_ID && isOpen) closeDrawer();
  }, [connected, chainId, isOpen, closeDrawer]);

  if (!isOpen) return null;

  const wrongNetwork = connected && chainId !== BSC_CHAIN_ID;

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
      closeDrawer();
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
          top: 0,
          right: 0,
          width: '380px',
          maxWidth: '100vw',
          height: '100vh',
          background: 'var(--bg-card)',
          borderLeft: '1px solid var(--border)',
          animation: 'slideInRight 300ms var(--ease-default)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
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
            BSC Wallet
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
          <button
            onClick={connect}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-4)',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <Wallet size={22} />
            <div>
              <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }}>
                {connected ? 'Wallet Connected' : 'Connect EVM Wallet'}
              </div>
              {authType === 'wallet' && address && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  {address}
                </div>
              )}
            </div>
          </button>

          {embeddedStatus.productionReady && (
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
                {emailState === 'loading' ? 'Working...' : emailState === 'sent' ? 'Verify Email' : 'Send Login Code'}
              </button>
            </div>
          )}

          {wrongNetwork ? (
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
              }}
            >
              <AlertTriangle size={22} />
              <div>
                <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }}>Switch to BSC Testnet</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 4 }}>
                  Current chain: {chainId ?? 'unknown'}
                </div>
              </div>
            </button>
          ) : (
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
              <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }}>
                {connected ? 'Ready on BSC' : 'BSC Testnet required'}
              </div>
              {authType === 'email' && connectedEmail && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {connectedEmail}
                </div>
              )}
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
