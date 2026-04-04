'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useChartData } from '@/hooks/useTokenDetail';
import type { ChartTimeRange, ChartDataPoint } from '@/lib/types';

interface PriceChartProps {
  mint: string;
  currentPrice: number;
}

const TIME_RANGES: { id: ChartTimeRange; label: string }[] = [
  { id: '1H', label: '1H' },
  { id: '4H', label: '4H' },
  { id: '1D', label: '1D' },
  { id: 'ALL', label: 'ALL' },
];

/*
 * Canvas 2D API colors — CSS variables cannot be used in ctx.fillStyle/strokeStyle.
 * These values mirror the design system tokens defined in globals.css :root.
 * If you change a design token, update the corresponding value here.
 */
const COLORS = {
  up: '#00FF66',         // --buy
  down: '#FF2D55',       // --sell
  upDim: 'rgba(0, 255, 102, 0.12)',   // --buy @ 12%
  downDim: 'rgba(255, 45, 85, 0.12)', // --sell @ 12%
  grid: '#1a1a1a',       // between --bg-card and --bg-elevated
  text: '#666666',       // --text-muted
  crosshair: '#444444',  // --border-active
  bg: '#111111',         // --bg-card
  label: '#181818',      // --bg-elevated
  labelText: '#aaaaaa',  // --text-secondary
  tooltipBorder: '#333333', // between --border and --border-active
};

/* ── Price formatting ── */
function formatPrice(price: number): string {
  if (price < 0.0001) return price.toFixed(8);
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  return price.toFixed(2);
}

