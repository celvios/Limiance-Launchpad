'use client';

import { useCallback, useState } from 'react';
import type { CreateTokenFormData, DeployResult } from '@/lib/types';
import { API_BASE_URL } from '@/lib/constants';
import { useWallet } from '@/providers/BscWalletProvider';

export type DeployState =
  | 'idle'
  | 'uploading'
  | 'preparing'
  | 'confirming'
  | 'indexing'
  | 'success'
  | 'error';

export interface UseInitializeTokenReturn {
  deployToken: (formData: CreateTokenFormData) => Promise<DeployResult>;
  state: DeployState;
  error: string | null;
  reset: () => void;
}

export function useInitializeToken(): UseInitializeTokenReturn {
  const { address } = useWallet();
  const [state, setState] = useState<DeployState>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  const deployToken = useCallback(
    async (formData: CreateTokenFormData): Promise<DeployResult> => {
      if (!address) throw new Error('BSC wallet not connected');
      setState('preparing');
      setError(null);

      try {
        setState('confirming');
        const res = await fetch(`${API_BASE_URL}/tokens/deploy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creator: address,
            name: formData.name,
            symbol: formData.symbol,
            description: formData.description,
            imageUri: formData.imageIpfsUri,
            totalSupply: formData.totalSupply,
            creatorAllocation: formData.creatorAllocation,
            curveParams: formData.curveParams,
            graduationThreshold: formData.graduationThreshold,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `Deploy failed: ${res.status}`);
        }

        setState('success');
        return await res.json() as DeployResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown deploy error';
        setError(message);
        setState('error');
        throw err;
      }
    },
    [address],
  );

  return { deployToken, state, error, reset };
}
