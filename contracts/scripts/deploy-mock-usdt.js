import { network } from "hardhat";

async function main() {
  const { ethers } = await network.create();
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", await deployer.getAddress());

  const usdt = await ethers.deployContract("MockUSDT", [], deployer);
  await usdt.waitForDeployment();

  console.log("MockUSDT deployed to:", await usdt.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
