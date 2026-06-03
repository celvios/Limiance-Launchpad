import { network } from "hardhat";

async function main() {
  const { ethers } = await network.create();
  const [deployer] = await ethers.getSigners();
  console.log("Minting with account:", await deployer.getAddress());

  const usdtAddress = process.env.USDT_ADDRESS;
  if (!usdtAddress) {
    throw new Error("USDT_ADDRESS not found in .env");
  }

  const MockUSDT = await ethers.getContractAt(
    [
      "function mint(address to, uint256 amount) external",
    ],
    usdtAddress,
    deployer
  );

  const addressesToMint = [
    "0x42501490f7c291b4B28110900c9Bd81f3B35B849",
    "0xE434423371E3AacAF0fF8fC0B3Ef1F521e82CCC1"
  ];

  const amount = ethers.parseUnits("1000000", 18); // 1 million USDT (18 decimals)

  for (const addr of addressesToMint) {
    console.log(`Minting 1,000,000 USDT to ${addr}...`);
    const tx = await MockUSDT.mint(addr, amount);
    await tx.wait();
    console.log(`✅ Minted to ${addr} (Tx: ${tx.hash})`);
  }

  console.log("Done!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
