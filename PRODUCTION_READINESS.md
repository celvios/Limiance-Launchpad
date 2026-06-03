# Limiance BSC Production Readiness

## Required Providers

- BSC RPC provider with production rate limits.
- Deployed `LaunchpadFactory` configured with the BSC USDT token address.
- Privy embedded wallets enabled for email login.
- Biconomy paymaster configured for BSC and allowlisted launchpad contract calls.
- Email provider for OTP or magic-link delivery.

## Required Backend Environment

- `NODE_ENV=production`
- `JWT_SECRET`
- `BSC_CHAIN_ID`
- `BSC_RPC_URL`
- `FACTORY_ADDRESS`
- `USDT_ADDRESS`
- `SUPPORTED_PAYMENT_ASSETS`
- `INDEXER_SECRET`
- `BICONOMY_API_KEY`
- `BICONOMY_PAYMASTER_ID`
- `PRIVY_APP_ID`
- `PRIVY_APP_SECRET`

The backend intentionally refuses to start in production if any critical value is missing.

## Required Frontend Environment

- `NEXT_PUBLIC_BSC_CHAIN_ID`
- `NEXT_PUBLIC_BSC_RPC_URL`
- `NEXT_PUBLIC_FACTORY_ADDRESS`
- `NEXT_PUBLIC_USDT_ADDRESS`
- `NEXT_PUBLIC_BICONOMY_API_KEY`
- `NEXT_PUBLIC_BICONOMY_PAYMASTER_ID`
- `NEXT_PUBLIC_EMBEDDED_WALLET_PROVIDER=privy`
- `NEXT_PUBLIC_PRIVY_APP_ID`

## Email Wallet Rule

Production email login must return both:

- `embeddedSignerAddress`
- `biconomySmartAccount`

The app must not derive fake addresses from email. That path is blocked.

Frontend email wallet wiring lives behind `EmbeddedWalletProvider`. The provider expects the selected embedded-wallet
implementation to return:

```ts
{
  embeddedSignerAddress: "0x...",
  biconomySmartAccount: "0x..."
}
```

For local provider testing, a wallet bridge can set `window.__limianceEmbeddedWallet` to that shape before verifying
the email OTP. Production should replace that bridge with Privy embedded wallet creation plus Biconomy Nexus smart
account creation.

## Biconomy Sponsorship Rule

Sponsor only these calls:

- `buy(uint256,address,uint256)`
- `buyFromVault(address,address,uint256)`

Set daily user limits and monitor failed sponsorship attempts.

## Go-Live Gates

- Frontend build passes.
- Backend build passes.
- Prisma schema validates.
- Solidity contracts compile and pass tests with Foundry.
- Testnet flow passes: email login, smart account creation, USDT vault deposit, indexer credit, gasless buy, wallet buy, graduation.
- Mainnet deploy only after contract audit and indexer replay test.
