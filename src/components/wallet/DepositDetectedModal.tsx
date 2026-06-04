'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, Zap, X } from 'lucide-react';
import { useUserBalance } from '@/hooks/useUserBalance';

/** Formats a raw 6-decimal USDT wei string into a human-readable amount */
function formatUsdt(wei: bigint): string {
  const val = Number(wei) / 1e6;
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function DepositDetectedModal() {
  const { totalAvailableUSDT } = useUserBalance();
  const prevBalRef = useRef<bigint | null>(null);
  const [visible, setVisible] = useState(false);
  const [depositedAmount, setDepositedAmount] = useState<bigint>(0n);

  useEffect(() => {
    // On first render just record the balance without triggering the modal
    if (prevBalRef.current === null) {
      prevBalRef.current = totalAvailableUSDT;
      return;
    }

    if (totalAvailableUSDT > prevBalRef.current) {
      const diff = totalAvailableUSDT - prevBalRef.current;
      setDepositedAmount(diff);
      setVisible(true);
    }

    prevBalRef.current = totalAvailableUSDT;
  }, [totalAvailableUSDT]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={() => setVisible(false)}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 200ms ease',
        }}
      />

      {/* Modal card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Deposit detected"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '420px',
          background: 'linear-gradient(135deg, #0d1117 0%, #161b27 100%)',
          border: '1px solid rgba(34,197,94,0.35)',
          borderRadius: '20px',
          boxShadow: '0 0 60px rgba(34,197,94,0.15), 0 24px 48px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          animation: 'slideUpScale 350ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Green glow strip at top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #22c55e, #4ade80, #22c55e, transparent)',
          }}
        />

        {/* Close button */}
        <button
          onClick={() => setVisible(false)}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
          }}
        >
          <X size={16} />
        </button>

        {/* Content */}
        <div style={{ padding: '40px 32px 32px', textAlign: 'center' }}>
          {/* Icon ring */}
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(74,222,128,0.1))',
              border: '2px solid rgba(34,197,94,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              boxShadow: '0 0 30px rgba(34,197,94,0.25)',
            }}
          >
            <CheckCircle size={36} color="#22c55e" strokeWidth={1.5} />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: '999px',
              padding: '4px 12px',
              marginBottom: '16px',
            }}
          >
            <Zap size={12} color="#4ade80" fill="#4ade80" />
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#4ade80', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Deposit Confirmed
            </span>
          </div>

          <h2
            style={{
              fontFamily: 'var(--font-ui, system-ui)',
              fontSize: '28px',
              fontWeight: 700,
              color: '#ffffff',
              margin: '0 0 8px',
              lineHeight: 1.2,
            }}
          >
            +{formatUsdt(depositedAmount)} USDT
          </h2>
          <p
            style={{
              fontSize: '15px',
              color: 'rgba(255,255,255,0.5)',
              margin: '0 0 28px',
              lineHeight: 1.5,
            }}
          >
            Your balance has been credited and is ready to use.
          </p>

          <button
            onClick={() => setVisible(false)}
            style={{
              width: '100%',
              padding: '14px',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              border: 'none',
              borderRadius: '12px',
              color: '#fff',
              fontFamily: 'var(--font-ui, system-ui)',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(34,197,94,0.3)',
              transition: 'transform 100ms ease, box-shadow 100ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 28px rgba(34,197,94,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(34,197,94,0.3)';
            }}
          >
            Start Trading →
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUpScale {
          from { opacity: 0; transform: translateY(24px) scale(0.94); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
