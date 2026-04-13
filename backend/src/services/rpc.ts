/**
 * Solana RPC client — reads on-chain TokenConfig accounts.
 *
 * BorshAccountsCoder is initialised lazily (inside fetchTokenConfig) so a
 * stale/placeholder IDL never crashes the server on startup.
 */
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = process.env.RPC_URL_DEVNET ?? process.env.RPC_URL ?? 'https://api.devnet.solana.com';

let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(RPC_URL, 'confirmed');
  }
  return _connection;
}

const PROGRAM_ID = new PublicKey(
  process.env.PROGRAM_ID ?? 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS'
);

const TOKEN_CONFIG_SEED = Buffer.from('token_config');

export function deriveTokenConfig(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [TOKEN_CONFIG_SEED, mint.toBytes()],
    PROGRAM_ID
  );
  return pda;
}

export interface TokenConfigAccount {
  creator: PublicKey;
  mint: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  supplyCap: bigint;
  currentSupply: bigint;
  curveType: { linear?: object } | { exponential?: object } | { sigmoid?: object };
  curveParams: {
    paramA: bigint;
    paramB: bigint;
    paramC: bigint;
    paramD: bigint;
    paramE: bigint;
  };
  graduationThreshold: bigint;
  solVault: PublicKey;
  status: { active?: object } | { graduated?: object } | { cancelled?: object };
  creatorAllocation: number;
  createdAt: bigint;
  graduating: boolean;
  bump: number;
}

/**
 * Fetch and decode a TokenConfig account from the chain.
 * Returns null if the account does not exist or the IDL is not yet finalised.
 *
 * Uses BorshAccountsCoder lazily — the coder is only built when this function
 * is called, so a placeholder IDL never blocks server startup.
 */
export async function fetchTokenConfig(mintAddress: string): Promise<TokenConfigAccount | null> {
  try {
    const mint = new PublicKey(mintAddress);
    const configPda = deriveTokenConfig(mint);
    const conn = getConnection();

    const accountInfo = await conn.getAccountInfo(configPda);
    if (!accountInfo) return null;

    // Lazy import — avoids top-level crash when IDL is a placeholder
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BorshAccountsCoder } = require('@coral-xyz/anchor');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const idl = require('../../idl.json');

    const coder = new BorshAccountsCoder(idl);
    const decoded = coder.decode('TokenConfig', accountInfo.data);
    return decoded as TokenConfigAccount;
  } catch (err) {
    console.error('[rpc] fetchTokenConfig error:', (err as Error).message);
    return null;
  }
}

export function decodeCurveType(
  ct: TokenConfigAccount['curveType']
): 'linear' | 'exponential' | 'sigmoid' {
  if ('linear' in ct) return 'linear';
  if ('exponential' in ct) return 'exponential';
  return 'sigmoid';
}

export function decodeStatus(
  st: TokenConfigAccount['status']
): 'active' | 'graduated' | 'cancelled' {
  if ('active' in st) return 'active';
  if ('graduated' in st) return 'graduated';
  return 'cancelled';
}
