'use client';

import React, { useMemo, useCallback } from 'react';
import { useWallet } from '@/providers/BscWalletProvider';
import { useCreateTokenStore } from '@/hooks/useCreateToken';
import { useUIStore } from '@/store/uiStore';
import { useInitializeToken } from '@/hooks/useInitializeToken';
import { useUserBalance } from '@/hooks/useUserBalance';
import { Button } from '@/components/ui/Button';
import { TOKEN_CREATION_FEE_USDT } from '@/lib/constants';
import { AlertTriangle, CheckCircle, Wallet } from 'lucide-react';

function sigmoidPrice(supply: number, pMin: number, pMax: number, graduationThreshold: number): number {
  if (graduationThreshold <= 0) return pMin;
  const midpoint = graduationThreshold / 2;
  const normalizedSupply = supply / midpoint;
  return pMin + (pMax - pMin) / (1 + Math.exp(-10 * (normalizedSupply - 1)));
}

function sigmoidIntegral(amount: number, pMin: number, pMax: number, graduationThreshold: number, steps = 50): number {
  if (amount <= 0 || graduationThreshold <= 0) return 0;
  const stepSize = amount / steps;
  let total = 0;
  for (let i = 0; i < steps; i += 1) {
    const s1 = i * stepSize;
    const s2 = (i + 1) * stepSize;
    const p1 = sigmoidPrice(s1, pMin, pMax, graduationThreshold);
    const p2 = sigmoidPrice(s2, pMin, pMax, graduationThreshold);
    total += ((p1 + p2) / 2) * stepSize;
  }
  return total;
}

/* ── Step 3 — Review & Deploy ── */

