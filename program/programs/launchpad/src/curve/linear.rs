/// Linear bonding curve: P(s) = a + b * s / SCALE
///
/// Where:
///   a         = base price in lamports (price at supply = 0)
///   b         = slope: lamports added per SCALE tokens of supply
///   SCALE     = 1_000_000 (avoids floating-point in on-chain math)
///   s         = current supply in token units (6 decimals)
///
/// Buy cost formula (closed-form sum):
///   cost(n, s) = n*a + b*s*n/SCALE + b*n*(n-1)/SCALE/2
///
/// All intermediates use u128 to prevent overflow.
use crate::errors::LaunchpadError;
use anchor_lang::prelude::*;

/// Scaling factor: slopes and rates are stored scaled by 1_000_000.
pub const SCALE: u128 = 1_000_000;

/// Compute the cost in lamports to buy `amount` tokens starting at `current_supply`.
///
/// # Arguments
/// * `a`              - Base price in lamports
/// * `b`              - Slope scaled by SCALE (lamports per SCALE tokens of supply increase)
/// * `current_supply` - Tokens already in circulation
/// * `amount`         - Tokens to buy
///
/// # Returns
/// Total lamport cost (u64)
pub fn buy_cost(a: u64, b: u64, current_supply: u64, amount: u64) -> Result<u64> {
    if amount == 0 {
        return err!(LaunchpadError::ZeroAmount);
    }

    let a = a as u128;
    let b = b as u128;
    let s = current_supply as u128;
    let n = amount as u128;

    // term1 = n * a  (flat base price across all tokens)
    let term1 = n.checked_mul(a).ok_or(LaunchpadError::Overflow)?;

    // term2 = b * s * n / SCALE  (slope contribution from existing supply)
    let term2 = b
        .checked_mul(s)
        .and_then(|v| v.checked_mul(n))
        .and_then(|v| v.checked_div(SCALE))
        .ok_or(LaunchpadError::Overflow)?;

    // term3 = b * n * (n-1) / SCALE / 2  (slope contribution from new supply)
    let term3 = b
        .checked_mul(n)
        .and_then(|v| v.checked_mul(n.saturating_sub(1)))
        .and_then(|v| v.checked_div(SCALE))
        .and_then(|v| v.checked_div(2))
        .ok_or(LaunchpadError::Overflow)?;

    let total = term1
        .checked_add(term2)
        .and_then(|v| v.checked_add(term3))
        .ok_or(LaunchpadError::Overflow)?;

    // Saturate to u64::MAX rather than panic — caller checks adequacy
    Ok(total.min(u64::MAX as u128) as u64)
}

/// Compute the SOL return in lamports for selling `amount` tokens at `current_supply`.
/// Applies a 5% penalty (seller receives 95% of the equivalent buy cost).
pub fn sell_return(a: u64, b: u64, current_supply: u64, amount: u64) -> Result<u64> {
    if amount == 0 {
        return err!(LaunchpadError::ZeroAmount);
    }
    let gross = buy_cost(a, b, current_supply.saturating_sub(amount), amount)?;
    Ok((gross as u128 * 95 / 100) as u64)
}

/// Spot price at a given supply level (for display / preview only).
/// Returns lamports per token.
pub fn price_at(a: u64, b: u64, supply: u64) -> u64 {
    let result = a as u128 + (b as u128 * supply as u128 / SCALE);
    result.min(u64::MAX as u128) as u64
}

// ────────────────────────────────────────────────────────────────────────────
// Unit Tests
// ────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    // a = 1_000_000 lamports (0.001 SOL base price)
    // b = 100        (slope: 0.0000001 SOL per token, scaled 1e6)
    const A: u64 = 1_000_000;
    const B: u64 = 100;

    #[test]
    fn price_at_zero_supply() {
        assert_eq!(price_at(A, B, 0), A);
    }

    #[test]
    fn price_at_supply_increases() {
        let p0 = price_at(A, B, 0);
        let p1 = price_at(A, B, 5_000_000);
        let p2 = price_at(A, B, 10_000_000);
        assert!(p1 > p0, "price should increase with supply");
        assert!(p2 > p1, "price should be monotonically increasing");
    }

    #[test]
    fn buy_cost_zero_supply() {
        // Buying 1 token at supply=0: cost ≈ a (plus negligible slope)
        let cost = buy_cost(A, B, 0, 1).unwrap();
        assert_eq!(cost, A); // n=1, s=0 → term1=A, term2=0, term3=0
    }

    #[test]
    fn buy_cost_non_zero_supply() {
        let cost_from_0 = buy_cost(A, B, 0, 100).unwrap();
        let cost_from_100 = buy_cost(A, B, 100, 100).unwrap();
        // Buying at higher supply should cost more (upward sloping curve)
        assert!(cost_from_100 > cost_from_0, "cost should increase with supply");
    }

    #[test]
    fn sell_return_is_95_percent_of_buy() {
        let buy = buy_cost(A, B, 0, 1_000).unwrap();
        let sell = sell_return(A, B, 1_000, 1_000).unwrap();
        // sell = buy * 95 / 100, allow 1 lamport rounding
        let expected = (buy as u128 * 95 / 100) as u64;
        assert!(
            sell == expected || sell + 1 == expected || sell == expected + 1,
            "sell={sell} expected≈{expected}"
        );
    }

    #[test]
    fn round_trip_never_profitable() {
        // Buy then sell should never return more than deposited
        let amount = 10_000u64;
        let buy_cost_val = buy_cost(A, B, 0, amount).unwrap();
        let sell_ret = sell_return(A, B, amount, amount).unwrap();
        assert!(
            sell_ret <= buy_cost_val,
            "sell return {sell_ret} > buy cost {buy_cost_val} — protocol broken"
        );
    }

    #[test]
    fn overflow_safety_large_inputs() {
        // Should not panic or overflow — return Err on extreme inputs
        let result = buy_cost(u64::MAX / 2, u64::MAX / 2, u64::MAX / 2, u64::MAX / 2);
        // Either Ok (saturated) or Err(Overflow) — must not panic
        let _ = result;
    }
}
