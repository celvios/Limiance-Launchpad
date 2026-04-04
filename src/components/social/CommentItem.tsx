'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUp } from 'lucide-react';
import { formatAddress, formatTimeAgo } from '@/lib/format';
import type { Comment } from '@/lib/types';

interface CommentItemProps {
  comment: Comment;
  onUpvote: (commentId: string) => void;
}

export function CommentItem({ comment, onUpvote }: CommentItemProps) {
  const displayName = comment.walletHandle
    ? `@${comment.walletHandle}`
    : formatAddress(comment.walletAddress);

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) 0',
        borderBottom: '1px solid var(--border)',
        animation: 'cardEnter 200ms var(--ease-default) both',
      }}
    >
      {/* Avatar */}
      <Link
        href={`/profile/${comment.walletAddress}`}
        style={{ textDecoration: 'none', flexShrink: 0 }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-muted)',
          }}
        >
          {comment.walletAddress.slice(0, 2).toUpperCase()}
        </div>
      </Link>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <Link
            href={`/profile/${comment.walletAddress}`}
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              textDecoration: 'none',
            }}
          >
            {displayName}
          </Link>
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

        {/* Text */}
        <p
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            marginTop: 'var(--space-1)',
            wordBreak: 'break-word',
          }}
        >
          {comment.text}
        </p>

        {/* Upvote */}
        <button
          onClick={() => onUpvote(comment.id)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginTop: 'var(--space-2)',
            padding: '2px var(--space-2)',
            background: comment.hasUpvoted ? 'var(--buy-dim)' : 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: comment.hasUpvoted ? 'var(--buy)' : 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all var(--duration-fast)',
          }}
          onMouseEnter={(e) => {
            if (!comment.hasUpvoted) {
              e.currentTarget.style.color = 'var(--text-secondary)';
            }
          }}
          onMouseLeave={(e) => {
            if (!comment.hasUpvoted) {
              e.currentTarget.style.color = 'var(--text-muted)';
            }
          }}
        >
          <ArrowUp size={12} />
          {comment.upvotes}
        </button>
      </div>
    </div>
  );
}
