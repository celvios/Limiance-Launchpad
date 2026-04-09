'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchTokenDetail, fetchTokenActivity, fetchChartData } from '@/lib/api';
import type { ChartTimeRange } from '@/lib/types';

export function useTokenDetail(mint: string) {
  return useQuery({
    queryKey: ['token-detail', mint],
    queryFn: () => fetchTokenDetail(mint),
    staleTime: 15_000,
    enabled: !!mint,
  });
}

export function useTokenActivity(mint: string) {
  return useQuery({
    queryKey: ['token-activity', mint],
    queryFn: () => fetchTokenActivity(mint),
    staleTime: 10_000,
    enabled: !!mint,
  });
}

export function useChartData(mint: string, range: ChartTimeRange) {
  return useQuery({
    queryKey: ['chart-data', mint, range],
    queryFn: () => fetchChartData(mint, range),
    staleTime: 30_000,
    enabled: !!mint,
  });
}
