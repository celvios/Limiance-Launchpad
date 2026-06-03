import { network } from "hardhat";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || value.startsWith("0xreplace")) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

async function main() {
  const { ethers } = await network.create();
  const [deployer] = await ethers.getSigners();
  const treasury = requiredEnv("TREASURY_ADDRESS");
  const paymentAsset = requiredEnv("USDT_ADDRESS");
  const router = requiredEnv("PANCAKE_ROUTER_ADDRESS");
  const wrappedNative = requiredEnv("WBNB_ADDRESS");

  console.log("Deploying LaunchpadFactory with account:", await deployer.getAddress());
  console.log("Treasury:", treasury);
  console.log("Payment asset:", paymentAsset);
  console.log("Router:", router);
  console.log("Wrapped native:", wrappedNative);

  const factory = await ethers.deployContract(
    "LaunchpadFactory",
    [treasury, paymentAsset, router, wrappedNative],
    deployer
  );
  await factory.waitForDeployment();

  console.log("LaunchpadFactory deployed to:", await factory.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
