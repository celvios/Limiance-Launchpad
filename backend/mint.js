const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://limiancedb_user:XSV0qslcMSYH7BnpT92xN1wSF5fGBFk4@dpg-d8g517ugvqtc73bkppo0-a.oregon-postgres.render.com/limiancedb',
      },
    },
  });

  // Credit 100,000 USDT to the user's REAL wallet
  const result = await prisma.userBalance.update({
    where: {
      walletAddress_chainId_asset: {
        walletAddress: '0xd366f97bd67301e48ad36caf8773b9c97c4053a3',
        chainId: 56,
        asset: '0x701e59e245b25851d9a8e4c92741aa98eb1e922f',
      },
    },
    data: {
      available: { increment: '100000000000' }, // 100,000 USDT (6 decimals)
    },
  });

  const balanceUSDT = Number(result.available) / 1e6;
  console.log(`Done! Minted 100,000 USDT to 0xd366f97bd67301e48ad36caf8773b9c97c4053a3`);
  console.log(`New balance: ${balanceUSDT.toLocaleString()} USDT`);

  await prisma.$disconnect();
}

main().catch(console.error);
