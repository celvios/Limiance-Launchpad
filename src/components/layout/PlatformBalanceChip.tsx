'use client';

import React, { useState } from 'react';
import { Wallet, ArrowDownRight, ArrowUpRight, Loader2 } from 'lucide-react';
import { useUserBalance } from '@/hooks/useUserBalance';
import { useWallet } from '@/providers/BscWalletProvider';
import { DepositWithdrawModal } from './DepositWithdrawModal';
import { formatNumber } from '@/lib/format';

export function PlatformBalanceChip() {
  const { connected } = useWallet();
  const { totalAvailableUSDT, isLoading } = useUserBalance();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!connected) return null;

  const displayBalance = Number(totalAvailableUSDT) / 1e6;

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-1) var(--space-3)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-full)',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          transition: 'all var(--duration-fast)',
          marginLeft: 'auto', // Pushes it to the right if in flex row
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--brand)';
          e.currentTarget.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <Wallet size={14} color="var(--brand)" />
        {isLoading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <span>{formatNumber(displayBalance)} USDT</span>
        )}
      </button>

      {isModalOpen && (
        <DepositWithdrawModal onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
}