export function StepReview() {
  const { connected } = useWallet();
  const openWalletDrawer = useUIStore((s) => s.openWalletDrawer);
  const openModal = useUIStore((s) => s.openModal);
  const addToast = useUIStore((s) => s.addToast);
  const { totalAvailableUSDT } = useUserBalance();
  const {
    formData,
    deployState,
    setDeployState,
    setDeployResult,
  } = useCreateTokenStore();

  // On-chain deploy + backend indexing
  const { deployToken: initializeToken } = useInitializeToken();

  // Simulation: trapezoidal integration over the bonding curve
  const simulation = useMemo(() => {
    const supply = formData.totalSupply;
    const pMin = formData.curveParams.pMin ?? formData.curveParams.a ?? 0.00001;
    const pMax = formData.curveParams.pMax ?? formData.curveParams.maxPrice ?? 0.1;
    const gradSupply = Math.floor(supply * formData.graduationThreshold / 100);
    const calcP = (s: number) => sigmoidPrice(s, pMin, pMax, gradSupply);

    const startPrice = calcP(0);
    const halfSupply  = Math.floor(supply * 0.5);
    const halfPrice   = calcP(halfSupply);
    const gradPrice   = calcP(gradSupply);

    // Estimate total raised at graduation using trapezoidal integration
    let totalRaised = 0;
    const steps = 200;
    const stepSize = gradSupply / steps;
    for (let i = 0; i < steps; i++) {
      const s1 = i * stepSize;
      const s2 = (i + 1) * stepSize;
      const p1 = calcP(s1);
      const p2 = calcP(s2);
      totalRaised += ((p1 + p2) / 2) * stepSize;
    }
    const platformFee = totalRaised * 0.03;

    let initialBuyCost = 0;
    if (formData.initialBuyAmount > 0) {
      initialBuyCost = sigmoidIntegral(formData.initialBuyAmount, pMin, pMax, gradSupply);
    }
    const initialBuyFee = initialBuyCost * 0.01; // 1% fee
    const initialBuyTotalCost = initialBuyCost + initialBuyFee;

    return { startPrice, halfPrice, gradPrice, totalRaised, platformFee, initialBuyTotalCost };
  }, [formData]);

  const handleDeploy = useCallback(async () => {
    if (!connected) {
      openWalletDrawer();
      return;
    }

    setDeployState('uploading');

    try {
      // Upload image to IPFS first if not already done
      if (!formData.imageIpfsUri && formData.imageFile) {
        const { uploadToIPFS } = await import('@/lib/pinata');
        const uri = await uploadToIPFS(formData.imageFile);
        useCreateTokenStore.getState().updateFormData({ imageIpfsUri: uri });
      }

      setDeployState('preparing');

      // Get the latest formData (after potential IPFS update)
      const latestFormData = useCreateTokenStore.getState().formData;

      setDeployState('confirming');

      const result = await initializeToken(latestFormData);

      if (result.success) {
        setDeployResult(result.tokenAddress, result.txSignature);
        addToast({
          type: 'success',
          message: `🎉 ${formData.symbol} launched successfully!`,
        });
      } else {
        throw new Error('Deploy returned unsuccessful');
      }
    } catch (err) {
      setDeployState('error');
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Deploy failed. Try again.',
      });
      // Re-enable button after error
      setTimeout(() => setDeployState('idle'), 2000);
    }
  }, [connected, openWalletDrawer, formData, setDeployState, setDeployResult, addToast, initializeToken]);

  const isDeploying = deployState === 'uploading' || deployState === 'preparing' || deployState === 'confirming';

  // Cost breakdown
  const creationFee = TOKEN_CREATION_FEE_USDT; // from env
  const initialBuyCost = simulation.initialBuyTotalCost;
  const totalCostUsdt = creationFee + initialBuyCost;
  const totalCostWei = BigInt(Math.floor(totalCostUsdt * 1e6));
  const availableUSDT = Number(totalAvailableUSDT) / 1e6;
  const hasEnough = Number(totalAvailableUSDT) >= Number(totalCostWei);

  const deployButtonText = (() => {
    if (!connected) return 'CONNECT WALLET FIRST';
    if (!hasEnough) return 'INSUFFICIENT BALANCE';
    switch (deployState) {
      case 'uploading': return 'UPLOADING IMAGE...';
      case 'preparing': return 'PREPARING...';
      case 'confirming': return 'CONFIRMING...';
      case 'error': return 'DEPLOY FAILED';
      default: return 'CONFIRM & DEPLOY TOKEN';
    }
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Two-column: Summary + Simulation */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-4)',
        }}
        className="review-grid"
      >
        {/* Left — Summary */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
          }}
        >
          <div style={sectionLabelStyle}>TOKEN SUMMARY</div>

          {/* Token header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-4)',
            }}
          >
            {formData.imagePreviewUrl ? (
              <img
                src={formData.imagePreviewUrl}
                alt={formData.name}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 'var(--radius-lg)',
                  objectFit: 'cover',
                  border: '2px solid var(--border)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-elevated)',
                  border: '2px solid var(--border)',
                }}
              />
            )}
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '24px',
                  color: 'var(--text-primary)',
                  letterSpacing: '1px',
                }}
              >
                {formData.name || 'Untitled'}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '14px',
                  color: 'var(--text-muted)',
                }}
              >
                ${formData.symbol || '???'}
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <DetailRow label="Total Supply">
              {formData.totalSupply.toLocaleString()} tokens
            </DetailRow>
            <DetailRow label="Initial Buy">
              {formData.initialBuyAmount > 0 
                ? `${formData.initialBuyAmount.toLocaleString()} tokens` 
                : 'None'}
            </DetailRow>
            <DetailRow label="Creation Fee">
              {TOKEN_CREATION_FEE_USDT.toLocaleString()} USDT
            </DetailRow>
            {formData.description && (
              <div>
                <div style={detailLabelStyle}>Description</div>
                <div
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}
                >
                  {formData.description}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right — Simulation */}
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
          }}
        >
          <div style={sectionLabelStyle}>PRICE SIMULATION</div>
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginBottom: 'var(--space-4)',
            }}
          >
            If tokens are minted to graduation:
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <SimRow label="Starting price" value={`${formatSimPrice(simulation.startPrice)} USDT`} />
            <SimRow label="Price at 50% supply" value={`${formatSimPrice(simulation.halfPrice)} USDT`} />
            <SimRow label="Price at graduation" value={`${formatSimPrice(simulation.gradPrice)} USDT`} />
            <div style={{ borderTop: '1px solid var(--border)', margin: 'var(--space-1) 0' }} />
            <SimRow label="Est. total raised" value={`${simulation.totalRaised.toFixed(2)} USDT`} highlight />
            <SimRow label="Platform fee (3%)" value={`${simulation.platformFee.toFixed(4)} USDT`} />
          </div>
        </div>
      </div>

      {/* ── Fee Confirmation Panel ── */}
      <div
        style={{
          background: hasEnough ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
          border: `1px solid ${hasEnough ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.25)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '12px', letterSpacing: '2px', color: 'var(--text-muted)', marginBottom: 2 }}>
          PAYMENT SUMMARY
        </div>

        {/* Line items */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)' }}>Creation Fee</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>{creationFee.toFixed(2)} USDT</span>
        </div>

        {formData.initialBuyAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Initial Buy ({formData.initialBuyAmount.toLocaleString()} tokens)
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>
              ~{initialBuyCost.toFixed(4)} USDT
            </span>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Total</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: hasEnough ? 'var(--buy)' : 'var(--sell)' }}>
            {totalCostUsdt.toFixed(4)} USDT
          </span>
        </div>

        {/* Balance */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {hasEnough ? <CheckCircle size={13} color="var(--buy)" /> : <AlertTriangle size={13} color="var(--sell)" />}
            Your Platform Balance
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: hasEnough ? 'var(--buy)' : 'var(--sell)' }}>
            {availableUSDT.toFixed(2)} USDT
          </span>
        </div>

        {/* Insufficient balance — show deposit prompt */}
        {!hasEnough && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--sell)' }}>
              You need {(totalCostUsdt - availableUSDT).toFixed(4)} more USDT to continue.
            </span>
            <button
              onClick={() => openModal('deposit')}
              style={{
                padding: '6px 12px', background: 'var(--brand)', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-ui)',
                fontWeight: 600, fontSize: '12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
              }}
            >
              <Wallet size={12} /> Deposit
            </button>
          </div>
        )}
      </div>

      {/* Deploy Button */}
      <Button
        variant={connected && hasEnough ? 'buy' : 'outline'}
        size="lg"
        isLoading={isDeploying}
        disabled={isDeploying || deployState === 'error' || !hasEnough}
        onClick={handleDeploy}
        style={{
          width: '100%',
          fontFamily: 'var(--font-display)',
          fontSize: '16px',
          letterSpacing: '2px',
        }}
      >
        {deployButtonText}
      </Button>

    </div>
  );
}

/* ── Sub-components ── */

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={detailLabelStyle}>{label}</span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          color: 'var(--text-primary)',
        }}
      >
        {children}
      </span>
    </div>
  );
}

function SimRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '13px',
          color: 'var(--text-muted)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          fontWeight: highlight ? 600 : 400,
          color: highlight ? 'var(--buy)' : 'var(--text-primary)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function formatSimPrice(price: number): string {
  if (price === 0) return '0.000000';
  if (price < 0.0000001) return price.toFixed(12);
  if (price < 0.00001)   return price.toFixed(10);
  if (price < 0.001)     return price.toFixed(7);  // covers 0.0001 range — shows 7 sig-figs
  if (price < 0.01)      return price.toFixed(5);
  if (price < 1)         return price.toFixed(4);
  return price.toFixed(2);
}

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: '12px',
  letterSpacing: '2px',
  color: 'var(--text-muted)',
  marginBottom: 'var(--space-3)',
};

const detailLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: '12px',
  color: 'var(--text-muted)',
};
