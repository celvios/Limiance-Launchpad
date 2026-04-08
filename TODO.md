# Launchpad — Build TODO

> **Rule for Forge (Claude):** At the end of every session, update this file.
> Mark completed items ✅. Add new items discovered during the session.
> Never delete items — cross them out with ~~strikethrough~~ if they were dropped/replaced.
> Keep items grouped by phase. Keep the "Environment" section current.

---

## Environment Setup

| Task | Status | Notes |
|---|---|---|
| Start Docker Desktop | ⬜ Pending | Required before running postgres/redis |
| Run postgres container | ⬜ Pending | `docker run --name launchpad-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=launchpad -p 5432:5432 -d postgres` |
| Run redis container | ⬜ Pending | `docker run --name launchpad-redis -p 6379:6379 -d redis` |
| Install Anchor via `avm` | ⬜ Pending | `cargo install --git https://github.com/coral-xyz/anchor avm --locked --force` then `avm install 0.30.0 && avm use 0.30.0` — takes 10–20 min |
| Get Helius API key | ⬜ Pending | Free at helius.dev — needed for RPC_URL and devnet deploy |
| `cd backend && npm install` | ⬜ Pending | Installs Fastify, Prisma, ws, etc. |
| `cp backend/.env.example backend/.env` + fill keys | ⬜ Pending | DATABASE_URL, REDIS_URL, RPC_URL_DEVNET, PINATA keys |
| `npx prisma migrate dev --name init` | ⬜ Pending | Creates all DB tables |
| `npm run dev` in backend | ⬜ Pending | API live on localhost:4000 |
| `anchor build` in program/ | ⬜ Pending | Requires Anchor CLI — compiles Rust program |
| `anchor deploy --provider.cluster devnet` | ⬜ Pending | Requires funded devnet wallet (`solana airdrop 2`) |
| Copy real PROGRAM_ID into `backend/.env` and `launchpad-frontend/.env.local` | ⬜ Pending | After anchor deploy outputs the address |
| `cp launchpad-frontend/.env.local.example launchpad-frontend/.env.local` + fill | ⬜ Pending | NEXT_PUBLIC_RPC_URL, NEXT_PUBLIC_PROGRAM_ID |
| Set `NEXT_PUBLIC_USE_MOCK_DATA=false` in frontend .env.local | ⬜ Pending | Switches frontend from mock data to real API |

---

## Phase 1 — Anchor Scaffold + Curve Math ✅ COMPLETE

- ✅ `program/Cargo.toml` + `Anchor.toml` workspace
- ✅ `program/programs/launchpad/src/errors.rs` — 17 custom errors
- ✅ `state/platform_config.rs` — PlatformConfig PDA
- ✅ `state/token_config.rs` — TokenConfig PDA, CurveType, CurveParams, TokenStatus
- ✅ `curve/linear.rs` — closed-form buy/sell, unit tests
- ✅ `curve/exponential.rs` — Simpson's rule, unit tests
- ✅ `curve/sigmoid.rs` — 7-segment piecewise linear, monotonic tests
- ✅ `curve/mod.rs` — dispatch layer + param validation
- ✅ `launchpad-frontend/src/lib/curve/math.ts` — BigInt port, existing signatures preserved
- ✅ `launchpad-frontend/src/lib/anchor/idl.json` — full IDL (placeholder program ID)
- ✅ `launchpad-frontend/src/lib/anchor/program.ts` — getProgram, PDA helpers

**Pixel unblocks:** Create Wizard Step 2 (live curve preview), Trade Panel price estimation.

---

## Phase 2 — initialize_platform + initialize_token ✅ COMPLETE

