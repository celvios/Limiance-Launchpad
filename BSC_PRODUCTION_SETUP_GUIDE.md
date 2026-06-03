# Limiance BSC Production Setup Guide

## Architecture Decisions

- User-facing payments support BNB and USDT.
- BNB payments auto-convert to USDT through PancakeSwap before the bonding curve executes.
- Bonding-curve accounting, trade fees, graduation target, creation fee, and creator bonus are USDT-denominated.
- Graduation target is `100,000 USDT`.
- Creator receives a flat `100 USDT` bonus at graduation.
- Platform earns the token creation fee plus `3%` bonding-curve trade fees.
- Graduation converts net USDT to BNB, creates PancakeSwap BNB/TOKEN liquidity, and burns LP tokens.

## Required Accounts

- BSC deployer wallet with BNB for contract deployment.
- Safe multisig treasury wallet for platform fees and factory ownership.
- Pimlico dashboard account.
- Embedded wallet provider account, recommended: Privy.
- Pinata account for token image uploads.
- Render or equivalent backend host.
- Postgres database.
- BSC RPC provider account for production, recommended: QuickNode, Alchemy, Ankr, or BNB Chain RPC with fallback.

## BSC Contracts

Deploy in this order:

1. Create the Safe treasury.
2. Testnet USDT/mock USDT token if using BSC testnet.
3. Create or verify WBNB/mock-USDT router liquidity for testnet.
4. Deploy `LaunchpadFactory`.
5. Transfer factory ownership to the Safe treasury after testnet verification.
6. Configure frontend/backend envs with the deployed factory address.

Factory constructor inputs:

- `initialFeeRecipient`: platform treasury wallet.
- `initialPaymentAsset`: USDT/mock USDT token address.
- `initialRouter`: PancakeSwap router address for the selected chain.
- `initialWrappedNative`: WBNB address for the selected chain.

Default economics:

- `platformFeeBps = 300`
- `creationFee = 10 USDT`
- `creatorGraduationBonus = 100 USDT`
- `platformGraduationFee = 0 USDT`

## PancakeSwap Requirements

You need the correct router and WBNB addresses for each chain.

- BSC mainnet: use PancakeSwap production router and WBNB.
- BSC testnet: use PancakeSwap testnet router if available, otherwise deploy/use a test router.
- Testnet must have BNB/USDT liquidity; if using mock USDT, create a WBNB/mock-USDT pool with enough liquidity.

Production warning:

- Current automatic graduation uses router execution inside the final buy transaction.
- Before mainnet, add audited slippage controls for graduation swaps and liquidity adds.
- For larger targets, use keeper-triggered graduation or TWAP/slippage checks to reduce final-buy failure risk.

## Pimlico Setup

Create a Pimlico project for BSC testnet first.

Required Pimlico values:

- `PIMLICO_API_KEY`
- `PIMLICO_BUNDLER_URL`
- `PIMLICO_PAYMASTER_URL`
- `PIMLICO_SPONSORSHIP_POLICY_ID`, if your Pimlico policy requires one
- BSC chain ID enabled in dashboard.

How to get them:

1. Open the Pimlico Dashboard.
2. Create a new project for Limiance.
3. Select BSC testnet for beta.
4. Copy the API key into `PIMLICO_API_KEY` and `NEXT_PUBLIC_PIMLICO_API_KEY`.
5. Create a bundler endpoint for BSC testnet.
6. Copy the bundler endpoint into `PIMLICO_BUNDLER_URL` and `NEXT_PUBLIC_PIMLICO_BUNDLER_URL`.
7. Create a verifying/sponsored paymaster endpoint for the same chain.
8. Copy the paymaster endpoint into `PIMLICO_PAYMASTER_URL` and `NEXT_PUBLIC_PIMLICO_PAYMASTER_URL`.
9. If the dashboard gives you a sponsorship policy ID, copy it into `PIMLICO_SPONSORSHIP_POLICY_ID` and `NEXT_PUBLIC_PIMLICO_SPONSORSHIP_POLICY_ID`.
10. Add the deployed factory and sale contracts to the allowed contract list.
11. Add only the sponsored function allowlist below.
12. Set daily/global sponsorship caps before public testing.

Privy dashboard requirement:

- Enable smart wallets.
- Select the smart-wallet type you want Privy to provision.
- Add the BSC testnet network.
- Paste the Pimlico bundler URL and paymaster URL into that network configuration.
- Privy documentation says production apps should use their own bundler URL instead of the heavily rate-limited public Pimlico bundler.

