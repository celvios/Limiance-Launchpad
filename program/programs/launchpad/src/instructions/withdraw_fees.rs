/// Withdraw accumulated platform fees from the fee vault.
///
/// Only callable by the platform authority (the wallet that initialized the platform).
/// Withdraws a specified amount — does not close the vault (it must remain for future fees).
use crate::errors::LaunchpadError;
use crate::state::PlatformConfig;
use anchor_lang::prelude::*;
use anchor_lang::system_program;

/// Accounts for the `withdraw_fees` instruction.
#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    /// Platform authority — must match platform_config.authority.
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Platform configuration — read for authority validation.
    #[account(
        seeds = [b"platform_config"],
        bump = platform_config.bump,
        constraint = platform_config.authority == authority.key() @ LaunchpadError::Unauthorized,
    )]
    pub platform_config: Account<'info, PlatformConfig>,

    /// Fee vault — source of withdrawal.
    /// CHECK: address validated against platform_config.fee_vault.
    #[account(
        mut,
        constraint = fee_vault.key() == platform_config.fee_vault @ LaunchpadError::Unauthorized,
    )]
    pub fee_vault: SystemAccount<'info>,

    /// Recipient of withdrawn fees (usually same as authority).
    /// CHECK: arbitrary destination — authority decides where to send.
    #[account(mut)]
    pub recipient: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
    require!(amount > 0, LaunchpadError::ZeroAmount);

    let available = ctx.accounts.fee_vault.lamports();
    require!(available >= amount, LaunchpadError::InsufficientFunds);

    // The fee_vault is a system account (not a PDA), so the authority must sign.
    // The authority constraint above ensures only the platform authority can call this.
    // We transfer directly using system_program — fee_vault itself is a regular account
    // owned by the system program, so the authority wallet (already signing) can drain it
    // by being passed as fee_vault in a direct system_program::transfer.
    //
    // NOTE: If fee_vault is a PDA, add seeds here. For now it's a system account
    // that was passed by the authority at initialize_platform time.
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.fee_vault.to_account_info(),
                to: ctx.accounts.recipient.to_account_info(),
            },
        ),
        amount,
    )?;

    msg!(
        "withdraw_fees: authority={} amount={} recipient={}",
        ctx.accounts.authority.key(),
        amount,
        ctx.accounts.recipient.key(),
    );

    Ok(())
}
