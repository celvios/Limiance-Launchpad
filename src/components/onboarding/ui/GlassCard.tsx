'use client';

import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  width?: number;
}

export function GlassCard({ children, className = '', width = 440 }: GlassCardProps) {
  return (
    <div
      className={`glass-card onboarding-card ${className}`}
      style={{
        width,
        maxWidth: '100%',
        position: 'relative',
        zIndex: 1,
      }}
    >
      {/* Content sits above the ::before pseudo-element */}
      <div style={{ position: 'relative', zIndex: 1, padding: '40px 36px' }}>
        {children}
      </div>
    </div>
  );
}
