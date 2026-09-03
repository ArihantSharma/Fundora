import { useNavigate } from "react-router-dom";

const features = [
  {
    icon: "🚀",
    title: "Milestone-Based Funding",
    desc: "Startups receive funds only when they hit verified milestones, reducing risk for investors.",
  },
  {
    icon: "🗳️",
    title: "DAO Governance",
    desc: "Every incubation decision is voted on by the community. Transparent, fair, decentralised.",
  },
  {
    icon: "🔒",
    title: "Trustless Escrow",
    desc: "Smart contracts hold and release funds automatically — no middlemen, no delays.",
  },
  {
    icon: "📈",
    title: "Open Marketplace",
    desc: "Browse approved startups, review milestones, and invest in projects you believe in.",
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div>
      {/* Hero */}
      <section className="landing-hero">
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
          <span style={{ fontSize: "2.5rem" }}>⬡</span>
          <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--brand)", letterSpacing: "-1px" }}>Fundora</span>
        </div>

        <h1>
          Empowering Startups.<br />
          <span style={{ color: "var(--brand)" }}>Funding Progress.</span><br />
          Governed Together.
        </h1>

        <p className="tagline">
          A decentralised incubation platform where startups get milestone-based funding, governed by a community DAO. Transparent. Accountable. Open to all.
        </p>

        <div className="hero-btns">
          <button className="btn btn-primary btn-lg" onClick={() => navigate("/auth")}>
            Get Started →
          </button>
          <button className="btn btn-ghost btn-lg" onClick={() => navigate("/marketplace")}>
            Explore Startups
          </button>
        </div>

        {/* Quick stats */}
        <div style={{
          display: "flex", gap: "40px", marginTop: "56px", flexWrap: "wrap", justifyContent: "center",
        }}>
          {[["12", "Startups Funded"], ["₹48L", "Capital Deployed"], ["94%", "DAO Approval Rate"]].map(([val, label]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--brand)" }}>{val}</div>
              <div style={{ fontSize: ".8rem", color: "var(--text-muted)", fontWeight: 500, marginTop: "2px" }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <div className="landing-features" style={{ paddingBottom: "80px" }}>
        {features.map((f) => (
          <div key={f.title} className="feature-card">
            <div className="f-icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA strip */}
      <div style={{
        background: "var(--brand)",
        color: "#fff",
        textAlign: "center",
        padding: "56px 24px",
      }}>
        <h2 style={{ color: "#fff", marginBottom: "12px" }}>Ready to build the next big thing?</h2>
        <p style={{ color: "rgba(255,255,255,.75)", marginBottom: "28px" }}>
          Register your startup today and get community-backed milestone funding.
        </p>
        <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            className="btn btn-lg"
            style={{ background: "#fff", color: "var(--brand)" }}
            onClick={() => navigate("/auth")}
          >
            Register as Founder
          </button>
          <button
            className="btn btn-lg btn-outline"
            style={{ borderColor: "rgba(255,255,255,.5)", color: "#fff" }}
            onClick={() => navigate("/auth")}
          >
            Join as Investor
          </button>
        </div>
      </div>
    </div>
  );
}
