/// Sigmoid bonding curve — 7-segment piecewise linear approximation.
///
/// True sigmoid: P(s) = P_max / (1 + e^(-k * (s - s0)))
///
/// On-chain: evaluated at 8 breakpoints, connected with linear segments.
/// Breakpoints (as fraction of supply_cap): 0%, 10%, 25%, 45%, 55%, 75%, 90%, 100%
///
/// Parameters:
///   param_a = P_max  — maximum price in lamports (at 100% supply)
///   param_b = k      — steepness, scaled by 1_000_000
///   param_c = s0     — midpoint in token units (50% supply is typical)
///
/// Segment slopes and intercepts are derived at runtime from these 3 params.
/// No persistent segment storage needed — recomputed on each call (O(7)).
use crate::errors::LaunchpadError;
use anchor_lang::prelude::*;

/// Scaling factor for fixed-point arithmetic.
pub const SCALE: u128 = 1_000_000;

/// One segment of the piecewise approximation.
#[derive(Clone, Copy, Debug)]
pub struct Segment {
    /// Token supply at which this segment starts.
    pub supply_start: u64,
    /// Token supply at which this segment ends (exclusive).
    pub supply_end: u64,
    /// Price at supply_start in lamports.
    pub p_start: u64,
    /// Price at supply_end in lamports.
    pub p_end: u64,
}

/// Fractional breakpoints × 1_000 (to avoid floats).
/// 0=0%, 100=10%, 250=25%, 450=45%, 550=55%, 750=75%, 900=90%, 1000=100%
const BP_NUM: [u64; 8] = [0, 100, 250, 450, 550, 750, 900, 1_000];
const BP_DEN: u64 = 1_000;

/// Approximate sigmoid value at a given supply using integer arithmetic.
///
/// We use a rational approximation of 1/(1+e^(-x)):
///   For |x| <= 2.5 : linearly interpolated from known points
///   For x > 2.5    : returns ~1 (≈ P_max)
///   For x < -2.5   : returns ~0
///
/// `x = k * (s - s0)` where k is scaled by SCALE.
fn sigmoid_price(p_max: u64, k_scaled: u64, s0: u64, supply: u64) -> u64 {
    let p = p_max as u128;
    let k = k_scaled as u128;

    // x_num = k * (supply - s0), signed. Work in i128.
    let x_num = (supply as i128 - s0 as i128)
        .saturating_mul(k as i128);
    // x_den = SCALE (since k is scaled by SCALE, and supply/s0 are raw)
    let x_den = SCALE as i128;

    // Clamp to [-6, 6] in SCALE units (beyond this sigmoid is effectively 0 or 1)
    let clamp = 6 * x_den;
    let x_clamped = x_num.clamp(-clamp, clamp);

    // Map x ∈ [-6, 6] to sigmoid output using piecewise linear table.
    // Known sigmoid values at integer x:
    // x: -6    -5    -4    -3    -2    -1     0    1     2     3     4     5     6
    // σ: .0025 .0067 .0180 .0474 .1192 .2689 .500 .7311 .8808 .9526 .9820 .9933 .9975
    //
    // Encoded as (numerator, denominator) pairs × 10_000 for precision:
    const TABLE_X: [i64; 13] = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
    const TABLE_V: [u128; 13] = [25, 67, 180, 474, 1192, 2689, 5000, 7311, 8808, 9526, 9820, 9933, 9975];
    const TABLE_DENOM: u128 = 10_000;

    let x_int = x_clamped / x_den; // integer part
    let x_frac = x_clamped.abs() % x_den; // fractional part (0..SCALE)

    // Find bracketing indices
    let idx = ((x_int + 6).clamp(0, 11)) as usize;
    let v_lo = TABLE_V[idx];
    let v_hi = TABLE_V[(idx + 1).min(12)];

    // Linear interpolation between table entries
    let v = if x_int >= 0 {
        v_lo + (v_hi.saturating_sub(v_lo)) * x_frac.unsigned_abs() as u128 / x_den as u128
    } else {
        v_hi.saturating_sub((v_hi.saturating_sub(v_lo)) * x_frac.unsigned_abs() as u128 / x_den as u128)
    };

    (p * v / TABLE_DENOM).min(u64::MAX as u128) as u64
}

/// Build the 7 piecewise segments for a given supply_cap + curve params.
pub fn build_segments(p_max: u64, k_scaled: u64, s0: u64, supply_cap: u64) -> [Segment; 7] {
    let mut segs = [Segment {
        supply_start: 0,
        supply_end: 0,
        p_start: 0,
        p_end: 0,
    }; 7];

    let mut breakpoints = [0u64; 8];
    for (i, bp) in BP_NUM.iter().enumerate() {
        breakpoints[i] = supply_cap
            .saturating_mul(*bp)
            .saturating_div(BP_DEN);
    }

    for i in 0..7 {
        let bs = breakpoints[i];
        let be = breakpoints[i + 1];
        segs[i] = Segment {
            supply_start: bs,
            supply_end: be,
            p_start: sigmoid_price(p_max, k_scaled, s0, bs),
            p_end: sigmoid_price(p_max, k_scaled, s0, be),
        };
    }

    segs
}

