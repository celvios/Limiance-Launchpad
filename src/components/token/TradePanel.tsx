'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, Copy, QrCode, Wallet } from 'lucide-react';
import { useWallet } from '@/providers/BscWalletProvider';
import { useUIStore } from '@/store/uiStore';
import { Button } from '@/components/ui/Button';
import { calculateBuyPrice } from '@/lib/curve/math';
import { formatAddress, formatNumber } from '@/lib/format';
import { formatAddress, formatNumber } from '@/lib/format';
import { API_BASE_URL, BSC_CHAIN_ID, CHAIN_CURRENCY, DEX_NAME, PAYMENT_ASSET } from '@/lib/constants';
import { useBuy } from '@/hooks/useTradeTransaction';
import { useUserBalance } from '@/hooks/useUserBalance';
import { useAuth } from '@/hooks/useAuth';
import type { DepositAddress, TokenDetail } from '@/lib/types';

interface TradePanelProps {
  token: TokenDetail;
}

type TradeTab = 'wallet' | 'deposit' | 'balance';
type TxState = 'idle' | 'confirming' | 'success' | 'error';

const USDT_PRESETS = [25, 50, 100, 250];

function paymentToBaseUnits(value: number): bigint {
  return BigInt(Math.round(value * 1e18));
}

export function TradePanel({ token }: TradePanelProps) {
  const { address, connected, chainId, switchToBsc } = useWallet();
  const openWalletDrawer = useUIStore((s) => s.openWalletDrawer);
  const addToast = useUIStore((s) => s.addToast);
  const [activeTab, setActiveTab] = useState<TradeTab>('balance');
  const [inputValue, setInputValue] = useState('');
  const [txState, setTxState] = useState<TxState>('idle');
  const [depositAddress, setDepositAddress] = useState<DepositAddress | null>(null);
  const [isLoadingDeposit, setIsLoadingDeposit] = useState(false);
  
  const { buy } = useBuy(token.tokenAddress ?? token.mint);
  const { totalAvailableUSDT } = useUserBalance();
  const { token: authToken } = useAuth();

  const inputAmount = parseFloat(inputValue) || 0;
  const isGraduated = token.status === 'graduated';
  const wrongNetwork = connected && chainId !== BSC_CHAIN_ID;
  const displayBalance = Number(totalAvailableUSDT) / 1e6;

  const buyEstimate = useMemo(() => {
    if (inputAmount <= 0) return null;
    return calculateBuyPrice(inputAmount, token.currentSupply, token.curveParams);
  }, [inputAmount, token.currentSupply, token.curveParams]);

  const loadDepositAddress = useCallback(async () => {
    if (!address) {
      openWalletDrawer();
      return;
    }
    setIsLoadingDeposit(true);
    try {
      const params = new URLSearchParams({
        wallet: address,
        asset: PAYMENT_ASSET,
        chainId: String(BSC_CHAIN_ID),
      });
      const res = await fetch(`${API_BASE_URL}/deposits/address?${params}`);
      if (!res.ok) throw new Error(`Deposit address failed: ${res.status}`);
      setDepositAddress(await res.json() as DepositAddress);
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : 'Could not load deposit address' });
    } finally {
      setIsLoadingDeposit(false);
    }
  }, [address, addToast, openWalletDrawer]);

  const executeWalletBuy = useCallback(async () => {
    if (!connected) {
      openWalletDrawer();
      return;
    }
    if (wrongNetwork) {
      await switchToBsc();
      return;
    }
    if (!buyEstimate || inputAmount <= 0) return;

    setTxState('confirming');
    try {
      await buy({
        amount: BigInt(Math.floor(buyEstimate.tokensOut * 1e18)),
        quotePayment: paymentToBaseUnits(inputAmount),
        saleAddress: token.dexPoolAddress ?? token.tokenAddress ?? token.mint,
      });
      setTxState('success');
      addToast({ type: 'success', message: `Bought ${formatNumber(buyEstimate.tokensOut, 0)} ${token.symbol}` });
      setInputValue('');
      setTimeout(() => setTxState('idle'), 1500);
    } catch (error) {
      setTxState('error');
      addToast({ type: 'error', message: error instanceof Error ? error.message : 'Buy failed' });
      setTimeout(() => setTxState('idle'), 1000);
    }
  }, [connected, wrongNetwork, switchToBsc, buyEstimate, inputAmount, buy, token, addToast, openWalletDrawer]);

  const copyDepositAddress = useCallback(async () => {
    if (!depositAddress) return;
    await navigator.clipboard.writeText(depositAddress.vaultAddress);
    addToast({ type: 'success', message: 'Deposit address copied' });
  }, [depositAddress, addToast]);

  const executeBalanceBuy = useCallback(async () => {
    if (!address || !authToken) {
      addToast({ type: 'error', message: 'Please connect and sign in first' });
      return;
    }
    if (!buyEstimate || inputAmount <= 0) return;
    if (inputAmount > displayBalance) {
      addToast({ type: 'error', message: 'Insufficient platform balance. Please deposit USDT.' });
      return;
    }

    setTxState('confirming');
    try {
      const res = await fetch(`/api/tokens/${token.tokenAddress ?? token.mint}/trade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          wallet: address,
          type: 'buy',
          amountUsdt: inputAmount,
          amountTokens: buyEstimate.tokensOut,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Balance buy failed');
      }

      setTxState('success');
      addToast({ type: 'success', message: `Bought ${formatNumber(buyEstimate.tokensOut, 0)} ${token.symbol} instantly!` });
      setInputValue('');
      setTimeout(() => setTxState('idle'), 1500);
      // In a real app, invalidate queries here to refresh the token supply and balance
    } catch (error) {
      setTxState('error');
      addToast({ type: 'error', message: error instanceof Error ? error.message : 'Buy failed' });
      setTimeout(() => setTxState('idle'), 1000);
    }
  }, [address, authToken, buyEstimate, inputAmount, displayBalance, addToast, token]);

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

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {[
          ['wallet', 'Wallet Buy'],
          ['deposit', 'Deposit Address'],
          ['balance', 'Balance Buy'],
        ].map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as TradeTab)}
            style={{
              flex: 1,
              padding: 'var(--space-3)',
              background: activeTab === tab ? 'var(--buy-dim)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--buy)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--buy)' : 'var(--text-muted)',
              fontFamily: 'var(--font-ui)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'wallet' && (
        <div style={bodyStyle}>
          <label style={labelStyle}>You pay ({CHAIN_CURRENCY})</label>
          <div style={inputShellStyle}>
            <input
              type="number"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="0.00"
              disabled={txState === 'confirming'}
              style={inputStyle}
            />
            <span style={unitStyle}>{CHAIN_CURRENCY}</span>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {USDT_PRESETS.map((value) => (
              <button key={value} onClick={() => setInputValue(String(value))} style={presetStyle}>
                {value} {CHAIN_CURRENCY}
              </button>
            ))}
          </div>

          {buyEstimate && inputAmount > 0 && (
            <div style={estimateStyle}>
              <Row label="Receive estimate" value={`${formatNumber(buyEstimate.tokensOut, 0)} ${token.symbol}`} />
              <Row label="Average price" value={`${buyEstimate.avgPrice.toFixed(8)} ${CHAIN_CURRENCY}`} />
              <Row label="Price impact" value={`${buyEstimate.priceImpact.toFixed(2)}%`} />
              <Row label="Est. Network Fee" value="~0.005 BNB" />
            </div>
          )}

          {wrongNetwork && (
            <div style={warningStyle}>
              <AlertTriangle size={16} />
              Switch to BSC Testnet before buying.
            </div>
          )}

          <Button
            variant="buy"
            size="lg"
            onClick={executeWalletBuy}
            disabled={(inputAmount <= 0 && connected && !wrongNetwork) || txState === 'confirming'}
            isLoading={txState === 'confirming'}
            style={{ width: '100%' }}
          >
            {!connected ? 'CONNECT WALLET' : wrongNetwork ? 'SWITCH TO BSC' : inputAmount > 0 ? `BUY ${token.symbol}` : 'ENTER AMOUNT'}
          </Button>
        </div>
      )}

      {activeTab === 'deposit' && (
        <div style={bodyStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <QrCode size={18} />
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }}>Generated Deposit Address</div>
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Send only BEP-20 {CHAIN_CURRENCY} on BSC Testnet. Deposits are credited after confirmations by the backend indexer.
          </div>
          {!depositAddress ? (
            <Button variant="outline" size="md" onClick={loadDepositAddress} isLoading={isLoadingDeposit}>
              Generate Address
            </Button>
          ) : (
            <div style={estimateStyle}>
              <Row label="Vault" value={formatAddress(depositAddress.vaultAddress)} />
              <Row label="Chain" value={`BSC ${depositAddress.chainId}`} />
              <button onClick={copyDepositAddress} style={copyButtonStyle}>
                <Copy size={14} />
                Copy full address
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'balance' && (
        <div style={bodyStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={labelStyle}>You pay (USDT Balance)</label>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>
              Available: {formatNumber(displayBalance)} USDT
            </span>
          </div>
          <div style={inputShellStyle}>
            <input
              type="number"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="0.00"
              disabled={txState === 'confirming'}
              style={inputStyle}
            />
            <span style={unitStyle}>USDT</span>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {USDT_PRESETS.map((value) => (
              <button key={value} onClick={() => setInputValue(String(value))} style={presetStyle}>
                {value} USDT
              </button>
            ))}
          </div>

          {buyEstimate && inputAmount > 0 && (
            <div style={estimateStyle}>
              <Row label="Receive estimate" value={`${formatNumber(buyEstimate.tokensOut, 0)} ${token.symbol}`} />
              <Row label="Average price" value={`${buyEstimate.avgPrice.toFixed(8)} USDT`} />
              <Row label="Price impact" value={`${buyEstimate.priceImpact.toFixed(2)}%`} />
              <Row label="Platform Fee" value="0.00 USDT" />
            </div>
          )}

          <Button
            variant="buy"
            size="lg"
            onClick={executeBalanceBuy}
            disabled={inputAmount <= 0 || txState === 'confirming' || inputAmount > displayBalance}
            isLoading={txState === 'confirming'}
            style={{ width: '100%' }}
          >
            {inputAmount > displayBalance 
              ? 'INSUFFICIENT BALANCE' 
              : inputAmount > 0 
                ? `INSTANT BUY ${token.symbol}` 
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

const warningStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  background: 'var(--sell-dim)',
  color: 'var(--sell)',
  border: '1px solid var(--sell)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-3)',
  fontFamily: 'var(--font-ui)',
  fontSize: 13,
};

const copyButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-2)',
  background: 'var(--bg-base)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
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
