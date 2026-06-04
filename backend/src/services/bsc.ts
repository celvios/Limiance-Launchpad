import { ethers } from 'ethers';

const DEFAULT_BSC_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.bnbchain.org:8545';

export const BSC_CHAIN_ID = Number(process.env.BSC_CHAIN_ID ?? '97');
export const BSC_RPC_URL = process.env.BSC_RPC_URL ?? DEFAULT_BSC_TESTNET_RPC;
export const FACTORY_ADDRESS =
  process.env.FACTORY_ADDRESS ?? '0x0000000000000000000000000000000000000000';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS ?? ZERO_ADDRESS;
export const USDT_ADDRESS =
  process.env.USDT_ADDRESS ?? process.env.BSC_USDT_ADDRESS ?? ZERO_ADDRESS;
export const PAYMENT_ASSET = USDT_ADDRESS;
export const PANCAKE_ROUTER_ADDRESS = process.env.PANCAKE_ROUTER_ADDRESS ?? ZERO_ADDRESS;
export const WBNB_ADDRESS = process.env.WBNB_ADDRESS ?? ZERO_ADDRESS;
export const GRADUATION_DEPLOYER_ADDRESS = process.env.GRADUATION_DEPLOYER_ADDRESS ?? ZERO_ADDRESS;
export const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY ?? '';
export const PIMLICO_BUNDLER_URL = process.env.PIMLICO_BUNDLER_URL ?? '';
export const PIMLICO_PAYMASTER_URL = process.env.PIMLICO_PAYMASTER_URL ?? '';
export const PIMLICO_SPONSORSHIP_POLICY_ID = process.env.PIMLICO_SPONSORSHIP_POLICY_ID ?? '';
export const TOKEN_CREATION_FEE_USDT = Number(process.env.TOKEN_CREATION_FEE_USDT ?? '10');
export const GAS_SPONSOR_DAILY_LIMIT_USDT = BigInt(process.env.GAS_SPONSOR_DAILY_LIMIT_USDT ?? '100000000');

// ABI interface for CentralTreasury vault prediction
const TREASURY_IFACE = new ethers.Interface([
  'function predictedDepositVault(address user, address asset) external view returns (address)',
]);

export function normalizeAddress(address: string): string {
  const trimmed = address.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    throw new Error('Invalid EVM address');
  }
  return trimmed.toLowerCase();
}

export function isSupportedAsset(asset: string): boolean {
  const normalized = normalizeAddress(asset);
  const configured = (process.env.SUPPORTED_PAYMENT_ASSETS ?? PAYMENT_ASSET)
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return configured.includes(normalized);
}

function encodeAddress(address: string): string {
  return normalizeAddress(address).replace(/^0x/, '').padStart(64, '0');
}

function pseudoVaultAddress(userWallet: string, asset: string): string {
  const normalized = normalizeAddress(userWallet);
  const seed = `${TREASURY_ADDRESS.toLowerCase()}:${BSC_CHAIN_ID}:${normalized}:${normalizeAddress(asset)}`;
  let hash = 0n;
  for (const char of seed) {
    hash = (hash * 31n + BigInt(char.charCodeAt(0))) & ((1n << 160n) - 1n);
  }
  return `0x${hash.toString(16).padStart(40, '0')}`;
}

export async function predictVaultAddress(userWallet: string, asset = PAYMENT_ASSET): Promise<string> {
  const user = normalizeAddress(userWallet);
  const paymentAsset = normalizeAddress(asset);
  // Use the CentralTreasury's predictedDepositVault view function
  if (TREASURY_ADDRESS === ZERO_ADDRESS || paymentAsset === ZERO_ADDRESS) {
    return pseudoVaultAddress(user, paymentAsset);
  }

  try {
    // Encode the call using ethers Interface for correct selector
    const callData = TREASURY_IFACE.encodeFunctionData('predictedDepositVault', [user, paymentAsset]);
    const res = await fetch(BSC_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: TREASURY_ADDRESS, data: callData }, 'latest'],
      }),
    });
    if (!res.ok) throw new Error(`BSC RPC error: ${res.status}`);
    const json = (await res.json()) as { result?: string; error?: { message?: string } };
    if (!json.result || json.result === '0x') {
      if (json.error?.message) console.warn('[bsc] predictVaultAddress RPC error:', json.error.message);
      return pseudoVaultAddress(user, paymentAsset);
    }
    // Decode the returned address
    const decoded = TREASURY_IFACE.decodeFunctionResult('predictedDepositVault', json.result);
    return decoded[0].toLowerCase();
  } catch (err) {
    console.warn('[bsc] predictVaultAddress failed, using pseudo:', err);
    return pseudoVaultAddress(user, paymentAsset);
  }
}

export async function getCurrentBlockNumber(): Promise<bigint> {
  const res = await fetch(BSC_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_blockNumber',
      params: [],
    }),
  });
  if (!res.ok) throw new Error(`BSC RPC error: ${res.status}`);
  const data = (await res.json()) as { result?: string };
  return BigInt(data.result ?? '0x0');
}

export function pimlicoConfig() {
  return {
    enabled: Boolean(PIMLICO_API_KEY && PIMLICO_BUNDLER_URL && PIMLICO_PAYMASTER_URL),
    chainId: BSC_CHAIN_ID,
    apiKeyConfigured: Boolean(PIMLICO_API_KEY),
    bundlerUrlConfigured: Boolean(PIMLICO_BUNDLER_URL),
    paymasterUrlConfigured: Boolean(PIMLICO_PAYMASTER_URL),
    sponsorshipPolicyConfigured: Boolean(PIMLICO_SPONSORSHIP_POLICY_ID),
    bundlerUrl: PIMLICO_BUNDLER_URL,
    paymasterUrl: PIMLICO_PAYMASTER_URL,
    sponsorshipPolicyId: PIMLICO_SPONSORSHIP_POLICY_ID,
    sponsorship: {
      asset: PAYMENT_ASSET,
      dailyLimit: GAS_SPONSOR_DAILY_LIMIT_USDT.toString(),
      allowlistedFunctions: [
        'createToken',
        'buy(uint256,address,uint256)',
        'buyWithBNB(uint256,address,uint256,uint256)',
        'buyFromVault(address,address,uint256)',
        'buyFromNativeVault(address,address,uint256,uint256,uint256,uint256,uint256)',
      ],
    },
  };
}
