"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GAS_SPONSOR_DAILY_LIMIT_USDT = exports.TOKEN_CREATION_FEE_USDT = exports.PIMLICO_SPONSORSHIP_POLICY_ID = exports.PIMLICO_PAYMASTER_URL = exports.PIMLICO_BUNDLER_URL = exports.PIMLICO_API_KEY = exports.WBNB_ADDRESS = exports.PANCAKE_ROUTER_ADDRESS = exports.PAYMENT_ASSET = exports.USDT_ADDRESS = exports.TREASURY_ADDRESS = exports.ZERO_ADDRESS = exports.FACTORY_ADDRESS = exports.BSC_RPC_URL = exports.BSC_CHAIN_ID = void 0;
exports.normalizeAddress = normalizeAddress;
exports.isSupportedAsset = isSupportedAsset;
exports.predictVaultAddress = predictVaultAddress;
exports.getCurrentBlockNumber = getCurrentBlockNumber;
exports.pimlicoConfig = pimlicoConfig;
const DEFAULT_BSC_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.bnbchain.org:8545';
exports.BSC_CHAIN_ID = Number(process.env.BSC_CHAIN_ID ?? '97');
exports.BSC_RPC_URL = process.env.BSC_RPC_URL ?? DEFAULT_BSC_TESTNET_RPC;
exports.FACTORY_ADDRESS = process.env.FACTORY_ADDRESS ?? '0x0000000000000000000000000000000000000000';
exports.ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
exports.TREASURY_ADDRESS = process.env.TREASURY_ADDRESS ?? exports.ZERO_ADDRESS;
exports.USDT_ADDRESS = process.env.USDT_ADDRESS ?? process.env.BSC_USDT_ADDRESS ?? exports.ZERO_ADDRESS;
exports.PAYMENT_ASSET = exports.USDT_ADDRESS;
exports.PANCAKE_ROUTER_ADDRESS = process.env.PANCAKE_ROUTER_ADDRESS ?? exports.ZERO_ADDRESS;
exports.WBNB_ADDRESS = process.env.WBNB_ADDRESS ?? exports.ZERO_ADDRESS;
exports.PIMLICO_API_KEY = process.env.PIMLICO_API_KEY ?? '';
exports.PIMLICO_BUNDLER_URL = process.env.PIMLICO_BUNDLER_URL ?? '';
exports.PIMLICO_PAYMASTER_URL = process.env.PIMLICO_PAYMASTER_URL ?? '';
exports.PIMLICO_SPONSORSHIP_POLICY_ID = process.env.PIMLICO_SPONSORSHIP_POLICY_ID ?? '';
exports.TOKEN_CREATION_FEE_USDT = process.env.TOKEN_CREATION_FEE_USDT ?? '10';
exports.GAS_SPONSOR_DAILY_LIMIT_USDT = BigInt(process.env.GAS_SPONSOR_DAILY_LIMIT_USDT ?? '100000000');
const PREDICTED_VAULT_SELECTOR = '0x3cb7ed9f'; // predictedDepositVault(address,address)
function normalizeAddress(address) {
    const trimmed = address.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
        throw new Error('Invalid EVM address');
    }
    return trimmed.toLowerCase();
}
function isSupportedAsset(asset) {
    const normalized = normalizeAddress(asset);
    const configured = (process.env.SUPPORTED_PAYMENT_ASSETS ?? exports.PAYMENT_ASSET)
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
    return configured.includes(normalized);
}
function encodeAddress(address) {
    return normalizeAddress(address).replace(/^0x/, '').padStart(64, '0');
}
function pseudoVaultAddress(userWallet, asset) {
    const normalized = normalizeAddress(userWallet);
    const seed = `${exports.FACTORY_ADDRESS.toLowerCase()}:${exports.BSC_CHAIN_ID}:${normalized}:${normalizeAddress(asset)}`;
    let hash = 0n;
    for (const char of seed) {
        hash = (hash * 31n + BigInt(char.charCodeAt(0))) & ((1n << 160n) - 1n);
    }
    return `0x${hash.toString(16).padStart(40, '0')}`;
}
async function predictVaultAddress(userWallet, asset = exports.PAYMENT_ASSET) {
    const user = normalizeAddress(userWallet);
    const paymentAsset = normalizeAddress(asset);
    if (exports.FACTORY_ADDRESS === exports.ZERO_ADDRESS || paymentAsset === exports.ZERO_ADDRESS) {
        return pseudoVaultAddress(user, paymentAsset);
    }
    const data = `${PREDICTED_VAULT_SELECTOR}${encodeAddress(user)}${encodeAddress(paymentAsset)}`;
    const res = await fetch(exports.BSC_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [{ to: exports.FACTORY_ADDRESS, data }, 'latest'],
        }),
    });
    if (!res.ok)
        throw new Error(`BSC RPC error: ${res.status}`);
    const json = (await res.json());
    if (!json.result || json.result === '0x') {
        if (json.error?.message)
            throw new Error(json.error.message);
        return pseudoVaultAddress(user, paymentAsset);
    }
    return `0x${json.result.slice(-40)}`.toLowerCase();
}
async function getCurrentBlockNumber() {
    const res = await fetch(exports.BSC_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_blockNumber',
            params: [],
        }),
    });
    if (!res.ok)
        throw new Error(`BSC RPC error: ${res.status}`);
    const data = (await res.json());
    return BigInt(data.result ?? '0x0');
}
function pimlicoConfig() {
    return {
        enabled: Boolean(exports.PIMLICO_API_KEY && exports.PIMLICO_BUNDLER_URL && exports.PIMLICO_PAYMASTER_URL),
        chainId: exports.BSC_CHAIN_ID,
        apiKeyConfigured: Boolean(exports.PIMLICO_API_KEY),
        bundlerUrlConfigured: Boolean(exports.PIMLICO_BUNDLER_URL),
        paymasterUrlConfigured: Boolean(exports.PIMLICO_PAYMASTER_URL),
        sponsorshipPolicyConfigured: Boolean(exports.PIMLICO_SPONSORSHIP_POLICY_ID),
        bundlerUrl: exports.PIMLICO_BUNDLER_URL,
        paymasterUrl: exports.PIMLICO_PAYMASTER_URL,
        sponsorshipPolicyId: exports.PIMLICO_SPONSORSHIP_POLICY_ID,
        sponsorship: {
            asset: exports.PAYMENT_ASSET,
            dailyLimit: exports.GAS_SPONSOR_DAILY_LIMIT_USDT.toString(),
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
//# sourceMappingURL=bsc.js.map