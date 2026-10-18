import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FolderPlus } from "lucide-react";
import VaultLayout from "../layouts/VaultLayout";
import { api } from "../lib/api";
import "./CreateCase.css";

const routes = {
  Overview: "/welcome", "Case Library": "/cases", "Case Detail": "/cases/detail",
  "Secure Submission": "/submission", "Audit Trail": "/audit", "Access Control": "/access-control",
};

function CreateCase() {
  const navigate = useNavigate();
  const [caseNumber, setCaseNumber] = useState("");
  const [caseType, setCaseType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;

    const number = caseNumber.trim();
    const type = caseType.trim();
    if (number.length < 2 || type.length < 2) {
      setError("Case number and case type must each have at least 2 characters.");
      return;
    }

    setError("");
    setBusy(true);
    try {
      const created = await api("/cases", {
        method: "POST",
        body: { case_number: number, case_type: type },
      });
      navigate(`/cases/detail?caseId=${encodeURIComponent(created.id)}`);
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  };

  return (
    <VaultLayout activeTab="Case Library" onTabChange={(tab) => navigate(routes[tab])}>
      <div className="create-case-page">
        <button type="button" className="create-case-back" onClick={() => navigate("/cases")}
          disabled={busy}>
          <ArrowLeft size={16} /> Back to Case Library
        </button>
        <div className="create-case-heading">
          <span>ARCHIVE DIRECTORY / NEW CASE</span>
          <h1>Create a Case</h1>
          <p>Register the case first. You can attach evidence from its detail page afterward.</p>
        </div>

        <form className="create-case-form" onSubmit={handleSubmit}>
          <div className="create-case-form-title">
            <FolderPlus size={20} />
            <h2>Case Information</h2>
          </div>
          <label>
            <span>Case Number <b>*</b></span>
            <input value={caseNumber} onChange={(event) => setCaseNumber(event.target.value)}
              minLength={2} maxLength={50} required disabled={busy}
              placeholder="Enter a unique case number" />
          </label>
          <label>
            <span>Case Type <b>*</b></span>
            <input value={caseType} onChange={(event) => setCaseType(event.target.value)}
              minLength={2} maxLength={100} required disabled={busy}
              placeholder="Enter the case type" />
          </label>
          {error && <div className="create-case-error" role="alert">{error}</div>}
          <div className="create-case-actions">
            <button type="button" className="create-case-cancel" onClick={() => navigate("/cases")}
              disabled={busy}>Cancel</button>
            <button type="submit" className="create-case-submit" disabled={busy}>
              {busy ? "Creating…" : "Create Case"}
            </button>
          </div>
        </form>
      </div>
    </VaultLayout>
  );
}

export default CreateCase;
