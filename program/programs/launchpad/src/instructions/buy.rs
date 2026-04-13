use crate::curve::{calc_buy_cost, calc_price_at};
use crate::errors::LaunchpadError;
use crate::state::{PlatformConfig, TokenConfig, TokenStatus};
use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};

/// Emitted after every successful buy.
#[event]
pub struct BuyEvent {
    /// SPL Mint purchased.
    pub mint: Pubkey,
    /// Buyer wallet.
    pub buyer: Pubkey,
    /// Token units purchased (6 decimals).
    pub amount: u64,
    /// Lamports sent to vault (before fee).
    pub sol_cost: u64,
    /// Platform fee in lamports.
    pub fee: u64,
    /// Token supply after this trade.
    pub supply_after: u64,
    /// Spot price (lamports/token) after this trade.
    pub price_after: u64,
    /// Unix timestamp.
    pub timestamp: i64,
}

/// Emitted when a buy crosses the graduation threshold.
/// The graduate instruction is called atomically within the same transaction.
#[event]
pub struct GraduationTriggered {
    pub mint: Pubkey,
    pub timestamp: i64,
}

/// Accounts for the `buy` instruction.
#[derive(Accounts)]
pub struct Buy<'info> {
    /// Buyer wallet — pays SOL, receives tokens.
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// Token configuration PDA. Must be Active and not currently graduating.
    #[account(
        mut,
        seeds = [b"token_config", mint.key().as_ref()],
        bump = token_config.bump,
        constraint = token_config.status == TokenStatus::Active @ LaunchpadError::TokenNotActive,
        constraint = !token_config.graduating @ LaunchpadError::AlreadyGraduating,
    )]
    pub token_config: Account<'info, TokenConfig>,

    /// SPL Mint for this token.
    #[account(
        mut,
        constraint = mint.key() == token_config.mint @ LaunchpadError::Unauthorized,
    )]
    pub mint: Account<'info, Mint>,

    /// SOL vault PDA — receives trade proceeds.
    #[account(
        mut,
        seeds = [b"vault", mint.key().as_ref()],
        bump,
    )]
    pub sol_vault: SystemAccount<'info>,

    /// Buyer's associated token account — receives minted tokens.
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_ata: Account<'info, TokenAccount>,

    /// Platform fee vault — receives the buy fee.
    /// CHECK: validated against platform_config.fee_vault.
    #[account(
        mut,
        constraint = fee_vault.key() == platform_config.fee_vault @ LaunchpadError::Unauthorized,
    )]
    pub fee_vault: SystemAccount<'info>,

    /// Platform configuration — read for fee_basis_points.
    pub platform_config: Account<'info, PlatformConfig>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Buy>, amount: u64, max_sol_cost: u64) -> Result<()> {
    require!(amount > 0, LaunchpadError::ZeroAmount);

    let config = &ctx.accounts.token_config;

    // 1. Supply cap check — must fit without overflow.
    let supply_after = config
        .current_supply
        .checked_add(amount)
        .ok_or(LaunchpadError::Overflow)?;
    require!(supply_after <= config.supply_cap, LaunchpadError::SupplyCap);

    // 2. Compute trade cost via curve dispatch.
    let cost = calc_buy_cost(
        &config.curve_type,
        &config.curve_params,
        config.supply_cap,
        config.current_supply,
        amount,
    )?;

    // 3. Slippage guard.
    require!(cost <= max_sol_cost, LaunchpadError::SlippageExceeded);

    // 4. Platform fee (basis points of cost, not added on top — taken from cost).
    //    fee is paid separately: buyer pays cost + fee total.
    let platform_config = &ctx.accounts.platform_config;
    let fee = (cost as u128)
        .checked_mul(platform_config.fee_basis_points as u128)
        .and_then(|v| v.checked_div(10_000))
        .ok_or(LaunchpadError::Overflow)? as u64;

    // 5. Verify buyer has enough SOL (Anchor handles lamport check on transfer,
    //    but we check explicitly for a cleaner error).
    let total_required = cost.checked_add(fee).ok_or(LaunchpadError::Overflow)?;
    require!(
        ctx.accounts.buyer.lamports() >= total_required,
        LaunchpadError::InsufficientFunds
    );

    // 6. Transfer cost → vault.
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.sol_vault.to_account_info(),
            },
        ),
        cost,
    )?;

    // 7. Transfer fee → fee_vault (only if fee > 0).
    if fee > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.fee_vault.to_account_info(),
                },
            ),
            fee,
        )?;
    }

    // 8. Mint tokens → buyer's ATA. token_config PDA is mint authority.
    let mint_key = ctx.accounts.mint.key();
    let token_config_seeds: &[&[u8]] = &[
        b"token_config",
        mint_key.as_ref(),
        &[ctx.accounts.token_config.bump],
    ];
    let signer_seeds = &[token_config_seeds];

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.buyer_ata.to_account_info(),
                authority: ctx.accounts.token_config.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    // 9. Update supply.
    let config = &mut ctx.accounts.token_config;
    config.current_supply = supply_after;

    // 10. Compute post-trade spot price for event.
    let price_after = calc_price_at(
        &config.curve_type,
        &config.curve_params,
        config.supply_cap,
        config.current_supply,
    );

    let clock = Clock::get()?;

    emit!(BuyEvent {
        mint: ctx.accounts.mint.key(),
        buyer: ctx.accounts.buyer.key(),
        amount,
        sol_cost: cost,
        fee,
        supply_after: config.current_supply,
        price_after,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "buy: mint={} buyer={} amount={} cost={} fee={} supply={}",
        ctx.accounts.mint.key(),
        ctx.accounts.buyer.key(),
        amount,
        cost,
        fee,
        config.current_supply,
    );

    // 11. Graduation trigger.
    if config.current_supply >= config.graduation_threshold {
        config.graduating = true;
        emit!(GraduationTriggered {
            mint: ctx.accounts.mint.key(),
            timestamp: clock.unix_timestamp,
        });
        msg!(
            "graduation_triggered: mint={} supply={} threshold={}",
            ctx.accounts.mint.key(),
            config.current_supply,
            config.graduation_threshold,
        );
        // NOTE: The `graduate` instruction must be called as the next instruction
        // in the same transaction by the client. The `graduating = true` flag
        // prevents any concurrent buys until graduation completes.
    }

    Ok(())
}
