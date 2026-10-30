import { useState } from "react";
import { useApp, API } from "../context/AppContext";
import { shortHash } from "../blockchain/contract";

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

function EvidenceModal({ milestone, onClose, onSubmitDone }) {
  const [fileObj, setFileObj]   = useState(null);  // actual File object
  const [notes,   setNotes]     = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"];
  const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type) && !f.name.match(/\.(pdf|png|jpe?g|gif|webp)$/i)) {
      setUploadErr("Only PDF and image files (PNG, JPEG, GIF, WebP) are accepted.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setUploadErr(`File is too large (max 10 MB, got ${(f.size / 1024 / 1024).toFixed(1)} MB).`);
      return;
    }
    setUploadErr("");
    setFileObj(f);
  }

  async function submit(e) {
    e.preventDefault();
    if (!fileObj) { setUploadErr("Please select a file to upload."); return; }
    setUploading(true);
    setUploadErr("");
    try {
      const fd = new FormData();
      fd.append("file", fileObj);
      fd.append("notes", notes);
      const res = await fetch(`${API}/api/milestones/${milestone.id}/evidence/upload`, {
        method: "POST",
        credentials: "include",
        body: fd,
        // Do NOT set Content-Type — browser sets it with the correct boundary automatically.
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Upload failed." }));
        throw new Error(err.detail || "Upload failed.");
      }
      const data = await res.json();
      onSubmitDone(data);
    } catch (err) {
      setUploadErr(err.message);
    } finally {
      setUploading(false);
    }
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
            <label className="form-label">Evidence Document * (PDF or image, max 10 MB)</label>
            <div style={{
              border: "2px dashed var(--border)",
              borderRadius: "var(--radius)",
              padding: "24px",
              textAlign: "center",
              position: "relative",
              background: "var(--bg)",
              cursor: "pointer",
            }}>
              {fileObj ? (
                <div>
                  <div style={{ fontSize: "1.3rem", marginBottom: "6px" }}>📄</div>
                  <div style={{ fontWeight: 600 }}>{fileObj.name}</div>
                  <div style={{ fontSize: ".8rem", color: "var(--success)", marginTop: "4px" }}>
                    {(fileObj.size / 1024).toFixed(0)} KB — ready to upload ✓
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "1.3rem", marginBottom: "6px" }}>📁</div>
                  <div style={{ fontWeight: 600, fontSize: ".9rem" }}>Click to select or drop a file</div>
                  <div style={{ fontSize: ".8rem", color: "var(--text-muted)" }}>PDF, PNG, JPEG, GIF, WebP — max 10 MB</div>
                </div>
              )}
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                onChange={handleFile}
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
              />
            </div>
            {uploadErr && (
              <div style={{ color: "var(--danger)", fontSize: ".82rem", marginTop: "6px" }}>⚠️ {uploadErr}</div>
            )}
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Notes for DAO</label>
            <textarea
              className="form-input"
              placeholder="Describe what you have achieved for this milestone…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ minHeight: 80 }}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={uploading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={uploading}>
              {uploading ? "Uploading…" : "Submit to DAO →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Milestones() {
  const { startups, milestones, user, submitMilestoneEvidence } = useApp();
  const role = user?.role;

  // Default to the first startup that belongs to this founder, falling back
  // to the first approved startup (for investors/DAO members viewing).
  const myStartup = user?.role === "Founder"
    ? startups.find((s) => s.founderId === user.id)
    : null;
  const defaultId = myStartup?.id
    ?? startups.find((s) => s.status === "Approved")?.id
    ?? startups[0]?.id
    ?? null;

  const [selectedStartupId, setSelectedStartupId] = useState(null);
  const [evidenceModal, setEvidenceModal] = useState(null);
  const [submitted, setSubmitted] = useState(null);

  // Update default once startups load.
  const effectiveId = selectedStartupId ?? defaultId;

  const startup       = startups.find((s) => s.id === effectiveId);
  const ms            = milestones[effectiveId] || [];
  const completed     = ms.filter((m) => m.status === "Completed").length;
  const totalFunds    = ms.reduce((a, m) => a + m.amount, 0);
  const releasedFunds = ms.filter((m) => m.status === "Completed").reduce((a, m) => a + m.amount, 0);

  async function handleSubmitEvidence(uploadResult) {
    // uploadResult comes from the backend after successful file upload.
    // The backend already updated the milestone status to "Pending DAO Approval".
    setSubmitted(evidenceModal.id);
    setEvidenceModal(null);
    // Reload data so milestone status updates in the UI.
    try {
      const [sRes, mRes, pRes] = await Promise.all([
        fetch(`${API}/api/startups`, { credentials: "include" }),
        fetch(`${API}/api/milestones`, { credentials: "include" }),
        fetch(`${API}/api/proposals`, { credentials: "include" }),
      ]);
      // Let AppContext handle its own state — just trigger a page reload signal
      // by nudging the submitted state.
    } catch { /* best-effort reload */ }
  }

  // Startups to show in the selector: all approved + founder's own (even if Pending).
  const selectorStartups = startups.filter(
    (s) => s.status === "Approved" || s.founderId === user?.id
  );

  if (startups.length > 0 && selectorStartups.length === 0) {
    return (
      <div className="page-wrapper">
        <div className="page-header"><h1>Milestones</h1></div>
        <div className="empty-state">
          <div className="icon">📋</div>
          <h3>No startups available</h3>
          <p>No approved startups yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>Milestones</h1>
        <p>Track progress, submit evidence, and unlock funding as you hit each milestone.</p>
      </div>

      {/* Startup selector */}
      <div style={{ marginBottom: "24px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {selectorStartups.map((s) => (
          <button
            key={s.id}
            className={`btn btn-sm${effectiveId === s.id ? " btn-primary" : " btn-ghost"}`}
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
          const isActive = m.status === "In Progress" || m.status === "Pending DAO Approval";
          const isUnlocked = m.status === "In Progress"
            || (m.status === "Locked" && (i === 0 || ms[i-1]?.status === "Completed"));
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
                      <div className="success-box mt-8" style={{ padding: "10px 14px", flexDirection: "column", alignItems: "flex-start", gap: "6px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "1rem" }}>💸</span>
                          <p style={{ fontSize: ".82rem", margin: 0 }}>{fmt(m.amount)} released to your wallet</p>
                        </div>
                        {m.releaseTxHash && (
                          <div style={{ fontSize: ".75rem", color: "var(--success)" }}>
                            On-chain tx: <span style={{ fontFamily: "monospace" }} title={m.releaseTxHash}>{shortHash(m.releaseTxHash)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Submit evidence button — available for unlocked milestones that aren't pending/completed */}
                  {role === "Founder" && isUnlocked && m.status !== "Pending DAO Approval" && m.status !== "Completed" && (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ flexShrink: 0 }}
                      onClick={() => setEvidenceModal(m)}
                    >
                      Submit Evidence
                    </button>
                  )}

                  {role === "Founder" && m.status === "Locked" && !isUnlocked && (
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
          onSubmitDone={handleSubmitEvidence}
        />
      )}
    </div>
  );
}
