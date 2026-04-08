use anchor_lang::prelude::*;

/// Selects which bonding curve formula governs this token's price.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum CurveType {
    #[default]
    Linear,
    Exponential,
    Sigmoid,
}

/// On-chain curve parameters, reused across all three curve types.
///
/// Linear:      P(s) = param_a + param_b * s / 1_000_000
///   param_a = base price in lamports
///   param_b = slope (lamports per 1M tokens — avoids decimals)
///
/// Exponential: P(s) ≈ param_a * (1 + r*s + (r*s)²/2)   [3-term Taylor]
///   param_a = initial price in lamports
///   param_b = growth rate r, scaled by 1_000_000 (r=1000 → 0.001 per token)
///
/// Sigmoid:     Piecewise linear, 7 segments.
///   param_a = P_max (maximum price, lamports)
///   param_b = steepness k, scaled by 1_000_000
///   param_c = midpoint s0 in token units
///   param_d / param_e = reserved for packed segment data
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct CurveParams {
    pub param_a: u64,  // 8
    pub param_b: u64,  // 8
    pub param_c: u64,  // 8
    pub param_d: u64,  // 8 — reserved
    pub param_e: u64,  // 8 — reserved
}
// Total: 40 bytes

/// Lifecycle status of a token.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum TokenStatus {
    /// Bonding curve is active — buy/sell allowed.
    #[default]
    Active,
    /// Token has graduated to Raydium — bonding curve closed.
    Graduated,
    /// Creator cancelled before any trades — refund issued.
    Cancelled,
}

/// Per-token state account.
/// PDA seeds: `["token_config", mint_pubkey]`
#[account]
pub struct TokenConfig {
    /// Wallet that launched this token.
    pub creator: Pubkey,              // 32

    /// SPL Mint for this token.
    pub mint: Pubkey,                 // 32

    /// Human-readable token name (max 32 bytes).
    pub name: String,                 // 4 + 32 = 36

    /// Trading symbol (max 10 bytes, e.g. "BONK").
    pub symbol: String,               // 4 + 10 = 14

    /// Metaplex metadata URI (max 200 bytes, IPFS or Arweave).
    pub uri: String,                  // 4 + 200 = 204

    /// Maximum tokens that can ever exist (denominated in smallest unit, 6 decimals).
    pub supply_cap: u64,              // 8

    /// Tokens currently in circulation (minted minus burned).
    pub current_supply: u64,          // 8

    /// Which bonding curve formula this token uses.
    pub curve_type: CurveType,        // 1

    /// Parameters for the selected curve.
    pub curve_params: CurveParams,    // 40

    /// When current_supply reaches this value, graduation to Raydium triggers.
    pub graduation_threshold: u64,    // 8

    /// PDA that holds SOL from trades (seeds: ["vault", mint]).
    pub sol_vault: Pubkey,            // 32

    /// Current lifecycle status.
    pub status: TokenStatus,          // 1

    /// Percentage of supply_cap pre-minted to creator (0–10).
    pub creator_allocation: u8,       // 1

    /// Unix timestamp (seconds) when the token was created.
    pub created_at: i64,              // 8

    /// Guard flag: true while a graduation CPI is in flight.
    /// Prevents re-entrant graduation calls.
    pub graduating: bool,             // 1

    /// Canonical bump for this PDA.
    pub bump: u8,                     // 1

    /// Reserved bytes for future fields without account migration.
    pub _reserved: [u8; 64],          // 64
}
// Discriminator: 8
// Fields: 32+32+36+14+204+8+8+1+40+8+32+1+1+8+1+1+64 = 451
// Total with discriminator: 459

impl TokenConfig {
    pub const SPACE: usize = 32 + 32 + 36 + 14 + 204 + 8 + 8 + 1 + 40 + 8 + 32 + 1 + 1 + 8 + 1 + 1 + 64;
}
