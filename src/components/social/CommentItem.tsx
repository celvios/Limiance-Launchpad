'use client';

import React from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, ThumbsDown } from 'lucide-react';
import { formatAddress, formatTimeAgo } from '@/lib/format';
import { ipfsToGateway } from '@/lib/pinata';
import type { Comment } from '@/lib/types';

interface CommentItemProps {
  comment: Comment;
  canReply: boolean;
  onReply: (commentId: string, text: string) => void;
  onReact: (commentId: string, type: 'like' | 'dislike') => void;
  depth?: number;
  replyMode?: 'inline' | 'select';
}

export function CommentItem({ comment, canReply, onReply, onReact, depth = 0, replyMode = 'inline' }: CommentItemProps) {
  const [isReplying, setIsReplying] = React.useState(false);
  const [replyText, setReplyText] = React.useState('');
  const displayName = comment.walletHandle
    ? `@${comment.walletHandle}`
    : formatAddress(comment.walletAddress);
  const likeCount = comment.likeCount ?? comment.upvotes ?? 0;
  const dislikeCount = comment.dislikeCount ?? 0;

  const submitReply = () => {
    if (!replyText.trim()) return;
    onReply(comment.id, replyText.trim());
    setReplyText('');
    setIsReplying(false);
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          padding: 'var(--space-3) 0',
          borderBottom: depth === 0 ? '1px solid var(--border)' : 'none',
          animation: 'cardEnter 200ms var(--ease-default) both',
          marginLeft: depth > 0 ? 'var(--space-6)' : 0,
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
            overflow: 'hidden',
          }}
        >
          {comment.profilePicUri ? (
            <img
              src={ipfsToGateway(comment.profilePicUri)}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            comment.walletAddress.slice(0, 2).toUpperCase()
          )}
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

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
          <button
          onClick={() => onReact(comment.id, 'like')}
          disabled={!canReply}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px var(--space-2)',
            background: 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: comment.viewerReaction === 'like' ? 'var(--sell)' : 'var(--text-muted)',
            cursor: canReply ? 'pointer' : 'not-allowed',
            transition: 'all var(--duration-fast)',
            transform: comment.viewerReaction === 'like' ? 'scale(1.08)' : 'scale(1)',
          }}
          onMouseEnter={(e) => {
            if (comment.viewerReaction !== 'like') {
              e.currentTarget.style.color = 'var(--text-secondary)';
            }
          }}
          onMouseLeave={(e) => {
            if (comment.viewerReaction !== 'like') {
              e.currentTarget.style.color = 'var(--text-muted)';
            }
          }}
        >
          <Heart
            size={13}
            fill={comment.viewerReaction === 'like' ? 'currentColor' : 'none'}
            style={{
              transition: 'transform 180ms var(--ease-default), fill 180ms var(--ease-default)',
              animation: comment.viewerReaction === 'like' ? 'heartPop 260ms var(--ease-default)' : undefined,
            }}
          />
          {likeCount}
          </button>
          <button
            onClick={() => onReact(comment.id, 'dislike')}
            disabled={!canReply}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px var(--space-2)',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: comment.viewerReaction === 'dislike' ? 'var(--sell)' : 'var(--text-muted)',
              cursor: canReply ? 'pointer' : 'not-allowed',
              transition: 'all var(--duration-fast)',
              transform: comment.viewerReaction === 'dislike' ? 'scale(1.08)' : 'scale(1)',
            }}
          >
            <ThumbsDown
              size={13}
              fill={comment.viewerReaction === 'dislike' ? 'currentColor' : 'none'}
              style={{
                transition: 'transform 180ms var(--ease-default), fill 180ms var(--ease-default)',
                animation: comment.viewerReaction === 'dislike' ? 'dislikePop 260ms var(--ease-default)' : undefined,
              }}
            />
            {dislikeCount}
          </button>
          <button
            onClick={() => {
              if (replyMode === 'select') {
                onReply(comment.id, '');
                return;
              }
              setIsReplying((value) => !value);
            }}
            disabled={!canReply}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px var(--space-2)',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-ui)',
              fontSize: '12px',
              color: canReply ? 'var(--text-muted)' : 'var(--text-disabled)',
              cursor: canReply ? 'pointer' : 'not-allowed',
            }}
          >
            <MessageCircle size={12} />
            Reply
          </button>
        </div>

        {isReplying && (
          <div style={{ marginTop: 'var(--space-2)' }}>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value.slice(0, 280))}
              placeholder="Write a reply..."
              autoFocus
              style={{
                width: '100%',
                minHeight: 56,
                padding: 'var(--space-2)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-ui)',
                fontSize: '13px',
                color: 'var(--text-primary)',
                resize: 'vertical',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
              <button
                onClick={() => {
                  setReplyText('');
                  setIsReplying(false);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitReply}
                disabled={!replyText.trim()}
                style={{
                  background: replyText.trim() ? 'var(--brand)' : 'var(--bg-elevated)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: replyText.trim() ? 'white' : 'var(--text-muted)',
                  cursor: replyText.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: 'var(--space-1) var(--space-3)',
                }}
              >
                Reply
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
      {comment.replies?.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          canReply={canReply}
          onReply={onReply}
          onReact={onReact}
          depth={depth + 1}
          replyMode={replyMode}
        />
      ))}
    </div>
  );
}
