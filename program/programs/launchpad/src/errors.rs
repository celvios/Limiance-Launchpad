use anchor_lang::prelude::*;

/// All custom error codes for the launchpad program.
/// Error codes start at 6000 (Anchor convention).
#[error_code]
pub enum LaunchpadError {
    /// Token must be in Active status to trade.
    #[msg("Token is not active")]
    TokenNotActive,

    /// Buying this amount would exceed the supply cap.
    #[msg("Supply cap exceeded")]
    SupplyCap,

    /// Buyer does not have enough SOL to cover the cost + fee.
    #[msg("Insufficient SOL balance")]
    InsufficientFunds,

    /// Seller does not hold enough tokens to sell.
    #[msg("Insufficient token balance")]
    InsufficientTokens,

    /// A graduation is already in progress — concurrent graduation guard.
    #[msg("Token is already graduating")]
    AlreadyGraduating,

    /// The actual cost exceeded the buyer's max_sol_cost (slippage protection).
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,

    /// Amount parameter must be > 0.
    #[msg("Amount must be greater than zero")]
    ZeroAmount,

    /// One or more curve parameters are invalid (zero, out of range).
    #[msg("Invalid curve parameters")]
    InvalidCurveParams,

    /// Creator allocation percentage exceeds the 10% maximum.
    #[msg("Creator allocation exceeds maximum (10%)")]
    CreatorAllocationTooHigh,

    /// Token symbol exceeds 10-character limit.
    #[msg("Symbol too long (max 10 chars)")]
    SymbolTooLong,

    /// Token name exceeds 32-character limit.
    #[msg("Name too long (max 32 chars)")]
    NameTooLong,

    /// Graduation threshold must be strictly less than supply_cap.
    #[msg("Graduation threshold must be less than supply cap")]
    InvalidThreshold,

    /// An intermediate u128 calculation overflowed.
    #[msg("Arithmetic overflow")]
    Overflow,

    /// Signer is not the expected authority for this operation.
    #[msg("Unauthorized")]
    Unauthorized,

    /// Metadata URI exceeds 200-character limit.
    #[msg("URI too long (max 200 chars)")]
    UriTooLong,

    /// Supply cap must be at least 1000 tokens.
    #[msg("Supply cap too small (min 1000)")]
    SupplyCapTooSmall,

    /// Platform fee basis points exceed the 500 bps (5%) maximum.
    #[msg("Fee too high (max 500 bps)")]
    FeeTooHigh,
}
