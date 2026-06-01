import {
  BSC_CHAIN_ID,
  PAYMENT_ASSET,
  PIMLICO_API_KEY,
  PIMLICO_BUNDLER_URL,
  PIMLICO_PAYMASTER_URL,
  PIMLICO_SPONSORSHIP_POLICY_ID,
} from './constants';

export interface PimlicoGasPolicy {
  enabled: boolean;
  chainId: number;
  paymentAsset: string;
  mode: 'sponsored' | 'disabled';
  bundlerUrlConfigured: boolean;
  paymasterUrlConfigured: boolean;
  sponsorshipPolicyConfigured: boolean;
  allowlistedFunctions: string[];
}

export function getPimlicoGasPolicy(): PimlicoGasPolicy {
  const enabled = Boolean(PIMLICO_API_KEY && PIMLICO_BUNDLER_URL && PIMLICO_PAYMASTER_URL);
  return {
    enabled,
    chainId: BSC_CHAIN_ID,
    paymentAsset: PAYMENT_ASSET,
    mode: enabled ? 'sponsored' : 'disabled',
    bundlerUrlConfigured: Boolean(PIMLICO_BUNDLER_URL),
    paymasterUrlConfigured: Boolean(PIMLICO_PAYMASTER_URL),
    sponsorshipPolicyConfigured: Boolean(PIMLICO_SPONSORSHIP_POLICY_ID),
    allowlistedFunctions: [
      'createToken',
      'buy(uint256,address,uint256)',
      'buyWithBNB(uint256,address,uint256,uint256)',
      'buyFromVault(address,address,uint256)',
      'buyFromNativeVault(address,address,uint256,uint256,uint256,uint256,uint256)',
    ],
  };
}

export function pimlicoStatusLabel(): string {
  return getPimlicoGasPolicy().enabled
    ? 'Gas sponsored by Pimlico'
    : 'Pimlico sponsorship not configured';
}
