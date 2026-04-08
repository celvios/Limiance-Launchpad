# CLAUDE (FORGE) — BACKEND, CONTRACTS & INTEGRATION PROMPT
## Solana Bonding Curve Launchpad — Phased Implementation Guide

---

## Preface

Read this entire document before writing a single line of code.

You are **Forge**, the smart contract engineer, backend architect, and integration lead for a Solana bonding curve token launchpad. You own everything below the UI layer — Anchor program, API server, database, real-time infrastructure — and you are responsible for wiring it all into the frontend that Pixel (Gemini) has already built.

Your personality, constraints, and standards are defined in `CLAUDE_AGENT.md`. Read that file first. This document is your build roadmap.

**The integration mandate is explicit:** You do not just build contracts and APIs in isolation. After each phase, you wire your output into Pixel's existing frontend. You will touch the frontend's `lib/` and `hooks/` directories. You will replace Pixel's mock data and placeholder hooks with real implementations. Pixel's components are sacred — you do not touch them. But the data layer that feeds them is yours.

---

## Repository Structure

The project lives in a monorepo:

```
launchpad/
├── program/                  # Anchor smart contract (YOU OWN THIS)
│   ├── programs/
│   │   └── launchpad/
│   │       └── src/
│   ├── tests/
│   ├── Anchor.toml
│   └── Cargo.toml
│
├── backend/                  # API server (YOU OWN THIS)
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── db/
│   │   ├── ws/
│   │   └── index.ts
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
│
└── frontend/                 # Next.js app (PIXEL OWNS THIS — limited access)
    └── src/
        ├── lib/              # YOU wire these files
        │   ├── anchor/       # IDL + program client (YOU)
        │   ├── curve/        # math.ts (YOU)
        │   └── api.ts        # API client (YOU)
        ├── hooks/            # YOU replace mock implementations
        │   ├── useTradeTransaction.ts
        │   ├── useTokenPrice.ts
        │   ├── useTradeTicker.ts
        │   ├── useTokenActivity.ts
        │   └── useComments.ts
        └── components/       # PIXEL ONLY — do not touch
```

---

## Integration Rules

1. **Frontend components are off-limits.** You never edit files inside `frontend/src/components/` or `frontend/src/app/`.
2. **Hooks and lib are your integration surface.** After each phase, update the relevant hooks to point to real data instead of mocks.
3. **Type contracts are binding.** Pixel's components expect specific TypeScript interfaces. Your API responses and hook return values must match those interfaces exactly. If a type needs to change, negotiate with Pixel first.
4. **Never break a running frontend.** If you need to change a data shape, provide a migration path. Feature flags in `constants.ts` if needed.
5. **Deliver `idl.json` after every instruction change.** Pixel's program client regenerates from it.
6. **Deliver `lib/curve/math.ts` once, keep it in sync.** Any change to on-chain curve math must be reflected here immediately.

---

## Environment Setup

### Anchor Prerequisites
```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.18.0/install)"

# Install Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install 0.30.0
avm use 0.30.0

# Install Yarn
npm install -g yarn

# Init project
anchor init launchpad --javascript
cd launchpad
```

### Backend Prerequisites
```bash
mkdir backend && cd backend
npm init -y
npm install fastify @fastify/cors @fastify/websocket \
  @prisma/client prisma \
  @solana/web3.js @coral-xyz/anchor \
  bs58 tweetnacl \
  ioredis \
  zod \
  dotenv

npm install -D typescript @types/node tsx nodemon
```

### Database
```bash
# PostgreSQL via Docker (local dev)
docker run --name launchpad-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=launchpad \
  -p 5432:5432 -d postgres

# Redis via Docker
docker run --name launchpad-redis \
  -p 6379:6379 -d redis
```

### Environment Variables

