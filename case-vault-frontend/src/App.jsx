import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Welcome from "./pages/Welcome";
import CaseLibrary from "./pages/CaseLibrary";
import CaseDetail from "./pages/CaseDetail";
import SecureSubmission from "./pages/SecureSubmission";
import AuditTrail from "./pages/AuditTrail";
import AccessControl from "./pages/AccessControl";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/cases" element={<CaseLibrary />} />
        <Route path="/cases/detail" element={<CaseDetail />} />
        <Route path="/submission" element={<SecureSubmission />} />
        <Route path="/audit" element={<AuditTrail />} />
        <Route path="/access-control" element={<AccessControl />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;