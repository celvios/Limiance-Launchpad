/**
 * Solana RPC client — reads on-chain TokenConfig accounts.
 * Uses Helius as primary, falls back to public RPC if needed.
 */
import { Connection, PublicKey } from '@solana/web3.js';
import { BorshAccountsCoder } from '@coral-xyz/anchor';
import idl from '../../idl.json';

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
const coder = new BorshAccountsCoder(idl as any);

/**
 * Derive the TokenConfig PDA for a given mint address.
 */
export function deriveTokenConfig(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [TOKEN_CONFIG_SEED, mint.toBytes()],
    PROGRAM_ID
  );
  return pda;
}

/**
 * Fetch and decode a TokenConfig account from the chain.
 * Returns null if the account does not exist.
 */
export async function fetchTokenConfig(mintAddress: string): Promise<TokenConfigAccount | null> {
  try {
    const mint = new PublicKey(mintAddress);
    const configPda = deriveTokenConfig(mint);
    const conn = getConnection();

    const accountInfo = await conn.getAccountInfo(configPda);
    if (!accountInfo) return null;

    const decoded = coder.decode('TokenConfig', accountInfo.data);
    return decoded as TokenConfigAccount;
  } catch {
    return null;
  }
}

export interface TokenConfigAccount {
  creator: PublicKey;
  mint: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  supplyCap: bigint;
  currentSupply: bigint;
  curveType: { linear?: {} } | { exponential?: {} } | { sigmoid?: {} };
  curveParams: {
    paramA: bigint;
    paramB: bigint;
    paramC: bigint;
    paramD: bigint;
    paramE: bigint;
  };
  graduationThreshold: bigint;
  solVault: PublicKey;
  status: { active?: {} } | { graduated?: {} } | { cancelled?: {} };
  creatorAllocation: number;
  createdAt: bigint;
  graduating: boolean;
  bump: number;
}

/**
 * Decode curve type enum from on-chain variant object.
 */
export function decodeCurveType(
  ct: TokenConfigAccount['curveType']
): 'linear' | 'exponential' | 'sigmoid' {
  if ('linear' in ct) return 'linear';
  if ('exponential' in ct) return 'exponential';
  return 'sigmoid';
}

/**
 * Decode status enum from on-chain variant object.
 */
export function decodeStatus(
  st: TokenConfigAccount['status']
): 'active' | 'graduated' | 'cancelled' {
  if ('active' in st) return 'active';
  if ('graduated' in st) return 'graduated';
  return 'cancelled';
}
