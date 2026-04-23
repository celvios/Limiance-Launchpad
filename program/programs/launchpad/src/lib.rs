use anchor_lang::prelude::*;

declare_id!("F97Ry5kDim5mvtJpZwYcwh3xcrGcna1c4hRhgNUHiV4C");

pub mod curve;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

#[program]
pub mod launchpad {
    use super::*;

    // ── Phase 2: Platform + Token Initialization ──────────────────────────────

    /// Initialize the platform configuration PDA.
    /// One-time admin instruction — run once after program deployment.
    ///
    /// # Arguments
    /// * `fee_basis_points` — Platform fee in basis points (max 500 = 5%).
    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        fee_basis_points: u16,
    ) -> Result<()> {
        initialize_platform::handler(ctx, fee_basis_points)
    }

    /// Deploy a new token on the bonding curve.
    ///
    /// Creates:
    ///   - SPL Mint (6 decimals)
    ///   - TokenConfig PDA
    ///   - SOL Vault PDA
    ///   - Metaplex metadata account
    ///
    /// Optionally mints creator_allocation % of supply_cap to creator's ATA.
    pub fn initialize_token(
        ctx: Context<InitializeToken>,
        params: initialize_token::InitializeTokenParams,
    ) -> Result<()> {
        initialize_token::handler(ctx, params)
    }

    // ── Phase 3: Trading ──────────────────────────────────────────────────────

    /// Buy tokens from the bonding curve.
    ///
    /// Transfers SOL (cost + fee) from buyer, mints tokens to buyer's ATA.
    /// If supply crosses graduation_threshold, sets `graduating = true` and
    /// emits GraduationTriggered — client must include `graduate` as the next ix.
    ///
    /// # Arguments
    /// * `amount`       — Token units to buy (6 decimals).
    /// * `max_sol_cost` — Slippage cap: transaction fails if cost > this value.
    pub fn buy(ctx: Context<Buy>, amount: u64, max_sol_cost: u64) -> Result<()> {
        buy::handler(ctx, amount, max_sol_cost)
    }

    /// Sell tokens back to the bonding curve.
    ///
    /// Burns seller's tokens, transfers 95% of equivalent buy cost back as SOL.
    /// The 5% spread is the implicit fee (stays in vault).
    ///
    /// # Arguments
    /// * `amount`         — Token units to sell (6 decimals).
    /// * `min_sol_return` — Slippage floor: transaction fails if return < this value.
    pub fn sell(ctx: Context<Sell>, amount: u64, min_sol_return: u64) -> Result<()> {
        sell::handler(ctx, amount, min_sol_return)
    }

    // ── Phase 4: Graduation ───────────────────────────────────────────────────

    /// Graduate a token to Raydium CPMM.
    ///
    /// Must be called immediately after a `buy` that set `graduating = true`.
    /// Mints remaining supply, creates Raydium pool, burns LP tokens,
    /// revokes mint authority, and sets status = Graduated.
    ///
    /// Raydium pool accounts are passed as `remaining_accounts` (positional).
    /// If no remaining_accounts are provided, runs in test mode (no pool created).
    pub fn graduate(ctx: Context<Graduate>) -> Result<()> {
        graduate::handler(ctx)
    }

    /// Cancel a token before any external trades have occurred.
    ///
    /// Only the creator can call this. Closes the sol_vault and token_config,
    /// returning rent to the creator. Creator allocation tokens remain in their ATA.
    pub fn cancel_token(ctx: Context<CancelToken>) -> Result<()> {
        cancel_token::handler(ctx)
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    /// Withdraw accumulated platform fees from the fee vault.
    ///
    /// Only callable by the platform authority.
    ///
    /// # Arguments
    /// * `amount` — Lamports to withdraw.
    pub fn withdraw_fees(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
        withdraw_fees::handler(ctx, amount)
    }
}
