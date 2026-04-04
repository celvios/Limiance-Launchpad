'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { AlertTriangle } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { calculateBuyPrice, calculateSellReturn } from '@/lib/curve/math';
import { formatNumber } from '@/lib/format';
import type { TokenDetail } from '@/lib/types';

interface TradePanelProps {
  token: TokenDetail;
}

type TxState = 'idle' | 'confirming' | 'success' | 'error';

const SOL_PRESETS = [0.1, 0.5, 1, 5];
const SLIPPAGE_OPTIONS = [0.5, 1, 2, 5];

function getPriceImpactLevel(impact: number) {
  if (impact < 1) return { color: 'var(--buy)', label: 'Low impact' };
  if (impact < 3) return { color: 'var(--graduation)', label: '' };
  if (impact < 5) return { color: 'var(--sell)', label: 'Moderate impact', showIcon: true };
  return { color: 'var(--sell)', label: 'High impact', showIcon: true, requiresConfirm: true };
}

export function TradePanel({ token }: TradePanelProps) {
  const { connected } = useWallet();
  const openWalletDrawer = useUIStore((s) => s.openWalletDrawer);
  const addToast = useUIStore((s) => s.addToast);

  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [inputValue, setInputValue] = useState('');
  const [slippage, setSlippage] = useState(1);
  const [showSlippage, setShowSlippage] = useState(false);
  const [txState, setTxState] = useState<TxState>('idle');
  const [showImpactModal, setShowImpactModal] = useState(false);
  const [panelFlash, setPanelFlash] = useState(false);
  const isGraduated = token.status === 'graduated';

  const inputAmount = parseFloat(inputValue) || 0;

  const buyEstimate = useMemo(() => {
    if (mode !== 'buy' || inputAmount <= 0) return null;
    return calculateBuyPrice(inputAmount, token.currentSupply, token.curveParams);
  }, [inputAmount, mode, token.currentSupply, token.curveParams]);

  const sellEstimate = useMemo(() => {
    if (mode !== 'sell' || inputAmount <= 0) return null;
    return calculateSellReturn(inputAmount, token.currentSupply, token.curveParams);
  }, [inputAmount, mode, token.currentSupply, token.curveParams]);

  const estimate = buyEstimate ?? sellEstimate;

  const handlePreset = useCallback((val: number) => {
    setInputValue(String(val));
  }, []);

  const executeTrade = useCallback(async () => {
    setTxState('confirming');

    try {
      // Simulate wallet signing + on-chain confirmation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Simulate success (90% chance) or error (10% chance)
      if (Math.random() > 0.1) {
        setTxState('success');
        setPanelFlash(true);
        setTimeout(() => setPanelFlash(false), 1500);

        addToast({
          type: 'success',
          message: mode === 'buy'
            ? `Bought ~${buyEstimate ? formatNumber(buyEstimate.tokensOut, 0) : '?'} ${token.symbol}`
            : `Sold ${formatNumber(inputAmount, 0)} ${token.symbol}`,
        });

        // Reset after animation
        setTimeout(() => {
          setTxState('idle');
          setInputValue('');
        }, 1500);
      } else {
        throw new Error('Transaction failed: Simulation error');
      }
    } catch (err) {
      setTxState('error');
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Transaction failed',
      });
      setTimeout(() => setTxState('idle'), 500);
    }
  }, [mode, inputAmount, buyEstimate, token.symbol, addToast]);

  const handleTrade = useCallback(() => {
    if (!connected) {
      openWalletDrawer();
      return;
    }
    if (inputAmount <= 0) return;

    // Check price impact — require modal confirmation for > 5%
    if (estimate && estimate.priceImpact > 5) {
      setShowImpactModal(true);
      return;
    }

    executeTrade();
  }, [connected, openWalletDrawer, inputAmount, estimate, executeTrade]);

  const handleConfirmHighImpact = useCallback(() => {
    setShowImpactModal(false);
    executeTrade();
  }, [executeTrade]);

  const impactLevel = estimate ? getPriceImpactLevel(estimate.priceImpact) : null;

  return (
    <>
      <div
        style={{
          background: panelFlash
            ? mode === 'buy'
              ? 'var(--buy-dim)'
              : 'var(--sell-dim)'
            : 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          transition: 'background 300ms var(--ease-default)',
        }}
      >
        {/* BUY / SELL tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {(['buy', 'sell'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setMode(tab);
                setInputValue('');
                setTxState('idle');
              }}
              style={{
                flex: 1,
                padding: 'var(--space-3)',
                background: mode === tab
                  ? tab === 'buy' ? 'var(--buy-dim)' : 'var(--sell-dim)'
                  : 'transparent',
                border: 'none',
                borderBottom: mode === tab
                  ? `2px solid ${tab === 'buy' ? 'var(--buy)' : 'var(--sell)'}`
                  : '2px solid transparent',
                color: mode === tab
                  ? tab === 'buy' ? 'var(--buy)' : 'var(--sell)'
                  : 'var(--text-muted)',
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                letterSpacing: '2px',
                cursor: 'pointer',
                transition: 'all var(--duration-fast)',
                textTransform: 'uppercase',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Input */}
          <div>
            <label
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '12px',
                color: 'var(--text-muted)',
                marginBottom: 'var(--space-1)',
                display: 'block',
              }}
            >
              {mode === 'buy' ? 'You pay (SOL)' : `You sell (${token.symbol})`}
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
              }}
            >
              <input
                type="number"
                placeholder="0.00"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={txState === 'confirming'}
                style={{
                  flex: 1,
                  padding: 'var(--space-3)',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '18px',
                  color: 'var(--text-primary)',
                  opacity: txState === 'confirming' ? 0.5 : 1,
                }}
              />
              <span
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                }}
              >
                {mode === 'buy' ? 'SOL' : token.symbol}
              </span>
            </div>

            {/* Presets */}
            {mode === 'buy' && (
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--space-2)',
                  marginTop: 'var(--space-2)',
                }}
              >
                {SOL_PRESETS.map((val) => (
                  <button
                    key={val}
                    onClick={() => handlePreset(val)}
                    disabled={txState === 'confirming'}
                    style={{
                      flex: 1,
                      padding: 'var(--space-1) var(--space-2)',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all var(--duration-fast)',
                    }}
                  >
                    {val} SOL
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Estimate output */}
          {estimate && inputAmount > 0 && (
            <div
              style={{
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                  }}
                >
                  You receive (est.)
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {mode === 'buy' && buyEstimate
                    ? `≈ ${formatNumber(buyEstimate.tokensOut, 0)} ${token.symbol}`
                    : sellEstimate
                    ? `≈ ${sellEstimate.solOut.toFixed(4)} SOL`
                    : ''}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                  }}
                >
                  Price per token
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {estimate.avgPrice.toFixed(6)} SOL
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                  }}
                >
                  Price impact
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: impactLevel?.color ?? 'var(--text-secondary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                  }}
                >
                  {impactLevel?.showIcon && <AlertTriangle size={12} />}
                  {estimate.priceImpact.toFixed(2)}%
                  {impactLevel?.label && (
                    <span style={{ fontSize: '10px', opacity: 0.8 }}>
                      {impactLevel.label}
                    </span>
                  )}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                  }}
                >
                  Platform fee
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {token.platformFee}%
                </span>
              </div>
            </div>
          )}

          {/* Slippage */}
          <div>
            <button
              onClick={() => setShowSlippage(!showSlippage)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontFamily: 'var(--font-ui)',
                fontSize: '12px',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
              }}
            >
              Slippage: {slippage}%
              <span style={{ fontSize: '10px' }}>{showSlippage ? '▲' : '▼'}</span>
            </button>

            {showSlippage && (
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--space-2)',
                  marginTop: 'var(--space-2)',
                }}
              >
                {SLIPPAGE_OPTIONS.map((val) => (
                  <button
                    key={val}
                    onClick={() => setSlippage(val)}
                    style={{
                      flex: 1,
                      padding: 'var(--space-1)',
                      background: slippage === val ? 'var(--text-primary)' : 'var(--bg-elevated)',
                      color: slippage === val ? 'var(--bg-base)' : 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      transition: 'all var(--duration-fast)',
                    }}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action button */}
          {isGraduated ? (
            <a
              href={`https://raydium.io/swap/?inputMint=sol&outputMint=${token.raydiumPoolAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-3)',
                background: 'var(--graduation)',
                color: 'var(--bg-base)',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                letterSpacing: '2px',
              }}
            >
              TRADE ON RAYDIUM
            </a>
          ) : (
            <Button
              variant={mode === 'buy' ? 'buy' : 'sell'}
              size="lg"
              onClick={handleTrade}
              disabled={(inputAmount <= 0 && connected) || txState === 'confirming'}
              isLoading={txState === 'confirming'}
              style={{
                width: '100%',
                fontFamily: 'var(--font-display)',
                letterSpacing: '2px',
              }}
            >
              {txState === 'confirming'
                ? 'CONFIRMING...'
                : !connected
                ? 'CONNECT WALLET'
                : mode === 'buy'
                ? inputAmount > 0
                  ? `BUY ${buyEstimate ? formatNumber(buyEstimate.tokensOut, 0) : ''} ${token.symbol}`
                  : 'ENTER AMOUNT'
                : inputAmount > 0
                ? `SELL ${formatNumber(inputAmount, 0)} ${token.symbol}`
                : 'ENTER AMOUNT'}
            </Button>
          )}
        </div>
      </div>

      {/* High Price Impact Confirmation Modal */}
      <Modal
        isOpen={showImpactModal}
        onClose={() => setShowImpactModal(false)}
        title="High Price Impact Warning"
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            padding: 'var(--space-4)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-3)',
              background: 'var(--sell-dim)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--sell)',
            }}
          >
            <AlertTriangle size={24} style={{ color: 'var(--sell)', flexShrink: 0 }} />
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--sell)',
                }}
              >
                Price impact is {estimate?.priceImpact.toFixed(2)}%
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  marginTop: 'var(--space-1)',
                }}
              >
                This trade will significantly move the price. You may receive fewer tokens than expected.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button
              variant="ghost"
              size="md"
              onClick={() => setShowImpactModal(false)}
              style={{ flex: 1 }}
            >
              Cancel
            </Button>
            <Button
              variant="sell"
              size="md"
              onClick={handleConfirmHighImpact}
              style={{ flex: 1 }}
            >
              Trade Anyway
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
