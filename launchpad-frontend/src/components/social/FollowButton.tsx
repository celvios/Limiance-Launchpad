'use client';

import React, { useState } from 'react';
import { useFollowUser, useUnfollowUser } from '@/hooks/useProfile';

interface FollowButtonProps {
  walletAddress: string;
  isFollowing: boolean;
  isOwnProfile?: boolean;
}

export function FollowButton({
  walletAddress,
  isFollowing,
  isOwnProfile = false,
}: FollowButtonProps) {
  const [hovering, setHovering] = useState(false);
  const followMutation = useFollowUser(walletAddress);
  const unfollowMutation = useUnfollowUser(walletAddress);

  if (isOwnProfile) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isFollowing) {
      unfollowMutation.mutate();
    } else {
      followMutation.mutate();
    }
  };

  const isPending = followMutation.isPending || unfollowMutation.isPending;

  const getLabel = () => {
    if (isPending) return '...';
    if (isFollowing && hovering) return 'Unfollow';
    if (isFollowing) return 'Following';
    return 'Follow';
  };

  const getStyle = (): React.CSSProperties => {
    if (isFollowing && hovering) {
      return {
        background: 'var(--sell-dim)',
        border: '1px solid var(--sell)',
        color: 'var(--sell)',
      };
    }
    if (isFollowing) {
      return {
        background: 'transparent',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
      };
    }
    return {
      background: 'transparent',
      border: '1px solid var(--border-active)',
      color: 'var(--text-primary)',
    };
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      disabled={isPending}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: 'var(--space-1) var(--space-3)',
        borderRadius: 'var(--radius-md)',
        fontFamily: 'var(--font-ui)',
        fontSize: '12px',
        fontWeight: 500,
        cursor: isPending ? 'wait' : 'pointer',
        transition: 'all var(--duration-fast)',
        ...getStyle(),
      }}
    >
      {getLabel()}
    </button>
  );
}
