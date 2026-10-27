/**
 * contract.js — all MetaMask and contract helpers in one place.
 *
 * Import what you need:
 *   import { connectWallet, getContract, fundStartupOnChain, ... } from "../blockchain/contract";
 *
 * Contract address comes from the .env file (VITE_CONTRACT_ADDRESS).
 * If you haven't deployed yet, set it after running:
 *   cd blockchain && npx hardhat run scripts/deploy.js --network localhost
 */

import { BrowserProvider, Contract, parseEther, formatEther } from "ethers";
import ABI from "./FundoraFunding.json";

// ── Config ────────────────────────────────────────────────────────────────

// Set VITE_CONTRACT_ADDRESS in frontend/.env after deploying.
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";

// Hardhat local network: Chain ID 31337, RPC http://127.0.0.1:8545
export const HARDHAT_CHAIN_ID = "0x7A69"; // 31337 in hex

// ── MetaMask helpers ──────────────────────────────────────────────────────

/**
 * Ask MetaMask to connect and return { provider, signer, address, balance }.
 * Throws a user-readable string on every known failure so the UI can display it.
 */
export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed. Please install it from metamask.io.");
  }

  // Ask the user to connect their wallet.
  let accounts;
  try {
    accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  } catch (err) {
    if (err.code === 4001) {
      throw new Error("You rejected the wallet connection request.");
    }
    throw new Error("Could not connect to MetaMask: " + err.message);
  }

  const provider = new BrowserProvider(window.ethereum);

  // Check that MetaMask is on the local Hardhat network.
  const network = await provider.getNetwork();
  if (network.chainId !== 31337n) {
    throw new Error(
      `Wrong network. Please switch MetaMask to the Hardhat local network.\n` +
      `Expected Chain ID: 31337 — you are on: ${network.chainId}`
    );
  }

  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const balanceWei = await provider.getBalance(address);
  const balance = parseFloat(formatEther(balanceWei)).toFixed(4);

  return { provider, signer, address, balance };
}

/**
 * Return a read-only contract instance (no signer needed).
 */
export function getReadContract(provider) {
  return new Contract(CONTRACT_ADDRESS, ABI.abi, provider);
}

/**
 * Return a write-enabled contract instance connected to the given signer.
 */
export function getWriteContract(signer) {
  return new Contract(CONTRACT_ADDRESS, ABI.abi, signer);
}

// ── On-chain actions ──────────────────────────────────────────────────────

/**
 * Investor sends ETH to fund a startup.
 * startupId   — the backend integer ID (same as the contract's startupId)
 * amountEth   — a string like "0.5" (ETH, not wei)
 * signer      — from connectWallet()
 *
 * Returns the confirmed transaction receipt.
 * Throws if the user rejects, the network is wrong, or the tx reverts.
 */
export async function fundStartupOnChain(startupId, amountEth, signer) {
  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract not deployed yet. Set VITE_CONTRACT_ADDRESS in frontend/.env");
  }
  const contract = getWriteContract(signer);
  let tx;
  try {
    tx = await contract.fundStartup(startupId, { value: parseEther(String(amountEth)) });
  } catch (err) {
    // User rejected in MetaMask wallet
    if (err.code === 4001 || err.code === "ACTION_REJECTED") {
      throw new Error("Transaction rejected in MetaMask.");
    }
    // Contract revert with a reason string
    const reason = err.reason || err.message || "Transaction failed";
    throw new Error(reason);
  }

  // Wait for 1 block confirmation before telling the user it succeeded.
  const receipt = await tx.wait(1);
  return receipt;
}

/**
 * DAO member casts a YES vote on a milestone.
 * milestoneIndex — 0-based index in the contract (stored in milestone.milestoneIndex)
 */
export async function approveMilestoneOnChain(startupId, milestoneIndex, signer) {
  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract not deployed yet. Set VITE_CONTRACT_ADDRESS in frontend/.env");
  }
  const contract = getWriteContract(signer);
  let tx;
  try {
    tx = await contract.approveMilestone(startupId, milestoneIndex);
  } catch (err) {
    if (err.code === 4001 || err.code === "ACTION_REJECTED") {
      throw new Error("Transaction rejected in MetaMask.");
    }
    throw new Error(err.reason || err.message || "Vote failed");
  }
  const receipt = await tx.wait(1);
  return receipt;
}

/**
 * Owner releases a milestone tranche to the founder.
 * Only callable when enough votes have been cast on-chain.
 */
export async function releaseMilestoneOnChain(startupId, milestoneIndex, signer) {
  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract not deployed yet. Set VITE_CONTRACT_ADDRESS in frontend/.env");
  }
  const contract = getWriteContract(signer);
  let tx;
  try {
    tx = await contract.releaseMilestone(startupId, milestoneIndex);
  } catch (err) {
    if (err.code === 4001 || err.code === "ACTION_REJECTED") {
      throw new Error("Transaction rejected in MetaMask.");
    }
    throw new Error(err.reason || err.message || "Release failed");
  }
  const receipt = await tx.wait(1);
  return receipt;
}

// ── Read helpers ──────────────────────────────────────────────────────────

export async function getStartupOnChainInfo(startupId, provider) {
  if (!CONTRACT_ADDRESS) return null;
  try {
    const contract = getReadContract(provider);
    const info = await contract.getStartupInfo(startupId);
    return {
      name: info[0],
      founder: info[1],
      target: formatEther(info[2]),
      raised: formatEther(info[3]),
      requiredVotes: Number(info[4]),
      milestoneCount: Number(info[5]),
    };
  } catch {
    return null; // startup not registered on-chain yet
  }
}

export async function getMilestoneOnChainInfo(startupId, milestoneIndex, provider) {
  if (!CONTRACT_ADDRESS) return null;
  try {
    const contract = getReadContract(provider);
    const info = await contract.getMilestoneInfo(startupId, milestoneIndex);
    return {
      title: info[0],
      amount: formatEther(info[1]),
      yesVotes: Number(info[2]),
      released: info[3],
    };
  } catch {
    return null;
  }
}

/** Shorten an address or tx hash for display: 0x1234...abcd */
export function shortHash(hash) {
  if (!hash || hash.length < 12) return hash;
  return hash.slice(0, 6) + "..." + hash.slice(-4);
}
