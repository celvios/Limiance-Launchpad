'use client';

import React from 'react';
import { useCreateTokenStore } from '@/hooks/useCreateToken';
import { CurvePreviewChart } from './CurvePreviewChart';
import { Info } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import type { CurveType } from '@/lib/types';

/* ── Step 2 — Curve Selection ── */

const CURVE_OPTIONS: {
  type: CurveType;
  title: string;
  icon: string;
  description: string;
  bestFor: string;
}[] = [
  {
    type: 'linear',
    title: 'LINEAR',
    icon: '📈',
    description: 'Steady, predictable price growth proportional to supply',
    bestFor: 'Utility tokens, stable DAOs',
  },
  {
    type: 'exponential',
    title: 'EXPONENTIAL',
    icon: '🚀',
    description: 'Accelerating price growth — early buyers get the best price',
    bestFor: 'Meme tokens, speculative assets',
  },
  {
    type: 'sigmoid',
    title: 'SIGMOID',
    icon: '🎯',
    description: 'S-shaped curve — stable start, rapid mid-growth, plateau at cap',
    bestFor: 'Fair launch tokens, balanced distribution',
  },
];

const PARAM_INFO: Record<string, { label: string; tooltip: string; min: number; max: number; step: number }> = {
  a: { label: 'Base Price (a)', tooltip: 'Starting price at zero supply', min: 0.000001, max: 1, step: 0.0001 },
  b: { label: 'Slope (b)', tooltip: 'How much price increases per token minted', min: 0.0000001, max: 0.01, step: 0.000001 },
  r: { label: 'Growth Rate (r)', tooltip: 'Exponential growth factor — higher = steeper curve', min: 0.0001, max: 0.01, step: 0.0001 },
  maxPrice: { label: 'Max Price', tooltip: 'Price ceiling the curve approaches but never exceeds', min: 0.001, max: 100, step: 0.01 },
  k: { label: 'Steepness (k)', tooltip: 'How sharp the S-curve transition is', min: 0.0001, max: 0.1, step: 0.0001 },
  s0: { label: 'Midpoint (s₀)', tooltip: 'Supply level where price reaches 50% of max', min: 100, max: 500000, step: 100 },
};

const CURVE_PARAM_KEYS: Record<CurveType, string[]> = {
  linear: ['a', 'b'],
  exponential: ['a', 'r'],
  sigmoid: ['maxPrice', 'k', 's0'],
};

export function StepCurve() {
  const { formData, setCurveType, updateCurveParam, updateFormData } = useCreateTokenStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Curve Type Cards */}
      <div>
        <label style={sectionLabelStyle}>Select Curve Type</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {CURVE_OPTIONS.map((curve) => {
            const isSelected = formData.curveType === curve.type;
            return (
              <button
                key={curve.type}
                onClick={() => setCurveType(curve.type)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  background: isSelected ? 'var(--bg-elevated)' : 'var(--bg-card)',
                  border: isSelected
                    ? '2px solid var(--buy)'
                    : '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all var(--duration-base)',
                  width: '100%',
                }}
              >
                {/* Curve icon SVG */}
                <div
                  style={{
                    width: 48,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: '20px',
                  }}
                >
                  <CurveIconSvg type={curve.type} active={isSelected} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 'var(--space-1)',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '16px',
                        letterSpacing: '2px',
                        color: isSelected ? 'var(--buy)' : 'var(--text-primary)',
                      }}
                    >
                      {curve.title}
                    </span>
                    {isSelected && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10px',
                          color: 'var(--buy)',
                          background: 'var(--buy-dim)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        SELECTED
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.4,
                    }}
                  >
                    {curve.description}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      marginTop: 'var(--space-1)',
                    }}
                  >
                    Best for: {curve.bestFor}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Parameter Inputs */}
      <div>
        <label style={sectionLabelStyle}>Curve Parameters</label>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 'var(--space-3)',
          }}
        >
          {CURVE_PARAM_KEYS[formData.curveType].map((key) => {
            const info = PARAM_INFO[key];
            const value = (formData.curveParams as unknown as Record<string, number | undefined>)[key] ?? info.min;
            return (
              <div key={key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginBottom: 'var(--space-1)' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                    }}
                  >
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
                  onChange={(e) => updateCurveParam(key, Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    transition: 'border-color var(--duration-fast)',
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Curve Preview Chart */}
      <div>
        <label style={sectionLabelStyle}>Price Curve Preview</label>
        <CurvePreviewChart
          curveParams={formData.curveParams}
          totalSupply={formData.totalSupply}
          graduationThreshold={formData.graduationThreshold}
        />
      </div>

      {/* Graduation Threshold Slider */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <label style={sectionLabelStyle}>Graduation Threshold</label>
          <Tooltip content="When this percentage of supply is minted, the token graduates to Raydium DEX">
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
            onChange={(e) =>
              updateFormData({ graduationThreshold: Number(e.target.value) })
            }
            style={{
              flex: 1,
              accentColor: 'var(--graduation)',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--graduation)',
              minWidth: 48,
              textAlign: 'right',
            }}
          >
            {formData.graduationThreshold}%
          </span>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginTop: 'var(--space-1)',
          }}
        >
          Graduates at:{' '}
          {Math.floor(
            formData.totalSupply * formData.graduationThreshold / 100
          ).toLocaleString()}{' '}
          tokens
        </div>
      </div>
    </div>
  );
}

/* ── Curve Icon SVGs ── */

function CurveIconSvg({ type, active }: { type: CurveType; active: boolean }) {
  const color = active ? 'var(--buy)' : 'var(--text-muted)';
  const paths: Record<CurveType, string> = {
    linear: 'M 4 28 L 44 4',
    exponential: 'M 4 28 Q 20 27 30 18 Q 38 10 44 4',
    sigmoid: 'M 4 28 Q 8 28 16 26 Q 24 20 28 14 Q 32 8 36 6 Q 40 4 44 4',
  };

  return (
    <svg viewBox="0 0 48 32" width="48" height="32">
      <path
        d={paths[type]}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: '12px',
  letterSpacing: '2px',
  color: 'var(--text-muted)',
  marginBottom: 'var(--space-3)',
  display: 'block',
};
