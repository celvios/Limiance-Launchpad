import React from 'react';

interface SkeletonCardProps {
  className?: string;
  style?: React.CSSProperties;
}

export function SkeletonCard({ className = '', style }: SkeletonCardProps) {
  const shimmerBg = `linear-gradient(
    90deg,
    var(--bg-card) 0%,
    var(--bg-elevated) 50%,
    var(--bg-card) 100%
  )`;

  const shimmerStyle: React.CSSProperties = {
    background: shimmerBg,
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: 'var(--radius-sm)',
  };

  return (
    <div
      className={className}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        ...style,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
        <div style={{ ...shimmerStyle, width: 48, height: 48, borderRadius: 'var(--radius-md)' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ ...shimmerStyle, width: '60%', height: 16 }} />
          <div style={{ ...shimmerStyle, width: '40%', height: 12 }} />
        </div>
      </div>

      {/* Description */}
      <div style={{ ...shimmerStyle, width: '100%', height: 14 }} />
      <div style={{ ...shimmerStyle, width: '75%', height: 14 }} />

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
        <div style={{ ...shimmerStyle, flex: 1, height: 40 }} />
        <div style={{ ...shimmerStyle, flex: 1, height: 40 }} />
        <div style={{ ...shimmerStyle, flex: 1, height: 40 }} />
      </div>

      {/* Sparkline */}
      <div style={{ ...shimmerStyle, width: '100%', height: 32 }} />

      {/* Supply bar */}
      <div style={{ ...shimmerStyle, width: '100%', height: 6 }} />

      {/* Footer */}
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <div style={{ ...shimmerStyle, width: 72, height: 32 }} />
        <div style={{ ...shimmerStyle, width: 48, height: 32 }} />
        <div style={{ ...shimmerStyle, width: 48, height: 32 }} />
      </div>
    </div>
  );
}