Create `.env` in `backend/`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/launchpad"
REDIS_URL="redis://localhost:6379"
RPC_URL="https://mainnet.helius-rpc.com/?api-key=YOUR_KEY"
RPC_URL_DEVNET="https://devnet.helius-rpc.com/?api-key=YOUR_KEY"
HELIUS_WEBHOOK_SECRET="your_webhook_secret"
PROGRAM_ID="your_deployed_program_id"
WHALE_THRESHOLD_SOL="10"
PORT="4000"
WS_PORT="4001"
```

Create `.env.local` in `frontend/` (you populate this):
```env
NEXT_PUBLIC_API_URL="http://localhost:4000"
NEXT_PUBLIC_WS_URL="ws://localhost:4001"
NEXT_PUBLIC_RPC_URL="https://devnet.helius-rpc.com/?api-key=YOUR_KEY"
NEXT_PUBLIC_PROGRAM_ID="your_deployed_program_id"
NEXT_PUBLIC_WHALE_THRESHOLD_SOL="10"
```

---

## PHASE 1 — Anchor Program Scaffold + Curve Math

**Duration estimate:** 1.5 weeks  
**Goal:** The Anchor program is structured, compiles, and the 3 bonding curves are implemented with verified math. Pixel gets the curve math for client-side previews immediately.

**What Pixel can unblock after this phase:** Step 2 of the Create Wizard (live curve preview chart) and the Trade Panel price estimation.

---

### 1.1 Program Structure

```
programs/launchpad/src/
├── lib.rs
├── instructions/
│   ├── mod.rs
│   ├── initialize_platform.rs
│   ├── initialize_token.rs
│   ├── buy.rs
│   ├── sell.rs
│   ├── graduate.rs
│   ├── cancel_token.rs
│   └── withdraw_fees.rs
├── state/
│   ├── mod.rs
│   ├── platform_config.rs
│   └── token_config.rs
├── curve/
│   ├── mod.rs
│   ├── linear.rs
│   ├── exponential.rs
│   └── sigmoid.rs
└── errors.rs
```

### 1.2 State Definitions

**`state/platform_config.rs`**
```rust
#[account]
#[derive(Default)]
pub struct PlatformConfig {
    pub authority: Pubkey,        // 32
    pub fee_basis_points: u16,    // 2  (100 = 1%)
    pub fee_vault: Pubkey,        // 32
    pub bump: u8,                 // 1
    pub _reserved: [u8; 64],      // 64 — future use
}
// Space: 8 (discriminator) + 131 = 139 bytes
```

**`state/token_config.rs`**
```rust
#[account]
pub struct TokenConfig {
    pub creator: Pubkey,              // 32
    pub mint: Pubkey,                 // 32
    pub name: String,                 // 4 + 32 = 36
    pub symbol: String,               // 4 + 10 = 14
    pub uri: String,                  // 4 + 200 = 204
    pub supply_cap: u64,              // 8
    pub current_supply: u64,          // 8
    pub curve_type: CurveType,        // 1
    pub curve_params: CurveParams,    // 40
    pub graduation_threshold: u64,    // 8
    pub sol_vault: Pubkey,            // 32
    pub status: TokenStatus,          // 1
    pub creator_allocation: u8,       // 1
    pub created_at: i64,              // 8
    pub graduating: bool,             // 1 — race condition guard
    pub bump: u8,                     // 1
    pub _reserved: [u8; 64],          // 64
}
// Space: 8 + 460 = 468 bytes

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum CurveType { Linear, Exponential, Sigmoid }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct CurveParams {
    pub param_a: u64,   // linear: base price | exp: initial price | sig: P_max
    pub param_b: u64,   // linear: slope      | exp: growth rate   | sig: steepness k (scaled 1e6)
    pub param_c: u64,   // sigmoid: midpoint s0 (in token units)
    pub param_d: u64,   // reserved
    pub param_e: u64,   // sigmoid segment slopes (packed, see sigmoid.rs)
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum TokenStatus { Active, Graduated, Cancelled }
```

### 1.3 Custom Errors — `errors.rs`

```rust
#[error_code]
pub enum LaunchpadError {
    #[msg("Token is not active")]
    TokenNotActive,
    #[msg("Supply cap exceeded")]
    SupplyCap,
    #[msg("Insufficient SOL balance")]
    InsufficientFunds,
    #[msg("Insufficient token balance")]
    InsufficientTokens,
    #[msg("Token is already graduating")]
    AlreadyGraduating,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Invalid curve parameters")]
    InvalidCurveParams,
    #[msg("Creator allocation exceeds maximum (10%)")]
    CreatorAllocationTooHigh,
    #[msg("Symbol too long (max 10 chars)")]
    SymbolTooLong,
    #[msg("Name too long (max 32 chars)")]
    NameTooLong,
    #[msg("Graduation threshold must be less than supply cap")]
    InvalidThreshold,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Unauthorized")]
    Unauthorized,
}
```

### 1.4 Bonding Curve Implementation

**RULE: All math uses `u128` for intermediate calculations. All values in lamports (1 SOL = 1,000,000,000). All rates scaled by 1,000,000 to avoid decimals.**

---

**`curve/linear.rs`**

Formula: `P(s) = a + b * s`  
Where `a` = base price in lamports, `b` = slope in lamports per token

```rust
pub fn buy_cost(a: u64, b: u64, current_supply: u64, amount: u64) -> Result<u64> {
    // Cost = sum of prices from supply to supply+amount
    // = amount*a + b*current_supply*amount + b*amount*(amount-1)/2
    let a = a as u128;
    let b = b as u128;
    let s = current_supply as u128;
    let n = amount as u128;

    let term1 = n.checked_mul(a).ok_or(LaunchpadError::Overflow)?;
    let term2 = b.checked_mul(s)
        .and_then(|v| v.checked_mul(n))
        .ok_or(LaunchpadError::Overflow)?;
    let term3 = b.checked_mul(n)
        .and_then(|v| v.checked_mul(n.saturating_sub(1)))
        .and_then(|v| v.checked_div(2))
        .ok_or(LaunchpadError::Overflow)?;

    let total = term1.checked_add(term2)
        .and_then(|v| v.checked_add(term3))
        .ok_or(LaunchpadError::Overflow)?;

    Ok(total as u64)
}

pub fn sell_return(a: u64, b: u64, current_supply: u64, amount: u64) -> Result<u64> {
    // Sell from (supply - amount) to supply, apply 95% factor
    let gross = buy_cost(a, b, current_supply.saturating_sub(amount), amount)?;
    Ok((gross as u128 * 95 / 100) as u64)
}

pub fn price_at(a: u64, b: u64, supply: u64) -> u64 {
    a + (b as u128 * supply as u128 / 1_000_000) as u64
}
```

---

**`curve/exponential.rs`**

Formula (3-term Taylor approximation):  
`P(s) = a * (1 + r*s + (r*s)^2 / 2)`  
Where `r` is scaled by `1_000_000` (r=1000 means 0.001 growth per token)

```rust
pub fn buy_cost(a: u64, r_scaled: u64, current_supply: u64, amount: u64) -> Result<u64> {
    // Integrate by summing price at each token (acceptable for reasonable amounts)
    // For large amounts: use closed-form Simpson's rule approximation
    let a = a as u128;
    let r = r_scaled as u128;
    let scale: u128 = 1_000_000;
    let mut total: u128 = 0;

    // Use 10-point Gaussian quadrature for gas efficiency
    // Approximate cost as: amount * average_price(s, s+amount)
    let s_start = current_supply as u128;
    let s_end = (current_supply + amount) as u128;
    let s_mid = (s_start + s_end) / 2;

    let price_start = price_at_u128(a, r, scale, s_start);
    let price_mid   = price_at_u128(a, r, scale, s_mid);
    let price_end   = price_at_u128(a, r, scale, s_end);

    // Simpson's rule: cost ≈ (amount / 6) * (P(start) + 4*P(mid) + P(end))
    let n = amount as u128;
    total = n.checked_mul(
        price_start
            .checked_add(price_mid.checked_mul(4).ok_or(LaunchpadError::Overflow)?)
            .and_then(|v| v.checked_add(price_end))
            .ok_or(LaunchpadError::Overflow)?
    ).and_then(|v| v.checked_div(6))
    .ok_or(LaunchpadError::Overflow)?;

    Ok(total as u64)
}

fn price_at_u128(a: u128, r: u128, scale: u128, supply: u128) -> u128 {
    let rs = r * supply / scale;
    let term1 = a;
    let term2 = a * rs / scale;
    let term3 = a * rs * rs / scale / scale / 2;
    term1 + term2 + term3
}

pub fn price_at(a: u64, r_scaled: u64, supply: u64) -> u64 {
    price_at_u128(a as u128, r_scaled as u128, 1_000_000, supply as u128) as u64
}

pub fn sell_return(a: u64, r_scaled: u64, current_supply: u64, amount: u64) -> Result<u64> {
    let gross = buy_cost(a, r_scaled, current_supply.saturating_sub(amount), amount)?;
    Ok((gross as u128 * 95 / 100) as u64)
}
```

---

**`curve/sigmoid.rs`**

Implementation: 7-segment piecewise linear approximation.

Breakpoints (as % of supply_cap): 0, 10, 25, 45, 55, 75, 90, 100  
Each segment stores: `slope` (lamports per token) and `intercept` (lamports)

```rust
pub struct SigmoidSegment {
    pub supply_start: u64,  // token units
    pub supply_end: u64,
    pub slope: u64,         // lamports per token (scaled 1e6)
    pub intercept: u64,     // lamports at segment start
}

pub fn build_segments(p_max: u64, supply_cap: u64, k_scaled: u64) -> Vec<SigmoidSegment> {
    // Compute price at each breakpoint using true sigmoid,
    // then connect breakpoints with linear segments.
    let breakpoints = [0.0, 0.10, 0.25, 0.45, 0.55, 0.75, 0.90, 1.0];
    // ... (full implementation: evaluate sigmoid at each breakpoint, derive slopes)
}

pub fn price_at(segments: &[SigmoidSegment], supply: u64) -> u64 {
    for seg in segments {
        if supply >= seg.supply_start && supply < seg.supply_end {
            let delta = supply - seg.supply_start;
            return seg.intercept + (seg.slope as u128 * delta as u128 / 1_000_000) as u64;
        }
    }
    // At supply_cap: return p_max
    segments.last().map(|s| s.intercept).unwrap_or(0)
}

pub fn buy_cost(segments: &[SigmoidSegment], current_supply: u64, amount: u64) -> Result<u64> {
    // Sum across potentially multiple segments
    // Use trapezoidal rule within each segment
    let mut total: u128 = 0;
    let mut remaining = amount;
    let mut supply = current_supply;

    for seg in segments {
        if supply >= seg.supply_end || remaining == 0 { continue; }
        if supply < seg.supply_start { continue; }

        let available = seg.supply_end.saturating_sub(supply);
        let to_buy = remaining.min(available);

        let p_start = price_at(segments, supply) as u128;
        let p_end   = price_at(segments, supply + to_buy) as u128;
        let cost    = to_buy as u128 * (p_start + p_end) / 2;

        total = total.checked_add(cost).ok_or(LaunchpadError::Overflow)?;
        supply += to_buy;
        remaining -= to_buy;
    }

    Ok(total as u64)
}

pub fn sell_return(segments: &[SigmoidSegment], current_supply: u64, amount: u64) -> Result<u64> {
    let gross = buy_cost(segments, current_supply.saturating_sub(amount), amount)?;
    Ok((gross as u128 * 95 / 100) as u64)
}
```

### 1.5 Curve Module Tests — `tests/curve_math.rs`

Write Rust unit tests verifying:

```rust
#[cfg(test)]
mod tests {
    // Linear: price at 0, 5000, 10000 tokens
    // Linear: buy cost for 100 tokens at various supply levels
    // Linear: sell return = 95% of equivalent buy cost
    // Exponential: verify Simpson's rule within 1% of true integral
    // Exponential: overflow safety at u64::MAX supply
    // Sigmoid: verify 7 segments cover full supply range
    // Sigmoid: price is monotonically increasing across all supply
    // Sigmoid: price at 0% supply ≈ 0, at 100% supply ≈ p_max
    // All curves: buy then sell round-trip never returns more SOL than deposited
    // All curves: checked arithmetic never panics on max values
}
```

**Run before proceeding:** `anchor test --skip-deploy`  
All curve tests must pass before Phase 2 begins.

### 1.6 TypeScript Curve Port — `frontend/src/lib/curve/math.ts`

Port every curve formula to TypeScript. Pixel needs this for live price previews in the Create Wizard and Trade Panel. Deliver this file at the end of Phase 1.

```typescript
// frontend/src/lib/curve/math.ts

export type CurveType = 'linear' | 'exponential' | 'sigmoid'

export interface CurveParams {
  a: number   // base price / initial price / p_max (in lamports)
  b: number   // slope / growth rate / steepness (scaled 1e6)
  c: number   // sigmoid midpoint s0
}

export interface PriceResult {
  totalCost: number       // lamports
  pricePerToken: number   // lamports per token
  priceImpact: number     // percentage (0–100)
  newPrice: number        // price after trade
}

export function calculateBuyPrice(
  curveType: CurveType,
  params: CurveParams,
  currentSupply: number,
  buyAmount: number,
  supplyCap: number
): PriceResult { ... }

export function calculateSellReturn(
  curveType: CurveType,
  params: CurveParams,
  currentSupply: number,
  sellAmount: number
): PriceResult { ... }

export function priceAt(
  curveType: CurveType,
  params: CurveParams,
  supply: number,
  supplyCap: number
): number { ... }

// Generate N data points for chart rendering
export function generateCurveData(
  curveType: CurveType,
  params: CurveParams,
  supplyCap: number,
  points: number = 100
): Array<{ supply: number; price: number }> { ... }
```

**Precision note:** JavaScript uses 64-bit floats. For values that stay < 2^53, this is safe. Use `BigInt` for large lamport calculations where needed.

### 1.7 Deliver IDL

After the program compiles successfully:
```bash
anchor build
# Copy generated IDL to frontend
cp target/idl/launchpad.json ../frontend/src/lib/anchor/idl.json
```

Update `frontend/src/lib/anchor/program.ts`:
```typescript
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import { Connection, PublicKey } from '@solana/web3.js'
import idl from './idl.json'
import type { Launchpad } from './idl'

export const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!)

