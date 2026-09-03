import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

function fmt(n) {
  if (n >= 100000) return "₹" + (n / 100000).toFixed(1).replace(".0", "") + "L";
  if (n >= 1000)   return "₹" + (n / 1000).toFixed(0) + "K";
  return "₹" + n;
}

function statusBadge(s) {
  const map = {
    Completed: "badge-success",
    "In Progress": "badge-info",
    Locked: "badge-muted",
    "Pending DAO Approval": "badge-pending",
  };
  return <span className={`badge ${map[s] || "badge-muted"}`}>{s}</span>;
}

function milestoneIcon(s) {
  if (s === "Completed")   return { label: "✓", cls: "completed" };
  if (s === "In Progress") return { label: "●", cls: "in-progress" };
  if (s === "Pending DAO Approval") return { label: "⏳", cls: "pending" };
  return { label: "🔒", cls: "locked" };
}

export default function StartupDetails() {
  const { id } = useParams();
  const { startups, milestones, fundStartup } = useApp();
  const navigate = useNavigate();

  const startup = startups.find((s) => s.id === Number(id));
  const ms = milestones[Number(id)] || [];

  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [funded, setFunded] = useState(false);
  const [error, setError] = useState("");

  if (!startup) {
    return (
      <div className="page-wrapper">
        <div className="empty-state">
          <div className="icon">❓</div>
          <h3>Startup not found</h3>
          <button className="btn btn-primary mt-16" onClick={() => navigate("/marketplace")}>Back to Marketplace</button>
        </div>
      </div>
    );
  }

  const pct = Math.min(Math.round((startup.fundingReceived / startup.fundingRequired) * 100), 100);

  function confirmFunding() {
    const val = Number(amount);
    if (!val || val <= 0) { setError("Please enter a valid amount."); return; }
    if (val > startup.fundingRequired - startup.fundingReceived) {
      setError("Amount exceeds remaining funding needed."); return;
    }
    fundStartup(startup.id, val);
    setFunded(true);
    setError("");
  }

  return (
    <div className="page-wrapper">
      {/* Back */}
      <button className="btn btn-ghost btn-sm mb-24" onClick={() => navigate("/marketplace")}>
        ← Back to Marketplace
      </button>

      <div className="dash-grid">
        {/* Left – main info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Header card */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
              <div>
                <h2 style={{ marginBottom: "4px" }}>{startup.name}</h2>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span className="tag">{startup.industry}</span>
                  <span className={`badge ${startup.status === "Approved" ? "badge-success" : "badge-pending"}`}>{startup.status}</span>
                </div>
              </div>
              <button className="btn btn-primary" onClick={() => { setShowModal(true); setFunded(false); setAmount(""); setError(""); }}>
                💰 Fund Startup
              </button>
            </div>

            <p style={{ lineHeight: 1.65, marginBottom: "20px" }}>{startup.description}</p>

            <hr className="divider" />

            <div className="grid-2" style={{ gap: "16px" }}>
              <div>
                <div style={{ fontSize: ".78rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: "4px" }}>Founder</div>
                <div style={{ fontWeight: 600 }}>{startup.founder}</div>
              </div>
              <div>
                <div style={{ fontSize: ".78rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: "4px" }}>Submitted</div>
                <div style={{ fontWeight: 600 }}>{startup.submittedDate}</div>
              </div>
            </div>

            <div className="mt-16">
              <div style={{ fontSize: ".78rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: "8px" }}>Team</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {startup.team.map((t) => (
                  <div key={t} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "6px 12px", fontSize: ".85rem", fontWeight: 500 }}>{t}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Milestones */}
          <div className="card">
            <h3 className="mb-16">Milestones</h3>
            <div className="milestone-list">
              {ms.map((m, i) => {
                const ic = milestoneIcon(m.status);
                return (
                  <div key={m.id} className="milestone-item">
                    <div className={`milestone-dot ${ic.cls}`}>{ic.label}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>Milestone {i + 1}: {m.title}</div>
                          <div style={{ fontSize: ".85rem", color: "var(--text-muted)", marginTop: "2px" }}>{m.description}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "12px" }}>
                          <div style={{ fontWeight: 700, fontSize: ".9rem" }}>{fmt(m.amount)}</div>
                          {statusBadge(m.status)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Funding card */}
          <div className="card">
            <h3 className="mb-16">Funding</h3>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: ".85rem" }}>
              <span className="text-muted">Raised</span>
              <span style={{ fontWeight: 700, color: "var(--success)" }}>{fmt(startup.fundingReceived)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: ".85rem" }}>
              <span className="text-muted">Goal</span>
              <span style={{ fontWeight: 700 }}>{fmt(startup.fundingRequired)}</span>
            </div>
            <div className="progress-bar-wrap" style={{ height: 10 }}>
              <div className="progress-bar-fill" style={{ width: pct + "%" }} />
            </div>
            <div style={{ textAlign: "right", fontSize: ".8rem", color: "var(--text-muted)", marginTop: "6px" }}>{pct}% funded</div>

            <button
              className="btn btn-primary btn-full mt-16"
              onClick={() => { setShowModal(true); setFunded(false); setAmount(""); setError(""); }}
            >
              💰 Fund This Startup
            </button>
          </div>

          {/* Pitch deck */}
          <div className="card">
            <h3 className="mb-12">Pitch Deck</h3>
            <div className="pitch-pill">
              <span className="p-icon">📄</span>
              <span>{startup.pitchDeck}</span>
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }}>View</button>
            </div>
          </div>

          {/* Tags */}
          <div className="card">
            <h3 className="mb-12">Tags</h3>
            <div className="tags">
              {(startup.tags || []).map((t) => <span key={t} className="tag">{t}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Funding modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            {funded ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "3rem", marginBottom: "12px" }}>🎉</div>
                <h3 style={{ marginBottom: "8px" }}>Funding Successful!</h3>
                <p style={{ marginBottom: "20px" }}>
                  <strong>{fmt(Number(amount))}</strong> has been committed to <strong>{startup.name}</strong>. Funds will be released as milestones are approved by the DAO.
                </p>
                <div className="success-box" style={{ justifyContent: "center" }}>
                  <span className="icon">✅</span>
                  <p>Transaction simulated successfully</p>
                </div>
                <button className="btn btn-primary btn-full mt-24" onClick={() => setShowModal(false)}>Close</button>
              </div>
            ) : (
              <div>
                <h3 className="modal-title">Fund {startup.name}</h3>
                <div className="form-group mb-16">
                  <label className="form-label">Funding Amount (₹)</label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="e.g. 600000"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setError(""); }}
                    min="1"
                    autoFocus
                  />
                  {amount && Number(amount) > 0 && (
                    <span style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>
                      = ₹{Number(amount).toLocaleString("en-IN")}
                    </span>
                  )}
                  {error && <span style={{ fontSize: ".82rem", color: "var(--danger)" }}>{error}</span>}
                </div>
                <div style={{ fontSize: ".82rem", color: "var(--text-muted)", background: "var(--bg)", padding: "10px 14px", borderRadius: "var(--radius-sm)", marginBottom: "8px" }}>
                  Remaining: <strong>{fmt(startup.fundingRequired - startup.fundingReceived)}</strong>
                </div>
                <div className="modal-actions">
                  <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                  <button className="btn btn-success" onClick={confirmFunding}>Confirm Funding ✓</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
