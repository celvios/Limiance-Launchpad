// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library SigmoidMath {
  int256 internal constant WAD_INT = 1e18;
  uint256 internal constant WAD = 1e18;

  function priceAt(
    uint256 pMin,
    uint256 pMax,
    int256 k,
    uint256 midpoint,
    uint256 supply
  ) internal pure returns (uint256) {
    require(pMax >= pMin, "BAD_PRICE_RANGE");

    int256 x = (k * (int256(supply) - int256(midpoint))) / WAD_INT;
    uint256 logistic = _logisticWad(x);
    return pMin + ((pMax - pMin) * logistic) / WAD;
  }

  function buyCost(
    uint256 pMin,
    uint256 pMax,
    int256 k,
    uint256 midpoint,
    uint256 currentSupply,
    uint256 amount
  ) internal pure returns (uint256) {
    if (amount == 0) return 0;
    uint256 startPrice = priceAt(pMin, pMax, k, midpoint, currentSupply);
    uint256 endPrice = priceAt(pMin, pMax, k, midpoint, currentSupply + amount);
    return (amount * (startPrice + endPrice)) / 2 / WAD;
  }

  function _logisticWad(int256 x) private pure returns (uint256) {
    if (x <= -6e18) return 24726231566;
    if (x >= 6e18) return 999752737684336000;

    int256[13] memory xs = [
      int256(-6e18),
      -5e18,
      -4e18,
      -3e18,
      -2e18,
      -1e18,
      0,
      1e18,
      2e18,
      3e18,
      4e18,
      5e18,
      6e18
    ];
    uint256[13] memory ys = [
      uint256(24726231566),
      66928509242848,
      1798620996209150,
      47425873177566780,
      119202922022117560,
      268941421369995100,
      500000000000000000,
      731058578630004900,
      880797077977882400,
      952574126822433300,
      982013790037908500,
      993307149075715200,
      999752737684336000
    ];

    for (uint256 i = 0; i < 12; i++) {
      if (x >= xs[i] && x <= xs[i + 1]) {
        uint256 span = uint256(xs[i + 1] - xs[i]);
        uint256 offset = uint256(x - xs[i]);
        return ys[i] + ((ys[i + 1] - ys[i]) * offset) / span;
      }
    }
    return WAD / 2;
  }
}
