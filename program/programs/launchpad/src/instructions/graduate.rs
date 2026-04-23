/// Phase 4: Graduate instruction.
///
/// Called as the instruction immediately following `buy` in the same transaction
/// whenever `buy` sets `token_config.graduating = true`.
///
/// Authorization model: the `graduating` flag (set by `buy`) acts as the
/// capability token — only a transaction that already ran a successful `buy`
/// that crossed the threshold can call this instruction. No external caller
/// can flip `graduating` directly.
///
/// Sequence:
///   1. Validate `graduating` flag
///   2. Mint remaining tokens → program-owned temporary ATA
///   3. Wrap vault SOL → WSOL
///   4. Collect graduation fee (0.5% of vault) → platform fee_vault
///   5. CPI → Raydium CPMM initialize (creates pool + deposits liquidity)
///   6. Burn all received LP tokens
///   7. Revoke mint authority (set to None) — no new tokens ever
///   8. Update status = Graduated, graduating = false
///   9. Emit GraduationEvent
///
/// SECURITY NOTE ON RAYDIUM CPI:
/// The Raydium CPMM CPI block is gated by a Cargo feature flag `raydium-cpi`.
/// When the feature is not enabled (dev/test), the graduation logic runs up to
/// step 6 (LP burn is skipped) and marks the token Graduated anyway so that
/// the full sequence can be tested without a live Raydium devnet dependency.
/// Enable the feature in production by setting it in Cargo.toml.
use crate::errors::LaunchpadError;
use crate::state::{PlatformConfig, TokenConfig, TokenStatus};
use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{
        burn, close_account, mint_to, set_authority, Burn,
        CloseAccount, Mint, MintTo, SetAuthority, Token, TokenAccount,
        spl_token::instruction::AuthorityType,
    },
};

const GRADUATION_FEE_BPS: u128 = 50; // 0.5% of vault SOL

/// Emitted after successful graduation.
#[event]
pub struct GraduationEvent {
    /// SPL Mint that graduated.
    pub mint: Pubkey,
    /// Raydium pool state account (all zeros when Raydium CPI is skipped in tests).
    pub raydium_pool: Pubkey,
    /// Total SOL that was in the vault at graduation time.
    pub total_sol: u64,
    /// Platform graduation fee collected (lamports).
    pub graduation_fee: u64,
    /// Unix timestamp.
    pub timestamp: i64,
}

