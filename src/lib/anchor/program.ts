/**
 * Anchor program client for the launchpad program.
 * Generated from IDL — do not edit directly. Regenerate after `anchor build`.
 */
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import idl from './idl.json';

// Re-export the IDL type — used by Pixel's components for type inference.
export type { Idl } from '@coral-xyz/anchor';

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS'
);

// PDA seed constants — must stay in sync with the Anchor program.
export const SEEDS = {
  PLATFORM_CONFIG: Buffer.from('platform_config'),
  TOKEN_CONFIG: Buffer.from('token_config'),
  VAULT: Buffer.from('vault'),
  MINT: Buffer.from('mint'),
} as const;

/**
 * Get a signer-capable program instance (requires a connected wallet).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getProgram(provider: AnchorProvider): Program<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Program(idl as any, PROGRAM_ID, provider);
}

/**
 * Get a read-only program instance (no wallet required — for fetching state).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getProgramReadonly(connection: Connection): Program<any> {
  const provider = new AnchorProvider(
    connection,
    // Wallet stub — read-only, never signs
    {
      publicKey: PublicKey.default,
      signTransaction: async (tx) => tx,
      signAllTransactions: async (txs) => txs,
    },
    { commitment: 'confirmed' }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Program(idl as any, PROGRAM_ID, provider);
}

// ─────────────────────────────────────────────────────────────────────────────
// PDA derivation helpers
// ─────────────────────────────────────────────────────────────────────────────

export function derivePlatformConfig(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEEDS.PLATFORM_CONFIG], PROGRAM_ID);
}

export function deriveMint(creator: PublicKey, symbol: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.MINT, creator.toBytes(), Buffer.from(symbol)],
    PROGRAM_ID
  );
}

export function deriveTokenConfig(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.TOKEN_CONFIG, mint.toBytes()],
    PROGRAM_ID
  );
}

export function deriveSolVault(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.VAULT, mint.toBytes()],
    PROGRAM_ID
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// On-chain curve type encoding (Anchor enum variant format)
// ─────────────────────────────────────────────────────────────────────────────

export function encodeCurveType(type: 'linear' | 'exponential' | 'sigmoid') {
  switch (type) {
    case 'linear':      return { linear: {} };
    case 'exponential': return { exponential: {} };
    case 'sigmoid':     return { sigmoid: {} };
  }
}
