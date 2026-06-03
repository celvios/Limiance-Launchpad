const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Minting with account:", deployer.address);

  const usdtAddress = process.env.USDT_ADDRESS;
  if (!usdtAddress) {
    throw new Error("USDT_ADDRESS not found in .env");
  }

  // We only need the mint function ABI
  const MockUSDT = await hre.ethers.getContractAt(
    [
      "function mint(address to, uint256 amount) external",
      "function decimals() external view returns (uint8)"
    ],
    usdtAddress,
    deployer
  );

  const addressesToMint = [
    "0x42501490f7c291b4B28110900c9Bd81f3B35B849",
    "0xE434423371E3AacAF0fF8fC0B3Ef1F521e82CCC1"
  ];

  const amount = hre.ethers.parseUnits("1000000", 18); // 1 million tokens

  for (const addr of addressesToMint) {
    console.log(`Minting 1,000,000 USDT to ${addr}...`);
    const tx = await MockUSDT.mint(addr, amount);
    await tx.wait();
    console.log(`Successfully minted to ${addr} (Tx: ${tx.hash})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
