/// Cancel a token that has never been traded.
///
/// Can only be called by the token creator, and only when:
///   - status == Active
///   - current_supply == creator_allocation (no external buys have occurred)
///
/// Refunds: closes the sol_vault (rent reclaim), closes token_config (rent reclaim).
/// Tokens already in the creator's ATA are not reclaimed — they stay with the creator.
use crate::errors::LaunchpadError;
use crate::state::{TokenConfig, TokenStatus};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

/// Emitted when a creator cancels their token before any trades.
#[event]
pub struct TokenCancelled {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub timestamp: i64,
}

/// Accounts for the `cancel_token` instruction.
#[derive(Accounts)]
pub struct CancelToken<'info> {
    /// Token creator — must be signer, receives rent refunds.
    #[account(mut)]
    pub creator: Signer<'info>,

    /// Token configuration PDA — closed, rent returned to creator.
    #[account(
        mut,
        seeds = [b"token_config", mint.key().as_ref()],
        bump = token_config.bump,
        constraint = token_config.creator == creator.key() @ LaunchpadError::Unauthorized,
        constraint = token_config.status == TokenStatus::Active @ LaunchpadError::TokenNotActive,
        close = creator,
    )]
    pub token_config: Account<'info, TokenConfig>,

    /// SPL Mint — read only for seed derivation.
    #[account(
        constraint = mint.key() == token_config.mint @ LaunchpadError::Unauthorized,
    )]
    pub mint: Account<'info, Mint>,

    /// SOL vault — closed, lamports returned to creator.
    #[account(
        mut,
        seeds = [b"vault", mint.key().as_ref()],
        bump,
    )]
    pub sol_vault: SystemAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CancelToken>) -> Result<()> {
    let config = &ctx.accounts.token_config;

    // Verify no external trades have occurred.
    // creator_allocation tokens may already be in creator's ATA — that's fine.
    let creator_alloc_tokens = (config.supply_cap as u128)
        .checked_mul(config.creator_allocation as u128)
        .and_then(|v| v.checked_div(100))
        .ok_or(LaunchpadError::Overflow)? as u64;

    require!(
        config.current_supply <= creator_alloc_tokens,
        LaunchpadError::TokenNotActive // reuse: "token is not in a cancellable state"
    );

    let mint_key = ctx.accounts.mint.key();
    let vault_bump = ctx.bumps.sol_vault;
    let vault_seeds: &[&[u8]] = &[b"vault", mint_key.as_ref(), &[vault_bump]];

    // Drain vault → creator (should be 0 lamports if no trades, but handle rent).
    let vault_lamports = ctx.accounts.sol_vault.lamports();
    if vault_lamports > 0 {
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.sol_vault.to_account_info(),
                    to: ctx.accounts.creator.to_account_info(),
                },
                &[vault_seeds],
            ),
            vault_lamports,
        )?;
    }

    let clock = Clock::get()?;
    emit!(TokenCancelled {
        mint: mint_key,
        creator: ctx.accounts.creator.key(),
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "cancel_token: mint={} creator={}",
        mint_key,
        ctx.accounts.creator.key(),
    );

    // token_config is closed by Anchor via `close = creator` constraint.
    Ok(())
}
