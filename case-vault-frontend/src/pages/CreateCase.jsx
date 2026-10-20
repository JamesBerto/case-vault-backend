import { useEffect, useState } from "react";
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
  const [numberLoading, setNumberLoading] = useState(true);
  const [numberError, setNumberError] = useState("");
  const [numberReload, setNumberReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api("/cases/next-number")
      .then((result) => { if (active) { setCaseNumber(result.case_number); setNumberError(""); } })
      .catch((requestError) => { if (active) { setCaseNumber(""); setNumberError(requestError.message); } })
      .finally(() => { if (active) setNumberLoading(false); });
    return () => { active = false; };
  }, [numberReload]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;

    const type = caseType.trim();
    if (!caseNumber || type.length < 2) {
      setError("Wait for the case number and enter a case type with at least 2 characters.");
      return;
    }

    setError("");
    setBusy(true);
    try {
      const created = await api("/cases", {
        method: "POST",
        body: { case_type: type },
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
          <p>Register the case first. Its date-based number is assigned automatically when saved. You can attach evidence from its detail page afterward.</p>
        </div>

        <form className="create-case-form" onSubmit={handleSubmit}>
          <div className="create-case-form-title">
            <FolderPlus size={20} />
            <h2>Case Information</h2>
          </div>
          <label>
            <span>Case Number</span>
            <input value={caseNumber} readOnly aria-label="Automatically generated case number"
              placeholder={numberLoading ? "Loading case number..." : "Unavailable"} />
          </label>
          {numberError && <div className="create-case-error" role="alert">{numberError} <button type="button" onClick={() => {
            setNumberLoading(true); setNumberError(""); setNumberReload((value) => value + 1);
          }}>Retry</button></div>}
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
            <button type="submit" className="create-case-submit" disabled={busy || numberLoading || !!numberError || !caseNumber}>
              {busy ? "Creating…" : "Create Case"}
            </button>
          </div>
        </form>
      </div>
    </VaultLayout>
  );
}

export default CreateCase;
