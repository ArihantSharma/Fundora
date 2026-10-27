import { useState } from "react";
import { useApp } from "../context/AppContext";
import { shortHash } from "../blockchain/contract";

function statusBadge(s) {
  const map = { Approved: "badge-success", Pending: "badge-pending", Rejected: "badge-danger" };
  return <span className={`badge ${map[s] || "badge-muted"}`}>{s}</span>;
}

function fmt(n) {
  if (!n) return "—";
  if (n >= 100000) return "₹" + (n / 100000).toFixed(1).replace(".0", "") + "L";
  if (n >= 1000)   return "₹" + (n / 1000).toFixed(0) + "K";
  return "₹" + n;
}

function ProposalCard({ proposal, onVote, onApproveMilestone, onRejectMilestone, onApproveOnChain, walletConnected }) {
  const total = proposal.yesVotes + proposal.noVotes;
  const yesPct = total > 0 ? Math.round((proposal.yesVotes / total) * 100) : 0;
  const noPct  = total > 0 ? 100 - yesPct : 0;
  const [approved, setApproved] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [txHash,   setTxHash]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState("");

  async function handleApproveMilestone() {
    setErr(""); setLoading(true);
    try {
      await onApproveMilestone(proposal.id);
      setApproved(true);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }
  async function handleRejectMilestone() {
    setErr(""); setLoading(true);
    try {
      await onRejectMilestone(proposal.id);
      setRejected(true);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }
  async function handleApproveOnChain() {
    setErr(""); setLoading(true);
    try {
      const receipt = await onApproveOnChain(
        proposal.startupId,
        proposal.milestoneId,
        proposal.milestoneIndex ?? 0,
      );
      setTxHash(receipt.hash);
      setApproved(true);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="proposal-card">
      {/* Header */}
      <div className="proposal-header">
        <div>
          <div className="proposal-num">Proposal #{proposal.proposalNumber} · {proposal.type}</div>
          <h3 style={{ marginTop: "4px", marginBottom: "6px" }}>{proposal.title}</h3>
          <p style={{ fontSize: ".875rem" }}>{proposal.description}</p>
        </div>
        {statusBadge(proposal.status)}
      </div>

      {/* Milestone-specific info */}
      {proposal.type === "Milestone Approval" && (
        <div style={{ background: "var(--bg)", borderRadius: "var(--radius-sm)", padding: "12px 14px", marginBottom: "16px", fontSize: ".85rem" }}>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            <span><strong>Milestone:</strong> {proposal.milestoneTitle}</span>
            <span><strong>Amount:</strong> {fmt(proposal.milestoneAmount)}</span>
            {proposal.evidence && <span><strong>Evidence:</strong> 📄 {proposal.evidence}</span>}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", marginBottom: "12px", fontSize: ".82rem", color: "var(--text-muted)" }}>
        <span>📅 {proposal.submittedDate}</span>
        <span>🏢 {proposal.startupName}</span>
      </div>

      {/* Vote bar */}
      <div style={{ marginBottom: "8px" }}>
        <div className="vote-bar-wrap">
          <div className="vote-bar-yes" style={{ width: yesPct + "%" }} />
          <div className="vote-bar-no"  style={{ width: noPct  + "%" }} />
        </div>
      </div>

      {/* Vote counts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
        {[
          { label: "YES",       value: proposal.yesVotes, color: "var(--success)" },
          { label: "NO",        value: proposal.noVotes,  color: "var(--danger)"  },
          { label: "Approval",  value: yesPct + "%",      color: "var(--text)"    },
          { label: "Required",  value: proposal.requiredPercentage + "%", color: "var(--text-muted)" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: "center", padding: "10px", background: "var(--bg)", borderRadius: "var(--radius-sm)" }}>
            <div style={{ fontSize: "1.2rem", fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: ".72rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      {proposal.type === "Startup Approval" && !proposal.hasVoted && proposal.status === "Pending" && (
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn btn-success btn-sm" onClick={async () => { try { await onVote(proposal.id, "yes"); } catch(e) { setErr(e.message); } }}>
            👍 Vote YES
          </button>
          <button className="btn btn-danger btn-sm" onClick={async () => { try { await onVote(proposal.id, "no"); } catch(e) { setErr(e.message); } }}>
            👎 Vote NO
          </button>
        </div>
      )}

      {proposal.type === "Startup Approval" && proposal.hasVoted && (
        <div style={{ fontSize: ".85rem", fontWeight: 600, color: "var(--text-muted)" }}>
          ✓ You voted <strong style={{ color: proposal.userVote === "yes" ? "var(--success)" : "var(--danger)" }}>{proposal.userVote?.toUpperCase()}</strong>
        </div>
      )}

      {proposal.type === "Milestone Approval" && !approved && !rejected && proposal.status === "Pending" && (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {walletConnected && (
            <button className="btn btn-primary btn-sm" onClick={handleApproveOnChain} disabled={loading}>
              {loading ? "Confirming…" : "🦊 Approve On-chain"}
            </button>
          )}
          <button className="btn btn-success btn-sm" onClick={handleApproveMilestone} disabled={loading}>
            {loading ? "…" : "✅ Approve (Simulated)"}
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleRejectMilestone} disabled={loading}>
            ❌ Reject Milestone
          </button>
        </div>
      )}

      {/* Milestone approved result */}
      {(approved || (proposal.type === "Milestone Approval" && proposal.status === "Approved")) && !rejected && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div className="success-box">
            <span className="icon">✅</span>
            <p>Milestone Approved by DAO</p>
          </div>
          {txHash && (
            <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: ".82rem" }}>
              <span style={{ fontWeight: 600 }}>On-chain tx: </span>
              <span style={{ color: "var(--brand)", fontFamily: "monospace" }} title={txHash}>{shortHash(txHash)}</span>
              <span style={{ color: "var(--text-muted)", fontSize: ".72rem", marginLeft: "8px" }}>(Hardhat local)</span>
            </div>
          )}
          <div style={{
            background: "var(--brand-light)",
            border: "1.5px solid var(--brand)",
            borderRadius: "var(--radius)",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}>
            <span style={{ fontSize: "1.4rem" }}>💸</span>
            <div>
              <div style={{ fontWeight: 700, color: "var(--brand)", fontSize: "1.1rem" }}>{fmt(proposal.milestoneAmount)} Released</div>
              <div style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>Funds transferred to founder's wallet</div>
            </div>
          </div>
        </div>
      )}

      {(rejected || (proposal.type === "Milestone Approval" && proposal.status === "Rejected")) && (
        <div style={{ background: "#FEE2E2", border: "1.5px solid #FCA5A5", borderRadius: "var(--radius)", padding: "14px 18px", color: "#991B1B", fontWeight: 600, fontSize: ".9rem" }}>
          ❌ Milestone Rejected — Founder must revise and resubmit.
        </div>
      )}
      {err && (
        <div style={{ marginTop: "10px", color: "var(--danger)", fontSize: ".83rem", background: "#FEE2E2", padding: "8px 12px", borderRadius: "var(--radius-sm)" }}>
          ⚠️ {err}
        </div>
      )}
    </div>
  );
}

export default function DAOProposals() {
  const { proposals, voteOnProposal, approveMilestoneProposal, rejectMilestoneProposal, walletConnected, approveReleaseOnChain } = useApp();
  const [filter, setFilter] = useState("All");

  const filtered = proposals.filter((p) => {
    if (filter === "All") return true;
    if (filter === "Pending") return p.status === "Pending";
    if (filter === "Approved") return p.status === "Approved";
    if (filter === "Milestone") return p.type === "Milestone Approval";
    return true;
  });

  const pending = proposals.filter((p) => p.status === "Pending").length;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>DAO Proposals</h1>
        <p>Review, discuss, and vote on startup approvals and milestone releases.</p>
      </div>

      {/* Stats */}
      <div className="stat-grid mb-24">
        <div className="stat-card">
          <div className="stat-label">Total Proposals</div>
          <div className="stat-value">{proposals.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Votes</div>
          <div className="stat-value" style={{ color: "var(--warning)" }}>{pending}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approved</div>
          <div className="stat-value" style={{ color: "var(--success)" }}>{proposals.filter((p) => p.status === "Approved").length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Quorum Threshold</div>
          <div className="stat-value">60%</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
        {["All", "Pending", "Approved", "Milestone"].map((f) => (
          <button key={f} className={`btn btn-sm${filter === f ? " btn-primary" : " btn-ghost"}`} onClick={() => setFilter(f)}>
            {f}
            {f === "Pending" && pending > 0 && (
              <span style={{ background: "var(--warning)", color: "#fff", borderRadius: "99px", padding: "1px 6px", fontSize: ".7rem", marginLeft: "4px" }}>
                {pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Proposal list */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🗳️</div>
          <h3>No proposals here</h3>
          <p>Proposals will appear as startups are submitted.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {filtered.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              onVote={voteOnProposal}
              onApproveMilestone={approveMilestoneProposal}
              onRejectMilestone={rejectMilestoneProposal}
              onApproveOnChain={approveReleaseOnChain}
              walletConnected={walletConnected}
            />
          ))}
        </div>
      )}
    </div>
  );
}
