import { NavLink, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function Navbar() {
  const {
    user, logout,
    walletAddress, walletBalance,
    walletConnected, walletError,
    connectMetaMask, disconnectWallet,
  } = useApp();
  const navigate = useNavigate();

  // Show only nav links relevant to the user's role.
  const navLinks = [];
  if (user?.role === "Founder") {
    navLinks.push({ to: "/dashboard", label: "Dashboard" });
    navLinks.push({ to: "/milestones", label: "Milestones" });
  }
  if (user?.role === "Investor") {
    navLinks.push({ to: "/marketplace", label: "Marketplace" });
  }
  if (user?.role === "DAO Member") {
    navLinks.push({ to: "/dao", label: "DAO" });
  }
  // Marketplace is visible to everyone, DAO to DAO members, milestones to founders.
  if (user?.role !== "Investor") {
    navLinks.push({ to: "/marketplace", label: "Marketplace" });
  }

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <nav className="navbar">
      <NavLink to="/" className="navbar-logo">
        <span className="logo-dot" />
        Fundora
      </NavLink>

      <div className="navbar-links">
        {/* Show only links the current role can access (deduplicated) */}
        {[...new Map(navLinks.map((l) => [l.to, l])).values()].map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => isActive ? "active" : ""}>
            {l.label}
          </NavLink>
        ))}
      </div>

      <div className="navbar-right">
        {/* Logged-in user badge + logout */}
        {user && (
          <>
            <span className="role-badge">{user.role}</span>
            <span style={{ fontSize: ".8rem", color: "var(--text-muted)", fontWeight: 500 }}>
              {user.name}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ fontSize: ".78rem" }}>
              Logout
            </button>
          </>
        )}

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
