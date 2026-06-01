'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/providers/BscWalletProvider';
import { PAYMENT_ASSET } from '@/lib/constants';

const DEFAULT_SLIPPAGE_BPS = 200;

function encodeUint256(value: bigint): string {
  return value.toString(16).padStart(64, '0');
}

function encodeAddress(value: string): string {
  return value.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

function encodeBuyCall(tokenAmount: bigint, recipient: string, maxPayment: bigint): string {
  const selector = '2afaca20'; // buy(uint256,address,uint256)
  return `0x${selector}${encodeUint256(tokenAmount)}${encodeAddress(recipient)}${encodeUint256(maxPayment)}`;
}

function encodeApproveCall(spender: string, amount: bigint): string {
  const selector = '095ea7b3'; // approve(address,uint256)
  return `0x${selector}${encodeAddress(spender)}${encodeUint256(amount)}`;
}

function applySlippage(amount: bigint, bps: number, direction: 'up' | 'down'): bigint {
  return direction === 'up'
    ? (amount * BigInt(10_000 + bps)) / 10_000n
    : (amount * BigInt(10_000 - bps)) / 10_000n;
}

export interface BuyParams {
  amount: bigint;
  maxPayment?: bigint;
  quotePayment?: bigint;
  saleAddress?: string;
}

export interface SellParams {
  amount: bigint;
  minPaymentReturn?: bigint;
  quotePayment?: bigint;
}

export interface TradeResult {
  txSignature: string;
}

export function useBuy(tokenAddress: string) {
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const buy = useCallback(
    async (params: BuyParams): Promise<TradeResult> => {
      if (!address || !window.ethereum) throw new Error('BSC wallet not connected');
      const saleAddress = params.saleAddress ?? tokenAddress;
      setIsLoading(true);
      setError(null);

      try {
        const value =
          params.maxPayment ??
          (params.quotePayment ? applySlippage(params.quotePayment, DEFAULT_SLIPPAGE_BPS, 'up') : 0n);
        if (value <= 0n) throw new Error('Missing USDT quote for buy transaction');

        await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: address,
              to: PAYMENT_ASSET,
              value: '0x0',
              data: encodeApproveCall(saleAddress, value),
            },
          ],
        });

        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: address,
              to: saleAddress,
              value: '0x0',
              data: encodeBuyCall(params.amount, address, value),
            },
          ],
        }) as string;

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['token-detail', tokenAddress] }),
          queryClient.invalidateQueries({ queryKey: ['activity', tokenAddress] }),
          queryClient.invalidateQueries({ queryKey: ['token-price', tokenAddress] }),
        ]);

        return { txSignature: txHash };
      } catch (err) {
        const nextError = err instanceof Error ? err : new Error(String(err));
        setError(nextError);
        throw nextError;
      } finally {
        setIsLoading(false);
      }
    },
    [address, tokenAddress, queryClient],
  );

  return { buy, isLoading, error };
}

export function useSell(tokenAddress: string) {
  const [error] = useState<Error | null>(
    new Error('Pre-graduation sells are disabled for BSC v1. Trade on PancakeSwap after graduation.'),
  );

  const sell = useCallback(async (_params: SellParams): Promise<TradeResult> => {
    throw new Error('Pre-graduation sells are disabled for BSC v1.');
  }, []);

  return { sell, isLoading: false, error };
}
