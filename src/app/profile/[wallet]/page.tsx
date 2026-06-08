'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@/providers/BscWalletProvider';
import { Settings, Award, MoreHorizontal, Wallet, ArrowLeft, Plus } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { TokenCardCompact } from '@/components/token/TokenCardCompact';
import { FollowButton } from '@/components/social/FollowButton';
import { EditProfileModal } from '@/components/social/EditProfileModal';
import { createChart, ColorType, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import {
  useProfile,
  useProfileTokens,
  useProfileHoldings,
  useProfileTrades,
  useProfileComments,
  useProfileNetworth,
} from '@/hooks/useProfile';
import { useUIStore } from '@/store/uiStore';
import { formatAddress, formatNumber } from '@/lib/format';
import type { ProfileTab } from '@/lib/types';

// The new tabs
const PROFILE_TABS = [
  { id: 'posts', label: 'Posts' },
  { id: 'replies', label: 'Replies' },
  { id: 'stats', label: 'Stats' },
];

export default function ProfilePage() {
  const params = useParams();
  const wallet = params.wallet as string;
  const [activeTab, setActiveTab] = useState<ProfileTab | 'posts' | 'replies' | 'stats'>('posts');
  const { address } = useWallet();
  const { openModal } = useUIStore();

  const { data: profile, isLoading, isError } = useProfile(wallet);
  
  const isOwnProfile = address?.toLowerCase() === wallet.toLowerCase();

  if (isLoading) return <ProfileSkeleton />;

  if (isError || !profile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: 'var(--space-3)' }}>
            PROFILE NOT FOUND
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-muted)' }}>
            This wallet address doesn&apos;t have a profile yet.
          </div>
        </div>
      </div>
    );
  }

  const daysJoined = Math.floor((Date.now() - profile.joinedAt) / 86_400_000);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', paddingBottom: '100px', background: 'var(--bg-base)' }}>
      {/* Header Container */}
      <div style={{ padding: 'var(--space-5)', maxWidth: 800, margin: '0 auto' }}>
        
        {/* Top Bar: Avatar + Menu */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              overflow: 'hidden',
              background: (profile as any).profilePicUri ? 'transparent' : 'var(--brand)',
              border: '2px solid var(--buy)', // Glowing green border like design
              boxShadow: '0 0 10px rgba(0, 255, 102, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: '20px',
              color: '#fff',
            }}
          >
            {(profile as any).profilePicUri ? (
              <img
                src={
                  (profile as any).profilePicUri.startsWith('ipfs://')
                    ? `https://gateway.pinata.cloud/ipfs/${(profile as any).profilePicUri.replace('ipfs://', '')}`
                    : (profile as any).profilePicUri
                }
                alt={profile.username ?? 'Avatar'}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              (profile.username ?? wallet).slice(0, 2).toUpperCase()
            )}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            {!isOwnProfile && <FollowButton walletAddress={wallet} isFollowing={profile.isFollowing} />}
            {isOwnProfile && (
              <button
                onClick={() => openModal('edit-profile')}
                style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                <Settings size={20} />
              </button>
            )}
            <button style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <MoreHorizontal size={24} />
            </button>
          </div>
        </div>

        {/* Net Worth Display */}
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '42px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-1px' }}>
            $1253.2K
          </div>
          
          {/* Handle / Joined */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', color: 'var(--text-primary)', fontWeight: 600 }}>
              {profile.username ? `@${profile.username}` : formatAddress(wallet)}
            </span>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-muted)' }}>
              - {daysJoined}d
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: 'var(--space-3)' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatNumber(profile.followingCount)}</span> Following
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatNumber(profile.followerCount)}</span> Followers
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>$550K</span> TFV
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>
            {profile.bio}
          </p>
        )}

        {/* Graduated badge */}
        {profile.graduatedCount > 0 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', padding: 'var(--space-1) var(--space-3)', background: 'var(--graduation-dim)', borderRadius: 'var(--radius-md)' }}>
            <Award size={14} style={{ color: 'var(--graduation)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--graduation)', fontWeight: 600 }}>
              {profile.graduatedCount} Graduated Token{profile.graduatedCount > 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Tabs */}
        <div style={{ borderBottom: '1px solid var(--border)', display: 'flex', gap: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
          {PROFILE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                background: 'none', border: 'none', padding: '12px 0',
                color: activeTab === tab.id ? 'var(--brand)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: activeTab === tab.id ? 600 : 500,
                borderBottom: `2px solid ${activeTab === tab.id ? 'var(--brand)' : 'transparent'}`,
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'posts' && <CreatedTab wallet={wallet} />}
          {activeTab === 'replies' && <CommentsTab wallet={wallet} />}
          {activeTab === 'stats' && <StatsTab wallet={wallet} />}
        </div>
      </div>

      {/* Floating Action Button (Mobile) */}
      <Link
        href="/create"
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'var(--brand)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
          zIndex: 40,
        }}
      >
        <Plus size={28} />
      </Link>

      {/* Edit Profile Modal */}
      {isOwnProfile && (
        <EditProfileModal
          walletAddress={wallet}
          currentUsername={profile.username}
          currentBio={profile.bio}
          currentProfilePicUri={(profile as any).profilePicUri ?? null}
        />
      )}
    </div>
  );
}

/* ── Tab Components ── */

function CreatedTab({ wallet }: { wallet: string }) {
  const { data: tokens, isLoading } = useProfileTokens(wallet);

  if (isLoading) return <TabSkeleton />;

  if (!tokens || tokens.length === 0) {
    return <EmptyTab message="No posts yet." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {tokens.map((token, i) => (
        <TokenCardCompact key={token.mint} token={token} index={i} />
      ))}
    </div>
  );
}

function CommentsTab({ wallet }: { wallet: string }) {
  const { data, isLoading } = useProfileComments(wallet);

  if (isLoading) return <TabSkeleton />;

  const comments = data?.comments ?? [];
  if (comments.length === 0) {
    return <EmptyTab message="No replies yet." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {comments.map((c) => (
        <div key={c.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Replying to <Link href={`/token/${c.tokenMint}`} style={{ color: 'var(--brand)', textDecoration: 'none' }}>${c.tokenSymbol}</Link>
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {c.text}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsTab({ wallet }: { wallet: string }) {
  const { data, isLoading } = useProfileNetworth(wallet);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#666666', fontFamily: '"IBM Plex Mono", monospace' },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.05)' }, horzLines: { color: 'rgba(255, 255, 255, 0.05)' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
      autoSize: true,
      height: 300,
    });

    chartRef.current = chart;

    const lineSeries = chart.addLineSeries({
      color: '#00FF66',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });

    lineSeries.setData(data);

    return () => chart.remove();
  }, [data]);

  if (isLoading) return <TabSkeleton />;

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
      <h3 style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', color: 'var(--text-primary)', marginBottom: 'var(--space-4)', fontWeight: 600 }}>Net Worth History</h3>
      <div ref={chartContainerRef} style={{ width: '100%' }} />
    </div>
  );
}

function TabSkeleton() {
  return <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Loading...</div>;
}

function EmptyTab({ message }: { message: string }) {
  return <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>{message}</div>;
}

function ProfileSkeleton() {
  return (
    <div style={{ padding: 'var(--space-5)', maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-elevated)', animation: 'pulse 1.5s infinite' }} />
      <div style={{ width: '60%', height: 40, background: 'var(--bg-elevated)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
      <div style={{ width: '40%', height: 20, background: 'var(--bg-elevated)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
      <div style={{ width: '100%', height: 100, background: 'var(--bg-elevated)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
    </div>
  );
}
