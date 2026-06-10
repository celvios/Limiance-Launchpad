'use client';

import React from 'react';
import { useWallet } from '@/providers/BscWalletProvider';
import { User } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { LimianceLogo } from '@/components/ui/LimianceLogo';
import { useProfile } from '@/hooks/useProfile';

export function MenuHeader() {
  const { isAuthenticated, address } = useWallet();
  const { addToast: _ } = useUIStore();

  const { data: profile } = useProfile(address || '');

  if (!isAuthenticated || !address) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-6) var(--space-4) var(--space-5)',
          gap: 'var(--space-5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <LimianceLogo size={32} />
        </div>
        <ConnectButton />
      </div>
    );
  }

  const displayName = profile?.username
    ? `@${profile.username}`
    : `@user_${address.slice(0, 4).toLowerCase()}`;

  const followerCount = profile?.followerCount ?? 0;
  const followingCount = profile?.followingCount ?? 0;
  const avatarUri = profile?.profilePicUri;

  // Connected state
  return (
    <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
      {/* Cover Image Strip */}
      <div
        style={{
          width: '100%',
          height: '80px',
          background: profile?.coverUri
            ? `url(${profile.coverUri}) center/cover no-repeat`
            : 'var(--bg-elevated)',
          position: 'relative',
        }}
      >
        <div
          className="drawer-cover-fade"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '40px',
            background: 'linear-gradient(to bottom, transparent, var(--bg-card))',
          }}
        />
      </div>

      <div style={{ padding: '0 var(--space-4)', position: 'relative', marginTop: '-28px' }}>
        {/* Avatar */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--bg-elevated)',
            border: '3px solid var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--space-2)',
            overflow: 'hidden',
          }}
        >
          {avatarUri ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUri}
              alt="Profile"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <User size={28} color="var(--text-muted)" />
          )}
        </div>

        {/* Username */}
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '18px',
            fontWeight: 700,
            color: '#FFFFFF',
            marginBottom: '6px',
          }}
        >
          {displayName}
        </div>

        {/* Following / Followers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                fontWeight: 700,
                color: '#FFFFFF',
              }}
            >
              {followingCount}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '12px',
                color: 'var(--text-muted)',
              }}
            >
              Following
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                fontWeight: 700,
                color: '#FFFFFF',
              }}
            >
              {followerCount}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '12px',
                color: 'var(--text-muted)',
              }}
            >
              Followers
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
