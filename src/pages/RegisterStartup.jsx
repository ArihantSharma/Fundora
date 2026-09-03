import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

const INDUSTRIES = [
  "Clean Technology", "AgriTech", "HealthTech", "FinTech", "EdTech",
  "E-Commerce", "Logistics", "SaaS", "AI / ML", "Other",
];

export default function RegisterStartup() {
  const { addStartup } = useApp();
  const navigate = useNavigate();

  const [submitted, setSubmitted] = useState(false);
  const [fileName, setFileName] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    industry: "",
    teamMembers: "",
    fundingRequired: "",
  });

  function handle(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleFile(e) {
    if (e.target.files[0]) setFileName(e.target.files[0].name);
  }

  function submit(e) {
    e.preventDefault();
    addStartup({
      name: form.name,
      description: form.description,
      industry: form.industry,
      team: form.teamMembers.split(",").map((s) => s.trim()).filter(Boolean),
      fundingRequired: Number(form.fundingRequired),
      pitchDeck: fileName || "pitch_deck.pdf",
      tags: [form.industry],
      founder: "You",
    });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="page-wrapper">
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", paddingTop: "40px" }}>
          <div style={{ fontSize: "4rem", marginBottom: "16px" }}>📤</div>
          <h2 style={{ marginBottom: "12px" }}>Startup Submitted!</h2>
          <p style={{ marginBottom: "24px" }}>
            <strong>{form.name}</strong> has been submitted for DAO approval. The community will review and vote on your proposal.
          </p>

          <div style={{ background: "#FEF3C7", border: "1.5px solid #FCD34D", borderRadius: "var(--radius)", padding: "20px", marginBottom: "28px" }}>
            <div style={{ fontSize: "1.3rem", marginBottom: "8px" }}>⏳</div>
            <div style={{ fontWeight: 700, color: "#92400E", marginBottom: "4px" }}>Pending DAO Approval</div>
            <div style={{ fontSize: ".85rem", color: "#B45309" }}>
              Your proposal has been sent to DAO members for review. Typically takes 2–5 days.
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={() => navigate("/dao")}>
              View DAO Proposals
            </button>
            <button className="btn btn-ghost" onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div className="page-header">
          <h1>Register Your Startup</h1>
          <p>Fill in the details below. Your startup will be submitted to the DAO for approval.</p>
        </div>

        <div className="card">
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Name */}
            <div className="form-group">
              <label className="form-label">Startup Name *</label>
              <input
                className="form-input"
                name="name"
                placeholder="e.g. EcoTech Solutions"
                value={form.name}
                onChange={handle}
                required
              />
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Description *</label>
              <textarea
                className="form-input"
                name="description"
                placeholder="Describe your startup, problem you're solving, and your approach…"
                value={form.description}
                onChange={handle}
                required
                style={{ minHeight: 120 }}
              />
            </div>

            {/* Industry */}
            <div className="form-group">
              <label className="form-label">Industry *</label>
              <select className="form-input" name="industry" value={form.industry} onChange={handle} required>
                <option value="">Select industry</option>
                {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
              </select>
            </div>

            {/* Team */}
            <div className="form-group">
              <label className="form-label">Team Members</label>
              <input
                className="form-input"
                name="teamMembers"
                placeholder="Arjun Mehta (CEO), Priya Sharma (CTO)"
                value={form.teamMembers}
                onChange={handle}
              />
              <span style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>Separate names with commas</span>
            </div>

            {/* Funding */}
            <div className="form-group">
              <label className="form-label">Funding Required (₹) *</label>
              <input
                className="form-input"
                name="fundingRequired"
                type="number"
                placeholder="1000000"
                value={form.fundingRequired}
                onChange={handle}
                required
                min="1"
              />
              {form.fundingRequired && (
                <span style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>
                  = ₹{Number(form.fundingRequired).toLocaleString("en-IN")}
                </span>
              )}
            </div>

            {/* Pitch deck */}
            <div className="form-group">
              <label className="form-label">Pitch Deck (PDF)</label>
              <div style={{
                border: "2px dashed var(--border)",
                borderRadius: "var(--radius)",
                padding: "28px",
                textAlign: "center",
                cursor: "pointer",
                position: "relative",
                background: "var(--bg)",
              }}>
                {fileName ? (
                  <div>
                    <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>📄</div>
                    <div style={{ fontWeight: 600, color: "var(--text)" }}>{fileName}</div>
                    <div style={{ fontSize: ".8rem", color: "var(--success)", marginTop: "4px" }}>File attached ✓</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>📁</div>
                    <div style={{ fontWeight: 600, marginBottom: "4px" }}>Drop your pitch deck here</div>
                    <div style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>PDF, up to 20 MB</div>
                  </div>
                )}
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFile}
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                />
              </div>
            </div>

            {/* Info box */}
            <div style={{ background: "var(--brand-light)", borderRadius: "var(--radius-sm)", padding: "14px 16px", fontSize: ".85rem", color: "var(--brand)" }}>
              ℹ️ After submission, your startup will appear in the DAO proposals. Once 60% of DAO members vote YES, it will be listed on the Marketplace.
            </div>

            <button type="submit" className="btn btn-primary btn-full btn-lg">
              Submit for DAO Approval →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