Recommended sponsored function allowlist:

- `createToken`
- `buy(uint256,address,uint256)`
- `buyWithBNB(uint256,address,uint256,uint256)`
- `buyFromVault(address,address,uint256)`
- `buyFromNativeVault(address,address,uint256,uint256,uint256,uint256,uint256)`

Set sponsorship controls:

- Daily per-user gas cap.
- Daily global gas cap.
- Function allowlist only.
- Chain ID restriction.
- Factory/sale contract address restriction.
- Abuse checks before sponsoring backend-submitted transactions.

## Embedded Wallet Setup

Use Privy or another embedded EVM wallet provider.

Required values:

- `PRIVY_APP_ID`
- `PRIVY_APP_SECRET`
- Frontend `NEXT_PUBLIC_PRIVY_APP_ID`

How to get them:

1. Open the Privy Dashboard.
2. Create an app for Limiance.
3. Enable email login.
4. Enable embedded Ethereum/EVM wallets.
5. Configure automatic wallet creation for users without wallets.
6. Add your local, staging, and production domains.
7. Copy the app ID into `PRIVY_APP_ID` and `NEXT_PUBLIC_PRIVY_APP_ID`.
8. Copy the app secret into `PRIVY_APP_SECRET`.
9. Keep `PRIVY_APP_SECRET` backend-only. Never expose it as `NEXT_PUBLIC_*`.

Production rules:

- Email users must get real embedded EVM signers.
- Do not derive wallets from email addresses.
- Do not custody private keys in the backend.
- Link the embedded signer to a Pimlico-backed smart account address.
- Store both the embedded signer and smart account address in the user identity table.

Current implementation status:

- The app is fail-closed if Privy/Pimlico credentials are missing.
- The fake email-derived wallet fallback has been removed.
- Final production sign-in still requires live Privy credentials and end-to-end testing with the Pimlico-backed smart account flow.

## Treasury Setup

Use a Safe multisig as treasury and admin owner.

Recommended v1 setup:

- Safe network: BNB Smart Chain testnet for beta, BNB Smart Chain mainnet for production.
- Signers: at least `2-of-3`; use `3-of-5` once the team grows.
- Signer wallets: hardware wallets where possible.
- Treasury receives: creation fees, `3%` bonding-curve trade fees, optional platform graduation fees.
- Factory ownership: transfer to Safe after contract deployment and verification.

How to get the treasury address:

1. Open Safe.
2. Create a new Safe on the target BSC network.
3. Add signer addresses.
4. Choose threshold.
5. Finish creation.
6. Copy the Safe address.
7. Use it for `TREASURY_ADDRESS`.
8. Use it as the `initialFeeRecipient` constructor value.
9. After deployment, call `transferOwnership(SAFE_ADDRESS)` on `LaunchpadFactory`.

## Backend Env Vars

Set these in production:

```env
NODE_ENV=production
DATABASE_URL=
JWT_SECRET=
INDEXER_SECRET=
BSC_CHAIN_ID=56
BSC_RPC_URL=
FACTORY_ADDRESS=
TREASURY_ADDRESS=
USDT_ADDRESS=
PANCAKE_ROUTER_ADDRESS=
WBNB_ADDRESS=
SUPPORTED_PAYMENT_ASSETS=
INDEXER_START_BLOCK=
TOKEN_CREATION_FEE_USDT=10
WHALE_THRESHOLD_USDT=1000
PIMLICO_API_KEY=
PIMLICO_BUNDLER_URL=
PIMLICO_PAYMASTER_URL=
PIMLICO_SPONSORSHIP_POLICY_ID=
GAS_SPONSOR_DAILY_LIMIT_USDT=
PRIVY_APP_ID=
PRIVY_APP_SECRET=
PINATA_API_KEY=
PINATA_SECRET_API_KEY=
PINATA_GATEWAY=
```

For BSC testnet, use `BSC_CHAIN_ID=97` and the mock USDT address.

## Frontend Env Vars

Set these for the web app:

```env
NEXT_PUBLIC_BSC_CHAIN_ID=56
NEXT_PUBLIC_BSC_RPC_URL=
NEXT_PUBLIC_FACTORY_ADDRESS=
NEXT_PUBLIC_TREASURY_ADDRESS=
NEXT_PUBLIC_USDT_ADDRESS=
NEXT_PUBLIC_PANCAKE_ROUTER_ADDRESS=
NEXT_PUBLIC_WBNB_ADDRESS=
NEXT_PUBLIC_TOKEN_CREATION_FEE_USDT=10
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_PIMLICO_API_KEY=
NEXT_PUBLIC_PIMLICO_BUNDLER_URL=
NEXT_PUBLIC_PIMLICO_PAYMASTER_URL=
NEXT_PUBLIC_PIMLICO_SPONSORSHIP_POLICY_ID=
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_EMBEDDED_WALLET_PROVIDER=privy
```