- ✅ `instructions/initialize_platform.rs`
- ✅ `instructions/initialize_token.rs` — Metaplex CPI, creator allocation mint, TokenCreated event
- ✅ `instructions/mod.rs` + `lib.rs` wired
- ✅ `backend/prisma/schema.prisma` — Token, Trade, Comment, Profile, Follow, Watchlist
- ✅ `backend/src/index.ts` — Fastify server with CORS, rate limit, multipart
- ✅ `backend/src/routes/tokens.ts` — POST /api/tokens, GET /api/tokens, GET /api/tokens/:mint
- ✅ `backend/src/routes/upload.ts` — POST /api/upload Pinata proxy
- ✅ `backend/src/services/prisma.ts`, `rpc.ts`, `redis.ts`, `price.ts`
- ✅ `launchpad-frontend/src/hooks/useInitializeToken.ts` — deploy hook wired to Anchor + backend index
- ✅ `launchpad-frontend/.env.local.example`

**Pixel unblocks:** Create Wizard deploy flow end-to-end, token feed from real DB.

**Still needed after environment is ready:**
- ⬜ Run `anchor build` to generate real IDL → copy to `launchpad-frontend/src/lib/anchor/idl.json`
- ⬜ Run devnet deploy → update PROGRAM_ID everywhere
- ⬜ Run `prisma migrate dev` → DB tables created
- ⬜ End-to-end test: deploy a token on devnet, verify it appears in `/api/tokens`

---

## Phase 3 — Buy & Sell Instructions ✅ CODE COMPLETE

**Depends on:** Phase 2 environment running, Anchor CLI installed.

### 3.1 Anchor Instructions
- ✅ `instructions/buy.rs` — curve cost, slippage check, fee split, mint tokens, update supply, BuyEvent, graduation trigger
- ✅ `instructions/sell.rs` — burn tokens, vault PDA signs SOL transfer, 95% return, SellEvent
- ✅ Wired buy/sell in `lib.rs` and `instructions/mod.rs`

### 3.2 Tests
- ⬜ `program/tests/buy_sell.ts` — buy increases supply, sell decreases, slippage rejection, supply cap, can't trade graduated token

### 3.3 Backend
- ✅ `backend/src/ws/server.ts` — WebSocket server on WS_PORT (4001)
- ✅ `backend/src/routes/webhook.ts` — POST /webhook/helius, HMAC verify, parse BuyEvent/SellEvent/GraduationEvent, write trades, broadcast WS
- ✅ `backend/src/routes/activity.ts` — GET /api/tokens/:mint/activity (cursor paginated, enriched with wallet handles)
- ✅ `backend/src/routes/chart.ts` — GET /api/tokens/:mint/chart?range=1h|4h|1d|all (OHLCV buckets)
- ✅ Registered webhook + activity + chart routes in `index.ts`
- ⬜ Configure Helius webhook in dashboard (point to backend URL + set secret)
- ⬜ Install `ws` package: `npm install ws && npm install -D @types/ws` in backend/

### 3.4 Frontend Hooks
- ✅ `hooks/useTradeTransaction.ts` — `useBuy(mint)` and `useSell(mint)` calling Anchor instructions, optimistic updates
- ✅ `hooks/useTradeTicker.ts` — already implemented with real WebSocket + mock fallback
- ✅ `hooks/useTokenActivity.ts` — `useInfiniteQuery` on `/api/tokens/:mint/activity`
- ⬜ Verify `hooks/useTokenPrice.ts` works with real data (already polls fetchTokenDetail)
- ⬜ Install `@solana/spl-token` if not present: check package.json in frontend

**Phase 3 completion gate:** Trade Panel buy/sell works end-to-end on devnet. Live ticker fires on trades.

---

## Phase 4 — Graduation (Raydium CPMM CPI) ✅ CODE COMPLETE (Raydium CPI pending)

**This is the most security-critical phase. Double every check.**

**Depends on:** Phase 3 complete and tested on devnet.

