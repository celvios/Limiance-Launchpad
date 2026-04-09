'use client';

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { calculatePrice } from '@/lib/curve/math';
import type { CurveParams } from '@/lib/types';

/* ── CurvePreviewChart ──
 * Pure SVG chart showing the bonding curve shape.
 * Draws itself left-to-right on mount / curve type change.
 * Re-draws smoothly when parameters change.
 */

interface CurvePreviewChartProps {
  curveParams: CurveParams;
  totalSupply: number;
  graduationThreshold: number; // percentage (0–100)
}

const CHART_W = 520;
const CHART_H = 240;
const PAD = { top: 20, right: 50, bottom: 36, left: 60 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;
const NUM_POINTS = 120;

export function CurvePreviewChart({
  curveParams,
  totalSupply,
  graduationThreshold,
}: CurvePreviewChartProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const [animKey, setAnimKey] = useState(0);

  // Compute data points
  const { path, gridLines, priceLabels, supplyLabels, gradX, maxPrice } = useMemo(() => {
    const points: { x: number; y: number; price: number }[] = [];
    let maxP = 0;

    for (let i = 0; i <= NUM_POINTS; i++) {
      const supply = (i / NUM_POINTS) * totalSupply;
      const price = calculatePrice(supply, curveParams);
      if (price > maxP) maxP = price;
      points.push({ x: supply, y: price, price });
    }

    // Add 10% padding to max price
    const paddedMax = maxP * 1.15;

    // Build SVG path
    const toSvgX = (supply: number) =>
      PAD.left + (supply / totalSupply) * PLOT_W;
    const toSvgY = (price: number) =>
      PAD.top + (1 - price / paddedMax) * PLOT_H;

    let d = `M ${toSvgX(points[0].x)} ${toSvgY(points[0].y)}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${toSvgX(points[i].x)} ${toSvgY(points[i].y)}`;
    }

    // Grid lines (4 horizontal)
    const gridCount = 4;
    const grids: { y: number; label: string }[] = [];
    for (let i = 0; i <= gridCount; i++) {
      const price = (paddedMax / gridCount) * i;
      grids.push({
        y: toSvgY(price),
        label: formatChartPrice(price),
      });
    }

    // Supply labels (5 along X axis)
    const supplyLbls: { x: number; label: string }[] = [];
    for (let i = 0; i <= 4; i++) {
      const supply = (totalSupply / 4) * i;
      supplyLbls.push({
        x: toSvgX(supply),
        label: formatSupply(supply),
      });
    }

    // Graduation threshold line
    const gradSupply = (graduationThreshold / 100) * totalSupply;
    const gx = toSvgX(gradSupply);

    return {
      path: d,
      gridLines: grids,
      priceLabels: grids,
      supplyLabels: supplyLbls,
      gradX: gx,
      maxPrice: paddedMax,
    };
  }, [curveParams, totalSupply, graduationThreshold]);

  // Trigger draw animation on curve type change
  useEffect(() => {
    setAnimKey((k) => k + 1);
  }, [curveParams.type]);

  // Animate stroke-dashoffset
  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const length = el.getTotalLength();
    el.style.strokeDasharray = `${length}`;
    el.style.strokeDashoffset = `${length}`;
    // Force reflow
    el.getBoundingClientRect();
    el.style.transition = 'stroke-dashoffset 1000ms cubic-bezier(0.16, 1, 0.3, 1)';
    el.style.strokeDashoffset = '0';
  }, [animKey, path]);

  // "You are here" — price at supply=0
  const startPrice = calculatePrice(0, curveParams);
  const startY = PAD.top + (1 - startPrice / maxPrice) * PLOT_H;

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        padding: 'var(--space-3)',
        overflow: 'hidden',
      }}
    >
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        width="100%"
        style={{ display: 'block' }}
      >
        {/* Grid lines */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              y1={g.y}
              x2={PAD.left + PLOT_W}
              y2={g.y}
              stroke="var(--border)"
              strokeWidth={0.5}
              strokeDasharray="3 4"
            />
            <text
              x={PAD.left - 8}
              y={g.y + 4}
              textAnchor="end"
              fill="var(--text-muted)"
              fontSize={9}
              fontFamily="'IBM Plex Mono', monospace"
            >
              {g.label}
            </text>
          </g>
        ))}

        {/* Supply axis labels */}
        {supplyLabels.map((s, i) => (
          <text
            key={i}
            x={s.x}
            y={CHART_H - 8}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize={9}
            fontFamily="'IBM Plex Mono', monospace"
          >
            {s.label}
          </text>
        ))}

        {/* Axis labels */}
        <text
          x={PAD.left - 8}
          y={10}
          textAnchor="end"
          fill="var(--text-muted)"
          fontSize={8}
          fontFamily="'DM Sans', sans-serif"
        >
          PRICE (SOL)
        </text>
        <text
          x={CHART_W - PAD.right + 8}
          y={CHART_H - 8}
          textAnchor="start"
          fill="var(--text-muted)"
          fontSize={8}
          fontFamily="'DM Sans', sans-serif"
        >
          SUPPLY
        </text>

        {/* Graduation threshold line */}
        <line
          x1={gradX}
          y1={PAD.top}
          x2={gradX}
          y2={PAD.top + PLOT_H}
          stroke="var(--graduation)"
          strokeWidth={1}
          strokeDasharray="6 4"
          opacity={0.7}
        />
        <text
          x={gradX}
          y={PAD.top - 6}
          textAnchor="middle"
          fill="var(--graduation)"
          fontSize={9}
          fontFamily="'DM Sans', sans-serif"
          fontWeight={600}
        >
          Graduation
        </text>

        {/* Curve path */}
        <path
          ref={pathRef}
          d={path}
          fill="none"
          stroke="var(--buy)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* "You are here" dot */}
        <circle
          cx={PAD.left}
          cy={startY}
          r={5}
          fill="var(--buy)"
          stroke="var(--bg-elevated)"
          strokeWidth={2}
        />
        <text
          x={PAD.left + 10}
          y={startY - 8}
          fill="var(--buy)"
          fontSize={9}
          fontFamily="'DM Sans', sans-serif"
          fontWeight={600}
        >
          You are here
        </text>
      </svg>
    </div>
  );
}

function formatChartPrice(price: number): string {
  if (price === 0) return '0';
  if (price < 0.0001) return price.toExponential(1);
  if (price < 0.01) return price.toFixed(5);
  if (price < 1) return price.toFixed(4);
  return price.toFixed(2);
}

function formatSupply(supply: number): string {
  if (supply === 0) return '0';
  if (supply >= 1000000) return `${(supply / 1000000).toFixed(0)}M`;
  if (supply >= 1000) return `${(supply / 1000).toFixed(0)}K`;
  return supply.toFixed(0);
}
