'use client';

import React, { useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatTimeAgo } from '@/lib/format';
import type { TokenCardData } from '@/lib/types';

export function CommentModal() {
  const { activeModal, closeModal, modalData, addToast } = useUIStore();
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const token = modalData as TokenCardData | null;
  const isOpen = activeModal === 'comment-modal' && !!token;

  if (!isOpen || !token) return null;

  const handleSubmit = async () => {
    if (!commentText.trim()) return;
    
    setIsSubmitting(true);
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      addToast({ type: 'success', message: 'Reply posted!' });
      setCommentText('');
      closeModal();
    } catch (e) {
      addToast({ type: 'error', message: 'Failed to post reply' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title="Reply">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        
        {/* Parent Token Context */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', position: 'relative' }}>
          {/* Connecting line like X */}
          <div style={{ 
            position: 'absolute', 
            top: '40px', 
            bottom: '-20px', 
            left: '19px', 
            width: '2px', 
            background: 'var(--border)' 
          }} />

          {/* Token Avatar Placeholder */}
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: '14px', color: 'var(--text-muted)',
            flexShrink: 0, zIndex: 1,
            overflow: 'hidden'
          }}>
            {token.symbol.slice(0, 2)}
          </div>
          
          <div style={{ flex: 1, paddingBottom: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, color: 'var(--text-primary)' }}>
                ${token.symbol}
              </span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)' }}>
                @{token.creatorHandle} · {formatTimeAgo(token.createdAt)}
              </span>
            </div>
            <p style={{
              fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-secondary)',
              marginTop: '4px', lineHeight: 1.5,
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
            }}>
              {token.description}
            </p>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
              Replying to <span style={{ color: 'var(--brand)' }}>@{token.creatorHandle}</span>
            </div>
          </div>
        </div>

        {/* Reply Input Area */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
           {/* Current user avatar placeholder */}
           <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--brand-dim)', border: '1px solid var(--brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--brand)',
            flexShrink: 0, zIndex: 1,
            fontSize: '12px', fontWeight: 600
          }}>
            Me
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Post your reply"
              autoFocus
              style={{
                width: '100%',
                minHeight: '100px',
                background: 'transparent',
                border: 'none',
                resize: 'none',
                fontFamily: 'var(--font-ui)',
                fontSize: '16px',
                color: 'var(--text-primary)',
                outline: 'none',
                padding: 'var(--space-2) 0',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border)' }}>
              <Button 
                variant="primary" 
                size="sm" 
                onClick={handleSubmit} 
                disabled={!commentText.trim() || isSubmitting}
                style={{ borderRadius: '9999px', paddingLeft: '24px', paddingRight: '24px' }}
              >
                {isSubmitting ? 'Posting...' : 'Reply'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