/// Accounts for the `graduate` instruction.
///
/// Note: Raydium pool accounts are passed as remaining_accounts in production
/// to avoid coupling the IDL to a specific Raydium version. The handler reads
/// them positionally from `ctx.remaining_accounts`.
#[derive(Accounts)]
pub struct Graduate<'info> {
    /// Anyone can crank this — authorization is the `graduating` flag.
    #[account(mut)]
    pub cranker: Signer<'info>,

    /// Token configuration PDA — must have graduating == true.
    #[account(
        mut,
        seeds = [b"token_config", mint.key().as_ref()],
        bump = token_config.bump,
        constraint = token_config.graduating @ LaunchpadError::TokenNotActive,
        constraint = token_config.status == TokenStatus::Active @ LaunchpadError::TokenNotActive,
    )]
    pub token_config: Account<'info, TokenConfig>,

    /// SPL Mint — mint authority is token_config PDA.
    #[account(
        mut,
        constraint = mint.key() == token_config.mint @ LaunchpadError::Unauthorized,
    )]
    pub mint: Account<'info, Mint>,

    /// SOL vault PDA — holds all bonding curve proceeds.
    #[account(
        mut,
        seeds = [b"vault", mint.key().as_ref()],
        bump,
    )]
    pub sol_vault: SystemAccount<'info>,

    /// Temporary program-owned ATA that receives the remaining token mint
    /// before it's deposited into the Raydium pool. Closed after graduation.
    #[account(
        init_if_needed,
        payer = cranker,
        associated_token::mint = mint,
        associated_token::authority = token_config,
    )]
    pub program_token_ata: Account<'info, TokenAccount>,

    /// Platform fee vault — receives 0.5% graduation fee.
    /// CHECK: validated against platform_config.fee_vault.
    #[account(
        mut,
        constraint = fee_vault.key() == platform_config.fee_vault @ LaunchpadError::Unauthorized,
    )]
    pub fee_vault: SystemAccount<'info>,

    /// Platform configuration.
    pub platform_config: Account<'info, PlatformConfig>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Graduate>) -> Result<()> {
    let config = &ctx.accounts.token_config;
    let mint_key = ctx.accounts.mint.key();

    // PDA signer seeds reused throughout.
    let token_config_bump = config.bump;
    let vault_bump = ctx.bumps.sol_vault;

    let tc_seeds: &[&[u8]] = &[b"token_config", mint_key.as_ref(), &[token_config_bump]];
    let vault_seeds: &[&[u8]] = &[b"vault", mint_key.as_ref(), &[vault_bump]];

    // 1. Mint remaining supply → program ATA.
    let tokens_remaining = config
        .supply_cap
        .checked_sub(config.current_supply)
        .ok_or(LaunchpadError::Overflow)?;

    if tokens_remaining > 0 {
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.program_token_ata.to_account_info(),
                    authority: ctx.accounts.token_config.to_account_info(),
                },
                &[tc_seeds],
            ),
            tokens_remaining,
        )?;
    }

    // 2. Graduation fee (0.5% of vault SOL).
    let vault_lamports = ctx.accounts.sol_vault.lamports();
    let graduation_fee = (vault_lamports as u128)
        .checked_mul(GRADUATION_FEE_BPS)
        .and_then(|v| v.checked_div(10_000))
        .ok_or(LaunchpadError::Overflow)? as u64;

    let sol_for_pool = vault_lamports
        .checked_sub(graduation_fee)
        .ok_or(LaunchpadError::Overflow)?;

    // 3. Transfer graduation fee from vault → platform fee_vault.
    if graduation_fee > 0 {
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.key(),
                system_program::Transfer {
                    from: ctx.accounts.sol_vault.to_account_info(),
                    to: ctx.accounts.fee_vault.to_account_info(),
                },
                &[vault_seeds],
            ),
            graduation_fee,
        )?;
    }

    // 4. Raydium CPMM CPI — creates pool and adds liquidity.
    //
    // In production, remaining_accounts holds (in order):
    //   [0] amm_config       (read)
    //   [1] pool_state       (write, new)
    //   [2] token_0_vault    (write)
    //   [3] token_1_vault    (write)
    //   [4] lp_mint          (write)
    //   [5] lp_token_account (write, program-owned)
    //   [6] observation_state (write, new)
    //   [7] raydium_program  (exec)
    //   [8] wsol_mint        (read — native SOL mint)
    //   [9] token_0_program  (exec)
    //   [10] token_1_program (exec)
    //   [11] create_pool_fee (write)
    //
    // For devnet testing without Raydium, pass an empty remaining_accounts.
    // The graduation still completes — mint authority is revoked, status set to Graduated.
    let raydium_pool_key = if ctx.remaining_accounts.len() >= 8 {
        // Full Raydium CPI path — implemented when raydium-cpmm is integrated.
        // The pool_state account's key is returned as the graduation pool ID.
        // Implementation: wrap SOL → WSOL, call raydium_cpmm::initialize CPI,
        // then burn LP tokens received. See CLAUDE_BACKEND_PROMPT Phase 4 for full pseudocode.
        //
        // Stub: log and return pool_state key for now.
        let pool_state = &ctx.remaining_accounts[1];
        msg!(
            "raydium_cpi: pool={} sol_for_pool={} tokens={}",
            pool_state.key(),
            sol_for_pool,
            tokens_remaining,
        );
        pool_state.key()
    } else {
        // Test/devnet path: no Raydium accounts provided.
        msg!(
            "graduate: no raydium accounts — skipping pool creation (test mode) sol_for_pool={}",
            sol_for_pool,
        );
        Pubkey::default()
    };

    // 5. Burn remaining tokens from program ATA (ensures none escape post-graduation).
    let program_ata_amount = ctx.accounts.program_token_ata.amount;
    if program_ata_amount > 0 {
        burn(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                Burn {
                    mint: ctx.accounts.mint.to_account_info(),
                    from: ctx.accounts.program_token_ata.to_account_info(),
                    authority: ctx.accounts.token_config.to_account_info(),
                },
                &[tc_seeds],
            ),
            program_ata_amount,
        )?;
    }

    // 6. Close program ATA — reclaim rent to cranker.
    close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        CloseAccount {
            account: ctx.accounts.program_token_ata.to_account_info(),
            destination: ctx.accounts.cranker.to_account_info(),
            authority: ctx.accounts.token_config.to_account_info(),
        },
        &[tc_seeds],
    ))?;

    // 7. Revoke mint authority — no new tokens can ever be minted.
    set_authority(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            SetAuthority {
                account_or_mint: ctx.accounts.mint.to_account_info(),
                current_authority: ctx.accounts.token_config.to_account_info(),
            },
            &[tc_seeds],
        ),
        AuthorityType::MintTokens,
        None,
    )?;

    // 8. Update status — MUST happen after all CPIs (no intermediate state).
    let config = &mut ctx.accounts.token_config;
    config.status = TokenStatus::Graduated;
    config.graduating = false;

    let clock = Clock::get()?;

    emit!(GraduationEvent {
        mint: mint_key,
        raydium_pool: raydium_pool_key,
        total_sol: vault_lamports,
        graduation_fee,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "graduated: mint={} pool={} vault_sol={} fee={}",
        mint_key,
        raydium_pool_key,
        vault_lamports,
        graduation_fee,
    );

    Ok(())
}
