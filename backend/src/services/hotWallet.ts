import { ethers } from 'ethers';
import { prisma } from './prisma';
import { BSC_RPC_URL, TREASURY_ADDRESS } from './bsc';

const CENTRAL_TREASURY_ABI = [
  'function processWithdrawal(address to, uint256 amount) external'
];

export async function runHotWalletWorker() {
  console.log(`[HotWallet] Starting worker on ${BSC_RPC_URL}`);
  const privateKey = process.env.TREASURY_PRIVATE_KEY;

  if (!privateKey) {
    console.warn(`[HotWallet] TREASURY_PRIVATE_KEY not set. Worker will not process withdrawals.`);
    return;
  }

  const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
  const wallet = new ethers.Wallet(privateKey, provider);
  const treasuryContract = new ethers.Contract(TREASURY_ADDRESS, CENTRAL_TREASURY_ABI, wallet);

  setInterval(async () => {
    try {
      // Find pending withdrawals
      const pending = await prisma.withdrawalRequest.findFirst({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
      });

      if (!pending) return;

      // Mark as processing
      await prisma.withdrawalRequest.update({
        where: { id: pending.id },
        data: { status: 'processing' },
      });

      console.log(`[HotWallet] Processing withdrawal ${pending.id} of ${pending.amount} to ${pending.destination}`);

      try {
        const tx = await treasuryContract.processWithdrawal(pending.destination, BigInt(pending.amount));
        console.log(`[HotWallet] Withdrawal Tx Sent: ${tx.hash}`);
        
        await tx.wait(1); // Wait for 1 confirmation
        
        await prisma.withdrawalRequest.update({
          where: { id: pending.id },
          data: { status: 'completed', txHash: tx.hash },
        });

        console.log(`[HotWallet] Withdrawal ${pending.id} completed!`);

      } catch (err: any) {
        console.error(`[HotWallet] Withdrawal failed:`, err);
        // Fallback to pending or failed based on error type
        await prisma.withdrawalRequest.update({
          where: { id: pending.id },
          data: { status: 'failed', error: err.message ?? String(err) },
        });
      }
    } catch (err) {
      console.error(`[HotWallet] Withdrawal loop error:`, err);
    }

    try {
      // Find pending graduations
      const graduatingToken = await prisma.token.findFirst({
        where: { status: 'graduating' },
        orderBy: { updatedAt: 'asc' },
      });

      if (graduatingToken) {
        console.log(`[HotWallet] Graduating token ${graduatingToken.symbol} (${graduatingToken.id})`);
        
        // Use GraduationDeployer contract
        const GRADUATION_DEPLOYER_ADDRESS = process.env.GRADUATION_DEPLOYER_ADDRESS ?? '0x0';
        if (GRADUATION_DEPLOYER_ADDRESS !== '0x0') {
          const deployerAbi = [
            'function deployAndGraduate(string name, string symbol, uint256 totalSupply, uint256 liquidityUsdt) external returns (address)'
          ];
          const deployer = new ethers.Contract(GRADUATION_DEPLOYER_ADDRESS, deployerAbi, wallet);
          
          // Assuming the vault has accumulated ~ $15,000 worth of USDT (15,000,000,000 wei)
          const liquidityUsdt = 15000_000000n; 
          
          try {
            const tx = await deployer.deployAndGraduate(
              graduatingToken.name,
              graduatingToken.symbol,
              graduatingToken.supplyCap,
              liquidityUsdt,
              { gasLimit: 5000000 }
            );
            console.log(`[HotWallet] Graduation Tx Sent: ${tx.hash}`);
            await tx.wait(1);

            // Fetch the TokenGraduated event to get the actual token and dex pool address
            const receipt = await provider.getTransactionReceipt(tx.hash);
            let deployedTokenAddress = graduatingToken.tokenAddress; // fallback
            // In a real implementation we would parse the logs. For MVP, we just mark graduated.
            
            await prisma.token.update({
              where: { id: graduatingToken.id },
              data: { status: 'graduated', dexPoolAddress: deployedTokenAddress },
            });
            console.log(`[HotWallet] Token ${graduatingToken.symbol} fully graduated!`);
          } catch (err: any) {
            console.error(`[HotWallet] Graduation failed:`, err);
          }
        } else {
          console.warn(`[HotWallet] GRADUATION_DEPLOYER_ADDRESS not set! Skipping graduation.`);
        }
      }
    } catch (err) {
      console.error(`[HotWallet] Graduation loop error:`, err);
    }
  }, 10000); // Check every 10 seconds
}
