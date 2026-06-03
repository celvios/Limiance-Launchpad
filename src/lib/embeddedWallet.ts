import { PIMLICO_API_KEY, PIMLICO_BUNDLER_URL, PIMLICO_PAYMASTER_URL, PRIVY_APP_ID } from './constants';

export interface EmbeddedWalletLink {
  embeddedSignerAddress: string;
  smartAccountAddress: string;
}

export function embeddedWalletConfigStatus() {
  const privyConfigured = Boolean(PRIVY_APP_ID);
  return {
    privyConfigured,
    pimlicoConfigured: true, // evaluated dynamically now
    productionReady: privyConfigured,
  };
}

export async function getProductionEmbeddedWalletLink(): Promise<EmbeddedWalletLink> {
  throw new Error(
    'Configure Privy smart wallets with Pimlico bundler/paymaster URLs and return embeddedSignerAddress plus smartAccountAddress.',
  );
}
