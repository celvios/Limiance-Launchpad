'use client';

/**
 * useInitializeToken — calls the Anchor `initialize_token` instruction
 * and indexes the result in the backend DB.
 *
 * Replaces the placeholder deploy handler in Create Wizard Step 3.
 *
 * Usage:
 *   const { deployToken, state } = useInitializeToken()
 *   const result = await deployToken(formData)
 */

import { useCallback, useState } from 'react';
import { useConnection, useWallet, useAnchorWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@coral-xyz/anchor';
import { PublicKey, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import BN from 'bn.js';
import {
  getProgram,
  deriveMint,
  deriveTokenConfig,
  deriveSolVault,
  derivePlatformConfig,
  encodeCurveType,
  PROGRAM_ID,
} from '@/lib/anchor/program';
import type { CreateTokenFormData, DeployResult } from '@/lib/types';
import { API_BASE_URL } from '@/lib/constants';

// Metaplex Token Metadata program ID (stable)
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
);

export type DeployState =
  | 'idle'
  | 'uploading'      // image upload to IPFS
  | 'preparing'      // building transaction
  | 'confirming'     // waiting for tx confirmation
  | 'indexing'       // POSTing to backend
  | 'success'
  | 'error';

export interface UseInitializeTokenReturn {
  deployToken: (formData: CreateTokenFormData) => Promise<DeployResult>;
  state: DeployState;
  error: string | null;
  reset: () => void;
}

/**
 * Convert frontend CurveParams (SOL floats) to on-chain u64 lamport params.
 * Must mirror the toOnChain() logic in lib/curve/math.ts.
 */
function buildOnChainCurveParams(formData: CreateTokenFormData) {
  const { curveType, curveParams } = formData;

  switch (curveType) {
    case 'linear':
      return {
        paramA: new BN(Math.round((curveParams.a ?? 0.0001) * 1e9)),
        paramB: new BN(Math.round((curveParams.b ?? 0.000005) * 1e9)),
        paramC: new BN(0),
        paramD: new BN(0),
        paramE: new BN(0),
      };
    case 'exponential':
      return {
        paramA: new BN(Math.round((curveParams.a ?? 0.00001) * 1e9)),
        paramB: new BN(Math.round((curveParams.r ?? 0.0008) * 1e6)),
        paramC: new BN(0),
        paramD: new BN(0),
        paramE: new BN(0),
      };
    case 'sigmoid':
      return {
        paramA: new BN(Math.round((curveParams.maxPrice ?? 0.1) * 1e9)),
        paramB: new BN(Math.round((curveParams.k ?? 0.002) * 1e6)),
        paramC: new BN(Math.round(curveParams.s0 ?? formData.totalSupply * 0.5)),
        paramD: new BN(0),
        paramE: new BN(0),
      };
  }
}

export function useInitializeToken(): UseInitializeTokenReturn {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [state, setState] = useState<DeployState>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  const deployToken = useCallback(
    async (formData: CreateTokenFormData): Promise<DeployResult> => {
      if (!wallet) {
        throw new Error('Wallet not connected');
      }

      setError(null);
      setState('preparing');

      try {
        const provider = new AnchorProvider(connection, wallet, {
          commitment: 'confirmed',
          preflightCommitment: 'confirmed',
        });

        const program = getProgram(provider);

        // ── Derive PDAs ──────────────────────────────────────────────────────
        const [mint] = deriveMint(wallet.publicKey, formData.symbol);
        const [tokenConfig] = deriveTokenConfig(mint);
        const [solVault] = deriveSolVault(mint);
        const [platformConfig] = derivePlatformConfig();

        // Creator ATA
        const creatorAta = await getAssociatedTokenAddress(mint, wallet.publicKey);

        // Metaplex metadata PDA
        const [metadataAccount] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('metadata'),
            TOKEN_METADATA_PROGRAM_ID.toBytes(),
            mint.toBytes(),
          ],
          TOKEN_METADATA_PROGRAM_ID
        );

        // ── Graduation threshold ─────────────────────────────────────────────
        // formData.graduationThreshold is a % (e.g. 80 = 80% of totalSupply)
        const supplyCap = new BN(formData.totalSupply * 1_000_000); // 6 decimals
        const gradPercent = formData.graduationThreshold;
        const graduationThreshold = supplyCap.muln(gradPercent).divn(100);

        // ── Build params ─────────────────────────────────────────────────────
        const curveParams = buildOnChainCurveParams(formData);
        const onChainCurveType = encodeCurveType(formData.curveType);

        const params = {
          name: formData.name,
          symbol: formData.symbol,
          uri: formData.imageIpfsUri,
          supplyCap,
          curveType: onChainCurveType,
          curveParams,
          graduationThreshold,
          creatorAllocation: formData.creatorAllocation,
        };

        // ── Send transaction ─────────────────────────────────────────────────
        setState('confirming');

        const txSignature = await (program.methods as any)
          .initializeToken(params)
          .accounts({
            creator: wallet.publicKey,
            mint,
            tokenConfig,
            solVault,
            creatorAta,
            metadataAccount,
            platformConfig,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc({ commitment: 'confirmed' });

        // ── Index in backend ─────────────────────────────────────────────────
        setState('indexing');

        const indexRes = await fetch(`${API_BASE_URL}/tokens`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mint: mint.toBase58(),
            txSignature,
            description: formData.description,
          }),
        });

        if (!indexRes.ok) {
          // Non-fatal: token is on-chain, just not indexed yet
          console.warn('[useInitializeToken] Backend indexing failed — retryable');
        }

        setState('success');

        return {
          success: true,
          mint: mint.toBase58(),
          txSignature,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        setState('error');
        throw err;
      }
    },
    [wallet, connection]
  );

  return { deployToken, state, error, reset };
}
