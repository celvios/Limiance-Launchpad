const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const t = await prisma.token.findMany({ select: { symbol: true, currentSupply: true } });
  console.log('Tokens:', t);
  const trades = await prisma.trade.findMany({ select: { tokenMint: true, type: true, amount: true } });
  console.log('Trades:', trades);
}
main().finally(() => prisma.$disconnect());
