'use client';

import React from 'react';
import Link from 'next/link';
import { Eye, Share2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { WatchlistButton } from '@/components/social/WatchlistButton';
import { formatTimeAgo } from '@/lib/format';
import { ipfsToGateway } from '@/lib/pinata';
import type { TokenDetail } from '@/lib/types';

interface TokenHeaderProps {
  token: TokenDetail;
}

export function TokenHeader({ token }: TokenHeaderProps) {
  return (
    <div>
      {/* Banner */}
      <div
        style={{
          width: '100%',
          height: 200,
          background: token.bannerUri
            ? `url(${token.bannerUri}) center/cover`
            : `linear-gradient(135deg, #0a1628 0%, #122448 40%, #1a3a6e 70%, #0d1f3c 100%)`,
          borderRadius: 'var(--radius-lg)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Shimmer overlay for tokens without banners */}
        {!token.bannerUri && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.25,
              backgroundImage: `radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.6) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(96, 165, 250, 0.4) 0%, transparent 50%),
                radial-gradient(circle at 50% 80%, rgba(37, 99, 235, 0.5) 0%, transparent 50%)`,
            }}
          />
        )}
      </div>

      {/* Logo + Info */}
      <div style={{ padding: '0 var(--space-4)' }}>
        {/* Logo overlapping banner */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--bg-elevated)',
            border: '3px solid var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-display)',
            fontSize: '24px',
            color: 'var(--text-muted)',
            marginTop: -32,
            position: 'relative',
            zIndex: 2,
            overflow: 'hidden',
          }}
        >
          {token.imageUri ? (
            <img 
              src={ipfsToGateway(token.imageUri)} 
              alt={token.symbol} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          ) : (
            token.symbol.slice(0, 2)
          )}
        </div>

        {/* Token name + symbol */}
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '48px',
            color: 'var(--text-primary)',
            letterSpacing: '2px',
            marginTop: 'var(--space-2)',
            lineHeight: 1,
          }}
        >
          {token.name}
        </h1>

        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '16px',
            color: 'var(--text-muted)',
            marginTop: 'var(--space-1)',
          }}
        >
          ${token.symbol}
        </div>

        {/* Creator + actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginTop: 'var(--space-3)',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'var(--font-ui)',
              fontSize: '14px',
              color: 'var(--text-secondary)',
            }}
          >
            by{' '}
            <Link
              href={`/profile/${token.creatorWallet}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--text-primary)',
                textDecoration: 'none',
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: 'var(--bg-elevated)',
                  overflow: 'hidden',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border)',
                }}
              >
                {token.creatorPicUri ? (
                  <img 
                    src={ipfsToGateway(token.creatorPicUri)} 
                    alt="" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                ) : (
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>
                    {token.creatorWallet.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              @{token.creatorHandle || `${token.creatorWallet.slice(0, 4)}...${token.creatorWallet.slice(-4)}`}
            </Link>{' '}
            · {formatTimeAgo(token.createdAt)}
          </span>

          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: 'var(--space-1) var(--space-2)',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'color var(--duration-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <Share2 size={14} />
          </button>

          <WatchlistButton mint={token.mint} size={16} />
        </div>

        {/* Tags */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            marginTop: 'var(--space-3)',
            flexWrap: 'wrap',
          }}
        >
          <Badge variant="curve">{token.curveType.toUpperCase()}</Badge>
          <Badge variant={token.status === 'graduated' ? 'grad' : 'default'}>
            {token.status.toUpperCase()}
          </Badge>
          <Badge variant="default">
            <Users size={10} style={{ marginRight: 4 }} />
            {token.holderCount} holders
          </Badge>
          <Badge variant="default">
            <Eye size={10} style={{ marginRight: 4 }} />
            {token.watchCount ?? 0} watching
          </Badge>
        </div>
      </div>
    </div>
  );
}