## Private Key Placement

Use private keys only for deployment or tightly scoped operator tasks.

Local deployment:

1. Copy `contracts/DEPLOYMENT_ENV.example` to `contracts/.env`.
2. Put the testnet deployer key in `DEPLOYER_PRIVATE_KEY`.
3. Fund that wallet with BSC testnet BNB.
4. Deploy `MockUSDT`.
5. Deploy `LaunchpadFactory`.
6. Transfer factory ownership to the Safe treasury after verification.

Rules:

- Never put a private key in any `NEXT_PUBLIC_*` variable.
- Never put a private key in frontend env.
- Never commit `.env`; it is ignored by git.
- Do not use the Safe treasury signer private keys as hot deployer keys.
- Use a fresh testnet-only private key for testnet deployment.

## Values You Already Have

Put the Privy app ID in:

- `PRIVY_APP_ID`
- `NEXT_PUBLIC_PRIVY_APP_ID`

Put the Privy app secret only in:

- `PRIVY_APP_SECRET`

Put the Pimlico API key in:

- `PIMLICO_API_KEY`
- `NEXT_PUBLIC_PIMLICO_API_KEY`

Put the Pimlico bundler URL in:

- `PIMLICO_BUNDLER_URL`
- `NEXT_PUBLIC_PIMLICO_BUNDLER_URL`

Put the Pimlico paymaster URL in:

- `PIMLICO_PAYMASTER_URL`
- `NEXT_PUBLIC_PIMLICO_PAYMASTER_URL`

Put the Pimlico sponsorship policy ID, if used, in:

- `PIMLICO_SPONSORSHIP_POLICY_ID`
- `NEXT_PUBLIC_PIMLICO_SPONSORSHIP_POLICY_ID`

Do not paste secrets into tracked files. Use local `.env`, Render secret env vars, or your hosting provider's encrypted environment settings.

## Mock USDT Testnet Setup

Use `contracts/src/MockUSDT.sol` only for testnet.

After deployment:

1. Copy the deployed mock USDT address.
2. Set backend `USDT_ADDRESS` to that address.
3. Set frontend `NEXT_PUBLIC_USDT_ADDRESS` to that address.
4. Set `SUPPORTED_PAYMENT_ASSETS` to that address.
5. Create WBNB/mock-USDT liquidity on the configured Pancake/test router.
6. Use `faucet(10000 ether)` from test wallets to mint test USDT.

## Deposit Address Rules

- A generated address is a smart-contract vault.
- The same generated address can receive native BNB and BEP-20 USDT.
- USDT deposits can be swept directly into sale contracts for balance buys.
- BNB deposits can be swept into the sale contract and auto-converted to USDT during buy execution.
- Backend indexer must track native BNB transfers and USDT `Transfer` logs.
- Credit deposits idempotently using transaction hash plus log index.

## Testnet Plan

1. Deploy mock USDT on BSC testnet.
2. Create WBNB/mock-USDT liquidity on the configured router.
3. Deploy `LaunchpadFactory`.
4. Set backend and frontend envs.
5. Configure Pimlico bundler and paymaster sponsorship on BSC testnet.
6. Configure Privy embedded wallets.
7. Test external wallet buy with USDT.
8. Test external wallet buy with BNB.
9. Test generated vault deposit with USDT.
10. Test generated vault deposit with BNB.
11. Test balance buy from USDT vault credit.
12. Test balance buy from BNB vault credit.
13. Buy until `100,000 USDT` graduation target.
14. Confirm creator receives `100 USDT`.
15. Confirm LP tokens are burned.
16. Confirm token trades on PancakeSwap BNB/TOKEN pair.

## Mainnet Gates

- Solidity audit complete.
- Router, WBNB, USDT addresses verified.
- Slippage and MEV assumptions reviewed.
- Indexer replay tested.
- Pimlico daily caps configured.
- Admin pause runbook written.
- Graduation failure runbook written.
- Treasury and deployer wallets secured with multisig.
- Monitoring enabled for RPC failures, indexer lag, failed deposits, failed buys, and graduation failures.
