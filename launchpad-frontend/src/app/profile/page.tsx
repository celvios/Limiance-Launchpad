'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { Wallet } from 'lucide-react';
import { ConnectButton } from '@/components/wallet/ConnectButton';

export default function ProfileRedirectPage() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();

  useEffect(() => {
    if (connected && publicKey) {
      router.replace(`/profile/${publicKey.toBase58()}`);
    }
  }, [connected, publicKey, router]);

  // While redirecting, show nothing
  if (connected && publicKey) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            border: '2px solid var(--border)',
            borderTopColor: 'var(--text-primary)',
            borderRadius: '50%',
            animation: 'spin 600ms linear infinite',
          }}
        />
      </div>
    );
  }

  // Not connected — show connect prompt
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        padding: 'var(--space-5)',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          maxWidth: 380,
          animation: 'cardEnter 400ms var(--ease-default) both',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-5)',
          }}
        >
          <Wallet size={32} style={{ color: 'var(--text-muted)' }} />
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '36px',
            color: 'var(--text-primary)',
            letterSpacing: '2px',
            marginBottom: 'var(--space-3)',
          }}
        >
          YOUR PROFILE
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '15px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginBottom: 'var(--space-6)',
          }}
        >
          Connect your wallet to view your profile, track holdings, and manage your created tokens.
        </p>

        <div style={{ maxWidth: 200, margin: '0 auto' }}>
          <ConnectButton />
        </div>
      </div>
    </div>
  );
}
