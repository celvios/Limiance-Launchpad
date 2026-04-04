'use client';

import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Tabs } from '@/components/ui/Tabs';
import { CommentItem } from '@/components/social/CommentItem';
import { useComments, usePostComment, useUpvoteComment } from '@/hooks/useComments';
import type { CommentSort } from '@/lib/types';

const SORT_TABS = [
  { id: 'top', label: 'Top' },
  { id: 'new', label: 'New' },
];

interface CommentSectionProps {
  mint: string;
}

export function CommentSection({ mint }: CommentSectionProps) {
  const [sort, setSort] = useState<CommentSort>('new');
  const [text, setText] = useState('');
  const { publicKey, connected } = useWallet();

  const { data, isLoading, isError } = useComments(mint, sort);
  const postMutation = usePostComment(mint);
  const upvoteMutation = useUpvoteComment(mint);

  const handlePost = () => {
    if (!text.trim() || !publicKey) return;
    postMutation.mutate(
      { text: text.trim(), walletAddress: publicKey.toBase58() },
      { onSuccess: () => setText('') }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePost();
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-3)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '12px',
            letterSpacing: '2px',
            color: 'var(--text-muted)',
          }}
        >
          COMMENTS{data ? ` (${data.total})` : ''}
        </div>
      </div>

      {/* Sort tabs */}
      <Tabs
        tabs={SORT_TABS}
        activeTab={sort}
        onTabChange={(id) => setSort(id as CommentSort)}
      />

      {/* Comment input */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          marginTop: 'var(--space-4)',
          marginBottom: 'var(--space-3)',
        }}
      >
        {/* Avatar */}
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
            fontSize: '14px',
            flexShrink: 0,
          }}
        >
          {connected ? '🟢' : '👤'}
        </div>

        <div style={{ flex: 1 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 280))}
            onKeyDown={handleKeyDown}
            placeholder={
              connected
                ? 'Type a comment...'
                : 'Connect wallet to comment'
            }
            disabled={!connected}
            style={{
              width: '100%',
              minHeight: 60,
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-ui)',
              fontSize: '14px',
              color: 'var(--text-primary)',
              resize: 'vertical',
              outline: 'none',
              transition: 'border-color var(--duration-fast)',
              opacity: connected ? 1 : 0.5,
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 'var(--space-1)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: text.length > 250 ? 'var(--sell)' : 'var(--text-muted)',
              }}
            >
              {text.length}/280
            </span>
            <button
              onClick={handlePost}
              disabled={!text.trim() || !connected || postMutation.isPending}
              style={{
                padding: 'var(--space-1) var(--space-4)',
                background: text.trim() && connected
                  ? 'var(--text-primary)'
                  : 'var(--bg-elevated)',
                color: text.trim() && connected
                  ? 'var(--bg-base)'
                  : 'var(--text-muted)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-ui)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: text.trim() && connected ? 'pointer' : 'not-allowed',
                transition: 'all var(--duration-fast)',
                opacity: postMutation.isPending ? 0.6 : 1,
              }}
            >
              {postMutation.isPending ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      </div>

      {/* Comments list */}
      {isLoading && (
        <div style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 60,
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-2)',
                animation: 'shimmer 1.5s infinite',
                backgroundImage:
                  'linear-gradient(90deg, var(--bg-card) 0%, var(--bg-elevated) 50%, var(--bg-card) 100%)',
                backgroundSize: '200% 100%',
              }}
            />
          ))}
        </div>
      )}

      {isError && (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-5)',
            fontFamily: 'var(--font-ui)',
            fontSize: '14px',
            color: 'var(--text-muted)',
          }}
        >
          Failed to load comments.
        </div>
      )}

      {data && data.comments.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-6)',
            fontFamily: 'var(--font-ui)',
            fontSize: '14px',
            color: 'var(--text-muted)',
          }}
        >
          No comments yet. Be the first!
        </div>
      )}

      {data && data.comments.length > 0 && (
        <div>
          {data.comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onUpvote={(id) => upvoteMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
