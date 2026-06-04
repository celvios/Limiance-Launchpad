export declare const BSC_CHAIN_ID: number;
export declare const BSC_RPC_URL: string;
export declare const FACTORY_ADDRESS: string;
export declare const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export declare const TREASURY_ADDRESS: string;
export declare const USDT_ADDRESS: string;
export declare const PAYMENT_ASSET: string;
export declare const PANCAKE_ROUTER_ADDRESS: string;
export declare const WBNB_ADDRESS: string;
export declare const GRADUATION_DEPLOYER_ADDRESS: string;
export declare const PIMLICO_API_KEY: string;
export declare const PIMLICO_BUNDLER_URL: string;
export declare const PIMLICO_PAYMASTER_URL: string;
export declare const PIMLICO_SPONSORSHIP_POLICY_ID: string;
export declare const TOKEN_CREATION_FEE_USDT: number;
export declare const GAS_SPONSOR_DAILY_LIMIT_USDT: bigint;
export declare function normalizeAddress(address: string): string;
export declare function isSupportedAsset(asset: string): boolean;
export declare function predictVaultAddress(userWallet: string, asset?: string): Promise<string>;
export declare function getCurrentBlockNumber(): Promise<bigint>;
export declare function pimlicoConfig(): {
    enabled: boolean;
    chainId: number;
    apiKeyConfigured: boolean;
    bundlerUrlConfigured: boolean;
    paymasterUrlConfigured: boolean;
    sponsorshipPolicyConfigured: boolean;
    bundlerUrl: string;
    paymasterUrl: string;
    sponsorshipPolicyId: string;
    sponsorship: {
        asset: string;
        dailyLimit: string;
        allowlistedFunctions: string[];
    };
};
//# sourceMappingURL=bsc.d.ts.map