export function getProgram(provider: AnchorProvider): Program<Launchpad> {
  return new Program(idl as Launchpad, PROGRAM_ID, provider)
}

export function getProgramReadonly(connection: Connection): Program<Launchpad> {
  // Read-only provider for fetching account state
  const provider = new AnchorProvider(connection, {} as any, {})
  return new Program(idl as Launchpad, PROGRAM_ID, provider)
}
```

### Phase 1 Completion Checklist

- [ ] All state accounts defined with correct space calculations
- [ ] All 3 curve modules implemented (linear, exponential, sigmoid)
- [ ] Custom error enum covers all failure modes
- [ ] All Rust curve unit tests pass
- [ ] Sigmoid segment builder verified: monotonically increasing price
- [ ] Program compiles: `anchor build` with zero warnings
- [ ] `frontend/src/lib/curve/math.ts` delivered and matches Rust math
- [ ] `frontend/src/lib/anchor/idl.json` delivered
- [ ] `frontend/src/lib/anchor/program.ts` updated
- [ ] Frontend `.env.local` populated with devnet values

**Pixel unblocks after this phase:** Create Wizard Step 2 (live curve preview), Trade Panel price estimation.

---

## PHASE 2 — Core Instructions: initialize_platform + initialize_token

**Duration estimate:** 1 week  
**Goal:** Platform can be initialized. Tokens can be deployed on-chain. Pixel's Create Wizard deploy button works end-to-end.

**Depends on:** Phase 1 complete, IDL delivered.

---

### 2.1 `initialize_platform` Instruction

**Accounts:**
```rust
#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + PlatformConfig::SPACE,
        seeds = [b"platform_config"],
        bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,

    /// CHECK: fee vault is a system account
    pub fee_vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
```

**Logic:**
```rust
pub fn initialize_platform(
    ctx: Context<InitializePlatform>,
    fee_basis_points: u16,
) -> Result<()> {
    require!(fee_basis_points <= 500, LaunchpadError::Unauthorized); // max 5%
    let config = &mut ctx.accounts.platform_config;
    config.authority = ctx.accounts.authority.key();
    config.fee_basis_points = fee_basis_points;
    config.fee_vault = ctx.accounts.fee_vault.key();
    config.bump = ctx.bumps.platform_config;
    Ok(())
}
```

This is a one-time admin instruction. Run it once on deploy. Not exposed to users.

---

### 2.2 `initialize_token` Instruction

**Accounts:**
```rust
#[derive(Accounts)]
#[instruction(params: InitializeTokenParams)]
pub struct InitializeToken<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        mint::decimals = 6,
        mint::authority = token_config,
        seeds = [b"mint", creator.key().as_ref(), params.symbol.as_bytes()],
        bump
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        space = 8 + TokenConfig::SPACE,
        seeds = [b"token_config", mint.key().as_ref()],
        bump
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        init,
        payer = creator,
        space = 0,
        seeds = [b"vault", mint.key().as_ref()],
        bump
    )]
    pub sol_vault: SystemAccount<'info>,

    #[account(
        init_if_needed,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = creator,
    )]
    pub creator_ata: Account<'info, TokenAccount>,

    /// Metaplex metadata account
    /// CHECK: validated by Metaplex program
    #[account(mut)]
    pub metadata_account: UncheckedAccount<'info>,

    pub platform_config: Account<'info, PlatformConfig>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
```

**Params:**
```rust
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeTokenParams {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub supply_cap: u64,
    pub curve_type: CurveType,
    pub curve_params: CurveParams,
    pub graduation_threshold: u64,
    pub creator_allocation: u8,    // 0–10
}
```

**Validation:**
```rust
require!(params.name.len() <= 32, LaunchpadError::NameTooLong);
require!(params.symbol.len() <= 10, LaunchpadError::SymbolTooLong);
require!(params.supply_cap >= 1_000, LaunchpadError::InvalidCurveParams);
require!(params.graduation_threshold < params.supply_cap, LaunchpadError::InvalidThreshold);
require!(params.creator_allocation <= 10, LaunchpadError::CreatorAllocationTooHigh);
// Validate curve params are non-zero
require!(params.curve_params.param_a > 0, LaunchpadError::InvalidCurveParams);
```

**Logic:**
1. Validate all params
2. Initialize `token_config` PDA
3. Create Metaplex metadata via CPI
4. If `creator_allocation > 0`: mint `supply_cap * creator_allocation / 100` tokens to `creator_ata`
5. Update `current_supply` to reflect creator mint
6. Emit `TokenCreated` event

**Event:**
```rust
#[event]
pub struct TokenCreated {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub symbol: String,
    pub curve_type: u8,
    pub supply_cap: u64,
    pub graduation_threshold: u64,
    pub timestamp: i64,
}
```

---

### 2.3 Backend — Token Indexing

Set up the backend database and Helius webhook to index `TokenCreated` events.

**Prisma Schema — `backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Token {
  id                  String    @id @default(cuid())
  mint                String    @unique
  creator             String
  name                String
  symbol              String
  uri                 String
  description         String    @default("")
  supplyCap           BigInt
  currentSupply       BigInt    @default(0)
  curveType           String    // "linear" | "exponential" | "sigmoid"
  curveParamA         BigInt
  curveParamB         BigInt
  curveParamC         BigInt
  graduationThreshold BigInt
  creatorAllocation   Int
  status              String    @default("active") // "active" | "graduated" | "cancelled"
  raydiumPoolId       String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  trades   Trade[]
  comments Comment[]

  @@index([status])
  @@index([createdAt])
  @@index([creator])
}

model Trade {
  id            String   @id @default(cuid())
  tokenMint     String
  walletAddress String
  type          String   // "buy" | "sell"
  amount        BigInt   // token amount
  solAmount     BigInt   // lamports
  pricePerToken BigInt   // lamports per token
  txSignature   String   @unique
  timestamp     DateTime
  isWhale       Boolean  @default(false)

  token Token @relation(fields: [tokenMint], references: [mint])

  @@index([tokenMint])
  @@index([walletAddress])
  @@index([timestamp])
}

