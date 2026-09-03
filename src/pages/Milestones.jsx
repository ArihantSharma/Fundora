import { useState } from "react";
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
  if (s === "Completed") return { label: "✓", cls: "completed" };
  if (s === "In Progress") return { label: "●", cls: "in-progress" };
  if (s === "Pending DAO Approval") return { label: "⏳", cls: "pending" };
  return { label: "🔒", cls: "locked" };
}

function EvidenceModal({ milestone, onClose, onSubmit }) {
  const [file, setFile] = useState("");
  const [notes, setNotes] = useState("");

  function handleFile(e) {
    if (e.target.files[0]) setFile(e.target.files[0].name);
  }

  function submit(e) {
    e.preventDefault();
    onSubmit(file || "evidence_document.pdf");
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3 className="modal-title">Submit Evidence — {milestone.title}</h3>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "var(--bg)", borderRadius: "var(--radius-sm)", padding: "12px 14px", fontSize: ".85rem" }}>
            <strong>{milestone.title}</strong> · {fmt(milestone.amount)}
          </div>

          {/* File upload */}
          <div className="form-group">
            <label className="form-label">Evidence Document *</label>
            <div style={{
              border: "2px dashed var(--border)",
              borderRadius: "var(--radius)",
              padding: "24px",
              textAlign: "center",
              position: "relative",
              background: "var(--bg)",
              cursor: "pointer",
            }}>
              {file ? (
                <div>
                  <div style={{ fontSize: "1.3rem", marginBottom: "6px" }}>📄</div>
                  <div style={{ fontWeight: 600 }}>{file}</div>
                  <div style={{ fontSize: ".8rem", color: "var(--success)", marginTop: "4px" }}>Attached ✓</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "1.3rem", marginBottom: "6px" }}>📁</div>
                  <div style={{ fontWeight: 600, fontSize: ".9rem" }}>Upload Evidence</div>
                  <div style={{ fontSize: ".8rem", color: "var(--text-muted)" }}>PDF, images, or documents</div>
                </div>
              )}
              <input type="file" onChange={handleFile} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Notes for DAO</label>
            <textarea
              className="form-input"
              placeholder="Describe what you've achieved for this milestone…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ minHeight: 80 }}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Submit to DAO →</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Milestones() {
  const { startups, milestones, role, submitMilestoneEvidence } = useApp();
  const [selectedStartupId, setSelectedStartupId] = useState(1);
  const [evidenceModal, setEvidenceModal] = useState(null); // milestone object
  const [submitted, setSubmitted] = useState(null); // milestoneId

  const startup = startups.find((s) => s.id === selectedStartupId);
  const ms = milestones[selectedStartupId] || [];
  const completed = ms.filter((m) => m.status === "Completed").length;
  const totalFunds = ms.reduce((a, m) => a + m.amount, 0);
  const releasedFunds = ms.filter((m) => m.status === "Completed").reduce((a, m) => a + m.amount, 0);

  function handleSubmitEvidence(filename) {
    submitMilestoneEvidence(selectedStartupId, evidenceModal.id, filename);
    setSubmitted(evidenceModal.id);
    setEvidenceModal(null);
  }

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>Milestones</h1>
        <p>Track progress, submit evidence, and unlock funding as you hit each milestone.</p>
      </div>

      {/* Startup selector */}
      <div style={{ marginBottom: "24px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {startups.filter((s) => s.status === "Approved" || s.id === selectedStartupId).map((s) => (
          <button
            key={s.id}
            className={`btn btn-sm${selectedStartupId === s.id ? " btn-primary" : " btn-ghost"}`}
            onClick={() => setSelectedStartupId(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Startup summary */}
      {startup && (
        <div className="stat-grid mb-24">
          <div className="stat-card">
            <div className="stat-label">Total Milestones</div>
            <div className="stat-value">{ms.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Completed</div>
            <div className="stat-value" style={{ color: "var(--success)" }}>{completed}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Funds Released</div>
            <div className="stat-value" style={{ color: "var(--brand)" }}>{fmt(releasedFunds)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Milestone Pot</div>
            <div className="stat-value">{fmt(totalFunds)}</div>
          </div>
        </div>
      )}

      {/* Overall progress */}
      {startup && (
        <div className="card mb-24">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontWeight: 600 }}>Overall Completion</span>
            <span style={{ fontWeight: 700 }}>{ms.length > 0 ? Math.round((completed / ms.length) * 100) : 0}%</span>
          </div>
          <div className="progress-bar-wrap" style={{ height: 10 }}>
            <div className="progress-bar-fill" style={{ width: ms.length > 0 ? Math.round((completed / ms.length) * 100) + "%" : "0%" }} />
          </div>
        </div>
      )}

      {/* Milestone list */}
      <div className="milestone-list">
        {ms.map((m, i) => {
          const ic = milestoneIcon(m.status);
          const isActive = m.status === "In Progress";
          const isPending = m.status === "Pending DAO Approval";
          const justSubmitted = submitted === m.id;

          return (
            <div
              key={m.id}
              className="milestone-item"
              style={{ border: isActive ? "1.5px solid var(--brand)" : isPending ? "1.5px solid var(--warning)" : undefined }}
            >
              <div className={`milestone-dot ${ic.cls}`}>{ic.label}</div>

              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, marginBottom: "2px" }}>Milestone {i + 1}: {m.title}</div>
                    <p style={{ fontSize: ".875rem", marginBottom: "10px" }}>{m.description}</p>

                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      {statusBadge(m.status)}
                      <span className="badge badge-info">{fmt(m.amount)}</span>
                      {m.completedDate && (
                        <span style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>Completed {m.completedDate}</span>
                      )}
                    </div>

                    {/* Evidence submitted notice */}
                    {(isPending || justSubmitted) && (
                      <div style={{ marginTop: "10px", background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: ".83rem", color: "#92400E" }}>
                        ⏳ Evidence submitted. Waiting for DAO approval.
                        {m.evidence && <span> · 📄 {m.evidence}</span>}
                      </div>
                    )}

                    {/* Completed – funds released notice */}
                    {m.status === "Completed" && (
                      <div className="success-box mt-8" style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: "1rem" }}>💸</span>
                        <p style={{ fontSize: ".82rem" }}>{fmt(m.amount)} released to your wallet</p>
                      </div>
                    )}
                  </div>

                  {/* Submit evidence button */}
                  {role === "Founder" && isActive && (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ flexShrink: 0 }}
                      onClick={() => setEvidenceModal(m)}
                    >
                      Submit Evidence
                    </button>
                  )}

                  {role === "Founder" && m.status === "Locked" && (
                    <button className="btn btn-ghost btn-sm" disabled style={{ flexShrink: 0, opacity: 0.4 }}>
                      🔒 Locked
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info box for non-founders */}
      {role !== "Founder" && (
        <div style={{ marginTop: "24px", background: "var(--brand-light)", borderRadius: "var(--radius-sm)", padding: "14px 16px", fontSize: ".85rem", color: "var(--brand)" }}>
          ℹ️ Switch to <strong>Founder</strong> role to submit milestone evidence. Switch to <strong>DAO Member</strong> to approve milestones.
        </div>
      )}

      {/* Evidence modal */}
      {evidenceModal && (
        <EvidenceModal
          milestone={evidenceModal}
          onClose={() => setEvidenceModal(null)}
          onSubmit={handleSubmitEvidence}
        />
      )}
    </div>
  );
}
