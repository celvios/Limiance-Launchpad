const { ethers } = require("ethers");

const rpcUrl = "https://bnb-testnet.g.alchemy.com/v2/IlLHtpK6nF1KPiWYQHxb7";
const privateKey = "8535a93559f1f9d75f06d478d5d929f760d7ced3e93282054830c126e1a64654";
const usdtAddress = "0x701e59e245B25851D9a8E4C92741Aa98EB1E922f";
const targetAddress = "0x74e46a5f8ce5205599cc3fef8466afea0c869084";
const abi = ["function mint(address to, uint256 amount) external"];

async function main() {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(usdtAddress, abi, wallet);
  
  console.log("Minting 100 USDT to", targetAddress);
  const amount = ethers.parseUnits("100", 18);
  const tx = await contract.mint(targetAddress, amount);
  console.log("Tx hash:", tx.hash);
  console.log("Waiting for confirmation...");
  await tx.wait();
  console.log("Tokens minted successfully.");
}

main().catch(console.error);