model Comment {
  id            String   @id @default(cuid())
  tokenMint     String
  walletAddress String
  message       String
  signature     String   // wallet signature of message
  upvotes       Int      @default(0)
  createdAt     DateTime @default(now())

  token Token @relation(fields: [tokenMint], references: [mint])

  @@index([tokenMint])
}

model Profile {
  id             String   @id @default(cuid())
  walletAddress  String   @unique
  username       String   @unique          // required — enforced at onboarding
  profilePicUri  String                    // IPFS URI — required at onboarding
  coverUri       String                    // IPFS URI — required at onboarding
  onboarded      Boolean  @default(false)  // true after onboarding completes
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([username])
  @@index([onboarded])
}

model Follow {
  id              String @id @default(cuid())
  followerWallet  String
  followingWallet String
  createdAt       DateTime @default(now())

  @@unique([followerWallet, followingWallet])
  @@index([followerWallet])
  @@index([followingWallet])
}

model Watchlist {
  id            String   @id @default(cuid())
  walletAddress String
  tokenMint     String
  createdAt     DateTime @default(now())

  @@unique([walletAddress, tokenMint])
  @@index([walletAddress])
}
```

Run migration:
```bash
cd backend
npx prisma migrate dev --name init
```

---

### 2.4 API Endpoints — Phase 2

#### `POST /api/tokens`

Indexes a token after deploy (called by frontend after tx confirms).

```
Request:
  Body: {
    mint: string
    txSignature: string
    description: string  // not stored on-chain, stored in DB
  }

Response 200:
  { token: TokenRecord }

Response 400:
  { error: "Token not found on-chain", code: "TOKEN_NOT_FOUND" }

Auth: none (tx signature proves legitimacy)
Rate limit: 10 req/min per IP
```

Logic: Fetch `TokenConfig` PDA from RPC using `mint`, verify it exists, write to DB.

#### `GET /api/tokens`

Feed and explore data.

```
Request:
  Query: {
    filter?: "new" | "trending" | "near_grad" | "graduated" | "following"
    tags?: string (comma-separated curve types)
    cursor?: string
    limit?: number (default 20, max 50)
    wallet?: string (required for "following" filter)
  }

Response 200:
  {
    tokens: TokenListItem[]
    nextCursor: string | null
  }

TokenListItem: {
  mint: string
  symbol: string
  name: string
  imageUri: string
  description: string
  creatorWallet: string
  creatorHandle: string | null
  createdAt: string (ISO)
  curveType: "linear" | "exponential" | "sigmoid"
  currentSupply: string (BigInt as string)
  supplyCap: string
  graduationThreshold: string
  status: "active" | "graduated"
  price: string          // current price in lamports
  priceChange24h: number // percentage
  marketCap: string      // lamports
  commentCount: number
  sparklineData: number[] // 7 price points, last 7 days
}

Auth: none
Rate limit: 60 req/min
```

Trending algorithm: `score = (trades_24h * 0.4) + (volume_24h * 0.4) + (1 / age_hours * 0.2)`

#### `GET /api/tokens/:mint`

Full token detail.

```
Response 200:
  {
    mint: string
    symbol: string
    name: string
    imageUri: string
    description: string
    curveType: string
    curveParams: { a: string, b: string, c: string }
    supplyCap: string
    currentSupply: string
    graduationThreshold: string
    status: string
    raydiumPoolId: string | null
    creatorWallet: string
    creatorHandle: string | null
    createdAt: string
    holderCount: number
    tradeCount: number
    price: string
    priceChange24h: number
    volume24h: string
    marketCap: string
  }

Response 404:
  { error: "Token not found", code: "NOT_FOUND" }
```

#### `POST /api/upload`

IPFS image upload proxy (hides Pinata API key from frontend).

```
Request:
  Content-Type: multipart/form-data
  Body: { file: File }

Response 200:
  { uri: string }  // IPFS URI: ipfs://Qm...

Validation:
  - Max file size: 5MB
  - Allowed types: image/jpeg, image/png, image/gif, image/webp

Auth: none (rate-limited)
Rate limit: 5 uploads/min per IP
```

---

### 2.5 Frontend Integration — Phase 2

**Wire `useTradeTransaction.ts` — `initialize_token`**

```typescript
// frontend/src/hooks/useTradeTransaction.ts
import { useAnchorProvider } from '@solana/wallet-adapter-react'
import { getProgram } from '@/lib/anchor/program'
import { SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'

export function useInitializeToken() {
  const provider = useAnchorProvider()

  const deployToken = async (params: DeployTokenParams) => {
    const program = getProgram(provider)

    // Derive PDAs
    const [mint] = PublicKey.findProgramAddressSync(
      [Buffer.from('mint'), provider.wallet.publicKey.toBytes(), Buffer.from(params.symbol)],
      program.programId
    )
    const [tokenConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from('token_config'), mint.toBytes()],
      program.programId
    )
    const [solVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), mint.toBytes()],
      program.programId
    )

    const tx = await program.methods
      .initializeToken({
        name: params.name,
        symbol: params.symbol,
        uri: params.uri,
        supplyCap: new BN(params.supplyCap),
        curveType: { [params.curveType]: {} },
        curveParams: {
          paramA: new BN(params.curveParams.a),
          paramB: new BN(params.curveParams.b),
          paramC: new BN(params.curveParams.c),
          paramD: new BN(0),
          paramE: new BN(0),
        },
        graduationThreshold: new BN(params.graduationThreshold),
        creatorAllocation: params.creatorAllocation,
      })
      .accounts({ mint, tokenConfig, solVault, ... })
      .rpc()

    // After tx confirms: POST /api/tokens to index in DB
    await fetch('/api/tokens', {
      method: 'POST',
      body: JSON.stringify({ mint: mint.toBase58(), txSignature: tx, description: params.description })
    })

    return { mint: mint.toBase58(), txSignature: tx }
  }

  return { deployToken }
}
```

This replaces Pixel's placeholder deploy handler in the Create Wizard Step 3.

### Phase 2 Completion Checklist

- [ ] `initialize_platform` instruction implemented + tested
- [ ] `initialize_token` instruction implemented with full validation
- [ ] Metaplex metadata CPI works (token visible in wallet explorers)
- [ ] Creator allocation minting works (0%, 5%, 10% tested)
- [ ] Prisma schema migrated to dev DB
- [ ] `POST /api/tokens` endpoint live
- [ ] `GET /api/tokens` endpoint live (all filters)
- [ ] `GET /api/tokens/:mint` endpoint live
- [ ] `POST /api/upload` Pinata proxy live
- [ ] `useInitializeToken` hook replaces Pixel's placeholder
- [ ] Create Wizard deploy flow works end-to-end on devnet
- [ ] Token appears in feed after deploy

---

## PHASE 3 — Buy & Sell Instructions

**Duration estimate:** 1.5 weeks  
**Goal:** Tokens are tradeable. Buy and sell transactions work on devnet. Pixel's Trade Panel is fully functional.

**Depends on:** Phase 2 complete.

---

### 3.1 `buy` Instruction

**Accounts:**
```rust
#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token_config", mint.key().as_ref()],
        bump = token_config.bump,
        constraint = token_config.status == TokenStatus::Active @ LaunchpadError::TokenNotActive,
        constraint = !token_config.graduating @ LaunchpadError::AlreadyGraduating,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        constraint = mint.key() == token_config.mint
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"vault", mint.key().as_ref()],
        bump
    )]
    pub sol_vault: SystemAccount<'info>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = fee_vault.key() == platform_config.fee_vault
    )]
    pub fee_vault: SystemAccount<'info>,

    pub platform_config: Account<'info, PlatformConfig>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
