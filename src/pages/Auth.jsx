import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

const ROLE_OPTIONS = [
  { value: "Founder",    icon: "🚀", label: "Founder" },
  { value: "Investor",   icon: "💼", label: "Investor" },
  { value: "DAO Member", icon: "🗳️", label: "DAO Member" },
];

export default function Auth() {
  const { setRole } = useApp();
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [selectedRole, setSelectedRole] = useState("Founder");
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  function handle(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function submit(e) {
    e.preventDefault();
    setRole(selectedRole);
    if (selectedRole === "Founder") navigate("/dashboard");
    else if (selectedRole === "Investor") navigate("/marketplace");
    else navigate("/dao");
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px" }}>
          <span style={{ fontSize: "1.4rem" }}>⬡</span>
          <span style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--brand)" }}>Fundora</span>
        </div>

        <h2>{isLogin ? "Welcome back" : "Create account"}</h2>
        <p>{isLogin ? "Sign in to continue to Fundora." : "Join the Fundora ecosystem today."}</p>

        <form className="auth-form" onSubmit={submit}>
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                name="name"
                placeholder="Arjun Mehta"
                value={form.name}
                onChange={handle}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handle}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              name="password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handle}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Your Role</label>
            <div className="role-select-grid">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  className={`role-select-btn${selectedRole === r.value ? " active" : ""}`}
                  onClick={() => setSelectedRole(r.value)}
                >
                  <span className="r-icon">{r.icon}</span>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: "4px" }}>
            {isLogin ? "Sign In →" : "Create Account →"}
          </button>
        </form>

        <div className="auth-switch">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => setIsLogin((v) => !v)}>
            {isLogin ? "Register" : "Sign In"}
          </button>
        </div>

        {/* Demo hint */}
        <div style={{
          marginTop: "20px",
          padding: "12px 16px",
          background: "var(--brand-light)",
          borderRadius: "var(--radius-sm)",
          fontSize: ".8rem",
          color: "var(--brand)",
        }}>
          💡 <strong>Prototype mode:</strong> Select any role and click Sign In to explore the full demo.
        </div>
      </div>
    </div>
  );
}