- ✅ Raydium CPMM CPI dependency commented into `Cargo.toml` (uncomment when ready for mainnet)
- ✅ `instructions/graduate.rs` — full graduation sequence:
  - ✅ Mint remaining tokens to program-owned ATA
  - ✅ Collect graduation fee (0.5% of vault SOL) → platform fee_vault
  - ✅ Raydium CPMM CPI stub (uses remaining_accounts — skips pool creation in test mode)
  - ✅ Burn all remaining tokens from program ATA
  - ✅ Close program ATA (reclaim rent)
  - ✅ Revoke mint authority → None (permanent)
  - ✅ Set `token_config.status = Graduated`, `graduating = false`
  - ✅ Emit `GraduationEvent` with Raydium pool ID
- ✅ `instructions/cancel_token.rs` — creator cancel before any external trades, refund rent + vault
- ✅ `instructions/withdraw_fees.rs` — platform authority withdraws fee_vault SOL
- ✅ All new instructions wired in `lib.rs` and `instructions/mod.rs`
- ⬜ Graduation integration test — token hits threshold mid-buy, graduation sequence fires
- ⬜ Full Raydium CPMM CPI integration — uncomment dependency, implement pool creation, LP burn (needs devnet Raydium program ID confirmation)
- ✅ Backend: `TokenGraduated` event handled in `webhook.ts` — updates `token.status`, stores `raydiumPoolId`
- ✅ Backend: `GET /api/tokens/:mint` already returns `raydiumPoolId` (field exists in schema)
- ✅ Frontend: `useGraduationHandler.ts` — already fully implemented, watches WS graduation events

**Phase 4 completion gate:** A token that hits graduation threshold automatically creates a Raydium pool with burned LP on devnet.

**Remaining for full Phase 4 production readiness:**
- ⬜ Confirm Raydium CPMM devnet program ID
- ⬜ Uncomment `raydium-cpmm-cpi` in Cargo.toml and wire full CPI in `graduate.rs` remaining_accounts path
- ⬜ Test graduation on devnet: verify LP tokens burned, mint authority null, pool live

---

## Phase 5 — Social Layer ⬜ NOT STARTED

**Depends on:** Phase 3 complete (trades exist to make social layer meaningful).

- ⬜ `backend/src/routes/comments.ts` — POST /api/tokens/:mint/comments (wallet-signed), GET (sorted by new/top)
- ⬜ `backend/src/routes/profiles.ts` — GET/PUT /api/profiles/:wallet, follow/unfollow
- ⬜ Wallet signature verification middleware (`tweetnacl` verify)
- ⬜ `hooks/useComments.ts` — real API replacing mock
- ⬜ `hooks/useProfile.ts` — real API replacing mock
- ⬜ `hooks/useOnboarding.ts` — real API for profile creation

---

## Known Issues / Risks

| Issue | Severity | Notes |
|---|---|---|
| Anchor CLI not installed on Windows | 🔴 Blocker | Use `cargo install avm`, then `avm install 0.30.0` |
| Docker Desktop stopped | 🔴 Blocker | Must be running for postgres + redis |
| IDL in frontend is placeholder | 🟡 Needed | Replace after `anchor build` — types will match then |
| Sigmoid s0 validation requires supply_cap | 🟡 Minor | validate_curve_params already handles this |
| Backend price.ts sigmoid approximation is simplified | 🟡 Minor | Full sigmoid in math.ts; backend uses linear approx around midpoint |
| Raydium CPMM devnet program ID must be confirmed | 🟡 Phase 4 | Check Raydium docs for current devnet address |
| `ws` npm package missing from backend | 🟡 Phase 3 | Run `npm install ws && npm install -D @types/ws` in backend/ |
| `@solana/spl-token` may be missing from frontend | 🟡 Phase 3 | Run `npm install @solana/spl-token` in launchpad-frontend/ if missing |
| Graduate ix uses remaining_accounts for Raydium pool | 🟡 Phase 4 | Client must pass Raydium accounts positionally; stub mode skips pool creation |
| fee_vault in withdraw_fees is a system account (not PDA) | 🟡 Phase 4 | If fee_vault is a PDA, add seeds to WithdrawFees Accounts struct |