```

**Params:**
```rust
pub struct BuyParams {
    pub amount: u64,         // tokens to buy
    pub max_sol_cost: u64,   // slippage protection: max lamports willing to pay
}
```

**Logic:**
```rust
pub fn buy(ctx: Context<Buy>, params: BuyParams) -> Result<()> {
    require!(params.amount > 0, LaunchpadError::ZeroAmount);

    let config = &mut ctx.accounts.token_config;

    // 1. Check supply cap
    require!(
        config.current_supply.checked_add(params.amount).ok_or(LaunchpadError::Overflow)?
            <= config.supply_cap,
        LaunchpadError::SupplyCap
    );

    // 2. Calculate cost using curve
    let cost = match config.curve_type {
        CurveType::Linear => linear::buy_cost(
            config.curve_params.param_a,
            config.curve_params.param_b,
            config.current_supply,
            params.amount,
        )?,
        CurveType::Exponential => exponential::buy_cost(
            config.curve_params.param_a,
            config.curve_params.param_b,
            config.current_supply,
            params.amount,
        )?,
        CurveType::Sigmoid => {
            let segments = sigmoid::build_segments(...);
            sigmoid::buy_cost(&segments, config.current_supply, params.amount)?
        }
    };

    // 3. Slippage check
    require!(cost <= params.max_sol_cost, LaunchpadError::SlippageExceeded);

    // 4. Calculate platform fee
    let platform_config = &ctx.accounts.platform_config;
    let fee = (cost as u128)
        .checked_mul(platform_config.fee_basis_points as u128)
        .and_then(|v| v.checked_div(10_000))
        .ok_or(LaunchpadError::Overflow)? as u64;

    let cost_after_fee = cost.checked_add(fee).ok_or(LaunchpadError::Overflow)?;

    // 5. Transfer SOL: buyer → vault
    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.sol_vault.to_account_info(),
            },
        ),
        cost,
    )?;

    // 6. Transfer fee: buyer → fee_vault
    if fee > 0 {
        anchor_lang::system_program::transfer(
            CpiContext::new(...),
            fee,
        )?;
    }

    // 7. Mint tokens to buyer
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.buyer_ata.to_account_info(),
                authority: ctx.accounts.token_config.to_account_info(),
            },
            &[&[b"token_config", ctx.accounts.mint.key().as_ref(), &[config.bump]]],
        ),
        params.amount,
    )?;

    // 8. Update supply
    config.current_supply = config.current_supply
        .checked_add(params.amount)
        .ok_or(LaunchpadError::Overflow)?;

    // 9. Emit BuyEvent
    emit!(BuyEvent {
        mint: ctx.accounts.mint.key(),
        buyer: ctx.accounts.buyer.key(),
        amount: params.amount,
        sol_cost: cost,
        fee,
        supply_after: config.current_supply,
        timestamp: Clock::get()?.unix_timestamp,
    });

    // 10. Check graduation
    if config.current_supply >= config.graduation_threshold {
        config.graduating = true;
        // Graduate instruction called via CPI or in same tx
        graduate(ctx.accounts, config)?;
    }

    Ok(())
}
```

---

### 3.2 `sell` Instruction

Mirror of `buy` — reverse direction. Burns tokens, returns SOL at 95% of buy price.

Key differences from buy:
- Burn tokens from seller ATA (not mint)
- Transfer SOL from vault to seller (vault PDA signs via `seeds`)
- No fee on sells (spread is the implicit fee)
- Emit `SellEvent`

**Vault signing pattern:**
```rust
let vault_seeds = &[
    b"vault",
    ctx.accounts.mint.key().as_ref(),
    &[ctx.bumps.sol_vault],
];
anchor_lang::system_program::transfer(
    CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        Transfer { from: vault.to_account_info(), to: seller.to_account_info() },
        &[vault_seeds],
    ),
    return_amount,
)?;
```

---

### 3.3 Integration Tests — Buy/Sell

```typescript
// tests/buy_sell.ts
it("buy tokens increases supply and price", async () => {
  // Create token, buy 1000 tokens, verify:
  // - current_supply increased by 1000
  // - SOL left buyer wallet
  // - Tokens arrived in buyer ATA
  // - Price at new supply > price at old supply
})

it("sell tokens decreases supply", async () => {
  // Buy then sell, verify:
  // - current_supply returned to original
  // - SOL returned to seller (< original due to spread)
  // - Tokens burned from seller ATA
})

it("slippage protection rejects overpriced trades", async () => {
  // Set max_sol_cost too low, expect SlippageExceeded error
})

it("supply cap prevents over-minting", async () => {
  // Attempt to buy more than remaining supply, expect SupplyCap error
})

it("cannot buy from graduated token", async () => {
  // Graduate a token, attempt buy, expect TokenNotActive
})
```

---

### 3.4 Trade Indexing — Helius Webhook

Helius sends a POST to your backend whenever a transaction involving your program ID is confirmed.

**`backend/src/routes/webhook.ts`**

```typescript
fastify.post('/webhook/helius', async (request, reply) => {
  // 1. Verify Helius signature
  const signature = request.headers['helius-signature']
  if (!verifyHeliusSignature(signature, request.body)) {
    return reply.code(401).send({ error: 'Invalid signature' })
  }

  const events = request.body as HeliusEvent[]

  for (const event of events) {
    // 2. Parse program logs for BuyEvent / SellEvent / GraduationEvent
    const parsed = parseProgramEvent(event)
    if (!parsed) continue

    // 3. Write trade to DB
    await prisma.trade.create({
      data: {
        tokenMint: parsed.mint,
        walletAddress: parsed.wallet,
        type: parsed.type,
        amount: BigInt(parsed.amount),
        solAmount: BigInt(parsed.solAmount),
        pricePerToken: BigInt(parsed.pricePerToken),
        txSignature: event.signature,
        timestamp: new Date(event.timestamp * 1000),
        isWhale: parsed.solAmount > WHALE_THRESHOLD,
      }
    })

    // 4. Update token currentSupply in DB
    await prisma.token.update({
      where: { mint: parsed.mint },
      data: { currentSupply: BigInt(parsed.supplyAfter) }
    })

    // 5. Broadcast to WebSocket clients
    wsServer.broadcast(JSON.stringify({
      type: parsed.type,
      tokenMint: parsed.mint,
      tokenSymbol: parsed.symbol,
      walletAddress: parsed.wallet,
      amount: parsed.amount,
      solAmount: parsed.solAmount,
      pricePerToken: parsed.pricePerToken,
      txSignature: event.signature,
      timestamp: event.timestamp,
      isWhale: parsed.solAmount > WHALE_THRESHOLD,
    }))
  }

  reply.send({ ok: true })
})
```

---

### 3.5 Additional API Endpoints — Phase 3

#### `GET /api/tokens/:mint/activity`

```
Query: { limit?: number, cursor?: string }

Response 200:
  {
    trades: TradeEvent[]
    nextCursor: string | null
  }

TradeEvent: {
  id: string
  type: "buy" | "sell"
  walletAddress: string
  walletHandle: string | null
  amount: string
  solAmount: string
  pricePerToken: string
  txSignature: string
  timestamp: string
  isWhale: boolean
}
```

#### `GET /api/tokens/:mint/chart`

```
Query: { range: "1h" | "4h" | "1d" | "all" }

Response 200:
  {
    data: Array<{ time: number; price: string; volume: string }>
  }
```

Computed from `trades` table, grouped by time bucket per range.

---

### 3.6 WebSocket Server

**`backend/src/ws/server.ts`**

```typescript
import WebSocket, { WebSocketServer } from 'ws'

const wss = new WebSocketServer({ port: Number(process.env.WS_PORT) })
const clients = new Set<WebSocket>()

wss.on('connection', (ws) => {
  clients.add(ws)
  ws.on('close', () => clients.delete(ws))
})

