'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { LimianceLogo } from '@/components/ui/LimianceLogo';

interface StepWelcomeProps {
  onNext: () => void;
}

export function StepWelcome({ onNext }: StepWelcomeProps) {
  return (
    <div className="step-content-enter">
      {/* Logo */}
      <div
        className="stagger-fade"
        style={{
          textAlign: 'center',
          marginBottom: 24,
          animationDelay: '200ms',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <LimianceLogo size={36} />
      </div>

      {/* Title */}
      <h1
        className="stagger-fade"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '40px',
          color: 'var(--text-primary)',
          textAlign: 'center',
          letterSpacing: '3px',
          lineHeight: 1,
          marginBottom: 16,
          animationDelay: '280ms',
        }}
      >
        WELCOME TO
        <br />
        LAUNCH
      </h1>

      {/* Subtitle */}
      <div
        className="stagger-fade"
        style={{
          textAlign: 'center',
          marginBottom: 8,
          animationDelay: '360ms',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '15px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          The social token launchpad
          <br />
          on Solana.
        </p>
      </div>

      <div
        className="stagger-fade"
        style={{
          textAlign: 'center',
          marginBottom: 36,
          animationDelay: '440ms',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '14px',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
          }}
        >
          Create tokens. Trade early.
          <br />
          Watch them go to Raydium.
        </p>
      </div>

      {/* CTA */}
      <div
        className="stagger-fade"
        style={{ animationDelay: '520ms' }}
      >
        <button className="glass-button-primary" onClick={onNext}>
          Get Started
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
