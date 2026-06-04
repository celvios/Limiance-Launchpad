'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useWallet } from '@/providers/BscWalletProvider';
import { useUIStore } from '@/store/uiStore';
import { Button } from '@/components/ui/Button';
import { calculateBuyPrice, onChainSellReturn } from '@/lib/curve/math';
import { formatNumber } from '@/lib/format';
import { API_BASE_URL, BSC_CHAIN_ID, DEX_NAME } from '@/lib/constants';
import { useUserBalance } from '@/hooks/useUserBalance';
import { useUserTokenBalance } from '@/hooks/useUserTokenBalance';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import type { TokenDetail } from '@/lib/types';

interface TradePanelProps {
  token: TokenDetail;
}

type TradeTab = 'buy' | 'sell';
type TxState = 'idle' | 'confirming' | 'success' | 'error';

const USDT_PRESETS = [25, 50, 100, 250];
const SELL_PCTS   = [25, 50, 75, 100];

export function TradePanel({ token }: TradePanelProps) {
  const { address } = useWallet();
  const openWalletDrawer = useUIStore((s) => s.openWalletDrawer);
  const addToast = useUIStore((s) => s.addToast);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TradeTab>('buy');
  const [inputValue, setInputValue] = useState('');
  const [txState, setTxState] = useState<TxState>('idle');

  const { totalAvailableUSDT, isLoading: balanceLoading } = useUserBalance();
  const { token: authToken } = useAuth();

  // Token balance on platform (for sell tab)
  const tokenId = token.tokenAddress ?? token.mint;
  const { tokenBalance, tokenBalanceWei, invalidate: invalidateTokenBal } = useUserTokenBalance(tokenId, address);

  const inputAmount = parseFloat(inputValue) || 0;
  const isGraduated = token.status === 'graduated';
  const usdtBalance = Number(totalAvailableUSDT) / 1e6;

  // ── Buy estimate ──────────────────────────────────────────────────────────
  const buyEstimate = useMemo(() => {
    if (activeTab !== 'buy' || inputAmount <= 0) return null;
    return calculateBuyPrice(inputAmount, token.currentSupply, token.curveParams);
  }, [activeTab, inputAmount, token.currentSupply, token.curveParams]);

  // ── Sell estimate ─────────────────────────────────────────────────────────
  const sellEstimate = useMemo(() => {
    if (activeTab !== 'sell' || inputAmount <= 0) return null;
    try {
      const cp = token.curveParams as any;
      const params = {
        pMin:   BigInt(Math.round((cp.pMin ?? cp.a ?? 0.00001) * 1e18)),
        paramA: BigInt(Math.round((cp.pMax ?? cp.maxPrice ?? 0.1) * 1e18)),
        paramB: BigInt(Math.round((cp.k ?? 0.002) * 1e6)),
        paramC: BigInt(Math.round(cp.midpoint ?? cp.s0 ?? token.currentSupply * 0.5)),
      };
      const sellWei = BigInt(Math.round(inputAmount * 1e18));
      const returnWei = onChainSellReturn('sigmoid', params, BigInt(token.totalSupply), BigInt(token.currentSupply), sellWei);
      const usdtReturn = Number(returnWei) / 1e6; // platform USDT is 6 dp
      return { usdtReturn };
    } catch {
      return null;
    }
  }, [activeTab, inputAmount, token.curveParams, token.currentSupply, token.totalSupply]);

  const invalidateAll = useCallback(() => {
    invalidateTokenBal();
    queryClient.invalidateQueries({ queryKey: ['userBalance'] });
    queryClient.invalidateQueries({ queryKey: ['tokenDetail'] });
  }, [invalidateTokenBal, queryClient]);

  // ── Execute Buy ───────────────────────────────────────────────────────────
  const executeBuy = useCallback(async () => {
    if (!address || !authToken) { openWalletDrawer(); return; }
    if (!buyEstimate || inputAmount <= 0) return;
    if (inputAmount > usdtBalance) {
      addToast({ type: 'error', message: 'Insufficient USDT balance — please deposit more.' });
      return;
    }

    setTxState('confirming');
    try {
      const res = await fetch(`${API_BASE_URL}/tokens/${tokenId}/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          wallet: address,
          type: 'buy',
          amountUsdt: inputAmount,
          amountTokens: buyEstimate.tokensOut,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Buy failed');
      }
      setTxState('success');
      addToast({ type: 'success', message: `Bought ${formatNumber(buyEstimate.tokensOut, 0)} ${token.symbol}!` });
      setInputValue('');
      invalidateAll();
      setTimeout(() => setTxState('idle'), 1500);
    } catch (error) {
      setTxState('error');
      addToast({ type: 'error', message: error instanceof Error ? error.message : 'Buy failed' });
      setTimeout(() => setTxState('idle'), 1000);
    }
  }, [address, authToken, buyEstimate, inputAmount, usdtBalance, addToast, openWalletDrawer, token, tokenId, invalidateAll]);

  // ── Execute Sell ──────────────────────────────────────────────────────────
  const executeSell = useCallback(async () => {
    if (!address || !authToken) { openWalletDrawer(); return; }
    if (!sellEstimate || inputAmount <= 0) return;
    if (inputAmount > tokenBalance) {
      addToast({ type: 'error', message: 'Insufficient token balance.' });
      return;
    }

    setTxState('confirming');
    try {
      const res = await fetch(`${API_BASE_URL}/tokens/${tokenId}/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          wallet: address,
          type: 'sell',
          amountUsdt: sellEstimate.usdtReturn,
          amountTokens: inputAmount,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Sell failed');
      }
      setTxState('success');
      addToast({ type: 'success', message: `Sold ${formatNumber(inputAmount, 0)} ${token.symbol} for ~${sellEstimate.usdtReturn.toFixed(2)} USDT!` });
      setInputValue('');
      invalidateAll();
      setTimeout(() => setTxState('idle'), 1500);
    } catch (error) {
      setTxState('error');
      addToast({ type: 'error', message: error instanceof Error ? error.message : 'Sell failed' });
      setTimeout(() => setTxState('idle'), 1000);
    }
  }, [address, authToken, sellEstimate, inputAmount, tokenBalance, addToast, openWalletDrawer, token, tokenId, invalidateAll]);

  // ── Graduated view ────────────────────────────────────────────────────────
  if (isGraduated) {
    const output = token.dexPoolAddress ?? token.tokenAddress ?? token.mint;
    return (
      <div style={panelStyle}>
        <a
          href={`https://pancakeswap.finance/swap?outputCurrency=${output}`}
          target="_blank"
          rel="noopener noreferrer"
          style={graduatedLinkStyle}
        >
          TRADE ON {DEX_NAME.toUpperCase()}
        </a>
      </div>
    );
  }

  const notAuthenticated = !address || !authToken;

  return (
    <div style={panelStyle}>
      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {(['buy', 'sell'] as TradeTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setInputValue(''); }}
            style={{
              flex: 1,
              padding: 'var(--space-3)',
              background: activeTab === tab
                ? (tab === 'buy' ? 'var(--buy-dim)' : 'var(--sell-dim)')
                : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab
                ? `2px solid var(--${tab})`
                : '2px solid transparent',
              color: activeTab === tab
                ? `var(--${tab})`
                : 'var(--text-muted)',
              fontFamily: 'var(--font-ui)',
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: 1,
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'all 0.15s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── BUY tab ── */}
      {activeTab === 'buy' && (
        <div style={bodyStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={labelStyle}>You pay (USDT Balance)</label>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>
              Available: {balanceLoading ? '...' : formatNumber(usdtBalance)} USDT
            </span>
          </div>

          <div style={inputShellStyle}>
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="0.00"
              disabled={txState === 'confirming'}
              style={inputStyle}
            />
            <span style={unitStyle}>USDT</span>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {USDT_PRESETS.map((v) => (
              <button key={v} onClick={() => setInputValue(String(v))} style={presetStyle}>
                {v} USDT
              </button>
            ))}
          </div>

          {buyEstimate && inputAmount > 0 && (
            <div style={estimateStyle}>
              <Row label="Receive estimate" value={`${formatNumber(buyEstimate.tokensOut, 0)} ${token.symbol}`} />
              <Row label="Avg price"        value={`${buyEstimate.avgPrice.toFixed(8)} USDT`} />
              <Row label="Price impact"     value={`${buyEstimate.priceImpact.toFixed(2)}%`} />
              <Row label="Platform fee"     value="0.00 USDT" />
            </div>
          )}

          <Button
            variant="buy"
            size="lg"
            onClick={notAuthenticated ? openWalletDrawer : executeBuy}
            disabled={!notAuthenticated && (inputAmount <= 0 || txState === 'confirming' || inputAmount > usdtBalance)}
            isLoading={txState === 'confirming'}
            style={{ width: '100%' }}
          >
            {notAuthenticated
              ? 'CONNECT WALLET'
              : inputAmount > usdtBalance
                ? 'INSUFFICIENT BALANCE'
                : inputAmount > 0
                  ? `BUY ${token.symbol}`
                  : 'ENTER AMOUNT'}
          </Button>
        </div>
      )}

      {/* ── SELL tab ── */}
      {activeTab === 'sell' && (
        <div style={bodyStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={labelStyle}>You sell ({token.symbol})</label>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>
              Balance: {formatNumber(tokenBalance, 2)} {token.symbol}
            </span>
          </div>

          <div style={inputShellStyle}>
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="0.00"
              disabled={txState === 'confirming'}
              style={inputStyle}
            />
            <span style={unitStyle}>{token.symbol}</span>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {SELL_PCTS.map((pct) => (
              <button
                key={pct}
                onClick={() => setInputValue(String((tokenBalance * pct / 100).toFixed(2)))}
                style={presetStyle}
              >
                {pct}%
              </button>
            ))}
          </div>

          {sellEstimate && inputAmount > 0 && (
            <div style={estimateStyle}>
              <Row label="You receive"   value={`~${sellEstimate.usdtReturn.toFixed(4)} USDT`} />
              <Row label="Sell slippage" value="5% (applied)" />
              <Row label="To wallet"     value="Platform Balance" />
            </div>
          )}

          <Button
            variant="sell"
            size="lg"
            onClick={notAuthenticated ? openWalletDrawer : executeSell}
            disabled={!notAuthenticated && (inputAmount <= 0 || txState === 'confirming' || inputAmount > tokenBalance)}
            isLoading={txState === 'confirming'}
            style={{ width: '100%' }}
          >
            {notAuthenticated
              ? 'CONNECT WALLET'
              : inputAmount > tokenBalance
                ? 'INSUFFICIENT TOKENS'
                : inputAmount > 0
                  ? `SELL ${token.symbol}`
                  : 'ENTER AMOUNT'}
          </Button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
};

const bodyStyle: React.CSSProperties = {
  padding: 'var(--space-4)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: 12,
  color: 'var(--text-muted)',
};

const inputShellStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: 'var(--space-3)',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  fontFamily: 'var(--font-mono)',
  fontSize: 18,
  color: 'var(--text-primary)',
};

const unitStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--text-muted)',
};

const presetStyle: React.CSSProperties = {
  flex: 1,
  padding: 'var(--space-1) var(--space-2)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
};

const estimateStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-3)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

const graduatedLinkStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--space-3)',
  background: 'var(--graduation)',
  color: 'var(--bg-base)',
  textDecoration: 'none',
  fontFamily: 'var(--font-display)',
  fontSize: 14,
  letterSpacing: 2,
};
