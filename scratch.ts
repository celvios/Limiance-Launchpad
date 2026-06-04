import { onChainBuyCost } from './src/lib/curve/math';

const cap = 1_000_000_000n;
const target = 15000;

for (let pMax = 0.00001; pMax <= 0.00005; pMax += 0.000001) {
  const onChain = {
    pMin: BigInt(Math.round(0.00001 * 1e18)),
    paramA: BigInt(Math.round(pMax * 1e18)),
    paramB: BigInt(Math.round(0.002 * 1e6)),
    paramC: BigInt(500000000), // midpoint = 500M
  };
  const costWei = onChainBuyCost('sigmoid', onChain, cap, 0n, 800_000_000n);
  console.log(`pMax=${pMax.toFixed(6)} => Cost: ${Number(costWei) / 1e18} USDT`);
}

