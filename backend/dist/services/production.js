"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertProductionConfig = assertProductionConfig;
const bsc_1 = require("./bsc");
function assertProductionConfig() {
    if (process.env.NODE_ENV !== 'production')
        return;
    const missing = [];
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-in-production')
        missing.push('JWT_SECRET');
    if (!process.env.INDEXER_SECRET)
        missing.push('INDEXER_SECRET');
    if (!process.env.PRIVY_APP_ID)
        missing.push('PRIVY_APP_ID');
    if (!process.env.PRIVY_APP_SECRET)
        missing.push('PRIVY_APP_SECRET');
    if (!bsc_1.PIMLICO_API_KEY)
        missing.push('PIMLICO_API_KEY');
    if (!bsc_1.PIMLICO_BUNDLER_URL)
        missing.push('PIMLICO_BUNDLER_URL');
    if (!bsc_1.PIMLICO_PAYMASTER_URL)
        missing.push('PIMLICO_PAYMASTER_URL');
    if (bsc_1.FACTORY_ADDRESS === bsc_1.ZERO_ADDRESS)
        missing.push('FACTORY_ADDRESS');
    if (bsc_1.TREASURY_ADDRESS === bsc_1.ZERO_ADDRESS)
        missing.push('TREASURY_ADDRESS');
    if (bsc_1.PAYMENT_ASSET === bsc_1.ZERO_ADDRESS)
        missing.push('USDT_ADDRESS');
    if (bsc_1.PANCAKE_ROUTER_ADDRESS === bsc_1.ZERO_ADDRESS)
        missing.push('PANCAKE_ROUTER_ADDRESS');
    if (bsc_1.WBNB_ADDRESS === bsc_1.ZERO_ADDRESS)
        missing.push('WBNB_ADDRESS');
    if (missing.length > 0) {
        throw new Error(`Production config missing: ${missing.join(', ')}`);
    }
}
//# sourceMappingURL=production.js.map