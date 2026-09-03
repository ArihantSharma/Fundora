import { createContext, useContext, useState } from "react";
import { startups as initialStartups } from "../data/startups";
import { milestonesByStartup as initialMilestones } from "../data/milestones";
import { proposals as initialProposals } from "../data/proposals";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [role, setRole] = useState("Founder"); // Founder | Investor | DAO Member
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress] = useState("0x71C4...A92F");

  // Mutable app state
  const [startups, setStartups] = useState(initialStartups);
  const [milestones, setMilestones] = useState(initialMilestones);
  const [proposals, setProposals] = useState(initialProposals);

  // ── Startup actions ──────────────────────────────────────────────
  function addStartup(startup) {
    const newStartup = {
      ...startup,
      id: startups.length + 1,
      fundingReceived: 0,
      status: "Pending",
      submittedDate: new Date().toISOString().split("T")[0],
    };
    setStartups((prev) => [...prev, newStartup]);

    // Auto-create a DAO proposal for it
    const proposalNumber = String(proposals.length + 1).padStart(3, "0");
    const newProposal = {
      id: proposals.length + 1,
      proposalNumber,
      title: `Approve ${startup.name} for Incubation`,
      startupId: newStartup.id,
      startupName: startup.name,
      description: startup.description,
      yesVotes: 0,
      noVotes: 0,
      requiredPercentage: 60,
      status: "Pending",
      type: "Startup Approval",
      submittedDate: newStartup.submittedDate,
      hasVoted: false,
      userVote: null,
    };
    setProposals((prev) => [...prev, newProposal]);
    return newStartup;
  }

  function fundStartup(startupId, amount) {
    setStartups((prev) =>
      prev.map((s) =>
        s.id === startupId
          ? { ...s, fundingReceived: s.fundingReceived + amount }
          : s
      )
    );
  }

  // ── Proposal / DAO actions ────────────────────────────────────────
  function voteOnProposal(proposalId, vote) {
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id !== proposalId || p.hasVoted) return p;
        const updated = {
          ...p,
          yesVotes: vote === "yes" ? p.yesVotes + 1 : p.yesVotes,
          noVotes: vote === "no" ? p.noVotes + 1 : p.noVotes,
          hasVoted: true,
          userVote: vote,
        };
        const total = updated.yesVotes + updated.noVotes;
        const pct = total > 0 ? (updated.yesVotes / total) * 100 : 0;
        if (pct >= updated.requiredPercentage) {
          updated.status = "Approved";
          // If it's a startup approval, mark the startup approved
          if (updated.type === "Startup Approval") {
            setStartups((s) =>
              s.map((st) =>
                st.id === updated.startupId ? { ...st, status: "Approved" } : st
              )
            );
          }
        }
        return updated;
      })
    );
  }

  function approveMilestoneProposal(proposalId) {
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id !== proposalId) return p;
        // Release funds on the startup
        setStartups((s) =>
          s.map((st) =>
            st.id === p.startupId
              ? { ...st, fundingReceived: st.fundingReceived + (p.milestoneAmount || 0) }
              : st
          )
        );
        // Mark milestone completed
        setMilestones((m) => {
          const list = m[p.startupId] || [];
          const updated = list.map((ms) =>
            ms.title === p.milestoneTitle
              ? { ...ms, status: "Completed", completedDate: new Date().toISOString().split("T")[0] }
              : ms
          );
          return { ...m, [p.startupId]: updated };
        });
        return { ...p, status: "Approved", hasVoted: true, userVote: "yes" };
      })
    );
  }

  function rejectMilestoneProposal(proposalId) {
    setProposals((prev) =>
      prev.map((p) =>
        p.id === proposalId ? { ...p, status: "Rejected", hasVoted: true, userVote: "no" } : p
      )
    );
  }

  // ── Milestone actions ─────────────────────────────────────────────
  function submitMilestoneEvidence(startupId, milestoneId, evidenceFileName) {
    setMilestones((prev) => {
      const list = prev[startupId] || [];
      return {
        ...prev,
        [startupId]: list.map((ms) =>
          ms.id === milestoneId
            ? { ...ms, status: "Pending DAO Approval", evidence: evidenceFileName }
            : ms
        ),
      };
    });

    // Create a DAO proposal for this milestone
    const startup = startups.find((s) => s.id === startupId);
    const milestone = (milestones[startupId] || []).find((m) => m.id === milestoneId);
    if (!startup || !milestone) return;

    const proposalNumber = String(proposals.length + 1).padStart(3, "0");
    const newProposal = {
      id: proposals.length + 1,
      proposalNumber,
      title: `Release Milestone ${milestoneId} Funds — ${startup.name}`,
      startupId,
      startupName: startup.name,
      description: milestone.description,
      yesVotes: 0,
      noVotes: 0,
      requiredPercentage: 60,
      status: "Pending",
      type: "Milestone Approval",
      milestoneTitle: milestone.title,
      milestoneAmount: milestone.amount,
      evidence: evidenceFileName,
      submittedDate: new Date().toISOString().split("T")[0],
      hasVoted: false,
      userVote: null,
    };
    setProposals((prev) => [...prev, newProposal]);
  }

  const value = {
    role,
    setRole,
    walletConnected,
    setWalletConnected,
    walletAddress,
    startups,
    milestones,
    proposals,
    addStartup,
    fundStartup,
    voteOnProposal,
    approveMilestoneProposal,
    rejectMilestoneProposal,
    submitMilestoneEvidence,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
