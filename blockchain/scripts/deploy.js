// Deploy FundoraFunding to the local Hardhat node.
//
// Usage (with node already running in another terminal via `npx hardhat node`):
//   npx hardhat run scripts/deploy.js --network localhost
//
// The script prints the deployed contract address. Copy it into
// frontend/.env as VITE_CONTRACT_ADDRESS.

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const Factory = await ethers.getContractFactory("FundoraFunding");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\nFundoraFunding deployed to:", address);
  console.log("\nAdd this to frontend/.env:");
  console.log(`VITE_CONTRACT_ADDRESS=${address}`);
  console.log(`VITE_DEPLOYER_ADDRESS=${deployer.address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
