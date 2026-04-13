use anchor_lang::prelude::*;

/// Global platform configuration.
/// PDA seeds: `["platform_config"]`
/// Created once by the platform authority at deploy time.
#[account]
#[derive(Default)]
pub struct PlatformConfig {
    /// The wallet that can update fees and withdraw accumulated fees.
    pub authority: Pubkey,          // 32

    /// Fee charged on every buy/sell, expressed in basis points.
    /// 100 = 1%, max 500 (5%).
    pub fee_basis_points: u16,      // 2

    /// System account that receives platform fees.
    pub fee_vault: Pubkey,          // 32

    /// Canonical bump for this PDA.
    pub bump: u8,                   // 1

    /// Reserved bytes for future protocol upgrades without migration.
    pub _reserved: [u8; 64],        // 64
}
// Discriminator: 8
// Total: 8 + 32 + 2 + 32 + 1 + 64 = 139

impl PlatformConfig {
    pub const SPACE: usize = 32 + 2 + 32 + 1 + 64;
}
