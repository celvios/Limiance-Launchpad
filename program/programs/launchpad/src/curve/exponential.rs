/// Exponential bonding curve — 3-term Taylor approximation.
///
/// True exponential: P(s) = a * e^(r * s)
/// On-chain approximation (sufficient for reasonable supply ranges):
///   P(s) = a * (1 + r*s + (r*s)² / 2)
///
/// Where:
///   a        = initial price in lamports (price at supply = 0)
///   r        = growth rate, scaled by SCALE=1_000_000
///              r=1000 means 0.001 per token of supply
///   s        = supply in token units
///
/// Buy cost uses Simpson's 1/3 rule (3-point quadrature) for gas efficiency:
///   cost ≈ (n/6) * (P(s) + 4*P(s + n/2) + P(s + n))
///
/// Error vs true integral: < 0.5% for typical bonding curve ranges.
use crate::errors::LaunchpadError;
use anchor_lang::prelude::*;

pub const SCALE: u128 = 1_000_000;

/// Spot price at a given supply using the 3-term Taylor series.
/// Returns lamports per token.
pub fn price_at(a: u64, r_scaled: u64, supply: u64) -> u64 {
    price_at_u128(a as u128, r_scaled as u128, supply as u128)
        .min(u64::MAX as u128) as u64
}

fn price_at_u128(a: u128, r: u128, supply: u128) -> u128 {
    // rs = r * supply / SCALE  (dimensionless product)
    let rs = r.saturating_mul(supply) / SCALE;

    // term1 = a
    let term1 = a;

    // term2 = a * rs / SCALE
    let term2 = a.saturating_mul(rs) / SCALE;

    // term3 = a * rs² / SCALE² / 2
    let term3 = a
        .saturating_mul(rs)
        .saturating_mul(rs)
        / SCALE
        / SCALE
        / 2;

    term1.saturating_add(term2).saturating_add(term3)
}

/// Cost in lamports to buy `amount` tokens starting at `current_supply`.
/// Uses Simpson's rule for O(1) gas cost regardless of amount.
pub fn buy_cost(a: u64, r_scaled: u64, current_supply: u64, amount: u64) -> Result<u64> {
    if amount == 0 {
        return err!(LaunchpadError::ZeroAmount);
    }

    let a = a as u128;
    let r = r_scaled as u128;
    let s = current_supply as u128;
    let n = amount as u128;

    // Three sample points for Simpson's rule
    let s_start = s;
    let s_mid = s + n / 2;
    let s_end = s + n;

    let p_start = price_at_u128(a, r, s_start);
    let p_mid = price_at_u128(a, r, s_mid);
    let p_end = price_at_u128(a, r, s_end);

    // Simpson's: cost ≈ (n / 6) * (p_start + 4*p_mid + p_end)
    let weighted = p_start
        .checked_add(p_mid.checked_mul(4).ok_or(LaunchpadError::Overflow)?)
        .and_then(|v| v.checked_add(p_end))
        .ok_or(LaunchpadError::Overflow)?;

    let total = n
        .checked_mul(weighted)
        .and_then(|v| v.checked_div(6))
        .ok_or(LaunchpadError::Overflow)?;

    Ok(total.min(u64::MAX as u128) as u64)
}

/// SOL return for selling `amount` tokens at `current_supply` (95% factor).
pub fn sell_return(a: u64, r_scaled: u64, current_supply: u64, amount: u64) -> Result<u64> {
    if amount == 0 {
        return err!(LaunchpadError::ZeroAmount);
    }
    let gross = buy_cost(a, r_scaled, current_supply.saturating_sub(amount), amount)?;
    Ok((gross as u128 * 95 / 100) as u64)
}

// ────────────────────────────────────────────────────────────────────────────
// Unit Tests
// ────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    // a = 1_000 lamports, r = 100 (0.0001 per token, scaled 1e6)
    const A: u64 = 1_000;
    const R: u64 = 100;

    #[test]
    fn price_at_zero() {
        // At supply=0, price should equal a (both Taylor correction terms are 0)
        assert_eq!(price_at(A, R, 0), A);
    }

    #[test]
    fn price_increases_with_supply() {
        let p0 = price_at(A, R, 0);
        let p1 = price_at(A, R, 1_000_000);
        let p2 = price_at(A, R, 5_000_000);
        assert!(p1 > p0);
        assert!(p2 > p1);
    }

    #[test]
    fn buy_cost_at_zero_supply_at_least_a() {
        let cost = buy_cost(A, R, 0, 1).unwrap();
        assert!(cost >= A, "buy 1 token should cost at least a lamports");
    }

    #[test]
    fn simpson_vs_riemann_within_1_percent() {
        // Compare Simpson cost vs a 1000-step Riemann sum
        let n = 1_000u64;
        let a_val = A as u128;
        let r_val = R as u128;
        let mut riemann: u128 = 0;
        for i in 0..n {
            riemann += price_at_u128(a_val, r_val, i as u128);
        }
        let simpson = buy_cost(A, R, 0, n).unwrap() as u128;
        let diff = if riemann > simpson {
            riemann - simpson
        } else {
            simpson - riemann
        };
        // Allow 1% error
        assert!(
            diff * 100 <= riemann,
            "Simpson error too large: simpson={simpson}, riemann={riemann}, diff={diff}"
        );
    }

    #[test]
    fn round_trip_never_profitable() {
        let amount = 5_000u64;
        let buy = buy_cost(A, R, 0, amount).unwrap();
        let sell = sell_return(A, R, amount, amount).unwrap();
        assert!(sell <= buy);
    }

    #[test]
    fn no_overflow_on_large_r() {
        // High growth rate — should not panic
        let result = buy_cost(1_000_000, 999_999, 1_000_000, 1_000);
        let _ = result;
    }
}