/// Spot price at `supply` by interpolating within the correct segment.
/// Returns lamports per token.
pub fn price_at(p_max: u64, k_scaled: u64, s0: u64, supply: u64, supply_cap: u64) -> u64 {
    let segs = build_segments(p_max, k_scaled, s0, supply_cap);
    price_in_segments(&segs, supply)
}

fn price_in_segments(segs: &[Segment; 7], supply: u64) -> u64 {
    for seg in segs {
        if supply >= seg.supply_start && supply < seg.supply_end {
            let span = seg.supply_end.saturating_sub(seg.supply_start);
            if span == 0 {
                return seg.p_start;
            }
            let delta = supply.saturating_sub(seg.supply_start);
            let p_range = seg.p_end.saturating_sub(seg.p_start);
            // Interpolate: p_start + p_range * delta / span
            return seg.p_start
                + (p_range as u128 * delta as u128 / span as u128) as u64;
        }
    }
    // At or past supply_cap: return p_max
    segs[6].p_end
}

/// Cost in lamports to buy `amount` tokens starting at `current_supply`.
/// Uses trapezoidal integration across segments — exact for piecewise linear.
pub fn buy_cost(
    p_max: u64,
    k_scaled: u64,
    s0: u64,
    supply_cap: u64,
    current_supply: u64,
    amount: u64,
) -> Result<u64> {
    if amount == 0 {
        return err!(LaunchpadError::ZeroAmount);
    }

    let segs = build_segments(p_max, k_scaled, s0, supply_cap);
    let mut total: u128 = 0;
    let mut remaining = amount;
    let mut pos = current_supply;

    for seg in &segs {
        if remaining == 0 {
            break;
        }
        if pos >= seg.supply_end {
            continue;
        }
        if pos < seg.supply_start {
            pos = seg.supply_start;
        }

        let available = seg.supply_end.saturating_sub(pos);
        let to_buy = remaining.min(available);

        let p_start = price_in_segments(&segs, pos) as u128;
        let p_end = price_in_segments(&segs, pos + to_buy) as u128;

        // Trapezoidal: area = to_buy * (p_start + p_end) / 2
        let cost = (to_buy as u128)
            .checked_mul(p_start.checked_add(p_end).ok_or(LaunchpadError::Overflow)?)
            .and_then(|v| v.checked_div(2))
            .ok_or(LaunchpadError::Overflow)?;

        total = total.checked_add(cost).ok_or(LaunchpadError::Overflow)?;
        pos += to_buy;
        remaining -= to_buy;
    }

    Ok(total.min(u64::MAX as u128) as u64)
}

/// SOL return for selling `amount` tokens at `current_supply` (95% factor).
pub fn sell_return(
    p_max: u64,
    k_scaled: u64,
    s0: u64,
    supply_cap: u64,
    current_supply: u64,
    amount: u64,
) -> Result<u64> {
    if amount == 0 {
        return err!(LaunchpadError::ZeroAmount);
    }
    let gross = buy_cost(
        p_max,
        k_scaled,
        s0,
        supply_cap,
        current_supply.saturating_sub(amount),
        amount,
    )?;
    Ok((gross as u128 * 95 / 100) as u64)
}

// ────────────────────────────────────────────────────────────────────────────
// Unit Tests
// ────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    const P_MAX: u64 = 100_000_000; // 0.1 SOL
    const K: u64 = 2_000;           // k = 0.002 (scaled 1e6)
    const S0: u64 = 5_000;          // midpoint at 5000 tokens
    const CAP: u64 = 10_000;        // supply cap = 10k tokens

    #[test]
    fn segments_cover_full_range() {
        let segs = build_segments(P_MAX, K, S0, CAP);
        assert_eq!(segs[0].supply_start, 0);
        assert_eq!(segs[6].supply_end, CAP);
    }

    #[test]
    fn price_monotonically_increasing() {
        let steps = 100;
        let mut prev = 0u64;
        for i in 0..=steps {
            let s = CAP * i / steps;
            let p = price_at(P_MAX, K, S0, s, CAP);
            assert!(p >= prev, "price not monotonic at supply={s}: prev={prev}, cur={p}");
            prev = p;
        }
    }

    #[test]
    fn price_at_zero_supply_near_zero() {
        let p = price_at(P_MAX, K, S0, 0, CAP);
        // Sigmoid at s=0 far below midpoint → price should be small fraction of P_max
        assert!(p < P_MAX / 5, "price at 0 supply should be low: got {p}");
    }

    #[test]
    fn price_at_full_supply_near_pmax() {
        let p = price_at(P_MAX, K, S0, CAP, CAP);
        assert!(p > P_MAX * 4 / 5, "price at full supply should be near P_max: got {p}");
    }

    #[test]
    fn buy_cost_is_positive() {
        let cost = buy_cost(P_MAX, K, S0, CAP, 0, 100).unwrap();
        assert!(cost > 0);
    }

    #[test]
    fn round_trip_never_profitable() {
        let amount = 500u64;
        let buy = buy_cost(P_MAX, K, S0, CAP, 0, amount).unwrap();
        let sell = sell_return(P_MAX, K, S0, CAP, amount, amount).unwrap();
        assert!(sell <= buy);
    }
}
