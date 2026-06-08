'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownRight, ArrowUpRight, Loader2,
  Copy, CheckCircle, ExternalLink, ArrowLeft, Send,
} from 'lucide-react';
import { useUserBalance } from '@/hooks/useUserBalance';
import { useWallet } from '@/providers/BscWalletProvider';
import { formatNumber, formatTimeAgo } from '@/lib/format';
import { API_BASE_URL, USDT_ADDRESS } from '@/lib/constants';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/store/uiStore';

// ERC-20 transfer(address,uint256) = 0xa9059cbb
function encodeERC20Transfer(to: string, amountWei: bigint): string {
  const selector = 'a9059cbb';
  const paddedTo = to.replace('0x', '').padStart(64, '0');
  const paddedAmount = amountWei.toString(16).padStart(64, '0');
  return `0x${selector}${paddedTo}${paddedAmount}`;
}

export default function WalletPage() {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
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

  const displayBalance = Number(totalAvailableUSDT) / 1e6;
  const isWalletUser = authType === 'wallet';
  const parsedAmount = parseFloat(amount) || 0;

  const syncVaultBalance = async () => {
    if (!authToken) return null;

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
      queryClient.invalidateQueries({ queryKey: ['userBalance'] });
      setDepositStep(3);
    }
    return data;
  };

  useEffect(() => {
    if (depositStep === 2) {
      const baselineBalance = totalAvailableUSDT;
      syncVaultBalance().catch(() => null);
      pollingRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['userBalance'] });
        syncVaultBalance().catch(() => null);
      }, 3000);

      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    }
  }, [depositStep, queryClient]);

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

  const handleWalletSend = async () => {
    if (!amount || !depositAddress || !address) return;
    const amountWei = BigInt(Math.floor(parsedAmount * 1e6)) * 1000000000000n;
    setWalletTxError(null);
    setWalletTxHash(null);
    setWalletTxPending(true);
    try {
      const data = encodeERC20Transfer(depositAddress, amountWei);
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
        message: `Withdrawal of ${withdrawnAmount} USDT queued!`,
      });
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

  useEffect(() => {
    if (activeTab === 'withdraw') fetchWithdrawalHistory();
  }, [activeTab]);

  const handleMintMockUsdt = async () => {
    if (!address) return;
    setWalletTxError(null);
    setWalletTxPending(true);
    try {
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

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px'
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '16px', outline: 'none'
  };
  const presetStyle: React.CSSProperties = {
    flex: 1, padding: 'var(--space-2)', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '13px', cursor: 'pointer'
  };
  const primaryBtn = (enabled: boolean): React.CSSProperties => ({
    width: '100%', padding: 'var(--space-3)', background: enabled ? 'var(--brand)' : 'var(--bg-elevated)',
    color: enabled ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-ui)', fontWeight: 600, cursor: enabled ? 'pointer' : 'not-allowed', marginTop: 'var(--space-2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.2s'
  });

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-5) var(--space-4)', paddingBottom: '100px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        
        {/* Balance Section */}
        <div style={{ textAlign: 'center', padding: 'var(--space-6) 0', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '48px', color: 'var(--text-primary)', fontWeight: 700 }}>
            {balanceLoading ? '...' : formatNumber(displayBalance)} USDT
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-muted)', marginTop: 8 }}>
            Total Available Balance
          </div>
        </div>

        {/* Action Tabs */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
          {(['deposit', 'withdraw'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); resetDeposit(); }}
              style={{
                flex: 1, padding: 'var(--space-3)', border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: activeTab === tab ? 'var(--brand)' : 'transparent',
                color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
                fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: '16px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
                transition: 'all 0.2s',
              }}
            >
              {tab === 'deposit' ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
              {tab === 'deposit' ? 'Deposit' : 'Withdraw'}
            </button>
          ))}
        </div>

        {/* Content Section */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)' }}>
          
          {/* DEPOSIT */}
          {activeTab === 'deposit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {depositStep === 1 && (
                <>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Enter the amount you want to deposit. You will then receive a unique deposit address to send USDT (BEP-20) to.
                  </div>
                  <div>
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
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[10, 50, 100, 500].map((v) => (
                      <button key={v} onClick={() => setAmount(String(v))} style={presetStyle}>${v}</button>
                    ))}
                  </div>
                  <button
                    onClick={goToStep2}
                    disabled={!parsedAmount || parsedAmount <= 0 || !depositAddress}
                    style={{...primaryBtn(!!parsedAmount && parsedAmount > 0 && !!depositAddress), padding: '16px'}}
                  >
                    {!depositAddress
                      ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Generating Address...</>
                      : 'Continue →'}
                  </button>
                </>
              )}

              {depositStep === 2 && (
                <>
                  <button
                    onClick={resetDeposit}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-ui)', fontSize: 14, padding: 0, marginBottom: 16 }}
                  >
                    <ArrowLeft size={16} /> Back
                  </button>

                  <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Send exactly this amount</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700, color: 'var(--buy)' }}>
                      {parsedAmount.toFixed(2)} <span style={{ fontSize: 16 }}>USDT</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>BEP-20 on BSC only</div>
                  </div>

                  <div>
                    <label style={labelStyle}>Send to this address</label>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input
                        readOnly
                        value={depositAddress ?? ''}
                        style={{ ...inputStyle, flex: 1, fontSize: 13, color: 'var(--text-muted)', cursor: 'text' }}
                      />
                      <button
                        onClick={copyAddress}
                        style={{
                          padding: '0 16px', borderRadius: 'var(--radius-md)',
                          background: copied ? 'var(--buy)' : 'var(--bg-elevated)',
                          border: '1px solid var(--border)',
                          color: copied ? '#fff' : 'var(--text-primary)',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                          fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14,
                          transition: 'all 0.15s', whiteSpace: 'nowrap',
                        }}
                      >
                        {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {isWalletUser && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                      {walletTxError && (
                        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--sell)', padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-sm)' }}>
                          {walletTxError}
                        </div>
                      )}
                      {walletTxHash ? (
                        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--buy)', padding: 12, background: 'rgba(34,197,94,0.1)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CheckCircle size={16} />
                          Transaction sent! Detecting deposit...
                          <a href={`https://testnet.bscscan.com/tx/${walletTxHash}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', marginLeft: 'auto' }}>
                            <ExternalLink size={16} />
                          </a>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={handleWalletSend}
                            disabled={walletTxPending}
                            style={{...primaryBtn(!walletTxPending), padding: '16px'}}
                          >
                            {walletTxPending
                              ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</>
                              : <><Send size={18} /> Send from Wallet</>}
                          </button>
                          <button
                            onClick={handleMintMockUsdt}
                            style={{ ...primaryBtn(true), background: 'transparent', border: '1px solid var(--buy)', color: 'var(--buy)', padding: '16px' }}
                          >
                            Bypass: Mint 10,000 Test USDT
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--text-muted)', justifyContent: 'center', marginTop: 16 }}>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                    Waiting for your deposit to be detected on-chain...
                  </div>
                </>
              )}

              {depositStep === 3 && (
                <div style={{ textAlign: 'center', padding: 'var(--space-6) 0' }}>
                  <div style={{ display: 'inline-flex', background: 'rgba(34,197,94,0.1)', padding: 'var(--space-4)', borderRadius: '50%', marginBottom: 'var(--space-4)' }}>
                    <CheckCircle size={48} color="var(--buy)" />
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', marginBottom: 8 }}>Deposit Successful!</h3>
                  <p style={{ fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', marginBottom: 24, fontSize: '15px' }}>
                    {parsedAmount.toFixed(2)} USDT has been added to your balance.
                  </p>
                  <button onClick={resetDeposit} style={{...primaryBtn(true), padding: '16px'}}>
                    Make another deposit
                  </button>
                </div>
              )}
            </div>
          )}

          {/* WITHDRAW */}
          {activeTab === 'withdraw' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {withdrawSuccess ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-6) 0' }}>
                  <div style={{ display: 'inline-flex', background: 'rgba(34,197,94,0.1)', padding: 'var(--space-4)', borderRadius: '50%', marginBottom: 'var(--space-4)' }}>
                    <CheckCircle size={48} color="var(--buy)" />
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', marginBottom: 8 }}>Withdrawal Queued</h3>
                  <p style={{ fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', marginBottom: 24, fontSize: '15px' }}>
                    {withdrawSuccess.amount} USDT is being sent to {withdrawSuccess.destination.slice(0,6)}...{withdrawSuccess.destination.slice(-4)}.
                  </p>
                  <button onClick={() => setWithdrawSuccess(null)} style={{...primaryBtn(true), padding: '16px'}}>
                    Make another withdrawal
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label style={labelStyle}>Amount to Withdraw (USDT)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      style={inputStyle}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                      <button
                        onClick={() => setAmount(displayBalance.toString())}
                        style={{ background: 'none', border: 'none', color: 'var(--brand)', fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Max: {formatNumber(displayBalance)} USDT
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Destination Wallet Address</label>
                    <input
                      type="text"
                      placeholder="0x..."
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <button
                    onClick={handleWithdraw}
                    disabled={!parsedAmount || parsedAmount <= 0 || parsedAmount > displayBalance || !destination || isWithdrawing}
                    style={{...primaryBtn(!!parsedAmount && parsedAmount > 0 && parsedAmount <= displayBalance && !!destination && !isWithdrawing), padding: '16px'}}
                  >
                    {isWithdrawing ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</> : 'Withdraw'}
                  </button>
                </>
              )}

              {/* History */}
              <div style={{ marginTop: 'var(--space-6)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-5)' }}>
                <h4 style={{ fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 600, marginBottom: 'var(--space-4)' }}>Recent Withdrawals</h4>
                {loadingHistory ? (
                  <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)' }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} /></div>
                ) : withdrawals.length === 0 ? (
                  <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: 14 }}>
                    No recent withdrawals.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {withdrawals.map((w: any) => (
                      <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                        <div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-primary)' }}>{Number(w.amount)/1e6} USDT</div>
                          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                            {new Date(w.createdAt).toLocaleDateString()} • {w.status}
                          </div>
                        </div>
                        {w.txHash && (
                          <a href={`https://testnet.bscscan.com/tx/${w.txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)' }}>
                            <ExternalLink size={16} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
