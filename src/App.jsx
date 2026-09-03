import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import Navbar from "./components/Navbar";

import Landing        from "./pages/Landing";
import Auth           from "./pages/Auth";
import Dashboard      from "./pages/Dashboard";
import RegisterStartup from "./pages/RegisterStartup";
import Marketplace    from "./pages/Marketplace";
import StartupDetails from "./pages/StartupDetails";
import DAOProposals   from "./pages/DAOProposals";
import Milestones     from "./pages/Milestones";

// Pages that show the Navbar
const SHOW_NAV = ["/dashboard", "/register-startup", "/marketplace", "/startup", "/dao", "/milestones"];

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
          {/* Public – no navbar */}
          <Route path="/"     element={<Landing />} />
          <Route path="/auth" element={<Auth />} />

          {/* App pages – with navbar */}
          <Route path="/dashboard"        element={<Layout><Dashboard /></Layout>} />
          <Route path="/register-startup" element={<Layout><RegisterStartup /></Layout>} />
          <Route path="/marketplace"      element={<Layout><Marketplace /></Layout>} />
          <Route path="/startup/:id"      element={<Layout><StartupDetails /></Layout>} />
          <Route path="/dao"              element={<Layout><DAOProposals /></Layout>} />
          <Route path="/milestones"       element={<Layout><Milestones /></Layout>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