export function broadcast(message: string) {
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  }
}
```

---

### 3.7 Frontend Integration — Phase 3

**Wire `useTradeTicker.ts`** (real WebSocket, replaces Phase 6 placeholder):
```typescript
// frontend/src/hooks/useTradeTicker.ts
export function useTradeTicker() {
  useEffect(() => {
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!)
    ws.onmessage = (e) => {
      const trade = JSON.parse(e.data)
      useTickerStore.getState().addTrade(trade)
    }
    return () => ws.close()
  }, [])
}
```

**Wire `useTradeTransaction.ts`** — buy/sell:
```typescript
export function useBuy(mint: string) {
  const provider = useAnchorProvider()
  const queryClient = useQueryClient()

  const buy = async (amount: number, maxSolCost: number) => {
    const program = getProgram(provider)
    const tx = await program.methods
      .buy({ amount: new BN(amount), maxSolCost: new BN(maxSolCost) })
      .accounts({ ... })
      .rpc()

    // Optimistic supply update
    queryClient.setQueryData(['token', mint], (old) => ({
      ...old,
      currentSupply: String(BigInt(old.currentSupply) + BigInt(amount))
    }))

    return tx
  }

  return { buy }
}
```

**Wire `useTokenActivity.ts`**:
```typescript
export function useTokenActivity(mint: string) {
  return useInfiniteQuery({
    queryKey: ['activity', mint],
    queryFn: ({ pageParam }) =>
      fetch(`${API_URL}/tokens/${mint}/activity?cursor=${pageParam}`).then(r => r.json()),
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 5_000,
    refetchInterval: 10_000,
  })
}
```

### Phase 3 Completion Checklist

- [ ] `buy` instruction: full implementation + slippage + fee + graduation trigger
- [ ] `sell` instruction: full implementation with vault PDA signing
- [ ] All buy/sell integration tests pass on localnet
- [ ] Helius webhook processes BuyEvent and SellEvent
- [ ] Trades written to DB on webhook receipt
- [ ] WebSocket server broadcasts trade events
- [ ] `GET /api/tokens/:mint/activity` endpoint live
- [ ] `GET /api/tokens/:mint/chart` endpoint live
- [ ] `useBuy` and `useSell` hooks wired to Anchor instructions
- [ ] `useTradeTicker` wired to WebSocket
- [ ] `useTokenActivity` wired to API
- [ ] Trade Panel buy/sell works end-to-end on devnet
- [ ] Live ticker populates in frontend
- [ ] Activity feed shows real trades on token page

---

## PHASE 4 — Graduation (Raydium CPI)

**Duration estimate:** 1.5 weeks  
**Goal:** When graduation threshold is hit, token auto-migrates to Raydium. LP tokens are burned. Token is permanently liquid.

**This is the most security-critical phase. Double every check.**

---

### 4.1 Raydium CPMM Integration

Add Raydium CPMM program as a dependency in `Cargo.toml`:

```toml
[dependencies]
raydium-cpmm-cpi = { git = "https://github.com/raydium-io/raydium-cpmm", features = ["cpi"] }
```

Key accounts needed from Raydium:
- `amm_config` — Raydium fee config PDA
- `pool_state` — new pool being created
- `token_0_vault` / `token_1_vault` — pool token vaults
- `lp_mint` — LP token mint
- `observation_state` — price oracle

### 4.2 `graduate` Instruction

This instruction is called internally from within `buy` when the threshold is hit. It is NOT externally callable (constrained by `graduating == true` flag set in `buy`).

**Full sequence:**
```rust
pub fn graduate(accounts: &mut GraduateAccounts, config: &mut TokenConfig) -> Result<()> {
    // 1. Calculate liquidity to add
    let sol_in_vault = accounts.sol_vault.lamports();
    let tokens_remaining = config.supply_cap
        .checked_sub(config.current_supply)
        .ok_or(LaunchpadError::Overflow)?;

    // 2. Mint remaining tokens to program-owned ATA (for LP)
    // These tokens pair with the SOL in vault
    token::mint_to(CpiContext::new_with_signer(
        ...,
        tokens_remaining,
    ), signer_seeds)?;

    // 3. Wrap SOL → WSOL for Raydium
    // Transfer from vault to WSOL account
    // (Raydium CPMM takes WSOL, not native SOL)

    // 4. Calculate graduation fee (0.5% of vault)
    let grad_fee = (sol_in_vault as u128 * 50 / 10_000) as u64;
    let sol_for_pool = sol_in_vault.checked_sub(grad_fee)
        .ok_or(LaunchpadError::Overflow)?;

    // 5. Transfer graduation fee to platform fee vault
    transfer_from_vault(accounts, grad_fee)?;

    // 6. CPI: Raydium create_pool
    raydium_cpmm_cpi::cpi::initialize(
        CpiContext::new_with_signer(
            accounts.raydium_program.to_account_info(),
            raydium_cpmm_cpi::cpi::accounts::Initialize {
                amm_config: accounts.amm_config.to_account_info(),
                pool_state: accounts.pool_state.to_account_info(),
                // ... all required Raydium accounts
            },
            signer_seeds,
        ),
        sol_for_pool,
        tokens_remaining,
        0, // open time: immediate
    )?;

    // 7. Burn all LP tokens received
    token::burn(
        CpiContext::new_with_signer(
            accounts.token_program.to_account_info(),
            token::Burn {
                mint: accounts.lp_mint.to_account_info(),
                from: accounts.lp_token_account.to_account_info(),
                authority: accounts.token_config.to_account_info(),
            },
            signer_seeds,
        ),
        accounts.lp_token_account.amount,
    )?;

    // 8. Revoke mint authority
    token::set_authority(
        CpiContext::new_with_signer(...),
        AuthorityType::MintTokens,
        None,
    )?;

    // 9. Update status
    config.status = TokenStatus::Graduated;
    config.graduating = false;

    // 10. Emit GraduationEvent
    emit!(GraduationEvent {
        mint: accounts.mint.key(),
        raydium_pool: accounts.pool_state.key(),
        total_sol: sol_in_vault,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
```

### 4.3 Graduation Indexing

Helius webhook picks up `GraduationEvent`. Backend handler:

```typescript
// In webhook.ts
if (parsed.type === 'graduation') {
  await prisma.token.update({
    where: { mint: parsed.mint },
    data: {
      status: 'graduated',
      raydiumPoolId: parsed.raydiumPool,
    }
  })

  wsServer.broadcast(JSON.stringify({
    type: 'graduation',
    tokenMint: parsed.mint,
    tokenSymbol: parsed.symbol,
    raydiumPoolId: parsed.raydiumPool,
    finalPrice: parsed.finalPrice,
    totalRaised: parsed.totalSol,
    timestamp: parsed.timestamp,
  }))
}
```

### 4.4 Frontend Integration — Graduation

**Wire graduation event in `useTradeTicker.ts`:**
```typescript
ws.onmessage = (e) => {
  const data = JSON.parse(e.data)

  if (data.type === 'graduation') {
    // Invalidate token query to force refetch
    queryClient.invalidateQueries(['token', data.tokenMint])
    // The GraduationBanner in Pixel's component reacts to status: 'graduated'
    // The graduation animation fires from the component watching status change
    return
  }

  useTickerStore.getState().addTrade(data)
}
```

### Phase 4 Completion Checklist

- [ ] Raydium CPMM CPI dependency added and compiling
- [ ] `graduate` instruction: full sequence (mint remaining → pool → LP burn → revoke authority)
- [ ] Graduation is atomic — partial states impossible
- [ ] `graduating` flag prevents race conditions
- [ ] Graduation fee collected to platform vault
- [ ] LP tokens confirmed burned on devnet (verify via explorer)
- [ ] Mint authority confirmed null after graduation
- [ ] Helius webhook handles GraduationEvent
- [ ] Token status updated to `graduated` in DB
- [ ] WebSocket broadcasts graduation event
- [ ] Frontend graduation animation fires from WebSocket event
- [ ] Graduated token page shows Raydium link (Pixel's existing component handles this)

---

## PHASE 5 — Social API (Comments, Profiles, Follows)

**Duration estimate:** 1 week  
**Goal:** All social endpoints live. Pixel's social components wire to real data.

**Depends on:** Phase 2 DB schema deployed.

---

### 5.1 Wallet Signature Verification

All authenticated endpoints verify a signed message. No JWT. No sessions.

```typescript
// backend/src/lib/auth.ts
import nacl from 'tweetnacl'
import bs58 from 'bs58'

export function verifyWalletSignature(
  walletAddress: string,
  message: string,
  signature: string
): boolean {
  const messageBytes = new TextEncoder().encode(message)
  const signatureBytes = bs58.decode(signature)
  const publicKeyBytes = bs58.decode(walletAddress)

  return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)
}
```

Standard message format for all authenticated actions:
```
ACTION:[action_type]|DATA:[relevant_data]|TIMESTAMP:[unix_ms]
```

Example for comment: `ACTION:COMMENT|DATA:$SYMBOL [truncated message]|TIMESTAMP:1714000000000`

### 5.2 Comment Endpoints

#### `GET /api/tokens/:mint/comments`
```
Query: { sort?: "top" | "new", limit?: number, cursor?: string }

Response 200:
  {
    comments: CommentItem[]
    nextCursor: string | null
  }

CommentItem: {
  id: string
  walletAddress: string
  walletHandle: string | null
  message: string
  upvotes: number
  createdAt: string
  hasUpvoted: boolean  // if wallet query param provided
}
```

#### `POST /api/tokens/:mint/comments`
```
Body: {
  message: string      // max 280 chars
  walletAddress: string
  signature: string    // signs: "ACTION:COMMENT|DATA:[message]|TIMESTAMP:[ts]"
  timestamp: number
}

Response 201: { comment: CommentItem }
Response 400: { error: "Invalid signature" | "Message too long" | ... }

Rate limit: 5 comments/min per wallet
```

#### `POST /api/comments/:id/upvote`
```
Body: { walletAddress: string, signature: string, timestamp: number }
Response 200: { upvotes: number }
Rate limit: 60 upvotes/min per wallet
```

### 5.3 Onboarding Endpoints

These three endpoints are the highest priority in Phase 5. Pixel's onboarding gate depends on them. They must be live before any other social endpoint.

#### `GET /api/profiles/:wallet`

Pixel calls this on every wallet connect to determine if the user has completed onboarding.

```
Response 200:
  {
    walletAddress: string
    username: string
    profilePicUri: string    // IPFS URI
    coverUri: string         // IPFS URI
    onboarded: boolean
    createdAt: string
    tokenCount: number
    followerCount: number
    followingCount: number
    graduatedCount: number
    isFollowing: boolean     // if viewer wallet query param provided
  }

Response 404:
  { error: "Profile not found", code: "NOT_FOUND" }
  // 404 means wallet has never onboarded — Pixel renders onboarding gate
```

#### `GET /api/profiles/check-username/:username`

Called by Pixel in real-time (debounced 500ms) as the user types their username in the onboarding flow.

```
Response 200:
  { available: true }

Response 200:
  { available: false }

Validation:
  - 3–20 chars
  - Regex: ^[a-zA-Z0-9_]+$
  - Case-insensitive uniqueness check (store lowercase, display as-entered)

Rate limit: 30 req/min per IP (debounced on client but still rate-limit server-side)
Auth: none
```

#### `POST /api/profiles`

Called after Pixel uploads images to IPFS and submits the onboarding form.

```
Body: {
  walletAddress: string
  username: string         // 3–20 chars, alphanumeric + underscores
  profilePicUri: string    // IPFS URI from /api/upload
  coverUri: string         // IPFS URI from /api/upload
  signature: string        // signs: "ACTION:ONBOARD|DATA:[username]|TIMESTAMP:[ts]"
  timestamp: number
}

Response 201:
  { profile: ProfileRecord }

Response 400:
  { error: "Invalid signature", code: "INVALID_SIGNATURE" }
  { error: "Username taken", code: "USERNAME_TAKEN" }
  { error: "Invalid username format", code: "INVALID_USERNAME" }
  { error: "Missing required fields", code: "MISSING_FIELDS" }

Response 409:
  { error: "Profile already exists", code: "ALREADY_EXISTS" }

Auth: wallet signature
Rate limit: 3 req/min per IP (one-time action, tight limit)
```

**Server-side logic:**
1. Verify wallet signature
2. Validate username format (`^[a-zA-Z0-9_]+$`, 3–20 chars)
3. Check username uniqueness (case-insensitive)
4. Validate IPFS URIs are well-formed (`ipfs://Qm...` or `https://ipfs.io/ipfs/...`)
5. Create Profile record with `onboarded: true`
6. Return profile

**Username storage rule:** Store username as lowercase in DB for uniqueness checks. Return the original casing the user entered for display. Add a `usernameDisplay` field to the schema for this.

Update Prisma schema accordingly:
```prisma
model Profile {
  id              String   @id @default(cuid())
  walletAddress   String   @unique
  username        String   @unique          // lowercase — for uniqueness
  usernameDisplay String                    // original casing — for display
  profilePicUri   String
  coverUri        String
  onboarded       Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([username])
  @@index([onboarded])
}
```

### 5.4 Profile Update Endpoint

#### `PUT /api/profiles/:wallet`

For the Edit Profile modal on the profile page. Only username and images can be changed. No bio.

```
Body: {
  username?: string        // optional — only if changing
  profilePicUri?: string   // optional — only if changing image
  coverUri?: string        // optional — only if changing cover
  walletAddress: string
  signature: string        // signs: "ACTION:UPDATE_PROFILE|DATA:[username]|TIMESTAMP:[ts]"
  timestamp: number
}

Response 200: { profile: ProfileRecord }
Response 400: { error: "Invalid signature" }
Response 409: { error: "Username taken", code: "USERNAME_TAKEN" }

Auth: wallet signature (must match :wallet param)
```

### 5.4 Follow Endpoints

#### `POST /api/follows`
```
Body: { followerWallet: string, followingWallet: string, signature: string, timestamp: number }
Response 201: { following: true }
```

#### `DELETE /api/follows`
```
Body: { followerWallet: string, followingWallet: string, signature: string, timestamp: number }
Response 200: { following: false }
```

### 5.5 Watchlist Endpoints

#### `GET /api/watchlist/:wallet`
```
Response 200: { mints: string[] }
```

#### `POST /api/watchlist`
```
Body: { walletAddress: string, tokenMint: string, signature: string, timestamp: number }
Response 201: { watched: true }
```

#### `DELETE /api/watchlist`
```
Body: { walletAddress: string, tokenMint: string, signature: string, timestamp: number }
Response 200: { watched: false }
```

### 5.6 Frontend Integration — Phase 5

**Wire `useComments.ts`:**
```typescript
export function useComments(mint: string, sort: 'top' | 'new' = 'new') {
  return useInfiniteQuery({
    queryKey: ['comments', mint, sort],
    queryFn: ({ pageParam }) =>
      fetch(`${API_URL}/tokens/${mint}/comments?sort=${sort}&cursor=${pageParam}`)
        .then(r => r.json()),
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 60_000,
  })
}

export function usePostComment(mint: string) {
  const { signMessage, publicKey } = useWallet()
  const queryClient = useQueryClient()

  const post = async (message: string) => {
    const timestamp = Date.now()
    const messageToSign = `ACTION:COMMENT|DATA:${message.slice(0, 20)}|TIMESTAMP:${timestamp}`
    const signature = await signMessage(new TextEncoder().encode(messageToSign))

    await fetch(`${API_URL}/tokens/${mint}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        walletAddress: publicKey!.toBase58(),
        signature: bs58.encode(signature),
        timestamp,
      })
    })

    queryClient.invalidateQueries(['comments', mint])
  }

  return { post }
}
```

### Phase 5 Completion Checklist

**Onboarding (must complete first — Pixel is blocked until these are live):**
- [ ] `verifyWalletSignature` utility implemented + tested
- [ ] `GET /api/profiles/:wallet` returns 404 for new wallets, full profile for existing
- [ ] `GET /api/profiles/check-username/:username` availability check live (case-insensitive)
- [ ] `POST /api/profiles` creates profile with username + profilePicUri + coverUri
- [ ] Username uniqueness enforced (case-insensitive, `usernameDisplay` stored separately)
- [ ] `PUT /api/profiles/:wallet` update endpoint live (username + images only, no bio)
- [ ] Onboarding gate wired: `useProfile` hook in frontend returns 404 → gate triggers

**Social:**
- [ ] All comment endpoints live + validated
- [ ] Follow/unfollow endpoints live
- [ ] Watchlist endpoints live
- [ ] `useComments` + `usePostComment` hooks wired
- [ ] `useProfile` hook wired to profile endpoint
- [ ] `useFollow` and `useWatchlist` hooks wired
- [ ] Profile page Holdings tab: pulls from trades table
- [ ] "Following" feed filter works (requires follow data)

---

## PHASE 6 — Remaining Instructions + Cleanup

**Duration estimate:** 1 week  
**Goal:** All instructions complete. Admin functions work. Token can be cancelled. Fees can be withdrawn.

---

### 6.1 `cancel_token` Instruction

Allows creator to cancel before first trade.

```rust
// Constraints:
// - Only creator can call
// - current_supply == creator_allocation (no outside trades yet)
// - status must be Active

