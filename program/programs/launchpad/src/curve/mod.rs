pub mod exponential;
pub mod linear;
pub mod sigmoid;

use crate::errors::LaunchpadError;
use crate::state::{CurveParams, CurveType};
use anchor_lang::prelude::*;

/// Dispatch buy cost calculation to the correct curve implementation.
pub fn calc_buy_cost(
    curve_type: &CurveType,
    params: &CurveParams,
    supply_cap: u64,
    current_supply: u64,
    amount: u64,
) -> Result<u64> {
    match curve_type {
        CurveType::Linear => linear::buy_cost(params.param_a, params.param_b, current_supply, amount),
        CurveType::Exponential => {
            exponential::buy_cost(params.param_a, params.param_b, current_supply, amount)
        }
        CurveType::Sigmoid => sigmoid::buy_cost(
            params.param_a,
            params.param_b,
            params.param_c,
            supply_cap,
            current_supply,
            amount,
        ),
    }
}

/// Dispatch sell return calculation to the correct curve implementation.
pub fn calc_sell_return(
    curve_type: &CurveType,
    params: &CurveParams,
    supply_cap: u64,
    current_supply: u64,
    amount: u64,
) -> Result<u64> {
    match curve_type {
        CurveType::Linear => linear::sell_return(params.param_a, params.param_b, current_supply, amount),
        CurveType::Exponential => {
            exponential::sell_return(params.param_a, params.param_b, current_supply, amount)
        }
        CurveType::Sigmoid => sigmoid::sell_return(
            params.param_a,
            params.param_b,
            params.param_c,
            supply_cap,
            current_supply,
            amount,
        ),
    }
}

/// Spot price at current supply (for on-chain price reference in events).
pub fn calc_price_at(
    curve_type: &CurveType,
    params: &CurveParams,
    supply_cap: u64,
    supply: u64,
) -> u64 {
    match curve_type {
        CurveType::Linear => linear::price_at(params.param_a, params.param_b, supply),
        CurveType::Exponential => exponential::price_at(params.param_a, params.param_b, supply),
        CurveType::Sigmoid => {
            sigmoid::price_at(params.param_a, params.param_b, params.param_c, supply, supply_cap)
        }
    }
}

/// Validate that curve params are internally consistent and non-degenerate.
pub fn validate_curve_params(curve_type: &CurveType, params: &CurveParams, supply_cap: u64) -> Result<()> {
    require!(params.param_a > 0, LaunchpadError::InvalidCurveParams);
    require!(params.param_b > 0, LaunchpadError::InvalidCurveParams);

    match curve_type {
        CurveType::Sigmoid => {
            // s0 must be inside the supply range
            require!(params.param_c > 0, LaunchpadError::InvalidCurveParams);
            require!(params.param_c < supply_cap, LaunchpadError::InvalidCurveParams);
        }
        _ => {}
    }

    Ok(())
}
