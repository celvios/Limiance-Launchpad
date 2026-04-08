use crate::errors::LaunchpadError;
use crate::state::PlatformConfig;
use anchor_lang::prelude::*;

/// Accounts required for `initialize_platform`.
///
/// One-time admin instruction. Called once during protocol deployment.
/// Only the `authority` signer can call `update_platform_fee` and `withdraw_fees` later.
#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    /// The platform administrator. Pays for the PDA rent.
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Platform configuration PDA — created here.
    /// Seeds: `["platform_config"]`
    #[account(
        init,
        payer = authority,
        space = 8 + PlatformConfig::SPACE,
        seeds = [b"platform_config"],
        bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,

    /// The system account that will receive platform fees.
    /// Must be a valid system-owned account (not a program-owned account).
    ///
    /// CHECK: This is a fee receiver; we only record its address. No funds are
    ///        transferred in this instruction — validation is caller's responsibility.
    pub fee_vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Initialize the platform configuration PDA.
///
/// # Arguments
/// * `fee_basis_points` — Fee rate in basis points (max 500 = 5%).
///   e.g. 100 = 1%. Charged on every buy and sell.
pub fn handler(ctx: Context<InitializePlatform>, fee_basis_points: u16) -> Result<()> {
    // Security: max fee guard — no rug via fee update
    require!(fee_basis_points <= 500, LaunchpadError::FeeTooHigh);

    let config = &mut ctx.accounts.platform_config;
    config.authority = ctx.accounts.authority.key();
    config.fee_basis_points = fee_basis_points;
    config.fee_vault = ctx.accounts.fee_vault.key();
    config.bump = ctx.bumps.platform_config;

    msg!(
        "Platform initialized. Authority: {}, fee: {} bps, vault: {}",
        config.authority,
        config.fee_basis_points,
        config.fee_vault
    );

    Ok(())
}