// Logic:
// 1. Burn creator's tokens
// 2. Set status = Cancelled
// 3. Close token_config account, return rent to creator
// 4. Emit TokenCancelled event
```

### 6.2 `withdraw_fees` Instruction

Platform authority withdraws accumulated fees.

```rust
// Constraints: authority == platform_config.authority
// Transfers all lamports from fee_vault (minus rent-exempt minimum)
```

### 6.3 `update_platform_fee` Instruction

```rust
// Constraints: authority only
// Update fee_basis_points, max 500 (5%)
```

### 6.4 Final Integration Audit

Go through every hook in `frontend/src/hooks/`:

| Hook | Status | Action |
|---|---|---|
| `useTokenFeed.ts` | API-wired Phase 2 | Verify all filters work |
| `useTradeTransaction.ts` | Wired Phase 2+3 | Test all tx flows |
| `useTokenPrice.ts` | Polling + WS Phase 3 | Verify fallback polling |
| `useTradeTicker.ts` | WebSocket Phase 3 | Verify reconnect |
| `useTokenActivity.ts` | API-wired Phase 3 | Verify pagination |
| `useComments.ts` | API-wired Phase 5 | Verify signature flow |
| `useProfile.ts` | API-wired Phase 5 | Verify all tabs |
| `useFollow.ts` | API-wired Phase 5 | Verify bidirectional |
| `useWatchlist.ts` | API-wired Phase 5 | Verify local sync |
| `useInitializeToken.ts` | Anchor Phase 2 | Full e2e test |
| `useBuy.ts` | Anchor Phase 3 | Full e2e test |
| `useSell.ts` | Anchor Phase 3 | Full e2e test |

### 6.5 Devnet Full E2E Test

Run the complete user journey on devnet:

```
1. Deploy platform (initialize_platform)
2. Create token (all 3 curve types)
3. Buy tokens (10 different wallets)
4. Sell tokens (verify returns)
5. Trigger graduation (buy to threshold)
6. Verify Raydium pool exists + LP burned
7. Verify graduated token un-tradeable on launchpad
8. Post comment + upvote
9. Follow creator
10. Check profile holdings + trade history
11. Withdraw platform fees
```

### Phase 6 Completion Checklist

- [ ] `cancel_token` instruction implemented + tested
- [ ] `withdraw_fees` instruction implemented
- [ ] `update_platform_fee` instruction implemented
- [ ] All 8 instructions have complete integration tests
- [ ] Full E2E devnet test passes
- [ ] All frontend hooks confirmed wired to real data
- [ ] Zero mock data remaining in frontend data layer
- [ ] `lib/curve/math.ts` verified against on-chain math (buy price matches within 0.1%)

---

## PHASE 7 — Security, Audit Prep & Mainnet Readiness

**Duration estimate:** 1 week  
**Goal:** Program is hardened. Audit document prepared. Mainnet deployment ready.

---

### 7.1 Security Checklist (Run on Every Instruction)

```
For each instruction in: initialize_platform, initialize_token, buy, sell, graduate, cancel_token, withdraw_fees:

