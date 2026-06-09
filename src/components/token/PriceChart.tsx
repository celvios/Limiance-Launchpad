'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
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

export function PriceChart({ mint, currentPrice }: PriceChartProps) {
  const [range, setRange] = useState<ChartTimeRange>('1D');
  const { data, isLoading } = useChartData(mint, range);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Derive the display data safely
  const formattedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // lightweight-charts expects time in seconds as a number, or YYYY-MM-DD strings
    // the backend returns unix timestamp in seconds for `time`
    return data.map((d) => ({
      time: d.time as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      value: d.volume || 0, // value is used for histogram volume
    })).sort((a, b) => (a.time as number) - (b.time as number));
  }, [data]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Initialize Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#666666',
        fontFamily: '"IBM Plex Mono", monospace',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: {
          top: 0.1,
          bottom: 0.3, // Leave space for volume
        },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1, // Normal mode
        vertLine: {
          color: '#444444',
          width: 1,
          style: 3,
          labelBackgroundColor: '#181818',
        },
        horzLine: {
          color: '#444444',
          width: 1,
          style: 3,
          labelBackgroundColor: '#181818',
        },
      },
      autoSize: true,
    });

    chartRef.current = chart;

    // Add Candlestick Series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00FF66',
      downColor: '#FF2D55',
      borderVisible: false,
      wickUpColor: '#00FF66',
      wickDownColor: '#FF2D55',
    });
    candlestickSeriesRef.current = candlestickSeries;

    // Add Volume Series (Histogram)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '', // set as an overlay by setting a blank priceScaleId
    });
    volumeSeriesRef.current = volumeSeries;

    // Configure overlay price scale for volume
    chart.priceScale('').applyOptions({
      scaleMargins: {
        top: 0.75, // Volume takes bottom 25%
        bottom: 0,
      },
    });

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []); // Run once on mount

  useEffect(() => {
    // Update data when it changes
    if (candlestickSeriesRef.current && volumeSeriesRef.current && formattedData.length > 0) {
      
      // Filter out duplicate times and ensure strictly ascending order
      const uniqueData = [];
      let lastTime = 0;
      for (const item of formattedData) {
        if ((item.time as number) > lastTime) {
          uniqueData.push(item);
          lastTime = item.time as number;
        }
      }

      candlestickSeriesRef.current.setData(uniqueData);
      
      const volumeData = uniqueData.map(d => ({
        time: d.time,
        value: d.value,
        color: d.close >= d.open ? 'rgba(0, 255, 102, 0.4)' : 'rgba(255, 45, 85, 0.4)',
      }));
      
      volumeSeriesRef.current.setData(volumeData);
      
      chartRef.current?.timeScale().fitContent();
    } else if (candlestickSeriesRef.current && volumeSeriesRef.current) {
        candlestickSeriesRef.current.setData([]);
        volumeSeriesRef.current.setData([]);
    }
  }, [formattedData]);

  // Format main price display
  let displayPrice = currentPrice.toFixed(4);
  if (currentPrice < 0.0001) displayPrice = currentPrice.toFixed(8);
  else if (currentPrice < 0.01) displayPrice = currentPrice.toFixed(6);

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '400px',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '24px',
              color: 'var(--text-primary)',
            }}
          >
            {displayPrice}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}
          >
            USDT
          </span>
        </div>

        {/* Time Ranges */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-1)',
            background: 'var(--bg-elevated)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {TIME_RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              style={{
                border: 'none',
                background: range === r.id ? 'var(--text-primary)' : 'transparent',
                color: range === r.id ? 'var(--bg-base)' : 'var(--text-secondary)',
                padding: 'var(--space-1) var(--space-3)',
                borderRadius: '4px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Container */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.4)',
              zIndex: 10,
              backdropFilter: 'blur(2px)',
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                border: '2px solid var(--border)',
                borderTopColor: 'var(--brand)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
          </div>
        )}
        
        {(!data || data.length === 0) && !isLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 5,
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
              No data
            </span>
          </div>
        )}

        <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}
