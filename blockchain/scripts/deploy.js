/**
 * Deploy FundoraFunding and write the address to a shared file.
 *
 * Direct usage (Hardhat node already running):
 *   npx hardhat run scripts/deploy.js --network localhost
 *
 * Inside Docker, the deploy service runs this automatically after the
 * Hardhat node is ready. The address is written to:
 *   /shared/deployment.json   (Docker volume)
 * or
 *   ../frontend/src/blockchain/deployment.json  (local fallback)
 *
 * The frontend reads VITE_CONTRACT_ADDRESS from its .env at startup.
 * The backend reads CONTRACT_ADDRESS from the same deployment file.
 */

const fs   = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );

  const Factory  = await ethers.getContractFactory("FundoraFunding");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\nFundoraFunding deployed to:", address);

  // Write deployment info to a shared location so other services can pick it up.
  const info = {
    contractAddress: address,
    deployerAddress: deployer.address,
    chainId: 31337,
    deployedAt: new Date().toISOString(),
  };

  // Primary target: /shared volume (Docker).
  const sharedDir = process.env.SHARED_DIR || "/shared";
  if (fs.existsSync(sharedDir)) {
    const sharedPath = path.join(sharedDir, "deployment.json");
    fs.writeFileSync(sharedPath, JSON.stringify(info, null, 2));
    console.log("Deployment info written to:", sharedPath);
  }

  // Also write next to the ABI for local (non-Docker) use.
  const localPath = path.join(__dirname, "../../frontend/src/blockchain/deployment.json");
  try {
    fs.writeFileSync(localPath, JSON.stringify(info, null, 2));
    console.log("Deployment info also written to:", localPath);
  } catch {
    // Ignore if frontend directory is not accessible (e.g. separate container).
  }

  console.log("\nAdd this to frontend/.env if running locally:");
  console.log(`VITE_CONTRACT_ADDRESS=${address}`);
  console.log(`VITE_DEPLOYER_ADDRESS=${deployer.address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
