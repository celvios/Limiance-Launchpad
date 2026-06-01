import { PIMLICO_API_KEY, PIMLICO_BUNDLER_URL, PIMLICO_PAYMASTER_URL, PRIVY_APP_ID } from './constants';

export interface EmbeddedWalletLink {
  embeddedSignerAddress: string;
  smartAccountAddress: string;
}

export function embeddedWalletConfigStatus() {
  const pimlicoConfigured = Boolean(PIMLICO_API_KEY && PIMLICO_BUNDLER_URL && PIMLICO_PAYMASTER_URL);
  return {
    privyConfigured: Boolean(PRIVY_APP_ID),
    pimlicoConfigured,
    productionReady: Boolean(PRIVY_APP_ID && pimlicoConfigured),
  };
}

export async function getProductionEmbeddedWalletLink(): Promise<EmbeddedWalletLink> {
  const status = embeddedWalletConfigStatus();
  if (!status.productionReady) {
    throw new Error('Privy and Pimlico environment keys are required before email wallet login can be used.');
  }

  throw new Error(
    'Configure Privy smart wallets with Pimlico bundler/paymaster URLs and return embeddedSignerAddress plus smartAccountAddress.',
  );
}
