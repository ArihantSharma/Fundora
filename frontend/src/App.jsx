import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import Navbar from "./components/Navbar";

import Landing         from "./pages/Landing";
import Auth            from "./pages/Auth";
import Dashboard       from "./pages/Dashboard";
import RegisterStartup from "./pages/RegisterStartup";
import Marketplace     from "./pages/Marketplace";
import StartupDetails  from "./pages/StartupDetails";
import DAOProposals    from "./pages/DAOProposals";
import Milestones      from "./pages/Milestones";

// ── Route guard ──────────────────────────────────────────────────────────────
// Redirects unauthenticated users to /auth.
// If allowedRoles is provided, also enforces the user's role.
function PrivateRoute({ children, allowedRoles }) {
  const { user, authLoading } = useApp();

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--text-muted)", fontSize: "1rem" }}>Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to the user's default page instead of showing a blank error.
    const home = user.role === "Founder" ? "/dashboard"
               : user.role === "Investor" ? "/marketplace"
               : "/dao";
    return <Navigate to={home} replace />;
  }

  return children;
}

function Layout({ children }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />

          {/* Protected — any authenticated user */}
          <Route path="/marketplace" element={
            <PrivateRoute>
              <Layout><Marketplace /></Layout>
            </PrivateRoute>
          } />
          <Route path="/startup/:id" element={
            <PrivateRoute>
              <Layout><StartupDetails /></Layout>
            </PrivateRoute>
          } />

          {/* Founder only */}
          <Route path="/dashboard" element={
            <PrivateRoute allowedRoles={["Founder"]}>
              <Layout><Dashboard /></Layout>
            </PrivateRoute>
          } />
          <Route path="/register-startup" element={
            <PrivateRoute allowedRoles={["Founder"]}>
              <Layout><RegisterStartup /></Layout>
            </PrivateRoute>
          } />
          <Route path="/milestones" element={
            <PrivateRoute allowedRoles={["Founder"]}>
              <Layout><Milestones /></Layout>
            </PrivateRoute>
          } />

          {/* DAO Member only */}
          <Route path="/dao" element={
            <PrivateRoute allowedRoles={["DAO Member"]}>
              <Layout><DAOProposals /></Layout>
            </PrivateRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
