import { MemoryRouter, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Welcome from "./pages/Welcome";
import CaseLibrary from "./pages/CaseLibrary";
import CreateCase from "./pages/CreateCase";
import CaseDetail from "./pages/CaseDetail";
import SecureSubmission from "./pages/SecureSubmission";
import AccessControl from "./pages/AccessControl";
import PasswordSettings from "./pages/PasswordSettings";
import { AuthProvider } from "./auth/AuthContext";
import { useAuth } from "./auth/context";

function Protected({ permission, children, deniedMessage }) {
  const { user, loading } = useAuth();
  if (loading) return <p role="status" style={{ padding: 24 }}>Checking session…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (permission && !user.permissions.includes(permission)) {
    if (deniedMessage) return <main role="alert" style={{ padding: 24 }}>
      <p>{deniedMessage}</p>
      <Link to="/welcome">Return to Overview</Link>
    </main>;
    return <Navigate to="/welcome" replace />;
  }
  return children;
}

function AppRoutes() {
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation;
  const { user, loading, accessError, retryAccess } = useAuth();
  if (loading) {
    return <p role="status" style={{ padding: 24 }}>Checking session…</p>;
  }
  if (accessError) return <main role="alert" style={{ padding: 24 }}>
    <p>Could not verify your access: {accessError}</p>
    <button type="button" onClick={retryAccess}>Retry</button>
  </main>;
  return <><Routes location={backgroundLocation || location}>
    <Route path="/" element={<Navigate to={user ? "/welcome" : "/login"} replace />} />
    <Route path="/login" element={user ? <Navigate to="/welcome" replace /> : <Login />} />
    <Route path="/welcome" element={<Protected>{user?.role_name === "admin" ? <AccessControl asOverview /> : <Welcome />}</Protected>} />
    <Route path="/cases" element={<Protected permission="case:view"><CaseLibrary /></Protected>} />
    <Route path="/cases/new" element={<Protected permission="case:create"
      deniedMessage="Your account does not have permission to create cases."><CreateCase /></Protected>} />
    <Route path="/cases/detail" element={<Protected permission="case:view"><CaseDetail /></Protected>} />
    <Route path="/submission" element={<Protected permission="evidence:upload"><SecureSubmission /></Protected>} />
    <Route path="/audit" element={<Protected permission="user:manage"><Navigate to="/access-control" replace /></Protected>} />
    <Route path="/access-control" element={<Protected>{user?.role_name === "admin" ? <Navigate to="/welcome" replace /> : <AccessControl />}</Protected>} />
    <Route path="/settings/password" element={<Protected><PasswordSettings /></Protected>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
    {backgroundLocation && <Routes>
      <Route path="/settings/password" element={<Protected><PasswordSettings /></Protected>} />
    </Routes>}
  </>;
}

function App() {
  return (
    <MemoryRouter>
      <AuthProvider><AppRoutes /></AuthProvider>
    </MemoryRouter>
  );
}

export default App;
