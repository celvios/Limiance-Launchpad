import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const mint = 'H6P45n3b6a98XvQyF81M14e4kH3QxT7sF25pZ4e1zZ8a'; // Need a mint, let's just get the first one that has trades
  const trade = await prisma.trade.findFirst({
    orderBy: { timestamp: 'desc' },
  });
  if (!trade) return console.log('No trades found');
  
  const mintToTest = trade.tokenMint;
  console.log('Testing mint:', mintToTest);

  const trades = await prisma.trade.findMany({
    where: { tokenMint: mintToTest },
    orderBy: { timestamp: 'asc' },
  });

  console.log(`Found ${trades.length} trades`);
  for (const t of trades.slice(0, 5)) {
    console.log(t.timestamp, t.pricePerToken);
  }
  
  if (trades.length > 0) {
      console.log('Last trade:', trades[trades.length-1].timestamp, trades[trades.length-1].pricePerToken);
  }

  const formatPrice = (p) => Number(p) < 1e10 ? Number(p) / 1e6 : Number(p) / 1e18;
  console.log('Formatted prices:');
  for (const t of trades) {
    console.log(formatPrice(t.pricePerToken));
  }
}
main();
