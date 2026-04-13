use crate::curve::validate_curve_params;
use crate::errors::LaunchpadError;
use crate::state::{CurveParams, CurveType, PlatformConfig, TokenConfig, TokenStatus};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3,
        Metadata,
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};

/// Parameters for token creation.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeTokenParams {
    /// Token name (max 32 bytes).
    pub name: String,
    /// Token symbol (max 10 bytes).
    pub symbol: String,
    /// Metaplex metadata URI — IPFS or Arweave (max 200 bytes).
    pub uri: String,
    /// Total supply cap in token units (6 decimals). Min 1_000.
    pub supply_cap: u64,
    /// Bonding curve type.
    pub curve_type: CurveType,
    /// Curve shape parameters.
    pub curve_params: CurveParams,
    /// Supply level that triggers Raydium graduation. Must be < supply_cap.
    pub graduation_threshold: u64,
    /// Percentage of supply_cap pre-minted to creator (0–10).
    pub creator_allocation: u8,
}

/// Accounts required for `initialize_token`.
#[derive(Accounts)]
#[instruction(params: InitializeTokenParams)]
pub struct InitializeToken<'info> {
    /// Token creator — pays all rent, receives creator allocation.
    #[account(mut)]
    pub creator: Signer<'info>,

    /// SPL Mint for the new token. 6 decimals.
    /// PDA seeds: `["mint", creator, symbol]` — ensures symbol uniqueness per creator.
    #[account(
        init,
        payer = creator,
        mint::decimals = 6,
        mint::authority = token_config,
        seeds = [b"mint", creator.key().as_ref(), params.symbol.as_bytes()],
        bump
    )]
    pub mint: Account<'info, Mint>,

    /// Per-token configuration PDA.
    /// PDA seeds: `["token_config", mint]`
    #[account(
        init,
        payer = creator,
        space = 8 + TokenConfig::SPACE,
        seeds = [b"token_config", mint.key().as_ref()],
        bump
    )]
    pub token_config: Account<'info, TokenConfig>,

    /// SOL vault — holds bonding curve proceeds.
    /// PDA seeds: `["vault", mint]`
    /// Space = 0: this is just a system account PDA used as a SOL holder.
    #[account(
        init,
        payer = creator,
        space = 0,
        seeds = [b"vault", mint.key().as_ref()],
        bump
    )]
    pub sol_vault: SystemAccount<'info>,

    /// Creator's associated token account — receives creator_allocation tokens.
    #[account(
        init_if_needed,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = creator,
    )]
    pub creator_ata: Account<'info, TokenAccount>,

    /// Metaplex metadata account for this mint.
    ///
    /// CHECK: Address and ownership are validated by the Metaplex program during CPI.
    #[account(mut)]
    pub metadata_account: UncheckedAccount<'info>,

    /// Platform configuration — read to verify platform is initialized.
    pub platform_config: Account<'info, PlatformConfig>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// Metaplex Token Metadata program.
    pub token_metadata_program: Program<'info, Metadata>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

/// On-chain event emitted after successful token creation.
#[event]
pub struct TokenCreated {
    /// The SPL Mint address.
    pub mint: Pubkey,
    /// Wallet that created this token.
    pub creator: Pubkey,
    /// Trading symbol.
    pub symbol: String,
    /// 0=Linear, 1=Exponential, 2=Sigmoid
    pub curve_type: u8,
    /// Total supply cap.
    pub supply_cap: u64,
    /// Supply level at which graduation triggers.
    pub graduation_threshold: u64,
    /// Unix timestamp.
    pub timestamp: i64,
}

pub fn handler(ctx: Context<InitializeToken>, params: InitializeTokenParams) -> Result<()> {
    // ── Validation ───────────────────────────────────────────────────────────
    require!(params.name.len() <= 32, LaunchpadError::NameTooLong);
    require!(params.symbol.len() <= 10, LaunchpadError::SymbolTooLong);
    require!(params.uri.len() <= 200, LaunchpadError::UriTooLong);
    require!(params.supply_cap >= 1_000, LaunchpadError::SupplyCapTooSmall);
    require!(
        params.graduation_threshold < params.supply_cap,
        LaunchpadError::InvalidThreshold
    );
    require!(
        params.creator_allocation <= 10,
        LaunchpadError::CreatorAllocationTooHigh
    );

    // Validate curve params (non-zero, internally consistent)
    validate_curve_params(&params.curve_type, &params.curve_params, params.supply_cap)?;

    // ── Metaplex Metadata CPI ────────────────────────────────────────────────
    // token_config is the mint authority — use its PDA seeds as signer
    let mint_key = ctx.accounts.mint.key();
    let token_config_seeds: &[&[u8]] = &[
        b"token_config",
        mint_key.as_ref(),
        &[ctx.bumps.token_config],
    ];
    let signer_seeds = &[token_config_seeds];

    create_metadata_accounts_v3(
        CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                mint_authority: ctx.accounts.token_config.to_account_info(),
                payer: ctx.accounts.creator.to_account_info(),
                update_authority: ctx.accounts.token_config.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            signer_seeds,
        ),
        DataV2 {
            name: params.name.clone(),
            symbol: params.symbol.clone(),
            uri: params.uri.clone(),
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        },
        true,  // is_mutable — creator can update metadata URI later
        true,  // update_authority_is_signer
        None,  // collection_details
    )?;

    // ── Creator Allocation ───────────────────────────────────────────────────
    let creator_tokens: u64 = if params.creator_allocation > 0 {
        // Safe: allocation is 0–10, supply_cap is u64 — product fits u128
        let alloc = (params.supply_cap as u128)
            .checked_mul(params.creator_allocation as u128)
            .and_then(|v| v.checked_div(100))
            .ok_or(LaunchpadError::Overflow)? as u64;

        // Mint creator allocation to creator's ATA
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.creator_ata.to_account_info(),
                    authority: ctx.accounts.token_config.to_account_info(),
                },
                signer_seeds,
            ),
            alloc,
        )?;

        alloc
    } else {
        0
    };

    // ── Populate TokenConfig ─────────────────────────────────────────────────
    let config = &mut ctx.accounts.token_config;
    let clock = Clock::get()?;

    config.creator = ctx.accounts.creator.key();
    config.mint = ctx.accounts.mint.key();
    config.name = params.name.clone();
    config.symbol = params.symbol.clone();
    config.uri = params.uri.clone();
    config.supply_cap = params.supply_cap;
    config.current_supply = creator_tokens;
    config.curve_type = params.curve_type.clone();
    config.curve_params = params.curve_params;
    config.graduation_threshold = params.graduation_threshold;
    config.sol_vault = ctx.accounts.sol_vault.key();
    config.status = TokenStatus::Active;
    config.creator_allocation = params.creator_allocation;
    config.created_at = clock.unix_timestamp;
    config.graduating = false;
    config.bump = ctx.bumps.token_config;

    // ── Emit Event ───────────────────────────────────────────────────────────
    let curve_type_u8 = match &config.curve_type {
        CurveType::Linear => 0u8,
        CurveType::Exponential => 1u8,
        CurveType::Sigmoid => 2u8,
    };

    emit!(TokenCreated {
        mint: config.mint,
        creator: config.creator,
        symbol: config.symbol.clone(),
        curve_type: curve_type_u8,
        supply_cap: config.supply_cap,
        graduation_threshold: config.graduation_threshold,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Token created: {} ({}) mint={} supply_cap={} creator_alloc={}",
        params.name,
        params.symbol,
        ctx.accounts.mint.key(),
        params.supply_cap,
        creator_tokens,
    );

    Ok(())
}
