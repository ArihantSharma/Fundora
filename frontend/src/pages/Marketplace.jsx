import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

function fmt(n) {
  if (n >= 100000) return "₹" + (n / 100000).toFixed(1).replace(".0", "") + "L";
  if (n >= 1000)   return "₹" + (n / 1000).toFixed(0) + "K";
  return "₹" + n;
}

function statusBadge(s) {
  const map = { Approved: "badge-success", Pending: "badge-pending", Rejected: "badge-danger" };
  return <span className={`badge ${map[s] || "badge-muted"}`}>{s}</span>;
}

const FILTERS = ["All", "Clean Technology", "AgriTech", "HealthTech", "FinTech", "EdTech"];

export default function Marketplace() {
  const { startups } = useApp();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const visible = startups.filter((s) => {
    const matchStatus = true; // show all for demo
    const matchIndustry = filter === "All" || s.industry === filter;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.industry.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchIndustry && matchSearch;
  });

  return (
    <div className="page-wrapper wide">
      <div className="page-header">
        <h1>Startup Marketplace</h1>
        <p>Discover and invest in community-approved startups.</p>
      </div>

      {/* Search + filter bar */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="form-input"
          style={{ maxWidth: 280 }}
          placeholder="🔍  Search startups…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`btn btn-sm${filter === f ? " btn-primary" : " btn-ghost"}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: "auto", fontSize: ".85rem", color: "var(--text-muted)" }}>
          {visible.length} startup{visible.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Cards grid */}
      {visible.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🔍</div>
          <h3>No startups found</h3>
          <p>Try adjusting your search or filter.</p>
        </div>
      ) : (
        <div className="grid-3" style={{ alignItems: "stretch" }}>
          {visible.map((s) => {
            const pct = Math.round((s.fundingReceived / s.fundingRequired) * 100);
            return (
              <div key={s.id} className="startup-card">
                {/* Header */}
                <div className="startup-card-header">
                  <div>
                    <div className="startup-card-name">{s.name}</div>
                    <div className="startup-card-industry">{s.industry}</div>
                  </div>
                  {statusBadge(s.status)}
                </div>

                {/* Tags */}
                <div className="tags">
                  {(s.tags || []).map((t) => <span key={t} className="tag">{t}</span>)}
                </div>

                {/* Description */}
                <p className="startup-card-desc">{s.description}</p>

                {/* Funding */}
                <div>
                  <div className="startup-card-funding">
                    <span>Raised {fmt(s.fundingReceived)}</span>
                    <span>Goal {fmt(s.fundingRequired)}</span>
                  </div>
                  <div className="progress-bar-wrap">
                    <div className="progress-bar-fill" style={{ width: Math.min(pct, 100) + "%" }} />
                  </div>
                  <div style={{ fontSize: ".75rem", color: "var(--text-muted)", marginTop: "4px" }}>{pct}% funded</div>
                </div>

                {/* Footer */}
                <div className="startup-card-footer">
                  <div>
                    <div style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>Founder</div>
                    <div style={{ fontSize: ".85rem", fontWeight: 600 }}>{s.founder}</div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate(`/startup/${s.id}`)}
                  >
                    View Details →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
