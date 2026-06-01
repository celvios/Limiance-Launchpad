import {
  FACTORY_ADDRESS,
  PAYMENT_ASSET,
  ZERO_ADDRESS,
  TREASURY_ADDRESS,
  PIMLICO_API_KEY,
  PIMLICO_BUNDLER_URL,
  PIMLICO_PAYMASTER_URL,
  PANCAKE_ROUTER_ADDRESS,
  WBNB_ADDRESS,
} from './bsc';

export function assertProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;

  const missing: string[] = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-in-production') missing.push('JWT_SECRET');
  if (!process.env.INDEXER_SECRET) missing.push('INDEXER_SECRET');
  if (!process.env.PRIVY_APP_ID) missing.push('PRIVY_APP_ID');
  if (!process.env.PRIVY_APP_SECRET) missing.push('PRIVY_APP_SECRET');
  if (!PIMLICO_API_KEY) missing.push('PIMLICO_API_KEY');
  if (!PIMLICO_BUNDLER_URL) missing.push('PIMLICO_BUNDLER_URL');
  if (!PIMLICO_PAYMASTER_URL) missing.push('PIMLICO_PAYMASTER_URL');
  if (FACTORY_ADDRESS === ZERO_ADDRESS) missing.push('FACTORY_ADDRESS');
  if (TREASURY_ADDRESS === ZERO_ADDRESS) missing.push('TREASURY_ADDRESS');
  if (PAYMENT_ASSET === ZERO_ADDRESS) missing.push('USDT_ADDRESS');
  if (PANCAKE_ROUTER_ADDRESS === ZERO_ADDRESS) missing.push('PANCAKE_ROUTER_ADDRESS');
  if (WBNB_ADDRESS === ZERO_ADDRESS) missing.push('WBNB_ADDRESS');

  if (missing.length > 0) {
    throw new Error(`Production config missing: ${missing.join(', ')}`);
  }
}
