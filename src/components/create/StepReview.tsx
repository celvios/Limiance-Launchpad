'use client';

import React, { useMemo, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCreateTokenStore } from '@/hooks/useCreateToken';
import { useUIStore } from '@/store/uiStore';
import { useInitializeToken } from '@/hooks/useInitializeToken';
import { calculatePrice } from '@/lib/curve/math';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CurvePreviewChart } from './CurvePreviewChart';

/* ── Step 3 — Review & Deploy ── */

export function StepReview() {
  const { connected } = useWallet();
  const openWalletDrawer = useUIStore((s) => s.openWalletDrawer);
  const addToast = useUIStore((s) => s.addToast);
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
    const startPrice = calculatePrice(0, formData.curveParams);
    const halfSupply = Math.floor(formData.totalSupply * 0.5);
    const gradSupply = Math.floor(
      formData.totalSupply * formData.graduationThreshold / 100
    );
    const halfPrice = calculatePrice(halfSupply, formData.curveParams);
    const gradPrice = calculatePrice(gradSupply, formData.curveParams);

    // Estimate total raised at graduation using trapezoidal integration
    let totalRaised = 0;
    const steps = 200;
    const stepSize = gradSupply / steps;
    for (let i = 0; i < steps; i++) {
      const s1 = i * stepSize;
      const s2 = (i + 1) * stepSize;
      const p1 = calculatePrice(s1, formData.curveParams);
      const p2 = calculatePrice(s2, formData.curveParams);
      totalRaised += ((p1 + p2) / 2) * stepSize;
    }
    const platformFee = totalRaised * 0.01;

    return { startPrice, halfPrice, gradPrice, totalRaised, platformFee };
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

      // On-chain deploy via Anchor + backend indexing via POST /api/tokens
      const result = await initializeToken(latestFormData);

      if (result.success) {
        setDeployResult(result.mint, result.txSignature);
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
  const deployButtonText = (() => {
    if (!connected) return 'CONNECT WALLET FIRST';
    switch (deployState) {
      case 'uploading': return 'UPLOADING IMAGE...';
      case 'preparing': return 'PREPARING...';
      case 'confirming': return 'CONFIRMING...';
      case 'error': return 'DEPLOY FAILED';
      default: return 'DEPLOY TOKEN';
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
            <DetailRow label="Curve Type">
              <Badge variant="curve">{formData.curveType.toUpperCase()}</Badge>
            </DetailRow>
            <DetailRow label="Total Supply">
              {formData.totalSupply.toLocaleString()} tokens
            </DetailRow>
            <DetailRow label="Creator Allocation">
              {formData.creatorAllocation}% ({Math.floor(formData.totalSupply * formData.creatorAllocation / 100).toLocaleString()} tokens)
            </DetailRow>
            <DetailRow label="Graduation At">
              {formData.graduationThreshold}% ({Math.floor(formData.totalSupply * formData.graduationThreshold / 100).toLocaleString()} tokens)
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
            <SimRow label="Starting price" value={`${formatSimPrice(simulation.startPrice)} SOL`} />
            <SimRow label="Price at 50% supply" value={`${formatSimPrice(simulation.halfPrice)} SOL`} />
            <SimRow label="Price at graduation" value={`${formatSimPrice(simulation.gradPrice)} SOL`} />
            <div style={{ borderTop: '1px solid var(--border)', margin: 'var(--space-1) 0' }} />
            <SimRow label="Est. total raised" value={`${simulation.totalRaised.toFixed(2)} SOL`} highlight />
            <SimRow label="Platform fee (1%)" value={`${simulation.platformFee.toFixed(4)} SOL`} />
          </div>
        </div>
      </div>

      {/* Mini curve preview */}
      <CurvePreviewChart
        curveParams={formData.curveParams}
        totalSupply={formData.totalSupply}
        graduationThreshold={formData.graduationThreshold}
      />

      {/* Deploy cost estimate */}
      <div
        style={{
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: 'var(--text-muted)',
        }}
      >
        Estimated deployment cost: ~0.05 SOL
      </div>

      {/* Deploy Button */}
      <Button
        variant={connected ? 'buy' : 'outline'}
        size="lg"
        isLoading={isDeploying}
        disabled={isDeploying || deployState === 'error'}
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
  if (price < 0.000001) return price.toFixed(10);
  if (price < 0.0001)   return price.toFixed(8);
  if (price < 0.01)     return price.toFixed(6);
  if (price < 1)        return price.toFixed(4);
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
