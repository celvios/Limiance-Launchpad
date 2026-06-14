import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const trades = await prisma.trade.findMany({ take: 5 });
  console.log('Trades:', trades.map(t => ({
    wallet: t.walletAddress,
    amount: t.amount.toString(),
    solAmount: t.solAmount.toString()
  })));
}
run().finally(() => prisma.$disconnect());
