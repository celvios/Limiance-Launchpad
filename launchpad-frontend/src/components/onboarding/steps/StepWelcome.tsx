'use client';

import React from 'react';
import { Rocket, ArrowRight } from 'lucide-react';

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
          marginBottom: 32,
          animationDelay: '200ms',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(0, 255, 102, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <Rocket size={26} style={{ color: 'var(--buy)' }} />
        </div>
      </div>

      {/* Title */}
      <h1
        className="stagger-fade"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '52px',
          color: 'var(--text-primary)',
          textAlign: 'center',
          letterSpacing: '3px',
          lineHeight: 1,
          marginBottom: 20,
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
