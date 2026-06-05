const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // All tokens
  const tokens = await prisma.token.findMany({
    select: {
      mint: true, symbol: true, name: true,
      currentSupply: true, supplyCap: true, graduationThreshold: true,
      curveParamA: true, curveParamB: true, curveParamC: true,
      status: true, createdAt: true,
    }
  });
  console.log('\n=== TOKENS ===');
  for (const t of tokens) {
    const pMax = Number(t.curveParamA) / 1e18;
    const pMin = Number(t.curveParamB) / 1e18;
    const k = Number(t.curveParamC) / 1e6;
    const supply = Number(t.currentSupply);
    const cap = Number(t.supplyCap);
    const gradThreshold = Number(t.graduationThreshold);
    const gradPct = gradThreshold > 0 ? (supply / gradThreshold * 100).toFixed(4) : 0;
    console.log(`${t.symbol} (${t.name})`);
    console.log(`  mint: ${t.mint}`);
    console.log(`  supply: ${supply.toLocaleString()} / ${gradThreshold.toLocaleString()} (${gradPct}% to graduation)`);
    console.log(`  supplyCap: ${cap.toLocaleString()}`);
    console.log(`  pMin: ${pMin}, pMax: ${pMax}, k: ${k}`);
    console.log(`  mktcap formula: pMin*cap = ${(pMin * cap).toFixed(2)}`);
    console.log(`  status: ${t.status}`);
  }

  // All user token balances
  const tokenBals = await prisma.userTokenBalance.findMany();
  console.log('\n=== USER TOKEN BALANCES ===');
  for (const b of tokenBals) {
    const humanAmt = Number(b.amount) / 1e6;
    console.log(`  wallet: ${b.walletAddress}`);
    console.log(`  token:  ${b.tokenAddress}`);
    console.log(`  amount: ${humanAmt.toLocaleString()} tokens (raw: ${b.amount.toString()})`);
  }

  // All trades
  const trades = await prisma.trade.findMany({
    orderBy: { timestamp: 'asc' },
    select: {
      tokenMint: true, type: true, walletAddress: true,
      amount: true, solAmount: true, pricePerToken: true, timestamp: true,
    }
  });
  console.log('\n=== TRADES ===');
  for (const t of trades) {
    const tokens = Number(t.amount) / 1e6;
    const usdt = Number(t.solAmount) / 1e6;
    const rawPrice = Number(t.pricePerToken);
    const price = rawPrice < 1e10 ? rawPrice / 1e6 : rawPrice / 1e18;
    console.log(`  [${t.type.toUpperCase()}] ${tokens.toLocaleString()} tokens for ${usdt.toFixed(4)} USDT @ ${price.toFixed(8)} each`);
    console.log(`    raw pricePerToken: ${t.pricePerToken.toString()} (< 1e10 ? ${rawPrice < 1e10})`);
  }

  // All USDT balances
  const usdtBals = await prisma.userBalance.findMany();
  console.log('\n=== USDT BALANCES ===');
  for (const b of usdtBals) {
    console.log(`  wallet: ${b.walletAddress} | available: ${(Number(b.available) / 1e6).toFixed(4)} USDT`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
