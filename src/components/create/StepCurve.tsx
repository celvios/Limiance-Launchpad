'use client';

import React from 'react';
import { Info } from 'lucide-react';
import { useCreateTokenStore } from '@/hooks/useCreateToken';
import { CurvePreviewChart } from './CurvePreviewChart';
import { Tooltip } from '@/components/ui/Tooltip';

const PARAM_INFO: Record<string, { label: string; tooltip: string; min: number; max: number; step: number }> = {
  pMin: { label: 'Start Price', tooltip: 'Initial token price in USDT.', min: 0.000001, max: 0.1, step: 0.000001 },
  pMax: { label: 'Max Price', tooltip: 'Price ceiling the sigmoid curve approaches.', min: 0.001, max: 10, step: 0.001 },
  k: { label: 'Steepness', tooltip: 'How fast price moves around the midpoint.', min: 0.0001, max: 0.1, step: 0.0001 },
  midpoint: { label: 'Midpoint', tooltip: 'Supply level where price reaches the middle of the curve.', min: 100, max: 500000, step: 100 },
};

const PARAM_KEYS = ['pMin', 'pMax', 'k', 'midpoint'];

export function StepCurve() {
  const { formData, updateCurveParam, updateFormData } = useCreateTokenStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4)',
        }}
      >
        <label style={sectionLabelStyle}>Production Formula</label>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>
          Sigmoid bonding curve only. Price starts accessible, accelerates through the midpoint, and stabilizes near the launch cap.
        </div>
        <div style={{ marginTop: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
          price = pMin + (pMax - pMin) / (1 + e^(-k * (supply - midpoint)))
        </div>
      </div>

      <div>
        <label style={sectionLabelStyle}>Safe Launch Parameters</label>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 'var(--space-3)',
          }}
        >
          {PARAM_KEYS.map((key) => {
            const info = PARAM_INFO[key];
            const value = (formData.curveParams as unknown as Record<string, number | undefined>)[key] ?? info.min;
            return (
              <div key={key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginBottom: 'var(--space-1)' }}>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {info.label}
                  </span>
                  <Tooltip content={info.tooltip}>
                    <Info size={12} style={{ color: 'var(--text-muted)', cursor: 'help' }} />
                  </Tooltip>
                </div>
                <input
                  type="number"
                  min={info.min}
                  max={info.max}
                  step={info.step}
                  value={value}
                  onChange={(event) => updateCurveParam(key, Number(event.target.value))}
                  style={inputStyle}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <label style={sectionLabelStyle}>Price Curve Preview</label>
        <CurvePreviewChart
          curveParams={formData.curveParams}
          totalSupply={formData.totalSupply}
          graduationThreshold={formData.graduationThreshold}
        />
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <label style={sectionLabelStyle}>PancakeSwap Graduation Threshold</label>
          <Tooltip content="When this percentage of launch supply is sold, the token becomes ready for DEX graduation.">
            <Info size={14} style={{ color: 'var(--text-muted)', cursor: 'help' }} />
          </Tooltip>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <input
            type="range"
            min={40}
            max={100}
            step={5}
            value={formData.graduationThreshold}
            onChange={(event) => updateFormData({ graduationThreshold: Number(event.target.value) })}
            style={{ flex: 1, accentColor: 'var(--graduation)' }}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, color: 'var(--graduation)', minWidth: 48, textAlign: 'right' }}>
            {formData.graduationThreshold}%
          </span>
        </div>
      </div>
    </div>
  );
}

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 12,
  letterSpacing: 2,
  color: 'var(--text-muted)',
  marginBottom: 'var(--space-3)',
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-2) var(--space-3)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  color: 'var(--text-primary)',
  outline: 'none',
};
