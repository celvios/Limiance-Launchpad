'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { Settings, Award, ExternalLink } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TokenCardCompact } from '@/components/token/TokenCardCompact';
import { FollowButton } from '@/components/social/FollowButton';
import { EditProfileModal } from '@/components/social/EditProfileModal';
import {
  useProfile,
  useProfileTokens,
  useProfileHoldings,
  useProfileTrades,
  useProfileComments,
} from '@/hooks/useProfile';
import { useUIStore } from '@/store/uiStore';
import { formatAddress, formatTimeAgo, formatNumber } from '@/lib/format';
import type { ProfileTab } from '@/lib/types';

const PROFILE_TABS = [
  { id: 'created', label: 'Created' },
  { id: 'holdings', label: 'Holdings' },
  { id: 'trades', label: 'Trades' },
  { id: 'comments', label: 'Comments' },
];

export default function ProfilePage() {
  const params = useParams();
  const wallet = params.wallet as string;
  const [activeTab, setActiveTab] = useState<ProfileTab>('created');
  const { publicKey } = useWallet();
  const { openModal } = useUIStore();

  const { data: profile, isLoading, isError } = useProfile(wallet);

  const isOwnProfile = publicKey?.toBase58() === wallet;

  if (isLoading) return <ProfileSkeleton />;

  if (isError || !profile) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '32px',
              color: 'var(--text-muted)',
              letterSpacing: '2px',
              marginBottom: 'var(--space-3)',
            }}
          >
            PROFILE NOT FOUND
          </div>
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '14px',
              color: 'var(--text-muted)',
            }}
          >
            This wallet address doesn&apos;t have a profile yet.
          </div>
        </div>
      </div>
    );
  }

  const daysJoined = Math.floor((Date.now() - profile.joinedAt) / 86_400_000);

  return (
    <div style={{ padding: 'var(--space-5)', maxWidth: 900, margin: '0 auto' }}>
      {/* Profile Header */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-5)',
          alignItems: 'flex-start',
          marginBottom: 'var(--space-6)',
          animation: 'cardEnter 300ms var(--ease-default) both',
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            overflow: 'hidden',
            background: (profile as any).profilePicUri ? 'transparent' : 'var(--brand)',
            border: '2px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            color: '#fff',
            flexShrink: 0,
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

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              flexWrap: 'wrap',
            }}
          >
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '36px',
                color: 'var(--text-primary)',
                letterSpacing: '2px',
                lineHeight: 1,
              }}
            >
              {profile.username ? `@${profile.username}` : formatAddress(wallet)}
            </h1>

            {!isOwnProfile && (
              <FollowButton
                walletAddress={wallet}
                isFollowing={profile.isFollowing}
              />
            )}

            {isOwnProfile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openModal('edit-profile')}
              >
                <Settings size={14} />
                Edit Profile
              </Button>
            )}
          </div>

          {/* Wallet address (if they have a username) */}
          {profile.username && (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                color: 'var(--text-muted)',
                marginTop: 'var(--space-1)',
              }}
            >
              {formatAddress(wallet)}
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <p
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                color: 'var(--text-secondary)',
                marginTop: 'var(--space-2)',
                lineHeight: 1.5,
              }}
            >
              {profile.bio}
            </p>
          )}

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-4)',
              marginTop: 'var(--space-3)',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '13px',
                color: 'var(--text-muted)',
              }}
            >
              Joined {daysJoined}d ago
            </span>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)' }}>
              ·
            </span>
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '13px',
                color: 'var(--text-secondary)',
              }}
            >
              <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {profile.tokensCreated}
              </strong>{' '}
              tokens created
            </span>
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '13px',
                color: 'var(--text-secondary)',
              }}
            >
              <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {profile.followerCount}
              </strong>{' '}
              followers
            </span>
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '13px',
                color: 'var(--text-secondary)',
              }}
            >
              <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {profile.followingCount}
              </strong>{' '}
              following
            </span>
          </div>

          {/* Graduated badge */}
          {profile.graduatedCount > 0 && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-3)',
                padding: 'var(--space-1) var(--space-3)',
                background: 'var(--graduation-dim)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <Award size={14} style={{ color: 'var(--graduation)' }} />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--graduation)',
                  fontWeight: 600,
                }}
              >
                {profile.graduatedCount} Graduated Token{profile.graduatedCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={PROFILE_TABS}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as ProfileTab)}
      />

      {/* Tab Content */}
      <div style={{ marginTop: 'var(--space-4)' }}>
        {activeTab === 'created' && <CreatedTab wallet={wallet} />}
        {activeTab === 'holdings' && <HoldingsTab wallet={wallet} />}
        {activeTab === 'trades' && <TradesTab wallet={wallet} />}
        {activeTab === 'comments' && <CommentsTab wallet={wallet} />}
      </div>

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
    return (
      <EmptyTab message="No tokens created yet." />
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 'var(--space-4)',
      }}
    >
      {tokens.map((token, i) => (
        <TokenCardCompact key={token.mint} token={token} index={i} />
      ))}
    </div>
  );
}

