import { network } from "hardhat";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || value.startsWith("0xreplace")) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

async function main() {
  const { ethers } = await network.create();
  const [deployer] = await ethers.getSigners();

  const paymentAsset = requiredEnv("USDT_ADDRESS");
  const router      = requiredEnv("PANCAKE_ROUTER_ADDRESS");
  const wbnb        = requiredEnv("WBNB_ADDRESS");

  console.log("Deploying with account:", await deployer.getAddress());
  const balance = await ethers.provider.getBalance(await deployer.getAddress());
  console.log("Account balance (BNB):", ethers.formatEther(balance));

  // 1. Deploy CentralTreasury
  console.log("\n[1/2] Deploying CentralTreasury...");
  const treasury = await ethers.deployContract("CentralTreasury", [paymentAsset], deployer);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("CentralTreasury deployed to:", treasuryAddress);

  // 2. Deploy GraduationDeployer
  console.log("\n[2/2] Deploying GraduationDeployer...");
  const graduationDeployer = await ethers.deployContract(
    "GraduationDeployer",
    [paymentAsset, router, wbnb],
    deployer
  );
  await graduationDeployer.waitForDeployment();
  const graduationDeployerAddress = await graduationDeployer.getAddress();
  console.log("GraduationDeployer deployed to:", graduationDeployerAddress);

  // 3. Print summary
  console.log("\n✅ Deployment Complete!");
  console.log("==================================================");
  console.log("Add these to your backend .env:");
  console.log(`TREASURY_ADDRESS=${treasuryAddress}`);
  console.log(`GRADUATION_DEPLOYER_ADDRESS=${graduationDeployerAddress}`);
  console.log("==================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
