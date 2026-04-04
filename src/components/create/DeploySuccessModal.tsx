'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateTokenStore } from '@/hooks/useCreateToken';
import { Button } from '@/components/ui/Button';
import { Copy, ExternalLink, Plus } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { formatAddress } from '@/lib/format';

/* ── Deploy Success Modal ──
 * Shown after token deploy succeeds.
 * Full-screen overlay with checkmark animation.
 */

export function DeploySuccessModal() {
  const router = useRouter();
  const { deployMint, deployState, formData, reset } = useCreateTokenStore();
  const addToast = useUIStore((s) => s.addToast);

  const isOpen = deployState === 'success' && !!deployMint;

  // Launch confetti on success
  useEffect(() => {
    if (!isOpen) return;
    import('canvas-confetti').then((confetti) => {
      confetti.default({
        particleCount: 80,
        spread: 70,
        colors: ['#00FF66', '#FF2D55', '#FFE500'],
        origin: { y: 0.5, x: 0.5 },
      });
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyMint = () => {
    if (deployMint) {
      navigator.clipboard.writeText(deployMint);
      addToast({ type: 'success', message: 'Mint address copied!' });
    }
  };

  const handleViewToken = () => {
    if (deployMint) {
      router.push(`/token/${deployMint}`);
    }
  };

  const handleShareTwitter = () => {
    const text = `I just launched $${formData.symbol} on LAUNCH! 🚀\n\nCheck it out: ${window.location.origin}/token/${deployMint}`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      '_blank'
    );
  };

  const handleCreateAnother = () => {
    reset();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--overlay-hard)',
        animation: 'fadeIn 300ms var(--ease-default)',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-7)',
          maxWidth: 440,
          width: '90%',
          textAlign: 'center',
          animation: 'slideUp 400ms var(--ease-spring)',
          boxShadow: 'var(--shadow-modal)',
        }}
      >
        {/* Success checkmark */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'var(--buy-dim)',
            border: '3px solid var(--buy)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-5)',
            animation: 'checkmarkPop 500ms var(--ease-spring)',
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            stroke="var(--buy)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M6 16 L13 23 L26 10"
              style={{
                strokeDasharray: 40,
                strokeDashoffset: 0,
                animation: 'drawCheck 600ms var(--ease-default) 200ms backwards',
              }}
            />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '32px',
            color: 'var(--text-primary)',
            letterSpacing: '2px',
            marginBottom: 'var(--space-2)',
          }}
        >
          TOKEN LAUNCHED!
        </div>
        <div
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '15px',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-5)',
          }}
        >
          ${formData.symbol} is now live
        </div>

        {/* Mint address */}
        <button
          onClick={handleCopyMint}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
            width: '100%',
            padding: 'var(--space-3)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            marginBottom: 'var(--space-5)',
            transition: 'border-color var(--duration-fast)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--text-secondary)',
            }}
          >
            {deployMint ? formatAddress(deployMint) : ''}
          </span>
          <Copy size={14} style={{ color: 'var(--text-muted)' }} />
        </button>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Button
            variant="buy"
            size="lg"
            onClick={handleViewToken}
            style={{
              width: '100%',
              fontFamily: 'var(--font-display)',
              letterSpacing: '2px',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              VIEW TOKEN PAGE <ExternalLink size={14} />
            </span>
          </Button>

          <Button
            variant="outline"
            size="md"
            onClick={handleShareTwitter}
            style={{ width: '100%' }}
          >
            Share on 𝕏
          </Button>

          <Button
            variant="ghost"
            size="md"
            onClick={handleCreateAnother}
            style={{ width: '100%' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Plus size={14} /> Create Another
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
