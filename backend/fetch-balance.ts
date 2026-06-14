import { PrismaClient } from '@prisma/client';

const DATABASE_URL = "postgresql://limiancedb_user:XSV0qslcMSYH7BnpT92xN1wSF5fGBFk4@dpg-d8g517ugvqtc73bkppo0-a.oregon-postgres.render.com/limiancedb";

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

async function run() {
  const email = 'toluking001@gmail.com';
  const user = await prisma.user.findFirst({
    where: { email },
    include: { wallets: true, depositAddresses: true }
  });

  if (!user) return console.log("User not found");
  const targetWallet = user.smartAccountAddress || user.primaryWalletAddress || user.embeddedSignerAddress;
  console.log(`Target wallet: ${targetWallet}`);

  // Fetch all deposit records for this user
  const deposits = await prisma.deposit.findMany({
    where: { userWallet: { equals: targetWallet!, mode: 'insensitive' } }
  });

  console.log(`Found ${deposits.length} raw deposit records.`);

  // Sum by chain and asset
  const balances: Record<string, bigint> = {};
  
  for (const d of deposits) {
    if (!d.credited) continue;
    const key = `${d.chainId}_${d.asset}`;
    balances[key] = (balances[key] || 0n) + d.amount;
    console.log(`- Deposit Tx: ${d.txHash} | Amount: ${d.amount.toString()}`);
  }

  // Also we need to check if they made any trades that consumed balances
  const userBalances = await prisma.userBalance.findMany({
    where: { walletAddress: { equals: targetWallet!, mode: 'insensitive' } }
  });

  for (const ub of userBalances) {
    const key = `${ub.chainId}_${ub.asset}`;
    const totalDeposited = balances[key] || 0n;
    const consumed = ub.consumed;
    
    // The correct available balance should be totalDeposited - consumed
    // Wait, let's also account for withdrawals if we have them. 
    // Limiance doesn't seem to have a Withdrawal table, it just uses `consumed`.
    const correctAvailable = totalDeposited - consumed;
    
    console.log(`\nRe-syncing ${ub.asset} on chain ${ub.chainId}:`);
    console.log(`Total Deposited: ${totalDeposited.toString()}`);
    console.log(`Total Consumed : ${consumed.toString()}`);
    console.log(`New Available  : ${correctAvailable.toString()}`);

    // Update DB
    await prisma.userBalance.update({
      where: { id: ub.id },
      data: { available: correctAvailable < 0n ? 0n : correctAvailable }
    });
  }

  console.log("\nDone!");
}

run().catch(console.error).finally(() => prisma.$disconnect());
