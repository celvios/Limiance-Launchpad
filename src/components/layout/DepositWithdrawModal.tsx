'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  X, ArrowDownRight, ArrowUpRight, Loader2,
  Copy, CheckCircle, ExternalLink, ArrowLeft, Send,
} from 'lucide-react';
import { useUserBalance } from '@/hooks/useUserBalance';
import { useWallet } from '@/providers/BscWalletProvider';
import { formatNumber, formatTimeAgo } from '@/lib/format';
import { API_BASE_URL, USDT_ADDRESS } from '@/lib/constants';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/store/uiStore';

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
  // Deposit flow steps: 1=enter amount, 2=show address, 3=detected
  const [depositStep, setDepositStep] = useState<1 | 2 | 3>(1);
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [copied, setCopied] = useState(false);
  const [walletTxHash, setWalletTxHash] = useState<string | null>(null);
  const [walletTxPending, setWalletTxPending] = useState(false);
  const [walletTxError, setWalletTxError] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState<{amount: string; destination: string} | null>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const { authType, address, token: authToken } = useWallet();
  const { addToast } = useUIStore();
  const {
    totalAvailableUSDT,
    depositAddress,
    isLoading: balanceLoading,
    withdraw,
  } = useUserBalance();
  const queryClient = useQueryClient();
  const prevBalanceRef = useRef<bigint>(totalAvailableUSDT);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncInProgressRef = useRef<boolean>(false);

  const displayBalance = Number(totalAvailableUSDT) / 1e6;
  const isWalletUser = authType === 'wallet';
  const parsedAmount = parseFloat(amount) || 0;

  const syncVaultBalance = async () => {
    if (!authToken) return null;
    if (syncInProgressRef.current) return null; // prevent concurrent calls
    syncInProgressRef.current = true;

    try {
      const res = await fetch(`${API_BASE_URL}/deposits/sync-vault`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (data.credited) {
        // Stop polling immediately — no more sync calls
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        queryClient.invalidateQueries({ queryKey: ['userBalance'] });
        setDepositStep(3);
      }
      return data;
    } finally {
      syncInProgressRef.current = false;
    }
  };

  // ── Step 2: poll for balance change after showing address ──────────────────
  useEffect(() => {
    if (depositStep === 2) {
      syncVaultBalance().catch(() => null);
      pollingRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['userBalance'] });
        syncVaultBalance().catch(() => null);
      }, 5000); // slowed from 3s to 5s to reduce server load

      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    }
  }, [depositStep, queryClient]); // Do NOT depend on totalAvailableUSDT here!

  // Detect when balance increases and move to step 3
  useEffect(() => {
    if (depositStep === 2 && totalAvailableUSDT > prevBalanceRef.current) {
      setDepositStep(3);
    } else if (depositStep === 1) {
      prevBalanceRef.current = totalAvailableUSDT;
    }
  }, [totalAvailableUSDT, depositStep]);

  const copyAddress = () => {
    if (depositAddress) {
      navigator.clipboard.writeText(depositAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const goToStep2 = () => {
    if (!parsedAmount || parsedAmount <= 0) return;
    setDepositStep(2);
  };

  const verifyDepositTx = async (txHash: string) => {
    if (!authToken) throw new Error('Not authenticated');

    const expectedAmount = BigInt(Math.floor(parsedAmount * 1e6)).toString();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const res = await fetch(`${API_BASE_URL}/deposits/verify-tx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ txHash, expectedAmount }),
      });

      if (res.status === 202) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? 'Deposit could not be verified');
      }

      queryClient.invalidateQueries({ queryKey: ['userBalance'] });
      setDepositStep(3);
      return data;
    }

    throw new Error('Deposit transaction is still pending. Keep this window open or check again shortly.');
  };

  // Wallet users: send USDT directly from their wallet to the vault address
  const handleWalletSend = async () => {
    if (!amount || !depositAddress || !address) return;
    // MockUSDT is 18 decimals on-chain!
    const amountWei = BigInt(Math.floor(parsedAmount * 1e6)) * 1000000000000n;
    setWalletTxError(null);
    setWalletTxHash(null);
    setWalletTxPending(true);
    try {
      const data = encodeERC20Transfer(depositAddress, amountWei);
      
      // Estimate gas first so we get a readable error if the user lacks USDT
      try {
        await (window as any).ethereum.request({
          method: 'eth_estimateGas',
          params: [{ from: address, to: USDT_ADDRESS, data }],
        });
      } catch (estError: any) {
        throw new Error('Transaction will fail. Please ensure you have enough USDT in your wallet.');
      }

      const txHash = await (window as any).ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to: USDT_ADDRESS, data }],
      });
      setWalletTxHash(txHash as string);
      await verifyDepositTx(txHash as string);
    } catch (err: any) {
      // Clean up MetaMask's default RPC errors which are confusing
      const msg = err?.message ?? 'Transaction rejected';
      if (msg.includes('gas limit too high')) {
        setWalletTxError('Transaction failed estimation. Ensure you have enough USDT.');
      } else {
        setWalletTxError(msg);
      }
    } finally {
      setWalletTxPending(false);
    }
  };

  const handleWithdraw = async () => {
    if (!amount || !destination) return;
    setIsWithdrawing(true);
    try {
      const amountWei = BigInt(Math.round(parsedAmount * 1e6)).toString();
      await withdraw({ amount: amountWei, destination });
      const withdrawnAmount = parsedAmount.toFixed(2);
      const dest = destination;
      setAmount('');
      setDestination('');
      setWithdrawSuccess({ amount: withdrawnAmount, destination: dest });
      addToast({
        type: 'success',
        message: `Withdrawal of ${withdrawnAmount} USDT queued! It will be sent to ${dest.slice(0,6)}...${dest.slice(-4)} on-chain shortly.`,
      });
      // Refresh withdrawal history
      fetchWithdrawalHistory();
    } catch (err: any) {
      addToast({ type: 'error', message: err?.message ?? 'Failed to withdraw' });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const fetchWithdrawalHistory = async () => {
    if (!address || !authToken) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE_URL}/deposits/withdrawals/${address}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWithdrawals(data.withdrawals ?? []);
      }
    } catch {}
    finally { setLoadingHistory(false); }
  };

  // Load withdrawal history when switching to withdraw tab
  useEffect(() => {
    if (activeTab === 'withdraw') fetchWithdrawalHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleMintMockUsdt = async () => {
    if (!address) return;
    setWalletTxError(null);
    setWalletTxPending(true);
    try {
      // Encode faucet(uint256) with 10,000 * 10^18
      const selector = '57915897';
      const amountToMint = BigInt(10000) * 1000000000000000000n;
      const paddedAmount = amountToMint.toString(16).padStart(64, '0');
      const data = `0x${selector}${paddedAmount}`;

      const txHash = await (window as any).ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to: USDT_ADDRESS, data }],
      });
      setWalletTxHash(txHash as string);
    } catch (err: any) {
      setWalletTxError(err?.message ?? 'Failed to mint test funds');
    } finally {
      setWalletTxPending(false);
    }
  };

  const resetDeposit = () => {
    setDepositStep(1);
    setAmount('');
    setWalletTxHash(null);
    setWalletTxError(null);
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
            {balanceLoading ? '...' : formatNumber(displayBalance)} USDT
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
              onClick={() => { setActiveTab(tab); resetDeposit(); }}
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

        {/* ── DEPOSIT TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'deposit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

            {/* STEP 1 — Enter amount */}
            {depositStep === 1 && (
              <>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Enter the amount you want to deposit. You will then receive a unique deposit address to send USDT (BEP-20) to.
                </div>
                <label style={labelStyle}>Amount to Deposit (USDT)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  min="1"
                  onChange={(e) => setAmount(e.target.value)}
                  style={inputStyle}
                  onKeyDown={(e) => e.key === 'Enter' && goToStep2()}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  {[10, 50, 100, 500].map((v) => (
                    <button key={v} onClick={() => setAmount(String(v))} style={presetStyle}>${v}</button>
                  ))}
                </div>
                <button
                  onClick={goToStep2}
                  disabled={!parsedAmount || parsedAmount <= 0 || !depositAddress}
                  style={primaryBtn(!!parsedAmount && parsedAmount > 0 && !!depositAddress)}
                >
                  {!depositAddress
                    ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generating Address...</>
                    : 'Continue →'}
                </button>
              </>
            )}

            {/* STEP 2 — Show address, wait for payment */}
            {depositStep === 2 && (
              <>
                <button
                  onClick={resetDeposit}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-ui)', fontSize: 12, padding: 0 }}
                >
                  <ArrowLeft size={14} /> Back
                </button>

                {/* Amount highlight */}
                <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Send exactly this amount</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700, color: 'var(--buy)' }}>
                    {parsedAmount.toFixed(2)} <span style={{ fontSize: 14 }}>USDT</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>BEP-20 on BSC only</div>
                </div>

                {/* Deposit address */}
                <div>
                  <label style={labelStyle}>Send to this address</label>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <input
                      readOnly
                      value={depositAddress ?? ''}
                      style={{ ...inputStyle, flex: 1, fontSize: 11, color: 'var(--text-muted)', cursor: 'text' }}
                    />
                    <button
                      onClick={copyAddress}
                      style={{
                        padding: '0 12px', borderRadius: 'var(--radius-md)',
                        background: copied ? 'var(--buy)' : 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        color: copied ? '#fff' : 'var(--text-primary)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                        fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13,
                        transition: 'all 0.15s', whiteSpace: 'nowrap',
                      }}
                    >
                      {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Wallet users: also offer "Send from Wallet" button */}
                {isWalletUser && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {walletTxError && (
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--sell)', padding: 8, background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-sm)' }}>
                        {walletTxError}
                      </div>
                    )}
                    {walletTxHash ? (
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--buy)', padding: 8, background: 'rgba(34,197,94,0.1)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle size={14} />
                        Transaction sent! Detecting deposit...
                        <a href={`https://testnet.bscscan.com/tx/${walletTxHash}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', marginLeft: 'auto' }}>
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={handleWalletSend}
                          disabled={walletTxPending}
                          style={primaryBtn(!walletTxPending)}
                        >
                          {walletTxPending
                            ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</>
                            : <><Send size={15} /> Send from Wallet</>}
                        </button>
                        <button
                          onClick={handleMintMockUsdt}
                          style={{ ...primaryBtn(true), background: 'transparent', border: '1px solid var(--buy)', color: 'var(--buy)' }}
                        >
                          Bypass: Mint 10,000 Test USDT
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Waiting indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-muted)', justifyContent: 'center' }}>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                  Waiting for your deposit to be detected on-chain...
                </div>
              </>
            )}

            {/* STEP 3 — Detected! */}
            {depositStep === 3 && (
              <>
                <div style={{ textAlign: 'center', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle size={28} color="var(--buy)" />
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text-primary)' }}>Deposit Detected!</div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Your USDT has been credited to your platform balance.
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700, color: 'var(--buy)' }}>
                    {formatNumber(displayBalance)} USDT
                  </div>
                </div>
                <button onClick={onClose} style={primaryBtn(true)}>Done</button>
              </>
            )}
          </div>
        )}

        {/* ── WITHDRAW TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'withdraw' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

            {/* Success state */}
            {withdrawSuccess ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'center' }}>
                <CheckCircle size={40} color="var(--buy)" />
                <div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Withdrawal Queued!</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
                    {withdrawSuccess.amount} USDT → {withdrawSuccess.destination.slice(0,8)}...{withdrawSuccess.destination.slice(-6)}
                  </div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                    Your withdrawal is being processed on-chain by our system. It may take a few minutes.
                  </div>
                </div>
                <button onClick={() => setWithdrawSuccess(null)} style={primaryBtn(true)}>Make Another Withdrawal</button>
                <button onClick={onClose} style={{ ...primaryBtn(true), background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Close</button>
              </div>
            ) : (
              <>
                <label style={labelStyle}>Amount to Withdraw (USDT)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={inputStyle}
                />
                <label style={labelStyle}>Destination Wallet Address (BEP-20)</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  style={{ ...inputStyle, fontSize: 13 }}
                />
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                  Withdrawals are sent on-chain to your BEP-20 address. Maximum: {formatNumber(displayBalance)} USDT.
                </p>
                <button
                  onClick={handleWithdraw}
                  disabled={isWithdrawing || !amount || !destination || parsedAmount > displayBalance}
                  style={{ ...primaryBtn(!isWithdrawing && !!amount && !!destination && parsedAmount <= displayBalance), background: 'var(--sell)' }}
                >
                  {isWithdrawing ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</> : 'Request Withdrawal'}
                </button>
              </>
            )}

            {/* ── Withdrawal History ─────────────────────────────────── */}
            {withdrawals.length > 0 && (
              <div style={{ marginTop: 'var(--space-2)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-3)' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, letterSpacing: 2, color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>WITHDRAWAL HISTORY</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {withdrawals.map((w) => (
                    <div key={w.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: 'var(--space-2) var(--space-3)',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      gap: 'var(--space-3)',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>
                          {(Number(w.amount) / 1e6).toFixed(2)} USDT
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          → {w.destination}
                        </div>
                        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {formatTimeAgo(w.createdAt)}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        {w.status === 'completed' && w.txHash ? (
                          <a href={`https://bscscan.com/tx/${w.txHash}`} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--buy)', textDecoration: 'none' }}>
                            <CheckCircle size={12} /> Sent <ExternalLink size={10} />
                          </a>
                        ) : w.status === 'failed' ? (
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--sell)' }}>Failed</span>
                        ) : (
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Pending
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: '12px',
  color: 'var(--text-muted)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-3)',
  background: 'var(--bg-base)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '16px',
  outline: 'none',
  boxSizing: 'border-box',
};

const presetStyle: React.CSSProperties = {
  flex: 1,
  padding: '6px 0',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
};

function primaryBtn(enabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: 'var(--space-3)',
    background: enabled ? 'var(--brand)' : 'var(--bg-elevated)',
    color: enabled ? '#fff' : 'var(--text-muted)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-ui)',
    fontWeight: 600,
    fontSize: '15px',
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.6,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    transition: 'all 0.15s',
  };
}
