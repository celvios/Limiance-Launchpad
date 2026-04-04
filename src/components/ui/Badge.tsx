import React from 'react';

export type BadgeVariant = 'buy' | 'sell' | 'new' | 'grad' | 'whale' | 'curve' | 'featured' | 'default';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  const baseStyles = 'font-mono uppercase text-[11px] px-2 py-0.5 rounded-sm inline-flex items-center justify-center leading-tight tracking-wide whitespace-nowrap';
  
  const variants: Record<BadgeVariant, string> = {
    buy: 'bg-[var(--buy)] text-[var(--bg-base)]',
    sell: 'bg-[var(--sell)] text-[var(--text-primary)]',
    new: 'bg-[var(--new)] text-[var(--text-primary)]',
    grad: 'bg-[var(--graduation)] text-[var(--bg-base)]',
    whale: 'bg-[var(--whale)] text-[var(--bg-base)]',
    curve: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
    featured: 'bg-gradient-to-r from-[#FFD700] to-[#F5A623] text-black font-bold shadow-[0_0_10px_rgba(255,215,0,0.4)]',
    default: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
