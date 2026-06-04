'use client';

import React, { useState } from 'react';
import { X, ArrowDownRight, ArrowUpRight, Loader2, Copy, CheckCircle, ExternalLink } from 'lucide-react';
import { useUserBalance } from '@/hooks/useUserBalance';
import { useWallet } from '@/providers/BscWalletProvider';
import { formatNumber } from '@/lib/format';
import { PAYMENT_ASSET, USDT_ADDRESS, BSC_RPC_URL } from '@/lib/constants';

interface DepositWithdrawModalProps {
  onClose: () => void;
}

// ERC-20 transfer(address,uint256) = 0xa9059cbb
function encodeERC20Transfer(to: string, amountWei: bigint): string {
  const selector = 'a9059cbb';
  const paddedTo = to.replace('0x', '').padStart(64, '0');
  const paddedAmount = amountWei.toString(16).padStart(64, '0');
  return `0x${selector}${paddedTo}${paddedAmount}`;
}

export function DepositWithdrawModal({ onClose }: DepositWithdrawModalProps) {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [copied, setCopied] = useState(false);
  const [walletTxHash, setWalletTxHash] = useState<string | null>(null);
  const [walletTxPending, setWalletTxPending] = useState(false);
  const [walletTxError, setWalletTxError] = useState<string | null>(null);

  const { authType, address } = useWallet();
  const { totalAvailableUSDT, depositAddress, testnetDeposit, isDepositing, withdraw, isWithdrawing } = useUserBalance();

  const displayBalance = Number(totalAvailableUSDT) / 1e6;
  const isWalletUser = authType === 'wallet';

  const copyAddress = () => {
    if (depositAddress) {
      navigator.clipboard.writeText(depositAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Wallet users: send USDT directly from their wallet to the vault address
  const handleWalletDeposit = async () => {
    if (!amount || isNaN(Number(amount)) || !depositAddress || !address) return;
    const amountWei = BigInt(Math.floor(Number(amount) * 1e6)); // USDT = 6 decimals
    setWalletTxError(null);
    setWalletTxHash(null);
    setWalletTxPending(true);

    try {
      const data = encodeERC20Transfer(depositAddress, amountWei);
      const txHash = await (window as any).ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: USDT_ADDRESS,
          data,
        }],
      });
      setWalletTxHash(txHash as string);
      setAmount('');
    } catch (err: any) {
      setWalletTxError(err?.message ?? 'Transaction rejected');
    } finally {
      setWalletTxPending(false);
    }
  };

  // Email users (testnet mock credit)
  const handleEmailDeposit = async () => {
    try {
      if (!amount || isNaN(Number(amount))) return;
      const amountWei = BigInt(Math.floor(Number(amount) * 1e6)).toString();
      const fakeTxHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
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
      if (!destination) return alert('Destination address required');
      const amountWei = BigInt(Math.floor(Number(amount) * 1e6)).toString();
      await withdraw({ amount: amountWei, destination });
      setAmount('');
      onClose();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to withdraw');
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', width: '90%', maxWidth: '420px',
          padding: 'var(--space-5)', display: 'flex', flexDirection: 'column',
          gap: 'var(--space-4)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          animation: 'cardEnter 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--text-primary)' }}>
            Platform Wallet
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Balance */}
        <div style={{ textAlign: 'center', padding: 'var(--space-3) 0', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '30px', color: 'var(--text-primary)', fontWeight: 600 }}>
            {formatNumber(displayBalance)} USDT
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginTop: 4 }}>
            Available Platform Balance
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', background: 'var(--bg-elevated)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
          {(['deposit', 'withdraw'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: 'var(--space-2)', border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: activeTab === tab ? 'var(--brand)' : 'transparent',
                color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
                fontFamily: 'var(--font-ui)', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
              }}
            >
              {tab === 'deposit' ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}
              {tab === 'deposit' ? 'Deposit' : 'Withdraw'}
            </button>
          ))}
        </div>

        {/* DEPOSIT TAB */}
        {activeTab === 'deposit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

            {/* Vault address (Email users only, or if we want to allow manual copy-paste for wallets later) */}
            {!isWalletUser && (
              <>
                <div>
                  <label style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Send USDT to this address (from any exchange or wallet)
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      readOnly
                      value={depositAddress ?? 'Generating address...'}
                      style={{
                        flex: 1, padding: 'var(--space-2) var(--space-3)',
                        background: 'var(--bg-base)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-mono)', fontSize: '12px', outline: 'none',
                      }}
                    />
                    <button
                      onClick={copyAddress}
                      disabled={!depositAddress}
                      style={{
                        padding: '0 var(--space-3)', background: copied ? 'var(--buy)' : 'var(--bg-elevated)',
                        border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                        color: copied ? '#fff' : 'var(--text-primary)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
                        fontFamily: 'var(--font-ui)', fontWeight: 600, transition: 'all 0.15s',
                      }}
                    >
                      {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginTop: 6 }}>
                    BEP-20 USDT only. Balance updates automatically after the transaction confirms.
                  </p>
                </div>
                <div style={{ height: 1, background: 'var(--border)' }} />
              </>
            )}

            {/* Wallet users: send directly from connected wallet */}
            {isWalletUser && (
              <>
                <label style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Amount (USDT) — send from your connected wallet
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{
                    width: '100%', padding: 'var(--space-3)',
                    background: 'var(--bg-base)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)', fontSize: '16px', outline: 'none',
                  }}
                />
                {walletTxError && (
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--sell)', padding: 'var(--space-2)', background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-sm)' }}>
                    {walletTxError}
                  </div>
                )}
                {walletTxHash && (
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--buy)', padding: 'var(--space-2)', background: 'rgba(34,197,94,0.1)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle size={14} />
                    Transaction sent! Balance updates in ~30s.
                    <a href={`https://testnet.bscscan.com/tx/${walletTxHash}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}
                <button
                  onClick={handleWalletDeposit}
                  disabled={walletTxPending || !amount || !depositAddress}
                  style={{
                    width: '100%', padding: 'var(--space-3)',
                    background: 'var(--brand)', color: '#fff', border: 'none',
                    borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-ui)',
                    fontWeight: 600, fontSize: '15px',
                    cursor: walletTxPending || !amount || !depositAddress ? 'not-allowed' : 'pointer',
                    opacity: walletTxPending || !amount || !depositAddress ? 0.7 : 1,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
                  }}
                >
                  {walletTxPending ? <Loader2 size={18} className="animate-spin" /> : !depositAddress ? 'Initializing...' : 'Confirm Deposit'}
                </button>
              </>
            )}

            {/* Email users: testnet mock credit */}
            {!isWalletUser && (
              <>
                <div style={{ padding: 'var(--space-3)', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                    <strong>Testnet:</strong> Use the mock credit below to add test funds instantly.
                  </p>
                </div>
                <label style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Mock Credit Amount (USDT)
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{
                    width: '100%', padding: 'var(--space-3)',
                    background: 'var(--bg-base)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)', fontSize: '16px', outline: 'none',
                  }}
                />
                <button
                  onClick={handleEmailDeposit}
                  disabled={isDepositing || !amount}
                  style={{
                    width: '100%', padding: 'var(--space-3)',
                    background: 'var(--brand)', color: '#fff', border: 'none',
                    borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-ui)',
                    fontWeight: 600, fontSize: '15px',
                    cursor: isDepositing || !amount ? 'not-allowed' : 'pointer',
                    opacity: isDepositing || !amount ? 0.7 : 1,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
                  }}
                >
                  {isDepositing ? <Loader2 size={18} className="animate-spin" /> : 'Add Test Funds'}
                </button>
              </>
            )}
          </div>
        )}

        {/* WITHDRAW TAB */}
        {activeTab === 'withdraw' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <label style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)' }}>
              Amount to Withdraw (USDT)
            </label>
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                width: '100%', padding: 'var(--space-3)',
                background: 'var(--bg-base)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)', fontSize: '16px', outline: 'none',
              }}
            />
            <label style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)' }}>
              Destination Wallet Address (BEP-20)
            </label>
            <input
              type="text"
              placeholder="0x..."
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              style={{
                width: '100%', padding: 'var(--space-3)',
                background: 'var(--bg-base)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)', fontSize: '13px', outline: 'none',
              }}
            />
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
              Withdrawals are processed on-chain within a few minutes.
            </p>
            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing || !amount || !destination}
              style={{
                width: '100%', padding: 'var(--space-3)',
                background: 'var(--sell)', color: '#fff', border: 'none',
                borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-ui)',
                fontWeight: 600, fontSize: '15px',
                cursor: isWithdrawing || !amount || !destination ? 'not-allowed' : 'pointer',
                opacity: isWithdrawing || !amount || !destination ? 0.7 : 1,
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
              }}
            >
              {isWithdrawing ? <Loader2 size={18} className="animate-spin" /> : 'Request Withdrawal'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
