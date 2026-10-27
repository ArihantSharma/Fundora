import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

const ACTIVITY = [
  { icon: "✅", text: "Milestone 1 approved by DAO", time: "2 days ago" },
  { icon: "💰", text: "₹2,00,000 released to your wallet", time: "2 days ago" },
  { icon: "👀", text: "Investor viewed your startup profile", time: "5 days ago" },
  { icon: "🗳️", text: "DAO voted to approve your startup", time: "1 week ago" },
  { icon: "📤", text: "Startup submitted for DAO approval", time: "10 days ago" },
];

function fmt(n) {
  if (n >= 100000) return "₹" + (n / 100000).toFixed(0) + "L";
  if (n >= 1000)   return "₹" + (n / 1000).toFixed(0) + "K";
  return "₹" + n;
}

function statusBadge(s) {
  const map = {
    Approved: "badge-success",
    Pending:  "badge-pending",
    Rejected: "badge-danger",
  };
  return <span className={`badge ${map[s] || "badge-muted"}`}>{s}</span>;
}

function FounderDash({ startups, milestones }) {
  const navigate = useNavigate();
  const myStartup = startups.find((s) => s.name === "EcoTech Solutions") || startups[0];
  if (!myStartup) {
    return (
      <div className="empty-state">
        <div className="icon">🚀</div>
        <h3>No startup yet</h3>
        <p>Register your startup to get started.</p>
        <button className="btn btn-primary mt-16" onClick={() => navigate("/register-startup")}>
          Register Startup
        </button>
      </div>
    );
  }

  const ms = milestones[myStartup.id] || [];
  const pct = Math.round((myStartup.fundingReceived / myStartup.fundingRequired) * 100);
  const current = ms.find((m) => m.status === "In Progress") || ms.find((m) => m.status === "Pending DAO Approval");

  return (
    <div>
      {/* Welcome */}
      <div className="page-header">
        <h1>Founder Dashboard 🚀</h1>
        <p>Track your startup's progress, funding, and milestones.</p>
      </div>

      {/* Stats */}
      <div className="stat-grid mb-24">
        <div className="stat-card">
          <div className="stat-label">Funding Required</div>
          <div className="stat-value">{fmt(myStartup.fundingRequired)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Funding Received</div>
          <div className="stat-value" style={{ color: "var(--success)" }}>{fmt(myStartup.fundingReceived)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Progress</div>
          <div className="stat-value">{pct}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Milestones</div>
          <div className="stat-value">{ms.filter((m) => m.status === "Completed").length}/{ms.length}</div>
          <div className="stat-sub">completed</div>
        </div>
      </div>

      <div className="dash-grid">
        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Startup overview */}
          <div className="card">
            <div className="flex justify-between items-center mb-16">
              <h3>{myStartup.name}</h3>
              {statusBadge(myStartup.status)}
            </div>
            <p style={{ fontSize: ".875rem", marginBottom: "16px" }}>{myStartup.description}</p>

            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", fontSize: ".85rem", color: "var(--text-muted)", marginBottom: "16px" }}>
              <span>🏭 {myStartup.industry}</span>
              <span>👥 {myStartup.team.length} team members</span>
              <span>📅 {myStartup.submittedDate}</span>
            </div>

            <div className="flex justify-between mb-4" style={{ fontSize: ".82rem" }}>
              <span className="text-muted">Funding Progress</span>
              <span className="fw-700">{fmt(myStartup.fundingReceived)} / {fmt(myStartup.fundingRequired)}</span>
            </div>
            <div className="progress-bar-wrap">
              <div className="progress-bar-fill" style={{ width: pct + "%" }} />
            </div>
          </div>

          {/* Current milestone */}
          {current && (
            <div className="card">
              <h3 className="mb-12">Current Milestone</h3>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{current.title}</div>
                  <div style={{ fontSize: ".85rem", color: "var(--text-muted)", marginTop: "4px" }}>{current.description}</div>
                  <div style={{ marginTop: "10px" }}>
                    <span className="badge badge-info">{fmt(current.amount)}</span>{" "}
                    {statusBadge(current.status)}
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => navigate("/milestones")}>
                  View →
                </button>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="card">
            <h3 className="mb-16">Quick Actions</h3>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate("/milestones")}>
                📋 View Milestones
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/startup/${myStartup.id}`)}>
                👁 View Public Profile
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate("/register-startup")}>
                ✏️ Edit Startup
              </button>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Activity */}
          <div className="card">
            <h3 className="mb-16">Recent Activity</h3>
            <div className="activity-list">
              {ACTIVITY.map((a, i) => (
                <div key={i} className="activity-item">
                  <div className="activity-icon">{a.icon}</div>
                  <div>
                    <div className="activity-text">{a.text}</div>
                    <div className="activity-time">{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Milestones mini */}
          <div className="card">
            <h3 className="mb-12">Milestones Overview</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {ms.map((m) => (
                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: ".85rem" }}>
                  <span style={{ color: "var(--text)" }}>{m.title}</span>
                  {statusBadge(m.status)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvestorDash({ startups }) {
  const navigate = useNavigate();
  const approved = startups.filter((s) => s.status === "Approved");
  const totalInvested = 600000; // demo value

  return (
    <div>
      <div className="page-header">
        <h1>Investor Dashboard 💼</h1>
        <p>Monitor your portfolio and discover new opportunities.</p>
      </div>

      <div className="stat-grid mb-24">
        <div className="stat-card">
          <div className="stat-label">Total Invested</div>
          <div className="stat-value" style={{ color: "var(--brand)" }}>₹6L</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Startups Backed</div>
          <div className="stat-value">1</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Open Opportunities</div>
          <div className="stat-value">{approved.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg. Return (est.)</div>
          <div className="stat-value" style={{ color: "var(--success)" }}>2.4x</div>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-16">My Portfolio</h3>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px", background: "var(--bg)", borderRadius: "var(--radius-sm)" }}>
          <div>
            <div style={{ fontWeight: 600 }}>EcoTech Solutions</div>
            <div style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>Clean Technology · Invested ₹6,00,000</div>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span className="badge badge-success">Active</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("/startup/1")}>View →</button>
          </div>
        </div>
      </div>

      <div className="card mt-24">
        <div className="flex justify-between items-center mb-16">
          <h3>Explore Startups</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/marketplace")}>View All →</button>
        </div>
        {approved.slice(0, 3).map((s) => {
          const pct = Math.round((s.fundingReceived / s.fundingRequired) * 100);
          return (
            <div key={s.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>{s.industry} · {fmt(s.fundingRequired)} target</div>
                <div className="progress-bar-wrap mt-8" style={{ width: "200px" }}>
                  <div className="progress-bar-fill" style={{ width: pct + "%" }} />
                </div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => navigate(`/startup/${s.id}`)}>Invest →</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DAOMemberDash({ proposals }) {
  const navigate = useNavigate();
  const pending = proposals.filter((p) => p.status === "Pending");

  return (
    <div>
      <div className="page-header">
        <h1>DAO Member Dashboard 🗳️</h1>
        <p>Review proposals and cast your votes to govern the ecosystem.</p>
      </div>

      <div className="stat-grid mb-24">
        <div className="stat-card">
          <div className="stat-label">Active Proposals</div>
          <div className="stat-value">{pending.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Proposals</div>
          <div className="stat-value">{proposals.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Your Votes Cast</div>
          <div className="stat-value">{proposals.filter((p) => p.hasVoted).length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approval Rate</div>
          <div className="stat-value" style={{ color: "var(--success)" }}>80%</div>
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-16">
          <h3>Pending Your Vote</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/dao")}>View All →</button>
        </div>
        {pending.length === 0 ? (
          <div className="text-muted text-small">All proposals have been reviewed. ✅</div>
        ) : (
          pending.map((p) => (
            <div key={p.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: "4px" }}>#{p.proposalNumber} — {p.title}</div>
                  <div style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>{p.type} · {p.submittedDate}</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => navigate("/dao")}>Vote →</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { role, startups, milestones, proposals } = useApp();

  if (role === "Investor")   return <div className="page-wrapper"><InvestorDash startups={startups} /></div>;
  if (role === "DAO Member") return <div className="page-wrapper"><DAOMemberDash proposals={proposals} /></div>;
  return <div className="page-wrapper"><FounderDash startups={startups} milestones={milestones} /></div>;
}