function HoldingsTab({ wallet }: { wallet: string }) {
  const { data, isLoading } = useProfileHoldings(wallet);

  if (isLoading) return <TabSkeleton />;

  const holdings = data?.holdings ?? [];
  if (holdings.length === 0) {
    return <EmptyTab message="No holdings found." />;
  }

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Table Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr',
          gap: 'var(--space-2)',
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--border)',
          fontFamily: 'var(--font-ui)',
          fontSize: '11px',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        <div>Token</div>
        <div>Amount</div>
        <div>Avg Buy</div>
        <div>Current</div>
        <div>PnL</div>
        <div>Value</div>
      </div>

      {/* Table Rows */}
      {holdings.map((h) => (
        <Link
          key={h.mint}
          href={`/token/${h.mint}`}
          style={{ textDecoration: 'none' }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr',
              gap: 'var(--space-2)',
              padding: 'var(--space-3) var(--space-4)',
              borderBottom: '1px solid var(--border)',
              transition: 'background var(--duration-fast)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                color: 'var(--text-primary)',
                fontWeight: 600,
              }}
            >
              ${h.symbol}
              <div
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontWeight: 400,
                }}
              >
                {h.name}
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>
              {formatNumber(h.amount, 0)}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {h.avgBuyPrice < 0.001 ? h.avgBuyPrice.toFixed(6) : h.avgBuyPrice.toFixed(4)} SOL
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>
              {h.currentPrice < 0.001 ? h.currentPrice.toFixed(6) : h.currentPrice.toFixed(4)} SOL
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                color: h.pnlPercent >= 0 ? 'var(--buy)' : 'var(--sell)',
                fontWeight: 600,
              }}
            >
              {h.pnlPercent >= 0 ? '+' : ''}
              {h.pnlPercent.toFixed(1)}%
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>
              {h.value < 1 ? h.value.toFixed(4) : formatNumber(h.value, 2)} SOL
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function TradesTab({ wallet }: { wallet: string }) {
  const { data, isLoading } = useProfileTrades(wallet);

  if (isLoading) return <TabSkeleton />;

  const trades = data?.trades ?? [];
  if (trades.length === 0) {
    return <EmptyTab message="No trades yet." />;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
      }}
    >
      {trades.map((trade) => (
        <div
          key={trade.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-3)',
            background: trade.isWhale ? 'var(--bg-elevated)' : 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <Badge variant={trade.type === 'buy' ? 'buy' : 'sell'}>
            {trade.type.toUpperCase()}
          </Badge>

          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              color: 'var(--text-primary)',
            }}
          >
            {formatNumber(trade.tokenAmount, 0)} tokens
          </span>

          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
          >
            for
          </span>

          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              color: 'var(--text-primary)',
            }}
          >
            {trade.solAmount} SOL
          </span>

          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginLeft: 'auto',
            }}
          >
            {formatTimeAgo(trade.timestamp)}
          </span>

          {trade.isWhale && <span style={{ fontSize: '14px' }}>🐋</span>}

          <a
            href={`https://solscan.io/tx/${trade.txSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              color: 'var(--text-muted)',
              display: 'inline-flex',
            }}
          >
            <ExternalLink size={12} />
          </a>
        </div>
      ))}
    </div>
  );
}

function CommentsTab({ wallet }: { wallet: string }) {
  const { data, isLoading } = useProfileComments(wallet);

  if (isLoading) return <TabSkeleton />;

  const comments = data?.comments ?? [];
  if (comments.length === 0) {
    return <EmptyTab message="No comments posted yet." />;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      {comments.map((comment) => (
        <Link
          key={comment.id}
          href={`/token/${comment.tokenMint}`}
          style={{ textDecoration: 'none' }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4)',
              transition: 'border-color var(--duration-fast)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-active)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-2)',
              }}
            >
              <Badge variant="curve">${comment.tokenSymbol}</Badge>
              <span
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                }}
              >
                {formatTimeAgo(comment.timestamp)}
              </span>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              {comment.text}
            </p>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginTop: 'var(--space-2)',
              }}
            >
              ▲ {comment.upvotes}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ── Shared Sub-Components ── */

function EmptyTab({ message }: { message: string }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: 'var(--space-8)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '14px',
          color: 'var(--text-muted)',
        }}
      >
        {message}
      </div>
    </div>
  );
}

function TabSkeleton() {
  const shimmerStyle: React.CSSProperties = {
    backgroundImage:
      'linear-gradient(90deg, var(--bg-card) 0%, var(--bg-elevated) 50%, var(--bg-card) 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: 'var(--radius-md)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ ...shimmerStyle, height: 60, width: '100%' }} />
      ))}
    </div>
  );
}

function ProfileSkeleton() {
  const shimmerStyle: React.CSSProperties = {
    backgroundImage:
      'linear-gradient(90deg, var(--bg-card) 0%, var(--bg-elevated) 50%, var(--bg-card) 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: 'var(--radius-sm)',
  };

  return (
    <div style={{ padding: 'var(--space-5)', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 'var(--space-5)' }}>
        <div style={{ ...shimmerStyle, width: 80, height: 80, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ ...shimmerStyle, width: 200, height: 36 }} />
          <div style={{ ...shimmerStyle, width: 120, height: 16 }} />
          <div style={{ ...shimmerStyle, width: 300, height: 16 }} />
          <div style={{ ...shimmerStyle, width: 250, height: 14 }} />
        </div>
      </div>
      <div style={{ ...shimmerStyle, width: '100%', height: 40, marginTop: 'var(--space-6)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ ...shimmerStyle, height: 60, width: '100%' }} />
        ))}
      </div>
    </div>
  );
}
