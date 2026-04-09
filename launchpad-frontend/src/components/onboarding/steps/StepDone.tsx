'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Compass, Rocket } from 'lucide-react';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useOnboarding } from '@/hooks/useOnboarding';

interface StepDoneProps {
  onClose: () => void;
  direction: 'forward' | 'back';
}

export function StepDone({ onClose, direction }: StepDoneProps) {
  const router = useRouter();
  const { username, profilePicUri } = useOnboardingStore();
  const { diceBearUrl } = useOnboarding();

  const avatarSrc = profilePicUri || diceBearUrl;
  const displayName = username.trim() || 'anon';

  const handleExplore = () => {
    onClose();
    router.push('/explore');
  };

  const handleLaunch = () => {
    onClose();
    router.push('/create');
  };

  const animClass =
    direction === 'forward' ? 'step-content-enter' : 'step-content-enter-reverse';

  return (
    <div className={animClass} key="step-done" style={{ textAlign: 'center' }}>
      {/* Animated Checkmark */}
      <div
        style={{
          margin: '0 auto 24px',
          width: 56,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          style={{ overflow: 'visible' }}
        >
          <circle
            cx="24"
            cy="24"
            r="22"
            stroke="var(--buy)"
            strokeWidth="2"
            fill="none"
            opacity="0.2"
          />
          <path
            d="M14 24 L21 31 L34 18"
            stroke="var(--buy)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray="40"
            strokeDashoffset="40"
            style={{
              animation: 'checkDraw 400ms var(--ease-default) 200ms both',
            }}
          />
        </svg>
      </div>

      {/* Title */}
      <h2
        className="stagger-fade"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '36px',
          color: 'var(--text-primary)',
          letterSpacing: '2px',
          marginBottom: 20,
          animationDelay: '400ms',
        }}
      >
        YOU&apos;RE IN, @{displayName}!
      </h2>

      {/* Avatar */}
      <div
        className="stagger-fade"
        style={{
          animationDelay: '500ms',
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 32,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            animation: 'glassCardEnter 300ms var(--ease-spring) 500ms both',
          }}
        >
          <img
            src={avatarSrc}
            alt={`@${displayName}`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </div>
      </div>

      {/* CTAs */}
      <div
        className="stagger-fade"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          animationDelay: '650ms',
        }}
      >
        <button className="glass-button-primary" onClick={handleExplore}>
          <Compass size={16} />
          Explore Tokens
        </button>

        <button className="glass-button-outlined" onClick={handleLaunch}>
          <Rocket size={16} />
          Launch a Token
        </button>
      </div>
    </div>
  );
}
