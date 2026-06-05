const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const trades = await prisma.trade.findMany({
    where: { tokenMint: '0xd2ac3c8d2eb8b13c38708a830c9d4120a2885ac8' },
    orderBy: { timestamp: 'desc' },
  });
  console.log(trades);
}
run().finally(() => prisma.$disconnect());
