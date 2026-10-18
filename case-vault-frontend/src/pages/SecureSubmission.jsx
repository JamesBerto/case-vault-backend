
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  FileText,
  ShieldCheck,
  LockKeyhole,
  CheckCircle2,
  AlertTriangle,
  X,
  FolderPlus,
  FolderOpen,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import VaultLayout from "../layouts/VaultLayout";
import "./SecureSubmission.css";

const API = "http://127.0.0.1:8000";
const MAX_FILE_SIZE = 25 * 1024 * 1024;

function getErrorMessage(data, status) {
  const detail = data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || "Invalid input").join("; ");
  }

  return `Request failed (HTTP ${status}).`;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function SecureSubmission() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [mode, setMode] = useState("evidence");

  const [availableCases, setAvailableCases] = useState([]);
  const [caseId, setCaseId] = useState("");
  const [loadingCases, setLoadingCases] = useState(true);

  const [newCaseNumber, setNewCaseNumber] = useState("");
  const [newCaseType, setNewCaseType] = useState("");
  const [isCreatingCase, setIsCreatingCase] = useState(false);

  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceType, setEvidenceType] = useState(
    "Device Extraction Report"
  );
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [reference, setReference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const token = () => sessionStorage.getItem("caseVaultToken");

  const loadCases = useCallback(async (signal) => {
    const currentToken = token();

    if (!currentToken) {
      setAvailableCases([]);
      setCaseId("");
      setError("Your session has expired. Please log in again.");
      setLoadingCases(false);
      return;
    }

    setLoadingCases(true);

    try {
      const response = await fetch(`${API}/cases`, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
        signal,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getErrorMessage(data, response.status));
      }

      if (!Array.isArray(data)) {
        throw new Error("The backend returned an invalid case list.");
      }

      if (signal?.aborted) return;

      setAvailableCases(data);

      setCaseId((current) => {
        const stillExists = data.some(
          (item) => String(item.id) === current
        );

        return stillExists
          ? current
          : data.length > 0
            ? String(data[0].id)
            : "";
      });
    } catch (err) {
      if (err.name !== "AbortError" && !signal?.aborted) {
        setError(err.message || "Could not load cases.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoadingCases(false);
      }
    }
  }, []);

useEffect(() => {
  const controller = new AbortController();

  Promise.resolve().then(() => {
    if (!controller.signal.aborted) {
      return loadCases(controller.signal);
    }
  });

  return () => controller.abort();
}, [loadCases]);

  const goTo = (tab) => {
    const routes = {
      Overview: "/welcome",
      "Case Library": "/cases",
      "Case Detail": "/cases/detail",
      "Secure Submission": "/submission",
      "Audit Trail": "/audit",
      "Access Control": "/access-control",
    };

    if (routes[tab]) navigate(routes[tab]);
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setNotice("");
  };

  const handleCreateCase = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    const currentToken = token();

    if (!currentToken) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    const caseNumber = newCaseNumber.trim();
    const caseType = newCaseType.trim();

    if (caseNumber.length < 2 || caseType.length < 2) {
      setError("Enter a case number and case type, each at least 2 characters.");
      return;
    }

    setIsCreatingCase(true);

    try {
      const response = await fetch(`${API}/cases`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          case_number: caseNumber,
          case_type: caseType,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getErrorMessage(data, response.status));
      }

      if (!data?.id) {
        throw new Error("The case was created, but the server returned no case ID.");
      }

      setAvailableCases((current) => [
        data,
        ...current.filter((item) => String(item.id) !== String(data.id)),
      ]);

      setCaseId(String(data.id));
      setNewCaseNumber("");
      setNewCaseType("");
      setNotice(`Case ${data.case_number} was created successfully.`);
      setMode("evidence");
    } catch (err) {
      setError(err.message || "Could not create the case.");
    } finally {
      setIsCreatingCase(false);
    }
  };

  const selectFile = (selectedFile) => {
    setError("");
    setSubmitted(false);

    if (!selectedFile) return;

    if (
      selectedFile.type !== "application/pdf" &&
      !selectedFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Only PDF files are accepted.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("The selected file exceeds the 25 MB limit.");
      return;
    }

    if (selectedFile.size === 0) {
      setError("The selected file is empty.");
      return;
    }

    setFile(selectedFile);

    if (!evidenceTitle.trim()) {
      setEvidenceTitle(selectedFile.name.replace(/\.pdf$/i, ""));
    }
  };

  const resetEvidenceForm = () => {
    setEvidenceTitle("");
    setEvidenceType("Device Extraction Report");
    setFile(null);
    setError("");
    setNotice("");
    setSubmitted(false);
    setReference("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmitEvidence = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (loadingCases) {
      setError("Please wait while cases are loading.");
      return;
    }

    if (!caseId) {
      setError("Please create a case or select an existing case.");
      return;
    }

    if (!evidenceTitle.trim()) {
      setError("Please enter an evidence title.");
      return;
    }

    if (!file) {
      setError("Please select a PDF evidence file.");
      return;
    }

    const currentToken = token();

    if (!currentToken) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    const formData = new FormData();
    formData.append("case_id", caseId);
    formData.append("evidence_type", evidenceType);
    formData.append("title", evidenceTitle.trim());
    formData.append("file", file);

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API}/evidence`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getErrorMessage(data, response.status));
      }

      setReference(data?.id || data?.evidence_id || "Saved");
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Evidence upload failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCase = availableCases.find(
    (item) => String(item.id) === caseId
  );

  return (
    <VaultLayout activeTab="Secure Submission" onTabChange={goTo}>
      <div className="submission-page">
        <div className="submission-heading">
          <div>
            <div className="submission-eyebrow">
              ARCHIVE OPERATIONS / EVIDENCE INTAKE
            </div>
            <h1>Secure Record Submission</h1>
            <p>Create a case or securely submit evidence to an existing case.</p>
          </div>

          <div className="submission-security-label">
            <LockKeyhole size={15} />
            SECURE INTAKE
          </div>
        </div>

        <div className="submission-panel">
          <div className="submission-panel-heading">
            <div className="submission-step-number">01</div>
            <div>
              <span className="submission-section-label">SELECT OPERATION</span>
              <h2>What would you like to do?</h2>
              <p>Cases are saved in the database and can be reused for evidence submissions.</p>
            </div>
          </div>

          <div className="submission-footer-actions">
            <button
              type="button"
              className={
                mode === "case"
                  ? "submission-primary-button"
                  : "submission-secondary-button"
              }
              onClick={() => changeMode("case")}
            >
              <FolderPlus size={17} />
              Create a New Case
            </button>

            <button
              type="button"
              className={
                mode === "evidence"
                  ? "submission-primary-button"
                  : "submission-secondary-button"
              }
              onClick={() => changeMode("evidence")}
            >
              <Upload size={17} />
              Submit Evidence
            </button>
          </div>
        </div>

        {notice && (
          <div className="submission-file-security" role="status">
            <CheckCircle2 size={18} />
            <p><strong>Success</strong><span>{notice}</span></p>
          </div>
        )}

        {error && (
          <div className="submission-error" role="alert">
            <AlertTriangle size={17} />
            {error}
          </div>
        )}

        {mode === "case" && (
          <form className="submission-form" onSubmit={handleCreateCase}>
            <section className="submission-panel">
              <div className="submission-panel-heading">
                <div className="submission-step-number">02</div>
                <div>
                  <span className="submission-section-label">CASE REGISTRATION</span>
                  <h2>Create a New Case</h2>
                  <p>Enter the case details. The case will be saved to the backend database.</p>
                </div>
              </div>

              <div className="submission-fields">
                <label className="submission-field">
                  <span>Case Number <b>*</b></span>
                  <input
                    type="text"
                    value={newCaseNumber}
                    onChange={(event) => setNewCaseNumber(event.target.value)}
                    placeholder="e.g. CASE-2026-001"
                    maxLength={50}
                    minLength={2}
                    required
                  />
                </label>

                <label className="submission-field">
                  <span>Case Type <b>*</b></span>
                  <input
                    type="text"
                    value={newCaseType}
                    onChange={(event) => setNewCaseType(event.target.value)}
                    placeholder="e.g. Digital Forensics Investigation"
                    maxLength={100}
                    minLength={2}
                    required
                  />
                </label>
              </div>

              <div className="submission-form-footer">
                <div className="submission-footer-note">
                  <LockKeyhole size={15} />
                  <span>AUTHENTICATED CASE REGISTRATION</span>
                </div>
                <div className="submission-footer-actions">
                  <button
                    type="button"
                    className="submission-secondary-button"
                    onClick={() => {
                      setNewCaseNumber("");
                      setNewCaseType("");
                      setError("");
                    }}
                  >
                    Clear Form
                  </button>
                  <button
                    type="submit"
                    className="submission-primary-button"
                    disabled={isCreatingCase}
                  >
                    <FolderPlus size={16} />
                    {isCreatingCase ? "Creating Case..." : "Save New Case"}
                  </button>
                </div>
              </div>
            </section>
          </form>
        )}

        {mode === "evidence" && !submitted && (
          <form className="submission-form" onSubmit={handleSubmitEvidence}>
            <div className="submission-main-grid">
              <div className="submission-form-column">
                <section className="submission-panel">
                  <div className="submission-panel-heading">
                    <div className="submission-step-number">02</div>
                    <div>
                      <span className="submission-section-label">RECORD METADATA</span>
                      <h2>Evidence Information</h2>
                      <p>Choose a database-backed case and enter the evidence details.</p>
                    </div>
                  </div>

                  <div className="submission-fields">
                    <label className="submission-field submission-field-full">
                      <span>Associated Case <b>*</b></span>
                      <select
                        value={caseId}
                        onChange={(event) => setCaseId(event.target.value)}
                        required
                        disabled={loadingCases || availableCases.length === 0}
                      >
                        <option value="">
                          {loadingCases ? "Loading cases..." : "Select a case"}
                        </option>
                        {availableCases.map((item) => (
                          <option key={item.id} value={String(item.id)}>
                            {item.case_number} · {item.case_type}
                          </option>
                        ))}
                      </select>
                      {!loadingCases && availableCases.length === 0 && (
                        <small>No cases found. Select “Create a New Case” first.</small>
                      )}
                    </label>

                    <label className="submission-field">
                      <span>Evidence Title <b>*</b></span>
                      <input
                        type="text"
                        value={evidenceTitle}
                        onChange={(event) => setEvidenceTitle(event.target.value)}
                        placeholder="e.g. Device Extraction Report"
                        maxLength={255}
                        minLength={2}
                        required
                      />
                    </label>

                    <label className="submission-field">
                      <span>Evidence Classification <b>*</b></span>
                      <select
                        value={evidenceType}
                        onChange={(event) => setEvidenceType(event.target.value)}
                        required
                      >
                        <option>Device Extraction Report</option>
                        <option>System Log Report</option>
                        <option>Network Analysis Report</option>
                        <option>Mobile Artifact Report</option>
                        <option>Incident Documentation</option>
                        <option>Other Forensic Document</option>
                      </select>
                    </label>
                  </div>
                </section>

                <section className="submission-panel">
                  <div className="submission-panel-heading">
                    <div className="submission-step-number">03</div>
                    <div>
                      <span className="submission-section-label">DIGITAL ARTIFACT</span>
                      <h2>Evidence File</h2>
                      <p>Select the PDF document to submit.</p>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    className="submission-hidden-input"
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(event) => selectFile(event.target.files?.[0])}
                  />

                  {!file ? (
                    <div
                      className={`submission-dropzone ${
                        dragging ? "submission-dropzone-active" : ""
                      }`}
                      role="button"
                      tabIndex={0}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          fileInputRef.current?.click();
                        }
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDragging(false);
                        selectFile(event.dataTransfer.files?.[0]);
                      }}
                    >
                      <div className="submission-drop-icon"><Upload size={25} /></div>
                      <strong>Drag and drop your PDF here</strong>
                      <span>or click to browse files on your computer</span>
                      <div className="submission-file-rules">
                        <span>PDF ONLY</span>
                        <span>MAXIMUM 25 MB</span>
                      </div>
                    </div>
                  ) : (
                    <div className="submission-selected-file">
                      <div className="submission-selected-file-icon">
                        <FileText size={23} />
                      </div>
                      <div className="submission-selected-file-info">
                        <strong>{file.name}</strong>
                        <span>{formatSize(file.size)} · PDF DOCUMENT</span>
                        <small>Selected locally until submission.</small>
                      </div>
                      <button
                        type="button"
                        className="submission-remove-file"
                        aria-label="Remove selected file"
                        onClick={() => {
                          setFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >
                        <X size={17} />
                      </button>
                    </div>
                  )}

                  <div className="submission-file-security">
                    <ShieldCheck size={17} />
                    <p>
                      <strong>File validation</strong>
                      <span>The backend independently checks the file type and content.</span>
                    </p>
                  </div>
                </section>
              </div>

              <aside className="submission-side-column">
                <section className="submission-panel submission-summary-panel">
                  <div className="submission-summary-heading">
                    <FolderOpen size={20} />
                    <div>
                      <span className="submission-section-label">INTAKE SUMMARY</span>
                      <h2>Record Overview</h2>
                    </div>
                  </div>

                  <div className="submission-summary-row">
                    <span>Case Identifier</span>
                    <strong>{selectedCase?.case_number || "Not selected"}</strong>
                  </div>
                  <div className="submission-summary-row">
                    <span>Classification</span>
                    <strong>{evidenceType}</strong>
                  </div>
                  <div className="submission-summary-row">
                    <span>File Attached</span>
                    <strong>{file ? "Yes" : "No"}</strong>
                  </div>
                  <div className="submission-summary-row">
                    <span>File Size</span>
                    <strong>{file ? formatSize(file.size) : "—"}</strong>
                  </div>
                </section>
              </aside>
            </div>

            <div className="submission-form-footer">
              <div className="submission-footer-note">
                <LockKeyhole size={15} />
                <span>AUTHENTICATED SERVER UPLOAD · PDF ONLY</span>
              </div>
              <div className="submission-footer-actions">
                <button
                  type="button"
                  className="submission-secondary-button"
                  onClick={resetEvidenceForm}
                >
                  Clear Form
                </button>
                <button
                  type="submit"
                  className="submission-primary-button"
                  disabled={
                    isSubmitting ||
                    loadingCases ||
                    availableCases.length === 0
                  }
                >
                  <ShieldCheck size={16} />
                  {isSubmitting ? "Saving Evidence..." : "Save Evidence Record"}
                </button>
              </div>
            </div>
          </form>
        )}

        {mode === "evidence" && submitted && (
          <section className="submission-success">
            <div className="submission-success-icon">
              <CheckCircle2 size={32} />
            </div>
            <span className="submission-eyebrow">UPLOAD COMPLETE</span>
            <h2>Evidence Saved</h2>
            <p>The server accepted the evidence upload.</p>

            <div className="submission-reference">
              <span>SERVER EVIDENCE ID</span>
              <strong>{reference}</strong>
            </div>

            <div className="submission-success-details">
              <div>
                <span>CASE IDENTIFIER</span>
                <strong>{selectedCase?.case_number || "Unknown"}</strong>
              </div>
              <div>
                <span>EVIDENCE TITLE</span>
                <strong>{evidenceTitle}</strong>
              </div>
              <div>
                <span>SELECTED FILE</span>
                <strong>{file?.name || "—"}</strong>
              </div>
              <div>
                <span>FILE SIZE</span>
                <strong>{file ? formatSize(file.size) : "—"}</strong>
              </div>
            </div>

            <div className="submission-success-actions">
              <button
                type="button"
                className="submission-secondary-button"
                onClick={resetEvidenceForm}
              >
                Submit Another Record
              </button>
              <button
                type="button"
                className="submission-primary-button"
                onClick={() => navigate("/cases")}
              >
                Return to Case Library
              </button>
            </div>
          </section>
        )}
      </div>
    </VaultLayout>
  );
}

export default SecureSubmission;