[ ] Authority check: correct signer enforced via Anchor constraint
[ ] PDA validation: all PDAs derived with correct seeds, not accepted as arbitrary
[ ] Arithmetic: every operation uses checked_* variant
[ ] u128 intermediates: all mul/div uses u128 before cast
[ ] Status checks: buy/sell check status == Active before any state change
[ ] Reentrancy: no intermediate state between CPI calls
[ ] Supply invariant: current_supply <= supply_cap after every buy
[ ] Vault solvency: sol_vault.lamports >= cost_of_all_outstanding_tokens
[ ] Graduation race: `graduating` flag prevents double-graduation
[ ] Mint authority: only token_config PDA can mint, never a user wallet
[ ] Zero amounts: all instructions reject amount == 0
[ ] Overflow test: tested with u64::MAX inputs in Rust unit tests
```

### 7.2 Invariant Tests

After every instruction in integration tests, assert:

```typescript
async function assertInvariants(mint: string) {
  const config = await program.account.tokenConfig.fetch(tokenConfigPDA)
  const vaultBalance = await connection.getBalance(solVaultPDA)

  // Supply invariant
  assert(config.currentSupply.lte(config.supplyCap))

  // Vault solvency: vault should hold at least what all tokens are worth at sell price
  const costToSellAll = await calculateSellReturn(
    config.curveType,
    config.curveParams,
    config.currentSupply.toNumber(),
    config.currentSupply.toNumber()
  )
  assert(vaultBalance >= costToSellAll * 0.94) // 5% spread gives 1% buffer
}
```

### 7.3 Audit Document

Produce `AUDIT_PREP.md`:

```
- Program overview and trust model
- All accounts and PDAs (seeds, space, authority)
- All instructions (happy path + all error paths)
- Curve math proofs (with overflow analysis)
- Graduation sequence (atomicity proof)
- Known limitations and accepted risks
- Test coverage summary
```

### 7.4 Mainnet Deployment Checklist

```
[ ] New program keypair generated (never used on devnet)
[ ] Anchor.toml updated with mainnet cluster
[ ] Program deployed: anchor deploy --provider.cluster mainnet
[ ] initialize_platform called with correct authority + fee vault
[ ] Program ID updated in frontend .env (production)
[ ] Helius webhook updated to mainnet program ID
[ ] Backend deployed (Railway / Render / VPS)
[ ] PostgreSQL production DB provisioned
[ ] Redis production instance provisioned
[ ] All environment variables set in production
[ ] Frontend deployed to Vercel (production env)
[ ] End-to-end test on mainnet with small amounts before launch
```

### Phase 7 Completion Checklist

- [ ] Security checklist passed for all 7 instructions
- [ ] Invariant tests pass after all instruction sequences
- [ ] No `unwrap()` remaining in program code
- [ ] Audit prep document complete
- [ ] Program verified on Solana explorer
- [ ] Mainnet deployment successful
- [ ] Production environment fully live

---

## Cross-Phase Rules

These apply in every phase, always:

1. **Checked math everywhere.** `checked_add`, `checked_mul`, `checked_div`. No raw arithmetic.
2. **u128 intermediates.** Any multiplication involving two u64s goes through u128.
3. **No `unwrap()` in production.** Every Result is handled. Every Option is matched.
4. **PDAs only.** Never accept arbitrary pubkeys where PDAs are expected.
5. **Deliver IDL after every instruction change.** Pixel regenerates types from it.
6. **API contracts before code.** Document the endpoint, agree shape with Pixel, then build.
7. **Type safety on the integration surface.** Every hook return type matches Pixel's component prop types exactly.
8. **Test on devnet before declaring done.** Localnet passing is necessary but not sufficient.
9. **Frontend integration is part of the phase.** A phase is not complete until Pixel's components show real data.

---

*Prompt Version: 1.0 | Chain: Solana | Framework: Anchor 0.30 | Last Updated: April 2026*
*Companion files: CLAUDE_AGENT.md · GEMINI_AGENT.md · GEMINI_FRONTEND_PROMPT.md*
