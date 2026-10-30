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
  const [apiError, setApiError] = useState("");
  const [onChainResult, setOnChainResult] = useState(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    industry: "",
    teamMembers: "",
    fundingRequired: "",
  });
  const [milestones, setMilestones] = useState([
    { title: "", description: "", amount: "" },
  ]);

  function handle(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleFile(e) {
    if (e.target.files[0]) setFileName(e.target.files[0].name);
  }

  function updateMilestone(idx, field, value) {
    setMilestones((ms) => ms.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  }

  function addMilestone() {
    setMilestones((ms) => [...ms, { title: "", description: "", amount: "" }]);
  }

  function removeMilestone(idx) {
    setMilestones((ms) => ms.filter((_, i) => i !== idx));
  }

  const totalMilestoneAmount = milestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
  const target = Number(form.fundingRequired) || 0;
  const amountsMatch = Math.abs(totalMilestoneAmount - target) < 0.01;

  async function submit(e) {
    e.preventDefault();
    setApiError("");

    // Validate milestones
    if (milestones.length === 0) { setApiError("Add at least one milestone."); return; }
    for (const m of milestones) {
      if (!m.title.trim()) { setApiError("Every milestone needs a title."); return; }
      if (!m.amount || Number(m.amount) <= 0) { setApiError("Milestone amounts must be positive."); return; }
    }
    if (!amountsMatch) {
      setApiError(`Milestone amounts (₹${totalMilestoneAmount.toLocaleString("en-IN")}) must sum to funding target (₹${target.toLocaleString("en-IN")}).`);
      return;
    }

    try {
      const result = await addStartup({
        name: form.name,
        description: form.description,
        industry: form.industry,
        team: form.teamMembers.split(",").map((s) => s.trim()).filter(Boolean),
        fundingRequired: Number(form.fundingRequired),
        pitchDeck: fileName || "pitch_deck.pdf",
        tags: [form.industry],
        milestones: milestones.map((m) => ({
          title: m.title,
          description: m.description,
          amount: Number(m.amount),
        })),
      });
      if (result?.onChainRegistration) {
        setOnChainResult(result.onChainRegistration);
      }
      setSubmitted(true);
    } catch (err) {
      setApiError(err.message || "Failed to submit startup. Is the backend running?");
    }
  }

  if (submitted) {
    return (
      <div className="page-wrapper">
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", paddingTop: "40px" }}>
          <div style={{ fontSize: "4rem", marginBottom: "16px" }}>✅</div>
          <h2 style={{ marginBottom: "12px" }}>Startup Created!</h2>
          <p style={{ marginBottom: "24px" }}>
            <strong>{form.name}</strong> has been created and is available to investors.
          </p>

          {onChainResult?.txHash && (
            <div className="success-box" style={{ justifyContent: "center", marginBottom: "20px" }}>
              <span className="icon">⛓</span>
              <p>Registered on smart contract — tx: {onChainResult.txHash.slice(0, 18)}…</p>
            </div>
          )}
          {onChainResult?.error && (
            <div style={{ background: "#FEF3C7", border: "1.5px solid #FCD34D", borderRadius: "var(--radius)", padding: "20px", marginBottom: "28px" }}>
              <div style={{ fontSize: "1.3rem", marginBottom: "8px" }}>⚠️</div>
              <div style={{ fontWeight: 700, color: "#92400E", marginBottom: "4px" }}>On-chain registration pending</div>
              <div style={{ fontSize: ".85rem", color: "#B45309" }}>
                Your startup is saved in the database but not yet on the smart contract.
                Reason: {onChainResult.error}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={() => navigate(`/startup/${submitted ? '' : ''}`)}>
              Go to Dashboard
            </button>
            <button className="btn btn-ghost" onClick={() => navigate("/marketplace")}>
              View Marketplace
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
          <p>Fill in the details below. Your startup will be registered on the smart contract and made available to investors.</p>
        </div>

        <div className="card">
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Name */}
            <div className="form-group">
              <label className="form-label">Startup Name *</label>
              <input className="form-input" name="name" placeholder="My Startup" value={form.name} onChange={handle} required />
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Description *</label>
              <textarea className="form-input" name="description" placeholder="Describe your startup…" value={form.description} onChange={handle} required style={{ minHeight: 120 }} />
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
              <input className="form-input" name="teamMembers" placeholder="Name (Role), Name (Role)" value={form.teamMembers} onChange={handle} />
              <span style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>Separate names with commas</span>
            </div>

            {/* Funding */}
            <div className="form-group">
              <label className="form-label">Total Funding Target (₹) *</label>
              <input className="form-input" name="fundingRequired" type="number" placeholder="1000000" value={form.fundingRequired} onChange={handle} required min="1" />
              {form.fundingRequired && (
                <span style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>
                  = ₹{Number(form.fundingRequired).toLocaleString("en-IN")}
                </span>
              )}
            </div>

            {/* Milestones */}
            <div className="form-group">
              <label className="form-label">Milestones *</label>
              <p style={{ fontSize: ".8rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                Define milestone tranches. Amounts must sum to the total funding target.
              </p>

              {milestones.map((m, idx) => (
                <div key={idx} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "16px", marginBottom: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <strong style={{ fontSize: ".85rem" }}>Milestone {idx + 1}</strong>
                    {milestones.length > 1 && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeMilestone(idx)} style={{ fontSize: ".72rem", padding: "2px 8px" }}>Remove</button>
                    )}
                  </div>
                  <input className="form-input" placeholder="Milestone title" value={m.title} onChange={(e) => updateMilestone(idx, "title", e.target.value)} style={{ marginBottom: "8px" }} />
                  <textarea className="form-input" placeholder="What will be achieved? What evidence will you provide?" value={m.description} onChange={(e) => updateMilestone(idx, "description", e.target.value)} style={{ marginBottom: "8px", minHeight: 60 }} />
                  <input className="form-input" type="number" placeholder="Amount (₹)" value={m.amount} onChange={(e) => updateMilestone(idx, "amount", e.target.value)} min="1" />
                </div>
              ))}

              <button type="button" className="btn btn-secondary btn-sm" onClick={addMilestone}>+ Add Milestone</button>

              {milestones.length > 0 && form.fundingRequired && (
                <div style={{ marginTop: "12px", fontSize: ".82rem" }}>
                  <span style={{ color: amountsMatch ? "var(--success)" : "var(--danger)" }}>
                    Milestone total: ₹{totalMilestoneAmount.toLocaleString("en-IN")} / Target: ₹{target.toLocaleString("en-IN")} {amountsMatch ? "✓" : "✗"}
                  </span>
                </div>
              )}
            </div>

            {/* Pitch deck */}
            <div className="form-group">
              <label className="form-label">Pitch Deck (PDF)</label>
              <div style={{ border: "2px dashed var(--border)", borderRadius: "var(--radius)", padding: "28px", textAlign: "center", cursor: "pointer", position: "relative", background: "var(--bg)" }}>
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
                <input type="file" accept=".pdf" onChange={handleFile} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full btn-lg">
              Create Startup →
            </button>
            {apiError && (
              <div style={{ color: "var(--danger)", fontSize: ".85rem", padding: "10px", background: "#FEE2E2", borderRadius: "var(--radius-sm)" }}>
                ⚠️ {apiError}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
