'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useWallet } from '@/providers/BscWalletProvider';
import { useUIStore } from '@/store/uiStore';
import { Button } from '@/components/ui/Button';
import { calculateBuyPrice, onChainSellReturn } from '@/lib/curve/math';
import { formatNumber } from '@/lib/format';
import { API_BASE_URL, DEX_NAME } from '@/lib/constants';
import { useUserBalance } from '@/hooks/useUserBalance';
import { useUserTokenBalance } from '@/hooks/useUserTokenBalance';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useTickerStore, type TradeEvent } from '@/store/tickerStore';
import type { TokenDetail, TradeActivity } from '@/lib/types';

interface TradePanelProps {
  token: TokenDetail;
}

type TradeTab = 'buy' | 'sell';
type TxState = 'idle' | 'confirming' | 'success' | 'error';

const USDT_PRESETS = [25, 50, 100, 250];
const SELL_PCTS   = [25, 50, 75, 100];

type TradeApiResponse = {
  success: boolean;
  trade?: {
    id: string;
    type: 'buy' | 'sell';
    walletAddress: string;
    amount: string | number;
    solAmount: string | number;
    paymentAmount?: string | number | null;
    pricePerToken?: string | number;
    txSignature: string;
    timestamp: string | number;
    isWhale: boolean;
  };
};

type ActivityPage = {
  trades: TradeActivity[];
  nextCursor: string | null;
};

function scaledNumber(value: string | number | null | undefined, scale: number): number {
  if (value === null || value === undefined) return 0;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric / scale;
}

export function TradePanel({ token }: TradePanelProps) {
  const { address, token: authToken } = useWallet();
  const openWalletDrawer = useUIStore((s) => s.openWalletDrawer);
  const addToast = useUIStore((s) => s.addToast);
  const addLiveTrade = useTickerStore((s) => s.addTrade);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TradeTab>('buy');
  const [inputValue, setInputValue] = useState('');
  const [txState, setTxState] = useState<TxState>('idle');

  const { totalAvailableUSDT, isLoading: balanceLoading } = useUserBalance();

  // Token balance on platform (for sell tab)
  const tokenId = token.tokenAddress ?? token.mint;
  const { tokenBalance, invalidate: invalidateTokenBal } = useUserTokenBalance(tokenId, address);

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
      const cp = token.curveParams;
      const params = {
        pMin:   BigInt(Math.round((cp.pMin ?? cp.a ?? 0.00001) * 1e18)),
        paramA: BigInt(Math.round((cp.pMax ?? cp.maxPrice ?? 0.1) * 1e18)),
        paramB: BigInt(Math.round((cp.k ?? 0.002) * 1e6)),
        paramC: BigInt(Math.round(cp.midpoint ?? cp.s0 ?? token.currentSupply * 0.5)),
      };
      const sellRawTokens = BigInt(Math.round(inputAmount));
      const returnWei = onChainSellReturn('sigmoid', params, BigInt(token.totalSupply), BigInt(token.currentSupply), sellRawTokens);
      const usdtReturn = Number(returnWei) / 1e18; // returnWei is WEI scale (1e18), need to convert back to normal decimal USDT
      return { usdtReturn };
    } catch {
      return null;
    }
  }, [activeTab, inputAmount, token.curveParams, token.currentSupply, token.totalSupply]);

  const invalidateAll = useCallback(() => {
    invalidateTokenBal();
    queryClient.invalidateQueries({ queryKey: ['userBalance'] });
    queryClient.invalidateQueries({ queryKey: ['token-detail', token.mint] });
    queryClient.invalidateQueries({ queryKey: ['token-detail', tokenId] });
    queryClient.invalidateQueries({ queryKey: ['chart-data', token.mint] });
    queryClient.invalidateQueries({ queryKey: ['profile-trades', address] });
  }, [address, invalidateTokenBal, queryClient, token.mint, tokenId]);

  const publishLocalTrade = useCallback((body: TradeApiResponse) => {
    if (!body.trade) return;

    const timestamp = typeof body.trade.timestamp === 'number'
      ? body.trade.timestamp
      : new Date(body.trade.timestamp).getTime();
    const trade: TradeActivity = {
      id: body.trade.id,
      type: body.trade.type,
      walletAddress: body.trade.walletAddress,
      walletHandle: null,
      tokenAmount: scaledNumber(body.trade.amount, 1e6),
      paymentAmount: scaledNumber(body.trade.paymentAmount, 1e6),
      solAmount: scaledNumber(body.trade.solAmount, 1e6),
      pricePerToken: scaledNumber(body.trade.pricePerToken, 1e18),
      txSignature: body.trade.txSignature,
      timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
      isWhale: body.trade.isWhale,
    };

    const upsertTrades = (trades: TradeActivity[] = []) => [
      trade,
      ...trades.filter((existing) => existing.id !== trade.id),
    ];

    queryClient.setQueryData<{ trades: TradeActivity[]; nextCursor: string | null }>(
      ['token-activity', token.mint],
      (current) => ({
        trades: upsertTrades(current?.trades).slice(0, 20),
        nextCursor: current?.nextCursor ?? null,
      }),
    );

    queryClient.setQueryData<InfiniteData<ActivityPage>>(['activity', token.mint], (current) => {
      if (!current?.pages?.length) return current;
      return {
        ...current,
        pages: current.pages.map((page, index) =>
          index === 0
            ? { ...page, trades: upsertTrades(page.trades).slice(0, 20) }
            : page
        ),
      };
    });

    const liveTrade: TradeEvent = {
      id: trade.id,
      type: trade.type,
      tokenMint: token.mint,
      tokenSymbol: token.symbol,
      amount: trade.tokenAmount,
      solAmount: trade.solAmount,
      walletAddress: trade.walletAddress,
      txSignature: trade.txSignature,
      timestamp: trade.timestamp,
      isWhale: trade.isWhale,
    };
    addLiveTrade(liveTrade);
  }, [addLiveTrade, queryClient, token.mint, token.symbol]);

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
      const data = await res.json() as TradeApiResponse;
      publishLocalTrade(data);
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
  }, [address, authToken, buyEstimate, inputAmount, usdtBalance, addToast, openWalletDrawer, token, tokenId, invalidateAll, publishLocalTrade]);

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
      const data = await res.json() as TradeApiResponse;
      publishLocalTrade(data);
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
  }, [address, authToken, sellEstimate, inputAmount, tokenBalance, addToast, openWalletDrawer, token, tokenId, invalidateAll, publishLocalTrade]);

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
