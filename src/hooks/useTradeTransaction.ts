'use client';

/**
 * useTradeTransaction — buy and sell hooks for the bonding curve.
 *
 * useBuy(mint)  — calls the `buy` Anchor instruction.
 * useSell(mint) — calls the `sell` Anchor instruction.
 *
 * Both hooks:
 *  - Derive all PDAs from the mint address
 *  - Apply optimistic supply update via react-query
 *  - Invalidate token-detail and activity queries on settlement
 *  - Handle graduation trigger: if BuyEvent emits GraduationTriggered,
 *    the client must submit `graduate` as a follow-up instruction (TODO: compose tx)
 */

import { useCallback, useState } from 'react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { AnchorProvider, BN } from '@coral-xyz/anchor';
import { getProgram, deriveTokenConfig, deriveSolVault, derivePlatformConfig } from '@/lib/anchor/program';
import { useQueryClient } from '@tanstack/react-query';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

// Default slippage: 2% over/under quote
const DEFAULT_SLIPPAGE_BPS = 200;

function applySlippage(amount: bigint, bps: number, direction: 'up' | 'down'): bigint {
  if (direction === 'up') {
    return (amount * BigInt(10_000 + bps)) / 10_000n;
  }
  return (amount * BigInt(10_000 - bps)) / 10_000n;
}

// ─────────────────────────────────────────────────────────────────────────────
// useBuy
// ─────────────────────────────────────────────────────────────────────────────

export interface BuyParams {
  /** Token units to buy (base units, 6 decimals — e.g. 1 token = 1_000_000). */
  amount: bigint;
  /** Maximum lamports willing to pay including fee. If omitted, 2% slippage applied to quote. */
  maxSolCost?: bigint;
  /** Quote (cost in lamports) from math.ts — used to auto-derive maxSolCost. */
  quoteLamports?: bigint;
}

export interface TradeResult {
  txSignature: string;
}

export function useBuy(mint: string) {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const buy = useCallback(
    async (params: BuyParams): Promise<TradeResult> => {
      if (!wallet) throw new Error('Wallet not connected');
      setIsLoading(true);
      setError(null);

      try {
        const provider = new AnchorProvider(connection, wallet, {
          commitment: 'confirmed',
          preflightCommitment: 'confirmed',
        });
        const program = getProgram(provider);

        const mintPubkey = new PublicKey(mint);
        const [tokenConfig] = deriveTokenConfig(mintPubkey);
        const [solVault] = deriveSolVault(mintPubkey);
        const [platformConfig] = derivePlatformConfig();

        // Fetch platform fee vault from on-chain config
        const platformConfigAccount = await program.account.platformConfig.fetch(platformConfig);
        const feeVault = platformConfigAccount.feeVault as PublicKey;

        // Buyer ATA
        const buyerAta = getAssociatedTokenAddressSync(mintPubkey, wallet.publicKey);

        // Slippage: if no maxSolCost provided, apply 2% buffer to quoteLamports
        let maxSolCost: BN;
        if (params.maxSolCost !== undefined) {
          maxSolCost = new BN(params.maxSolCost.toString());
        } else if (params.quoteLamports !== undefined) {
          const capped = applySlippage(params.quoteLamports, DEFAULT_SLIPPAGE_BPS, 'up');
          maxSolCost = new BN(capped.toString());
        } else {
          // Fallback: 1 SOL cap — caller should always provide a quote
          maxSolCost = new BN(LAMPORTS_PER_SOL);
        }

        const amount = new BN(params.amount.toString());

        // Optimistic update: increment currentSupply immediately
        queryClient.setQueryData(['token-detail', mint], (old: Record<string, unknown> | undefined) => {
          if (!old) return old;
          const cur = BigInt(String(old.currentSupply ?? '0'));
          return { ...old, currentSupply: (cur + params.amount).toString() };
        });

        const txSignature = await (program.methods as any)
          .buy(amount, maxSolCost)
          .accounts({
            buyer: wallet.publicKey,
            tokenConfig,
            mint: mintPubkey,
            solVault,
            buyerAta,
            feeVault,
            platformConfig,
          })
          .rpc({ commitment: 'confirmed' });

        // Invalidate queries to pick up authoritative state from chain
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['token-detail', mint] }),
          queryClient.invalidateQueries({ queryKey: ['activity', mint] }),
          queryClient.invalidateQueries({ queryKey: ['token-price', mint] }),
        ]);

        return { txSignature };
      } catch (err) {
        // Roll back optimistic update on failure
        queryClient.invalidateQueries({ queryKey: ['token-detail', mint] });
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [wallet, connection, mint, queryClient]
  );

  return { buy, isLoading, error };
}

// ─────────────────────────────────────────────────────────────────────────────
// useSell
// ─────────────────────────────────────────────────────────────────────────────

export interface SellParams {
  /** Token units to sell (base units, 6 decimals). */
  amount: bigint;
  /** Minimum lamports to accept. If omitted, 2% slippage applied to quote. */
  minSolReturn?: bigint;
  /** Quote (return in lamports) from math.ts — used to auto-derive minSolReturn. */
  quoteLamports?: bigint;
}

export function useSell(mint: string) {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sell = useCallback(
    async (params: SellParams): Promise<TradeResult> => {
      if (!wallet) throw new Error('Wallet not connected');
      setIsLoading(true);
      setError(null);

      try {
        const provider = new AnchorProvider(connection, wallet, {
          commitment: 'confirmed',
          preflightCommitment: 'confirmed',
        });
        const program = getProgram(provider);

        const mintPubkey = new PublicKey(mint);
        const [tokenConfig] = deriveTokenConfig(mintPubkey);
        const [solVault] = deriveSolVault(mintPubkey);
        const [platformConfig] = derivePlatformConfig();

        // Seller ATA
        const sellerAta = getAssociatedTokenAddressSync(mintPubkey, wallet.publicKey);

        // Slippage: apply 2% haircut to quote
        let minSolReturn: BN;
        if (params.minSolReturn !== undefined) {
          minSolReturn = new BN(params.minSolReturn.toString());
        } else if (params.quoteLamports !== undefined) {
          const floored = applySlippage(params.quoteLamports, DEFAULT_SLIPPAGE_BPS, 'down');
          minSolReturn = new BN(floored.toString());
        } else {
          minSolReturn = new BN(0);
        }

        const amount = new BN(params.amount.toString());

        // Optimistic update: decrement currentSupply
        queryClient.setQueryData(['token-detail', mint], (old: Record<string, unknown> | undefined) => {
          if (!old) return old;
          const cur = BigInt(String(old.currentSupply ?? '0'));
          const next = cur > params.amount ? cur - params.amount : 0n;
          return { ...old, currentSupply: next.toString() };
        });

        const txSignature = await (program.methods as any)
          .sell(amount, minSolReturn)
          .accounts({
            seller: wallet.publicKey,
            tokenConfig,
            mint: mintPubkey,
            solVault,
            sellerAta,
            platformConfig,
          })
          .rpc({ commitment: 'confirmed' });

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['token-detail', mint] }),
          queryClient.invalidateQueries({ queryKey: ['activity', mint] }),
          queryClient.invalidateQueries({ queryKey: ['token-price', mint] }),
        ]);

        return { txSignature };
      } catch (err) {
        queryClient.invalidateQueries({ queryKey: ['token-detail', mint] });
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [wallet, connection, mint, queryClient]
  );

  return { sell, isLoading, error };
}
