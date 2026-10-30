import { createContext, useContext, useState, useEffect } from "react";
import {
  connectWallet,
  fundStartupOnChain,
  approveMilestoneOnChain,
  releaseMilestoneOnChain,
} from "../blockchain/contract";

export const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const AppContext = createContext(null);

// All fetch calls to the backend include credentials so the session cookie
// is sent and received automatically.
function apiFetch(path, options = {}) {
  return fetch(`${API}${path}`, {
    credentials: "include",        // send HttpOnly session cookie on every request
    ...options,
  });
}

export function AppProvider({ children }) {
  // ── Authenticated user (null = not logged in) ─────────────────
  const [user,    setUser]    = useState(null);   // { id, name, email, role }
  const [authLoading, setAuthLoading] = useState(true);  // checking session on load

  // ── Wallet state ─────────────────────────────────────────────────
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress,   setWalletAddress]   = useState("");
  const [walletBalance,   setWalletBalance]   = useState("0.0000");
  const [walletSigner,    setWalletSigner]    = useState(null);
  const [walletError,     setWalletError]     = useState("");

  // ── App data ──────────────────────────────────────────────────────
  const [startups,   setStartups]   = useState([]);
  const [milestones, setMilestones] = useState({});
  const [proposals,  setProposals]  = useState([]);
  const [loading,    setLoading]    = useState(true);

  // ── On mount: restore session from server, then load data ─────────
  useEffect(() => {
    async function init() {
      // Try to restore an existing session.
      try {
        const res = await apiFetch("/api/auth/me");
        if (res.ok) {
          const u = await res.json();
          setUser(u);
        }
      } catch {
        // Network error — backend not running; app still works in offline mode.
      }
      setAuthLoading(false);

      // Load public data regardless of auth state.
      try {
        const [sRes, mRes, pRes] = await Promise.all([
          apiFetch("/api/startups"),
          apiFetch("/api/milestones"),
          apiFetch("/api/proposals"),
        ]);
        const startupsData   = await sRes.json();
        const milestonesData = await mRes.json();
        const proposalsData  = await pRes.json();
        setStartups(startupsData);
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
    init();
  }, []);

  // MetaMask event listeners.
  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
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

  // ── Auth actions ──────────────────────────────────────────────────

  async function register(name, email, password, role) {
    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Registration failed.");
    setUser(data);
    return data;
  }

  async function login(email, password) {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Login failed.");
    setUser(data);
    // Reload proposals so hasVoted is personalised for the logged-in user.
    const pRes = await apiFetch("/api/proposals");
    if (pRes.ok) setProposals(await pRes.json());
    return data;
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    disconnectWallet();
  }

  // ── Wallet actions ────────────────────────────────────────────────

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

  // ── Startup actions ───────────────────────────────────────────────

  async function addStartup(startup) {
    const res = await apiFetch("/api/startups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:             startup.name,
        description:      startup.description,
        industry:         startup.industry,
        team:             startup.team,
        fundingRequired:  startup.fundingRequired,
        pitchDeck:        startup.pitchDeck,
        tags:             startup.tags,
        milestones:       startup.milestones || [],
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to register startup.");
    }
    const newStartup = await res.json();
    setStartups((prev) => [...prev, newStartup]);
    const pRes = await apiFetch("/api/proposals");
    if (pRes.ok) setProposals(await pRes.json());
    return newStartup;
  }

  // Off-chain simulated investment (used when wallet is not connected).
  async function fundStartup(startupId, amount) {
    const res = await apiFetch(`/api/startups/${startupId}/investments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Investment failed.");
    }
    setStartups((prev) =>
      prev.map((s) => s.id === startupId ? { ...s, fundingReceived: s.fundingReceived + amount } : s)
    );
  }

  // ── On-chain investment ───────────────────────────────────────────

  async function fundStartupOnChainAction(startupId, amountEth) {
    if (!walletConnected || !walletSigner) {
      throw new Error("Please connect your MetaMask wallet first.");
    }
    // Check that this startup is registered on the contract before sending ETH.
    const startup = startups.find((s) => s.id === startupId);
    if (!startup?.contractAddress) {
      throw new Error(
        "This startup is not yet registered on the smart contract. " +
        "The startup owner must register it on-chain from their dashboard first."
      );
    }
    const receipt = await fundStartupOnChain(startupId, amountEth, walletSigner);
    await apiFetch("/api/blockchain/invest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startupId,
        txHash:        receipt.hash,
        walletAddress: walletAddress,
        amountEth:     parseFloat(amountEth),
      }),
    });
    const sRes = await apiFetch("/api/startups");
    if (sRes.ok) setStartups(await sRes.json());
    return receipt;
  }

  // ── Register startup on-chain (Founder only, called from their dashboard) ──

  async function registerStartupOnChain(startupId) {
    if (!walletConnected || !walletAddress) {
      throw new Error("Connect your MetaMask wallet first to provide your founder address.");
    }
    const res = await apiFetch(`/api/blockchain/register-startup/${startupId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ founderWalletAddress: walletAddress }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "On-chain registration failed.");
    }
    const data = await res.json();
    // Refresh startups so contractAddress appears immediately
    const sRes = await apiFetch("/api/startups");
    if (sRes.ok) setStartups(await sRes.json());
    return data;
  }

  // ── On-chain milestone vote + release ─────────────────────────────

  async function approveReleaseOnChain(startupId, milestoneId, milestoneIndex) {
    if (!walletConnected || !walletSigner) {
      throw new Error("Please connect your MetaMask wallet first.");
    }
    await approveMilestoneOnChain(startupId, milestoneIndex, walletSigner);
    const releaseReceipt = await releaseMilestoneOnChain(startupId, milestoneIndex, walletSigner);
    await apiFetch("/api/blockchain/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milestoneId, txHash: releaseReceipt.hash }),
    });
    const [mRes, pRes] = await Promise.all([
      apiFetch("/api/milestones"),
      apiFetch("/api/proposals"),
    ]);
    if (mRes.ok) {
      const mData = await mRes.json();
      const grouped = {};
      for (const m of mData) {
        if (!grouped[m.startupId]) grouped[m.startupId] = [];
        grouped[m.startupId].push(m);
      }
      setMilestones(grouped);
    }
    if (pRes.ok) setProposals(await pRes.json());
    return releaseReceipt;
  }

  // ── Off-chain DAO actions ─────────────────────────────────────────

  async function voteOnProposal(proposalId, vote) {
    const res = await apiFetch(`/api/proposals/${proposalId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Vote failed.");
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
    const res = await apiFetch(`/api/proposals/${proposalId}/approve-milestone`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Approval failed.");
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
    const res = await apiFetch(`/api/proposals/${proposalId}/reject-milestone`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Rejection failed.");
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

  async function submitMilestoneEvidence(startupId, milestoneId, fileName, notes = "") {
    const res = await apiFetch(`/api/milestones/${milestoneId}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, notes }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Evidence submission failed.");
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
    const pRes = await apiFetch("/api/proposals");
    if (pRes.ok) setProposals(await pRes.json());
  }

  const value = {
    // Auth
    user, authLoading, login, logout, register,
    // Wallet
    walletConnected, walletAddress, walletBalance, walletError, walletSigner,
    connectMetaMask, disconnectWallet,
    // Data
    loading, startups, milestones, proposals,
    // Off-chain actions
    addStartup, fundStartup,
    voteOnProposal, approveMilestoneProposal, rejectMilestoneProposal,
    submitMilestoneEvidence,
    // On-chain actions
    fundStartupOnChainAction,
    registerStartupOnChain,
    approveReleaseOnChain,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
