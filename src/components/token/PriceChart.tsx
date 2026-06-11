'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  Time,
  CandlestickSeries,
  HistogramSeries,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import { Maximize, Minimize } from 'lucide-react';
import { useChartData } from '@/hooks/useTokenDetail';
import type { ChartTimeRange } from '@/lib/types';

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

function formatPrice(p: number): string {
  if (!p) return '—';
  if (p < 0.000001) return p.toExponential(4);
  if (p < 0.0001)   return p.toFixed(8);
  if (p < 0.01)     return p.toFixed(6);
  if (p < 1)        return p.toFixed(4);
  return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatVolume(v: number): string {
  if (!v) return '0';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(2)}K`;
  return v.toFixed(2);
}

export function PriceChart({ mint, currentPrice }: PriceChartProps) {
  const [range, setRange] = useState<ChartTimeRange>('1H');
  const { data, isLoading } = useChartData(mint, range);

  const containerWrapperRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartRef          = useRef<IChartApi | null>(null);
  const candleRef         = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef         = useRef<ISeriesApi<'Histogram'> | null>(null);

  // OHLCV tooltip state — updated on crosshair move
  const [tooltip, setTooltip] = useState<{
    open: number; high: number; low: number; close: number; volume: number; isUp: boolean;
  } | null>(null);

  const formattedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const seen = new Set<number>();
    return data
      .filter((d) => {
        if (seen.has(d.time as number)) return false;
        seen.add(d.time as number);
        return true;
      })
      .sort((a, b) => (a.time as number) - (b.time as number));
  }, [data]);

  // Fullscreen listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (chartRef.current) {
        setTimeout(() => chartRef.current?.timeScale().fitContent(), 50);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerWrapperRef.current?.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  };

  // Build chart once
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0d0d14' },
        textColor: '#9ca3af',
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.06)', style: LineStyle.Dotted },
        horzLines: { color: 'rgba(255,255,255,0.06)', style: LineStyle.Dotted },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.28 },
        textColor: '#9ca3af',
        autoScale: true,
        mode: 0, // 0 = Normal scale — log scale distorts tiny price ranges
        minimumWidth: 80,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: false,
        fixRightEdge: false,
        rightOffset: 12,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,255,255,0.15)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1a1a2e' },
        horzLine: { color: 'rgba(255,255,255,0.15)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1a1a2e' },
      },
      autoSize: true,
    });

    chartRef.current = chart;

    const candle = chart.addSeries(CandlestickSeries, {
      upColor:       '#22c55e',
      downColor:     '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      borderVisible: true,
      wickUpColor:   '#22c55e',
      wickDownColor: '#ef4444',
    });
    candleRef.current = candle;

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat:  { type: 'volume' },
      priceScaleId: 'vol',
    });
    volumeRef.current = volume;

    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    // Crosshair listener — update OHLCV tooltip
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setTooltip(null);
        return;
      }
      const c = param.seriesData.get(candle) as any;
      const v = param.seriesData.get(volume) as any;
      if (c) {
        setTooltip({
          open:   c.open,
          high:   c.high,
          low:    c.low,
          close:  c.close,
          volume: v?.value ?? 0,
          isUp:   c.close >= c.open,
        });
      }
    });

    return () => {
      chart.remove();
      chartRef.current   = null;
      candleRef.current  = null;
      volumeRef.current  = null;
    };
  }, []);

  // Push data whenever it changes
  useEffect(() => {
    if (!candleRef.current || !volumeRef.current) return;

    if (formattedData.length === 0) {
      candleRef.current.setData([]);
      volumeRef.current.setData([]);
      return;
    }

    candleRef.current.setData(
      formattedData.map((d) => ({
        time:  d.time as Time,
        open:  d.open,
        high:  d.high,
        low:   d.low,
        close: d.close,
      }))
    );

    volumeRef.current.setData(
      formattedData.map((d) => ({
        time:  d.time as Time,
        value: d.volume ?? 0,
        color: d.close >= d.open ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)',
      }))
    );

    // Fit time scale & force price scale to auto-scale to data range
    if (formattedData.length <= 5) {
      // Pad the x-axis if there are very few candles so they don't stretch massively
      chartRef.current?.timeScale().setVisibleLogicalRange({
        from: -10,
        to: formattedData.length + 10,
      });
    } else {
      chartRef.current?.timeScale().fitContent();
    }
    // Force the price scale to re-fit to the visible data
    chartRef.current?.priceScale('right').applyOptions({ autoScale: true });

    // Seed tooltip with last candle
    const last = formattedData[formattedData.length - 1];
    setTooltip({
      open:   last.open,
      high:   last.high,
      low:    last.low,
      close:  last.close,
      volume: last.volume ?? 0,
      isUp:   last.close >= last.open,
    });
  }, [formattedData]);

  const priceColor = tooltip
    ? (tooltip.isUp ? '#22c55e' : '#ef4444')
    : currentPrice >= 0 ? '#22c55e' : '#ef4444';

  return (
    <div
      ref={containerWrapperRef}
      style={{
        background: '#0d0d14',
        border: isFullscreen ? 'none' : '1px solid rgba(255,255,255,0.06)',
        borderRadius: isFullscreen ? '0px' : '12px',
        display: 'flex',
        flexDirection: 'column',
        height: isFullscreen ? '100vh' : '100%',
        width: isFullscreen ? '100vw' : '100%',
        minHeight: '550px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── DexScreener-style header ── */}
      <div style={{ padding: '12px 16px 8px', display: 'flex', flexDirection: 'column', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#0d0d14', zIndex: 10 }}>
        
        {/* OHLCV row */}
        {tooltip ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#6b7280' }}>
              O <span style={{ color: tooltip.isUp ? '#22c55e' : '#ef4444' }}>{formatPrice(tooltip.open)}</span>
            </span>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#6b7280' }}>
              H <span style={{ color: '#22c55e' }}>{formatPrice(tooltip.high)}</span>
            </span>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#6b7280' }}>
              L <span style={{ color: '#ef4444' }}>{formatPrice(tooltip.low)}</span>
            </span>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#6b7280' }}>
              C <span style={{ color: tooltip.isUp ? '#22c55e' : '#ef4444' }}>{formatPrice(tooltip.close)}</span>
            </span>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#6b7280' }}>
              Vol <span style={{ color: '#9ca3af' }}>{formatVolume(tooltip.volume)}</span>
            </span>
          </div>
        ) : (
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#4b5563' }}>
            Hover over chart to see OHLCV
          </div>
        )}

        {/* Price + time range row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 22, fontWeight: 700, color: '#f9fafb', letterSpacing: '-0.5px' }}>
              {formatPrice(tooltip?.close ?? currentPrice)}
            </span>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#6b7280' }}>
              USDT
            </span>
          </div>

          {/* Actions: Time range + Expand */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Time range tabs */}
            <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', padding: '3px', borderRadius: 8 }}>
              {TIME_RANGES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRange(r.id)}
                  style={{
                    border: 'none',
                    background: range === r.id ? 'rgba(255,255,255,0.12)' : 'transparent',
                    color: range === r.id ? '#f9fafb' : '#6b7280',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Expand button */}
            <button
              onClick={toggleFullscreen}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: 'none',
                color: '#9ca3af',
                padding: '6px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Chart area ── */}
      <div style={{ flex: 1, position: 'relative', minHeight: '400px' }}>
        {/* Loading spinner */}
        {isLoading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,13,20,0.7)', zIndex: 10, backdropFilter: 'blur(2px)' }}>
            <div style={{ width: 24, height: 24, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#22c55e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}

        {/* No data state */}
        {!isLoading && (!data || data.length === 0) && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, zIndex: 5 }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, color: '#4b5563' }}>No trades yet</div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#374151' }}>Chart will appear once trading starts</div>
          </div>
        )}

        <div ref={chartContainerRef} style={{ position: 'absolute', inset: 0 }} />
      </div>
    </div>
  );
}
