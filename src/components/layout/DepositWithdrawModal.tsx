'use client';

import React, { useState } from 'react';
import { X, ArrowDownRight, ArrowUpRight, Loader2 } from 'lucide-react';
import { useUserBalance } from '@/hooks/useUserBalance';
import { formatNumber } from '@/lib/format';

interface DepositWithdrawModalProps {
  onClose: () => void;
}

export function DepositWithdrawModal({ onClose }: DepositWithdrawModalProps) {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const { totalAvailableUSDT, testnetDeposit, isDepositing, withdraw, isWithdrawing } = useUserBalance();

  const handleDeposit = async () => {
    try {
      if (!amount || isNaN(Number(amount))) return;
      const amountWei = BigInt(Math.floor(Number(amount) * 1e6)).toString();
      // On a real mainnet, this would first trigger a wagmi sendTransaction / writeContract
      // For now on testnet, we simulate it
      const fakeTxHash = `0x${Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('')}`;
      await testnetDeposit({ amount: amountWei, txHash: fakeTxHash });
      setAmount('');
      onClose();
    } catch (err) {
      console.error('Deposit failed', err);
      alert('Failed to deposit');
    }
  };

  const handleWithdraw = async () => {
    try {
      if (!amount || isNaN(Number(amount))) return;
      if (!destination) return alert('Destination required');
      const amountWei = BigInt(Math.floor(Number(amount) * 1e6)).toString();
      await withdraw({ amount: amountWei, destination });
      setAmount('');
      onClose();
    } catch (err) {
      console.error('Withdraw failed', err);
      alert('Failed to withdraw');
    }
  };

  const displayBalance = Number(totalAvailableUSDT) / 1e6;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          width: '90%',
          maxWidth: '400px',
          padding: 'var(--space-5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          animation: 'cardEnter 0.2s ease-out',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--text-primary)' }}>
            Platform Wallet
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', background: 'var(--bg-elevated)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
          <button
            onClick={() => setActiveTab('deposit')}
            style={{
              flex: 1,
              padding: 'var(--space-2)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: activeTab === 'deposit' ? 'var(--brand)' : 'transparent',
              color: activeTab === 'deposit' ? '#fff' : 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <ArrowDownRight size={16} /> Deposit
          </button>
          <button
            onClick={() => setActiveTab('withdraw')}
            style={{
              flex: 1,
              padding: 'var(--space-2)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: activeTab === 'withdraw' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'withdraw' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <ArrowUpRight size={16} /> Withdraw
          </button>
        </div>

        <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '32px', color: 'var(--text-primary)', fontWeight: 600 }}>
            {formatNumber(displayBalance)} USDT
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)' }}>
            Available Platform Balance
          </div>
        </div>

        {activeTab === 'deposit' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Amount to Deposit (USDT)
            </label>
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '16px',
                outline: 'none',
              }}
            />
            <button
              onClick={handleDeposit}
              disabled={isDepositing || !amount}
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                background: 'var(--brand)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-ui)',
                fontWeight: 600,
                fontSize: '15px',
                cursor: isDepositing ? 'not-allowed' : 'pointer',
                opacity: isDepositing || !amount ? 0.7 : 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-2)'
              }}
            >
              {isDepositing ? <Loader2 size={18} className="animate-spin" /> : 'Confirm Deposit (Testnet Mock)'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Amount to Withdraw (USDT)
            </label>
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '16px',
                outline: 'none',
              }}
            />
            
            <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
              Destination Address
            </label>
            <input
              type="text"
              placeholder="0x..."
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
            
            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing || !amount || !destination}
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                background: 'var(--sell)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-ui)',
                fontWeight: 600,
                fontSize: '15px',
                cursor: isWithdrawing ? 'not-allowed' : 'pointer',
                opacity: isWithdrawing || !amount || !destination ? 0.7 : 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-2)'
              }}
            >
              {isWithdrawing ? <Loader2 size={18} className="animate-spin" /> : 'Confirm Withdraw'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
