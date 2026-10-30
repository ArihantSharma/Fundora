import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

const ROLE_OPTIONS = [
  { value: "Founder",    icon: "🚀", label: "Founder" },
  { value: "Investor",   icon: "💼", label: "Investor" },
  { value: "DAO Member", icon: "🗳️", label: "DAO Member" },
];

export default function Auth() {
  const { user, login, register } = useApp();
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [selectedRole, setSelectedRole] = useState("Founder");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // If already logged in, redirect to the right page.
  useEffect(() => {
    if (user) {
      if (user.role === "Founder") navigate("/dashboard");
      else if (user.role === "Investor") navigate("/marketplace");
      else navigate("/dao");
    }
  }, [user]);

  function handle(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError("");
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      let loggedInUser;
      if (isLogin) {
        loggedInUser = await login(form.email, form.password);
      } else {
        if (!form.name.trim()) { setError("Please enter your name."); setSubmitting(false); return; }
        loggedInUser = await register(form.name, form.email, form.password, selectedRole);
      }
      if (loggedInUser.role === "Founder") navigate("/dashboard");
      else if (loggedInUser.role === "Investor") navigate("/marketplace");
      else navigate("/dao");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
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
              minLength={8}
            />
          </div>

          {!isLogin && (
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
          )}

          {error && (
            <div style={{
              padding: "10px 14px",
              background: "#FEE2E2",
              border: "1px solid #FCA5A5",
              borderRadius: "var(--radius-sm)",
              color: "#991B1B",
              fontSize: ".85rem",
            }}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-full" disabled={submitting} style={{ marginTop: "4px" }}>
            {submitting ? "Please wait…" : isLogin ? "Sign In →" : "Create Account →"}
          </button>
        </form>

        <div className="auth-switch">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => { setIsLogin((v) => !v); setError(""); }}>
            {isLogin ? "Register" : "Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}
