import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp, API } from "../context/AppContext";

function fmt(n) {
  if (n >= 100000) return "₹" + (n / 100000).toFixed(0) + "L";
  if (n >= 1000)   return "₹" + (n / 1000).toFixed(0) + "K";
  return "₹" + n;
}

function statusBadge(s) {
  const map = { Approved: "badge-success", Pending: "badge-pending", Rejected: "badge-danger" };
  return <span className={`badge ${map[s] || "badge-muted"}`}>{s}</span>;
}

// ── Founder Dashboard ────────────────────────────────────────────────────────
function FounderDash({ user, startups, milestones }) {
  const navigate = useNavigate();
  const { walletConnected, registerStartupOnChain } = useApp();
  const [registerMsg, setRegisterMsg] = useState("");

  // Show only the logged-in founder's own startup(s).
  const myStartups = startups.filter((s) => s.founderId === user.id);

  // Allow switching between multiple startups.
  const [selectedId, setSelectedId] = useState(null);
  const myStartup = selectedId
    ? myStartups.find((s) => s.id === selectedId) || myStartups[0]
    : myStartups[0];

  if (myStartups.length === 0) {
    return (
      <div className="page-wrapper">
        <div className="page-header">
          <h1>Founder Dashboard 🚀</h1>
          <p>Welcome, {user.name}. Get started by registering your startup.</p>
        </div>
        <div className="empty-state">
          <div className="icon">🚀</div>
          <h3>No startup yet</h3>
          <p>Register your startup to begin the incubation process.</p>
          <button className="btn btn-primary mt-16" onClick={() => navigate("/register-startup")}>
            Register Startup
          </button>
        </div>
      </div>
    );
  }

  const ms      = milestones[myStartup.id] || [];
  const pct     = myStartup.fundingRequired > 0
    ? Math.min(Math.round((myStartup.fundingReceived / myStartup.fundingRequired) * 100), 100)
    : 0;
  const current = ms.find((m) => m.status === "In Progress")
               || ms.find((m) => m.status === "Pending DAO Approval");

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>Founder Dashboard 🚀</h1>
        <p>Welcome back, {user.name}. Here's your startup overview.</p>
      </div>

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
          <div className="stat-value">
            {ms.filter((m) => m.status === "Completed").length}/{ms.length}
          </div>
          <div className="stat-sub">completed</div>
        </div>
      </div>

      <div className="dash-grid">
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
              <span>👥 {(myStartup.team || []).length} team members</span>
              {myStartup.submittedDate && <span>📅 {myStartup.submittedDate}</span>}
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
                  <div style={{ fontSize: ".85rem", color: "var(--text-muted)", marginTop: "4px" }}>
                    {current.description}
                  </div>
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
                ➕ Register Another Startup
              </button>
            </div>
          </div>

          {/* On-chain registration — shown only when startup is Approved but not yet on-chain */}
          {myStartup.status === "Approved" && !myStartup.contractAddress && (
            <div className="card" style={{ border: "1.5px solid var(--accent)" }}>
              <h3 className="mb-8">⛓ On-Chain Registration</h3>
              <p style={{ fontSize: ".85rem", marginBottom: "14px" }}>
                Your startup is DAO-approved. Register it on the smart contract so investors
                can fund it with ETH. You must connect your MetaMask wallet first.
              </p>
              {registerMsg && (
                <div style={{ fontSize: ".82rem", marginBottom: "12px",
                  color: registerMsg.startsWith("✅") ? "var(--success)" : "var(--danger)" }}>
                  {registerMsg}
                </div>
              )}
              <button
                className="btn btn-primary btn-sm"
                disabled={!walletConnected}
                onClick={async () => {
                  setRegisterMsg("Registering on-chain…");
                  try {
                    const r = await registerStartupOnChain(myStartup.id);
                    setRegisterMsg(r.alreadyRegistered
                      ? "✅ Already registered on-chain."
                      : `✅ Registered! Tx: ${r.txHash?.slice(0, 18)}…`);
                  } catch (e) {
                    setRegisterMsg("❌ " + e.message);
                  }
                }}
              >
                {walletConnected ? "🦊 Register on Smart Contract" : "Connect Wallet First"}
              </button>
            </div>
          )}

          {myStartup.contractAddress && (
            <div className="card">
              <h3 className="mb-8">⛓ On-Chain Status</h3>
              <div style={{ fontSize: ".82rem", color: "var(--success)" }}>✅ Registered on smart contract</div>
              <div style={{ fontSize: ".75rem", color: "var(--text-muted)", marginTop: "4px", fontFamily: "monospace" }}>
                {myStartup.contractAddress}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {ms.length > 0 && (
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
          )}

          {ms.length === 0 && (
            <div className="card">
              <h3 className="mb-12">Milestones Overview</h3>
              <p className="text-muted text-small">No milestones yet. Add milestones on the Milestones page.</p>
            </div>
          )}

          {/* All my startups if more than one — clickable selector */}
          {myStartups.length > 1 && (
            <div className="card">
              <h3 className="mb-12">My Startups ({myStartups.length})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {myStartups.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: ".85rem",
                      padding: "8px 10px",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      background: s.id === (myStartup?.id) ? "var(--brand-light)" : "var(--bg)",
                      border: `1px solid ${s.id === (myStartup?.id) ? "var(--brand)" : "var(--border)"}`,
                    }}
                  >
                    <span style={{ color: "var(--text)", fontWeight: s.id === myStartup?.id ? 700 : 500 }}>{s.name}</span>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      {statusBadge(s.status)}
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: ".7rem", padding: "2px 6px" }}
                        onClick={(e) => { e.stopPropagation(); navigate(`/startup/${s.id}`); }}>
                        View →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Investor Dashboard ───────────────────────────────────────────────────────
function InvestorDash({ user, startups }) {
  const navigate = useNavigate();
  const [portfolio,  setPortfolio]  = useState([]);
  const [portLoading, setPortLoading] = useState(true);
  const [portError,  setPortError]  = useState("");

  // Fetch this investor's real investments from the backend.
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/api/my/investments`, { credentials: "include" });
        if (res.ok) {
          setPortfolio(await res.json());
        } else {
          setPortError("Could not load portfolio.");
        }
      } catch {
        setPortError("Backend unreachable.");
      } finally {
        setPortLoading(false);
      }
    }
    load();
  }, []);

  const approved      = startups.filter((s) => s.status === "Approved");
  // Separate INR and ETH totals — never add them together.
  const totalInrInvested = portfolio.filter(inv => (inv.currency || "INR") === "INR")
                                    .reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const totalEthInvested = portfolio.filter(inv => (inv.currency || "INR") === "ETH")
                                    .reduce((sum, inv) => sum + (inv.amount || 0), 0);
  // Count distinct startups by startupName (best we can without ID in the response).
  const startupIds = [...new Set(portfolio.map(inv => inv.startupName).filter(Boolean))];

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>Investor Dashboard 💼</h1>
        <p>Welcome back, {user.name}. Monitor your portfolio and discover opportunities.</p>
      </div>

      <div className="stat-grid mb-24">
        <div className="stat-card">
          <div className="stat-label">Total Invested (₹)</div>
          <div className="stat-value" style={{ color: "var(--brand)" }}>
            {portLoading ? "…" : fmt(totalInrInvested)}
          </div>
        </div>
        {totalEthInvested > 0 && (
          <div className="stat-card">
            <div className="stat-label">Test ETH Invested</div>
            <div className="stat-value" style={{ color: "var(--accent)" }}>
              {portLoading ? "…" : `${totalEthInvested.toFixed(4)} ETH`}
            </div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-label">Startups Backed</div>
          <div className="stat-value">{portLoading ? "…" : startupIds.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Open Opportunities</div>
          <div className="stat-value">{approved.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Investments Made</div>
          <div className="stat-value">{portLoading ? "…" : portfolio.length}</div>
        </div>
      </div>

      {/* Portfolio */}
      <div className="card mb-24">
        <h3 className="mb-16">My Portfolio</h3>
        {portLoading && <p className="text-muted text-small">Loading portfolio…</p>}
        {portError  && <p style={{ color: "var(--danger)", fontSize: ".85rem" }}>⚠️ {portError}</p>}
        {!portLoading && !portError && portfolio.length === 0 && (
          <div className="empty-state" style={{ padding: "32px 0" }}>
            <div className="icon">💼</div>
            <h3>No investments yet</h3>
            <p>Browse the Marketplace to find startups to fund.</p>
            <button className="btn btn-primary mt-16" onClick={() => navigate("/marketplace")}>
              Explore Startups
            </button>
          </div>
        )}
        {!portLoading && portfolio.map((inv) => {
          const startup = startups.find((s) => s.name === inv.startupName);
          return (
            <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px", background: "var(--bg)", borderRadius: "var(--radius-sm)", marginBottom: "10px" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{inv.startupName || "Unknown startup"}</div>
                <div style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>
                  {(inv.currency || "INR") === "ETH"
                    ? `Invested ${Number(inv.amount).toFixed(4)} test ETH (on-chain)`
                    : `Invested ${fmt(inv.amount)}`}
                  {inv.txHash && <span style={{ marginLeft: "8px" }}>· tx confirmed ✓</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <span className="badge badge-success">Active</span>
                {startup && (
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/startup/${startup.id}`)}>
                    View →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Explore */}
      <div className="card">
        <div className="flex justify-between items-center mb-16">
          <h3>Explore Approved Startups</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/marketplace")}>
            View All →
          </button>
        </div>
        {approved.length === 0 ? (
          <p className="text-muted text-small">No approved startups yet.</p>
        ) : (
          approved.slice(0, 3).map((s) => {
            const pct = s.fundingRequired > 0
              ? Math.min(Math.round((s.fundingReceived / s.fundingRequired) * 100), 100) : 0;
            return (
              <div key={s.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>{s.industry} · {fmt(s.fundingRequired)} target</div>
                  <div className="progress-bar-wrap mt-8" style={{ width: "200px" }}>
                    <div className="progress-bar-fill" style={{ width: pct + "%" }} />
                  </div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => navigate(`/startup/${s.id}`)}>
                  Invest →
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── DAO Member Dashboard ─────────────────────────────────────────────────────
function DAOMemberDash({ user, proposals }) {
  const navigate = useNavigate();
  const pending   = proposals.filter((p) => p.status === "Pending");
  const approved  = proposals.filter((p) => p.status === "Approved");
  const myVotes   = proposals.filter((p) => p.hasVoted).length;
  const approvalRate = proposals.length > 0
    ? Math.round((approved.length / proposals.length) * 100) : 0;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>DAO Member Dashboard 🗳️</h1>
        <p>Welcome back, {user.name}. Review proposals and cast your votes.</p>
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
          <div className="stat-value">{myVotes}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approval Rate</div>
          <div className="stat-value" style={{ color: "var(--success)" }}>{approvalRate}%</div>
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-16">
          <h3>Pending Your Vote</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/dao")}>
            View All →
          </button>
        </div>
        {pending.length === 0 ? (
          <div className="text-muted text-small">All proposals have been reviewed. ✅</div>
        ) : (
          pending.map((p) => (
            <div key={p.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                    #{p.proposalNumber} — {p.title}
                  </div>
                  <div style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>
                    {p.type} · {p.submittedDate}
                    {p.hasVoted && <span style={{ marginLeft: "8px", color: "var(--success)" }}>Voted ✓</span>}
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => navigate("/dao")}>
                  Vote →
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, startups, milestones, proposals } = useApp();
  const role = user?.role;

  if (role === "Investor")   return <InvestorDash user={user} startups={startups} />;
  if (role === "DAO Member") return <DAOMemberDash user={user} proposals={proposals} />;
  return <FounderDash user={user} startups={startups} milestones={milestones} />;
}
