use crate::curve::{calc_price_at, calc_sell_return};
use crate::errors::LaunchpadError;
use crate::state::{PlatformConfig, TokenConfig, TokenStatus};
use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{burn, Burn, Mint, Token, TokenAccount};

/// Emitted after every successful sell.
#[event]
pub struct SellEvent {
    /// SPL Mint sold.
    pub mint: Pubkey,
    /// Seller wallet.
    pub seller: Pubkey,
    /// Token units burned (6 decimals).
    pub amount: u64,
    /// Lamports returned to seller (after 5% spread).
    pub sol_return: u64,
    /// Token supply after this trade.
    pub supply_after: u64,
    /// Spot price (lamports/token) after this trade.
    pub price_after: u64,
    /// Unix timestamp.
    pub timestamp: i64,
}

/// Accounts for the `sell` instruction.
#[derive(Accounts)]
pub struct Sell<'info> {
    /// Seller wallet — receives SOL, loses tokens.
    #[account(mut)]
    pub seller: Signer<'info>,

    /// Token configuration PDA. Must be Active.
    #[account(
        mut,
        seeds = [b"token_config", mint.key().as_ref()],
        bump = token_config.bump,
        constraint = token_config.status == TokenStatus::Active @ LaunchpadError::TokenNotActive,
        constraint = !token_config.graduating @ LaunchpadError::AlreadyGraduating,
    )]
    pub token_config: Account<'info, TokenConfig>,

    /// SPL Mint for this token — used for burn authority check.
    #[account(
        mut,
        constraint = mint.key() == token_config.mint @ LaunchpadError::Unauthorized,
    )]
    pub mint: Account<'info, Mint>,

    /// SOL vault PDA — signs the SOL transfer back to seller.
    #[account(
        mut,
        seeds = [b"vault", mint.key().as_ref()],
        bump,
    )]
    pub sol_vault: SystemAccount<'info>,

    /// Seller's associated token account — tokens burned from here.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller,
    )]
    pub seller_ata: Account<'info, TokenAccount>,

    /// Platform configuration — read only (no fee on sells; spread is implicit).
    pub platform_config: Account<'info, PlatformConfig>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Sell>, amount: u64, min_sol_return: u64) -> Result<()> {
    require!(amount > 0, LaunchpadError::ZeroAmount);

    let config = &ctx.accounts.token_config;

    // 1. Seller holds enough tokens.
    require!(
        ctx.accounts.seller_ata.amount >= amount,
        LaunchpadError::InsufficientTokens
    );

    // 2. Compute return (95% of equivalent buy cost at current_supply).
    let sol_return = calc_sell_return(
        &config.curve_type,
        &config.curve_params,
        config.supply_cap,
        config.current_supply,
        amount,
    )?;

    // 3. Slippage guard.
    require!(sol_return >= min_sol_return, LaunchpadError::SlippageExceeded);

    // 4. Vault has enough SOL.
    require!(
        ctx.accounts.sol_vault.lamports() >= sol_return,
        LaunchpadError::InsufficientFunds
    );

    // 5. Burn tokens from seller's ATA.
    //    token_config PDA is the mint authority → used as burn authority.
    let mint_key = ctx.accounts.mint.key();
    let token_config_seeds: &[&[u8]] = &[
        b"token_config",
        mint_key.as_ref(),
        &[ctx.accounts.token_config.bump],
    ];
    let tc_signer = &[token_config_seeds];

    burn(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.seller_ata.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
            tc_signer,
        ),
        amount,
    )?;

    // 6. Transfer SOL from vault → seller. Vault PDA signs.
    let vault_seeds: &[&[u8]] = &[
        b"vault",
        mint_key.as_ref(),
        &[ctx.bumps.sol_vault],
    ];
    let vault_signer = &[vault_seeds];

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.key(),
            system_program::Transfer {
                from: ctx.accounts.sol_vault.to_account_info(),
                to: ctx.accounts.seller.to_account_info(),
            },
            vault_signer,
        ),
        sol_return,
    )?;

    // 7. Update supply.
    let config = &mut ctx.accounts.token_config;
    config.current_supply = config
        .current_supply
        .checked_sub(amount)
        .ok_or(LaunchpadError::Overflow)?;

    // 8. Post-trade spot price.
    let price_after = calc_price_at(
        &config.curve_type,
        &config.curve_params,
        config.supply_cap,
        config.current_supply,
    );

    let clock = Clock::get()?;

    emit!(SellEvent {
        mint: ctx.accounts.mint.key(),
        seller: ctx.accounts.seller.key(),
        amount,
        sol_return,
        supply_after: config.current_supply,
        price_after,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "sell: mint={} seller={} amount={} return={} supply={}",
        ctx.accounts.mint.key(),
        ctx.accounts.seller.key(),
        amount,
        sol_return,
        config.current_supply,
    );

    Ok(())
}
