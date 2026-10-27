import { NavLink, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function Navbar() {
  const {
    role, setRole,
    walletAddress, walletBalance,
    walletConnected, walletError,
    connectMetaMask, disconnectWallet,
  } = useApp();
  const navigate = useNavigate();

  const roles = ["Founder", "Investor", "DAO Member"];

  function handleRoleChange(r) {
    setRole(r);
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
        {/* Role switcher */}
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

        {/* Wallet button */}
        {walletConnected ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="wallet-btn connected" style={{ cursor: "default", flexDirection: "column", alignItems: "flex-start", gap: "1px", padding: "5px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span className="wallet-dot" />
                <span style={{ fontSize: ".78rem", fontWeight: 700 }}>
                  {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
                </span>
              </div>
              <div style={{ fontSize: ".7rem", color: "var(--success)", opacity: .85 }}>{walletBalance} ETH</div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={disconnectWallet}
              style={{ fontSize: ".72rem", padding: "4px 8px" }}
              title="Disconnect wallet"
            >
              ✕
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
            <button className="wallet-btn" onClick={connectMetaMask}>
              <span className="wallet-dot" />
              Connect Wallet
            </button>
            {walletError && (
              <span style={{ fontSize: ".68rem", color: "var(--danger)", maxWidth: "200px", textAlign: "right", lineHeight: 1.3 }}>
                {walletError}
              </span>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