function formatTime(timestamp: number, range: ChartTimeRange): string {
  const d = new Date(timestamp * 1000);
  if (range === '1H' || range === '4H') {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

/* ── Chart drawing engine ── */
function drawChart(
  ctx: CanvasRenderingContext2D,
  data: ChartDataPoint[],
  width: number,
  height: number,
  range: ChartTimeRange,
  mouseX: number | null,
  mouseY: number | null,
  dpr: number,
) {
  ctx.clearRect(0, 0, width * dpr, height * dpr);
  ctx.save();
  ctx.scale(dpr, dpr);

  if (data.length === 0) {
    ctx.fillStyle = COLORS.text;
    ctx.font = '13px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('No data', width / 2, height / 2);
    ctx.restore();
    return;
  }

  const PADDING = { top: 16, right: 72, bottom: 32, left: 12 };
  const chartW = width - PADDING.left - PADDING.right;
  const chartH = height - PADDING.top - PADDING.bottom;
  const volumeH = chartH * 0.15;
  const candleArea = chartH - volumeH - 8; // 8px gap

  // Price range
  const allHigh = Math.max(...data.map((d) => d.high));
  const allLow = Math.min(...data.map((d) => d.low));
  const priceRange = allHigh - allLow || allHigh * 0.01;
  const pricePad = priceRange * 0.08;
  const priceMax = allHigh + pricePad;
  const priceMin = allLow - pricePad;
  const priceSpan = priceMax - priceMin;

  // Volume range
  const volumes = data.map((d) => Math.abs(d.close - d.open) * 100000);
  const maxVol = Math.max(...volumes) || 1;

  // Candle geometry
  const candleSpacing = Math.max(2, chartW / data.length);
  const candleW = Math.max(3, candleSpacing * 0.7);
  const wickW = Math.max(1, candleW * 0.15);

  // Y helpers
  const priceToY = (p: number) => PADDING.top + (1 - (p - priceMin) / priceSpan) * candleArea;
  const volToH = (v: number) => (v / maxVol) * volumeH;

  // ── Grid lines ──
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);
  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const y = PADDING.top + (candleArea / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(PADDING.left, y);
    ctx.lineTo(PADDING.left + chartW, y);
    ctx.stroke();

    // Price label
    const price = priceMax - (priceSpan / gridLines) * i;
    ctx.fillStyle = COLORS.text;
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(formatPrice(price), PADDING.left + chartW + 8, y + 4);
  }
  ctx.setLineDash([]);

  // ── Time labels ──
  const labelInterval = Math.max(1, Math.floor(data.length / 8));
  ctx.fillStyle = COLORS.text;
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  for (let i = 0; i < data.length; i += labelInterval) {
    const x = PADDING.left + i * candleSpacing + candleSpacing / 2;
    ctx.fillText(formatTime(data[i].time, range), x, height - 8);
  }

  // ── Volume bars ──
  const volBaseY = PADDING.top + candleArea + 8 + volumeH;
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const x = PADDING.left + i * candleSpacing + (candleSpacing - candleW) / 2;
    const isUp = d.close >= d.open;
    const h = volToH(volumes[i]);

    ctx.fillStyle = isUp ? COLORS.upDim : COLORS.downDim;
    ctx.fillRect(x, volBaseY - h, candleW, h);
  }

  // ── Candlesticks ──
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const x = PADDING.left + i * candleSpacing + candleSpacing / 2;
    const isUp = d.close >= d.open;
    const color = isUp ? COLORS.up : COLORS.down;

    const bodyTop = priceToY(Math.max(d.open, d.close));
    const bodyBot = priceToY(Math.min(d.open, d.close));
    const bodyH = Math.max(1, bodyBot - bodyTop);

    // Wick
    ctx.strokeStyle = color;
    ctx.lineWidth = wickW;
    ctx.beginPath();
    ctx.moveTo(x, priceToY(d.high));
    ctx.lineTo(x, priceToY(d.low));
    ctx.stroke();

    // Body
    ctx.fillStyle = color;
    ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
  }

  // ── Crosshair + tooltip ──
  if (mouseX !== null && mouseY !== null && mouseX > PADDING.left && mouseX < PADDING.left + chartW) {
    const candleIndex = Math.floor((mouseX - PADDING.left) / candleSpacing);
    if (candleIndex >= 0 && candleIndex < data.length) {
      const d = data[candleIndex];
      const snapX = PADDING.left + candleIndex * candleSpacing + candleSpacing / 2;

      // Vertical line
      ctx.strokeStyle = COLORS.crosshair;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(snapX, PADDING.top);
      ctx.lineTo(snapX, PADDING.top + candleArea);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(PADDING.left, mouseY);
      ctx.lineTo(PADDING.left + chartW, mouseY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Price label on right axis
      const hoverPrice = priceMin + (1 - (mouseY - PADDING.top) / candleArea) * priceSpan;
      ctx.fillStyle = COLORS.label;
      const labelW = 68;
      ctx.fillRect(PADDING.left + chartW + 2, mouseY - 10, labelW, 20);
      ctx.fillStyle = COLORS.labelText;
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(formatPrice(hoverPrice), PADDING.left + chartW + 6, mouseY + 4);

      // OHLC tooltip
      const isUp = d.close >= d.open;
      const tooltipW = 170;
      const tooltipH = 88;
      let tooltipX = snapX + 16;
      if (tooltipX + tooltipW > width - PADDING.right) tooltipX = snapX - tooltipW - 16;
      const tooltipY = Math.max(PADDING.top, Math.min(mouseY - tooltipH / 2, height - PADDING.bottom - tooltipH));

      // Tooltip bg
      ctx.fillStyle = 'rgba(17, 17, 17, 0.95)';
      ctx.strokeStyle = COLORS.tooltipBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tooltipX, tooltipY, tooltipW, tooltipH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      const lines = [
        { label: 'O', value: formatPrice(d.open), color: isUp ? COLORS.up : COLORS.down },
        { label: 'H', value: formatPrice(d.high), color: COLORS.up },
        { label: 'L', value: formatPrice(d.low), color: COLORS.down },
        { label: 'C', value: formatPrice(d.close), color: isUp ? COLORS.up : COLORS.down },
      ];

      lines.forEach((line, idx) => {
        const ly = tooltipY + 18 + idx * 17;
        ctx.fillStyle = COLORS.text;
        ctx.fillText(line.label, tooltipX + 10, ly);
        ctx.fillStyle = line.color;
        ctx.fillText(line.value, tooltipX + 28, ly);
      });
    }
  }

  ctx.restore();
}

/* ── React component ── */
export function PriceChart({ mint, currentPrice }: PriceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeRange, setActiveRange] = useState<ChartTimeRange>('ALL');
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const animFrameRef = useRef<number>(0);

  const { data: chartData, isLoading } = useChartData(mint, activeRange);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !chartData) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = 420;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawChart(ctx, chartData, w, h, activeRange, mousePos?.x ?? null, mousePos?.y ?? null, dpr);
  }, [chartData, activeRange, mousePos]);

  // Render on data/mouse change
  useEffect(() => {
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [render]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(render);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [render]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const handleMouseLeave = useCallback(() => setMousePos(null), []);

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Time range tabs + price */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {currentPrice < 0.001
            ? currentPrice.toFixed(6)
            : currentPrice < 1
            ? currentPrice.toFixed(4)
            : currentPrice.toFixed(2)}{' '}
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>SOL</span>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
          {TIME_RANGES.map((range) => (
            <button
              key={range.id}
              onClick={() => setActiveRange(range.id)}
              style={{
                padding: 'var(--space-1) var(--space-3)',
                background: activeRange === range.id ? 'var(--text-primary)' : 'transparent',
                color: activeRange === range.id ? 'var(--bg-base)' : 'var(--text-muted)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all var(--duration-fast)',
              }}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-card)',
              zIndex: 2,
              height: 420,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                color: 'var(--text-muted)',
              }}
            >
              Loading chart...
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ display: 'block', cursor: 'crosshair' }}
        />
      </div>
    </div>
  );
}
