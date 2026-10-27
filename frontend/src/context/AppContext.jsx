import { createContext, useContext, useState, useEffect } from "react";
import {
  connectWallet,
  fundStartupOnChain,
  approveMilestoneOnChain,
  releaseMilestoneOnChain,
} from "../blockchain/contract";

const API = "http://localhost:8000";
const AppContext = createContext(null);

export function AppProvider({ children }) {
  // ── Role switcher (no real auth) ─────────────────────────────────
  const [role, setRole] = useState("Founder");

  // ── Wallet state ─────────────────────────────────────────────────
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress]     = useState("");
  const [walletBalance, setWalletBalance]     = useState("0.0000");
  const [walletSigner,  setWalletSigner]      = useState(null);
  const [walletError,   setWalletError]       = useState("");

  // ── Off-chain data from FastAPI ──────────────────────────────────
  const [startups,   setStartups]   = useState([]);
  const [milestones, setMilestones] = useState({}); // { startupId: [...] }
  const [proposals,  setProposals]  = useState([]);
  const [loading,    setLoading]    = useState(true);

  // Load everything from the backend on first render.
  useEffect(() => {
    async function loadAll() {
      try {
        const [sRes, mRes, pRes] = await Promise.all([
          fetch(`${API}/api/startups`),
          fetch(`${API}/api/milestones`),
          fetch(`${API}/api/proposals`),
        ]);
        const startupsData   = await sRes.json();
        const milestonesData = await mRes.json();
        const proposalsData  = await pRes.json();

        setStartups(startupsData);
        // Group milestones by startupId so pages can do milestones[id]
        const grouped = {};
        for (const m of milestonesData) {
          if (!grouped[m.startupId]) grouped[m.startupId] = [];
          grouped[m.startupId].push(m);
        }
        setMilestones(grouped);
        setProposals(proposalsData);
      } catch (err) {
        console.error("Could not reach backend:", err.message);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  // Listen for MetaMask account / chain changes and update state.
  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        // User disconnected from MetaMask
        setWalletConnected(false);
        setWalletAddress("");
        setWalletBalance("0.0000");
        setWalletSigner(null);
      }
    };
    const handleChainChanged = () => window.location.reload();
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged",    handleChainChanged);
    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged",    handleChainChanged);
    };
  }, []);

  // ── Wallet actions ───────────────────────────────────────────────

  async function connectMetaMask() {
    setWalletError("");
    try {
      const { signer, address, balance } = await connectWallet();
      setWalletSigner(signer);
      setWalletAddress(address);
      setWalletBalance(balance);
      setWalletConnected(true);
    } catch (err) {
      setWalletError(err.message);
    }
  }

  function disconnectWallet() {
    setWalletConnected(false);
    setWalletAddress("");
    setWalletBalance("0.0000");
    setWalletSigner(null);
    setWalletError("");
  }

  // ── Off-chain startup actions ────────────────────────────────────

  async function addStartup(startup) {
    const res = await fetch(`${API}/api/startups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: startup.name,
        description: startup.description,
        industry: startup.industry,
        team: startup.team,
        fundingRequired: startup.fundingRequired,
        pitchDeck: startup.pitchDeck,
        tags: startup.tags,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const newStartup = await res.json();
    setStartups((prev) => [...prev, newStartup]);
    const pRes = await fetch(`${API}/api/proposals`);
    setProposals(await pRes.json());
    return newStartup;
  }

  // Off-chain simulated investment (used when wallet is not connected).
  async function fundStartup(startupId, amount) {
    const res = await fetch(`${API}/api/startups/${startupId}/investments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Investment failed");
    }
    setStartups((prev) =>
      prev.map((s) => s.id === startupId ? { ...s, fundingReceived: s.fundingReceived + amount } : s)
    );
  }

  // ── On-chain investment ──────────────────────────────────────────

  /**
   * Send real ETH via MetaMask then record the tx hash in the backend.
   * amountEth is a string like "0.5".
   * Returns the tx receipt (receipt.hash is the transaction hash).
   */
  async function fundStartupOnChainAction(startupId, amountEth) {
    if (!walletConnected || !walletSigner) {
      throw new Error("Please connect your MetaMask wallet first.");
    }
    // 1. Send on-chain — user confirms in MetaMask.
    const receipt = await fundStartupOnChain(startupId, amountEth, walletSigner);

    // 2. Record in backend so the DB stays in sync.
    await fetch(`${API}/api/blockchain/invest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startupId,
        txHash: receipt.hash,
        walletAddress: walletAddress,
        amountEth: parseFloat(amountEth),
      }),
    });

    // 3. Refresh the startup's fundingReceived from the backend.
    const sRes = await fetch(`${API}/api/startups`);
    setStartups(await sRes.json());

    return receipt;
  }

  // ── On-chain milestone vote + release ────────────────────────────

  /**
   * DAO member votes YES on-chain then the owner releases the tranche.
   * milestoneIndex is the 0-based index inside the contract.
   * Returns the release tx receipt.
   */
  async function approveReleaseOnChain(startupId, milestoneId, milestoneIndex) {
    if (!walletConnected || !walletSigner) {
      throw new Error("Please connect your MetaMask wallet first.");
    }

    // 1. Cast YES vote on-chain.
    await approveMilestoneOnChain(startupId, milestoneIndex, walletSigner);

    // 2. Release the tranche on-chain (owner calls releaseMilestone).
    //    In the prototype the frontend wallet IS the owner (Hardhat account 0).
    const releaseReceipt = await releaseMilestoneOnChain(startupId, milestoneIndex, walletSigner);

    // 3. Record in backend.
    await fetch(`${API}/api/blockchain/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milestoneId, txHash: releaseReceipt.hash }),
    });

    // 4. Refresh milestones and proposals.
    const [mRes, pRes] = await Promise.all([
      fetch(`${API}/api/milestones`),
      fetch(`${API}/api/proposals`),
    ]);
    const mData = await mRes.json();
    const grouped = {};
    for (const m of mData) {
      if (!grouped[m.startupId]) grouped[m.startupId] = [];
      grouped[m.startupId].push(m);
    }
    setMilestones(grouped);
    setProposals(await pRes.json());

    return releaseReceipt;
  }

  // ── Existing off-chain DAO actions ───────────────────────────────

  async function voteOnProposal(proposalId, vote) {
    const res = await fetch(`${API}/api/proposals/${proposalId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Vote failed");
    }
    const updated = await res.json();
    setProposals((prev) => prev.map((p) => (p.id === proposalId ? updated : p)));
    if (updated.status === "Approved" && updated.type === "Startup Approval") {
      setStartups((prev) =>
        prev.map((s) => (s.id === updated.startupId ? { ...s, status: "Approved" } : s))
      );
    }
  }

  async function approveMilestoneProposal(proposalId) {
    const res = await fetch(`${API}/api/proposals/${proposalId}/approve-milestone`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Approval failed");
    }
    const updated = await res.json();
    setProposals((prev) => prev.map((p) => (p.id === proposalId ? updated : p)));
    if (updated.milestoneId) {
      setMilestones((prev) => {
        const sid = updated.startupId;
        return {
          ...prev,
          [sid]: (prev[sid] || []).map((m) =>
            m.id === updated.milestoneId ? { ...m, status: "Completed" } : m
          ),
        };
      });
    }
  }

  async function rejectMilestoneProposal(proposalId) {
    const res = await fetch(`${API}/api/proposals/${proposalId}/reject-milestone`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Rejection failed");
    }
    const updated = await res.json();
    setProposals((prev) => prev.map((p) => (p.id === proposalId ? updated : p)));
    if (updated.milestoneId) {
      setMilestones((prev) => {
        const sid = updated.startupId;
        return {
          ...prev,
          [sid]: (prev[sid] || []).map((m) =>
            m.id === updated.milestoneId ? { ...m, status: "In Progress" } : m
          ),
        };
      });
    }
  }

  async function submitMilestoneEvidence(startupId, milestoneId, fileName) {
    const res = await fetch(`${API}/api/milestones/${milestoneId}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, notes: "" }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Evidence submission failed");
    }
    setMilestones((prev) => {
      const list = prev[startupId] || [];
      return {
        ...prev,
        [startupId]: list.map((m) =>
          m.id === milestoneId ? { ...m, status: "Pending DAO Approval", evidence: fileName } : m
        ),
      };
    });
    const pRes = await fetch(`${API}/api/proposals`);
    setProposals(await pRes.json());
  }

  const value = {
    // Role
    role, setRole,
    // Wallet
    walletConnected, walletAddress, walletBalance, walletError, walletSigner,
    connectMetaMask, disconnectWallet,
    // Data
    loading, startups, milestones, proposals,
    // Off-chain actions (same names as Milestone 3 so existing pages still work)
    addStartup, fundStartup,
    voteOnProposal, approveMilestoneProposal, rejectMilestoneProposal,
    submitMilestoneEvidence,
    // On-chain actions (new in Milestone 4)
    fundStartupOnChainAction,
    approveReleaseOnChain,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
