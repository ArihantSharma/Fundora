/**
 * register_startup.js
 *
 * Called by the FastAPI backend to register a startup on-chain.
 * The deployer (contract owner) signs the transaction — ordinary users
 * cannot call registerStartup() directly because of the onlyOwner modifier.
 *
 * Usage:
 *   node register_startup.js <startupId> <startupName> <founderAddress> <targetWei> <requiredVotes> <milestoneTitlesJSON> <milestoneAmountsJSON>
 *
 * Returns JSON to stdout: { txHash, contractAddress, startupId }
 * Exits with code 1 and prints error JSON on failure.
 *
 * Environment variables:
 *   HARDHAT_RPC_URL   — defaults to http://127.0.0.1:8545
 *   CONTRACT_ADDRESS  — deployed FundoraFunding address
 *   DEPLOYER_KEY      — optional private key; defaults to Hardhat account 0
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  const [
    ,, // node, script
    startupId,
    startupName,
    founderAddress,
    targetWei,
    requiredVotes,
    milestoneTitlesJSON,
    milestoneAmountsJSON,
  ] = process.argv;

  if (!startupId || !startupName || !founderAddress || !targetWei) {
    throw new Error("Usage: node register_startup.js <startupId> <name> <founder> <targetWei> <requiredVotes> <titlesJSON> <amountsJSON>");
  }

  const rpcUrl = process.env.HARDHAT_RPC_URL || "http://127.0.0.1:8545";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  let signer;
  if (process.env.DEPLOYER_KEY) {
    signer = new ethers.Wallet(process.env.DEPLOYER_KEY, provider);
  } else {
    // Default: use Hardhat account 0 (the deployer / contract owner)
    signer = await provider.getSigner(0);
  }

  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("CONTRACT_ADDRESS environment variable is required");
  }

  const abiPath = path.join(__dirname, "FundoraFunding.json");
  const { abi } = JSON.parse(fs.readFileSync(abiPath, "utf8"));
  const contract = new ethers.Contract(contractAddress, abi, signer);

  const milestoneTitles  = JSON.parse(milestoneTitlesJSON  || "[]");
  const milestoneAmounts = JSON.parse(milestoneAmountsJSON || "[]");

  // Verify not already registered
  try {
    await contract.getStartupInfo(BigInt(startupId));
    // If we reach here, it's already registered — return success
    const result = { txHash: null, contractAddress, startupId: Number(startupId), alreadyRegistered: true };
    process.stdout.write(JSON.stringify(result) + "\n");
    return;
  } catch {
    // Not registered yet — proceed
  }

  const tx = await contract.registerStartup(
    BigInt(startupId),
    startupName,
    founderAddress,
    BigInt(targetWei),
    BigInt(requiredVotes || "2"),
    milestoneTitles,
    milestoneAmounts.map(BigInt),
  );
  const receipt = await tx.wait(1);

  const result = {
    txHash: receipt.hash,
    contractAddress,
    startupId: Number(startupId),
    blockNumber: receipt.blockNumber,
  };
  process.stdout.write(JSON.stringify(result) + "\n");
}

main().catch((err) => {
  process.stderr.write(JSON.stringify({ error: err.message }) + "\n");
  process.exitCode = 1;
});
