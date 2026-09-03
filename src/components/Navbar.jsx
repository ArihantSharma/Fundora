import { NavLink, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function Navbar() {
  const { role, setRole, walletConnected, setWalletConnected, walletAddress } = useApp();
  const navigate = useNavigate();

  const roles = ["Founder", "Investor", "DAO Member"];

  function handleRoleChange(r) {
    setRole(r);
    // Navigate to the relevant dashboard
    if (r === "Founder") navigate("/dashboard");
    else if (r === "Investor") navigate("/marketplace");
    else navigate("/dao");
  }

  return (
    <nav className="navbar">
      <NavLink to="/" className="navbar-logo">
        <span className="logo-dot" />
        Fundora
      </NavLink>

      <div className="navbar-links">
        <NavLink to="/dashboard"   className={({ isActive }) => isActive ? "active" : ""}>Dashboard</NavLink>
        <NavLink to="/marketplace" className={({ isActive }) => isActive ? "active" : ""}>Marketplace</NavLink>
        <NavLink to="/dao"         className={({ isActive }) => isActive ? "active" : ""}>DAO</NavLink>
        <NavLink to="/milestones"  className={({ isActive }) => isActive ? "active" : ""}>Milestones</NavLink>
      </div>

      <div className="navbar-right">
        {/* Inline role switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: ".75rem", color: "var(--text-muted)", fontWeight: 600 }}>View as:</span>
          {roles.map((r) => (
            <button
              key={r}
              onClick={() => handleRoleChange(r)}
              className={`role-btn${role === r ? " active" : ""}`}
              style={{ padding: "4px 10px", fontSize: ".75rem" }}
            >
              {r}
            </button>
          ))}
        </div>

        <span className="role-badge">{role}</span>

        <button
          className={`wallet-btn${walletConnected ? " connected" : ""}`}
          onClick={() => setWalletConnected((v) => !v)}
        >
          <span className="wallet-dot" />
          {walletConnected ? walletAddress : "Connect Wallet"}
        </button>
      </div>
    </nav>
  );
}
