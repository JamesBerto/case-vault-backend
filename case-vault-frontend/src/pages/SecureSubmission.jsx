
import { useEffect, useRef, useState } from "react";
import {
  Upload,
  FileText,
  ShieldCheck,
  LockKeyhole,
  CheckCircle2,
  AlertTriangle,
  X,
  Fingerprint,
  FolderOpen,
  Clock3,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import VaultLayout from "../layouts/VaultLayout";
import { useAuth } from "../auth/context";
import "./SecureSubmission.css";
import { api } from "../lib/api";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function SecureSubmission({ embedded = false, onUploaded }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const canCreateCase = user.permissions.includes("case:create");
  const requestedCaseId = params.get("caseId") || "";
  const fileInputRef = useRef(null);

  const [caseId, setCaseId] = useState(requestedCaseId);
  const [cases, setCases] = useState([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [casesLoadedFor, setCasesLoadedFor] = useState(null);
  const [casesError, setCasesError] = useState("");
  const [casesReload, setCasesReload] = useState(0);
  const caseListLoading = casesLoading || casesLoadedFor !== requestedCaseId;
  const availableCases = caseListLoading || casesError ? [] : cases;
  const selectedCase = availableCases.find((item) => item.id === caseId);
  const [submitting, setSubmitting] = useState(false);
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceType, setEvidenceType] = useState("Device Extraction Report");
  const [description, setDescription] = useState("");
  const [sourceDevice, setSourceDevice] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [reference, setReference] = useState("");

  useEffect(() => {
    let active = true;
    api("/cases").then((records) => {
      if (active) {
        setCases(records);
        setCasesError("");
        setCasesLoadedFor(requestedCaseId);
        setCaseId((current) => {
          const preferred = requestedCaseId || current;
          return records.some((item) => item.id === preferred) ? preferred : "";
        });
      }
    }).catch((requestError) => {
      if (active) {
        setCases([]);
        setCaseId("");
        setCasesError(requestError.message);
        setCasesLoadedFor(requestedCaseId);
      }
    }).finally(() => { if (active) setCasesLoading(false); });
    return () => { active = false; };
  }, [requestedCaseId, casesReload]);

  const retryCases = () => {
    setCasesLoading(true);
    setCasesError("");
    setCasesReload((current) => current + 1);
  };

  const selectFile = (selectedFile) => {
    setError("");
    setSubmitted(false);

    if (!selectedFile) return;

    if (
      selectedFile.type !== "application/pdf" ||
      !selectedFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Only PDF files are accepted.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("The selected file exceeds the 10 MB limit.");
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

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!file) {
      setError("Please select a PDF evidence file before submitting.");
      return;
    }

    if (!selectedCase) { setError("Choose an existing case first."); return; }

    if (!evidenceTitle.trim()) {
      setError("Please enter an evidence title.");
      return;
    }

    const form = new FormData();
    form.append("case_id", caseId);
    form.append("evidence_type", evidenceType);
    form.append("title", evidenceTitle.trim());
    form.append("description", description.trim());
    form.append("source_device", sourceDevice.trim());
    form.append("notes", notes.trim());
    form.append("file", file);
    setSubmitting(true);
    try {
      const created = await api("/evidence", { method: "POST", body: form });
      setReference(created.id);
      setSubmitted(true);
      onUploaded?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCaseId("");
    setEvidenceTitle("");
    setEvidenceType("Device Extraction Report");
    setDescription("");
    setSourceDevice("");
    setNotes("");
    setFile(null);
    setError("");
    setSubmitted(false);
    setReference("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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

  const content = (
      <div className="submission-page">


        <div className="submission-heading">
          <div>
            <div className="submission-eyebrow">
              ARCHIVE OPERATIONS / EVIDENCE INTAKE
            </div>
            <h1>Secure Record Submission</h1>
            <p>
              Register a forensic evidence record and prepare it for secure
              archival review.
            </p>
          </div>

          <div className="submission-security-label">
            <LockKeyhole size={15} />
            SECURE INTAKE
          </div>
        </div>

        {submitted ? (
          <section className="submission-success">
            <div className="submission-success-icon">
              <CheckCircle2 size={32} />
            </div>
            <span className="submission-eyebrow">UPLOAD COMPLETE</span>
            <h2>Evidence Saved</h2>
            <p>
              The PDF and evidence metadata were saved to the Case Vault backend.
            </p>

            <div className="submission-reference">
              <span>EVIDENCE IDENTIFIER</span>
              <strong>{reference}</strong>
            </div>

            <div className="submission-success-details">
              <div>
                <span>CASE IDENTIFIER</span>
                <strong>{cases.find((item) => item.id === caseId)?.case_number || caseId}</strong>
              </div>
              <div>
                <span>EVIDENCE TITLE</span>
                <strong>{evidenceTitle}</strong>
              </div>
              <div>
                <span>SELECTED FILE</span>
                <strong>{file?.name}</strong>
              </div>
              <div>
                <span>FILE SIZE</span>
                <strong>{file ? formatSize(file.size) : "—"}</strong>
              </div>
            </div>

            <div className="submission-demo-notice">
              <AlertTriangle size={16} />
              <span>
                Integrity can be checked from the case detail page.
              </span>
            </div>

            <div className="submission-success-actions">
              <button
                type="button"
                className="submission-secondary-button"
                onClick={resetForm}
              >
                Create Another Record
              </button>
              <button
                type="button"
                className="submission-primary-button"
                onClick={() => embedded
                  ? document.getElementById("admin-case-library")?.scrollIntoView()
                  : navigate("/cases")}
              >
                Return to Case Library
              </button>
            </div>
          </section>
        ) : (
          <form className="submission-form" onSubmit={handleSubmit}>
            <div className="submission-main-grid">
              <div className="submission-form-column">
                <section className="submission-panel">
                  <div className="submission-panel-heading">
                    <div className="submission-step-number">01</div>
                    <div>
                      <span className="submission-section-label">
                        RECORD METADATA
                      </span>
                      <h2>Evidence Information</h2>
                      <p>Provide the details associated with this record.</p>
                    </div>
                  </div>

                  <div className="submission-fields">
                    <div className="submission-field">
                      <label className="submission-field-label" htmlFor="submission-associated-case">Associated Case <b>*</b></label>
                      <select
                        id="submission-associated-case"
                        value={caseId}
                        onChange={(event) => setCaseId(event.target.value)}
                        disabled={caseListLoading || Boolean(casesError) || availableCases.length === 0 || submitting}
                        required
                      >
                        <option value="" disabled>Select a case</option>
                        {availableCases.map((item) => <option key={item.id} value={item.id}>
                          {item.case_number} — {item.case_type}
                        </option>)}
                      </select>
                      {caseListLoading && <div className="submission-case-message" role="status">Loading cases…</div>}
                      {!caseListLoading && casesError && <div className="submission-case-message" role="alert">
                        Could not load cases: {casesError} <button type="button" onClick={retryCases}>Retry</button>
                      </div>}
                      {!caseListLoading && !casesError && availableCases.length === 0 &&
                        <div className="submission-case-message" role="status">
                          No cases available. Create a case first.
                          {canCreateCase && <> <Link to="/cases/new">Create a case</Link></>}
                        </div>}
                    </div>

                    <label className="submission-field">
                      <span>Evidence Title <b>*</b></span>
                      <input
                        type="text"
                        value={evidenceTitle}
                        onChange={(event) => setEvidenceTitle(event.target.value)}
                        placeholder="e.g. Device Extraction Report"
                        minLength={2}
                        maxLength={255}
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

                    <label className="submission-field">
                      <span>Source Device / Origin</span>
                      <input
                        type="text"
                        value={sourceDevice}
                        onChange={(event) => setSourceDevice(event.target.value)}
                        placeholder="e.g. Device reference or source identifier"
                        maxLength={200}
                      />
                    </label>

                    <label className="submission-field submission-field-full">
                      <span>Description (optional)</span>
                      <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Describe the evidence and its relevance to the case..."
                        rows={4}
                        maxLength={2000}
                      />
                      <small>{description.length}/2000 characters</small>
                    </label>

                    <label className="submission-field submission-field-full">
                      <span>Internal Notes</span>
                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Optional handling notes or review instructions..."
                        rows={3}
                        maxLength={2000}
                      />
                    </label>
                  </div>
                </section>

                <section className="submission-panel">
                  <div className="submission-panel-heading">
                    <div className="submission-step-number">02</div>
                    <div>
                      <span className="submission-section-label">
                        DIGITAL ARTIFACT
                      </span>
                      <h2>Evidence File</h2>
                      <p>
                        Select the PDF document to prepare for archival intake.
                      </p>
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
                      <div className="submission-drop-icon">
                        <Upload size={25} />
                      </div>
                      <strong>Drag and drop your PDF here</strong>
                      <span>or click to browse files on your computer</span>
                      <div className="submission-file-rules">
                        <span>PDF ONLY</span>
                        <span>MAXIMUM 10 MB</span>
                      </div>
                    </div>
                  ) : (
                    <div className="submission-selected-file">
                      <div className="submission-selected-file-icon">
                        <FileText size={23} />
                      </div>
                      <div className="submission-selected-file-info">
                        <strong>{file.name}</strong>
                        <span>
                          {formatSize(file.size)} · PDF DOCUMENT
                        </span>
                        <small>
                          Ready to upload to the server.
                        </small>
                      </div>
                      <button
                        type="button"
                        className="submission-remove-file"
                        aria-label="Remove selected file"
                        onClick={() => {
                          setFile(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
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
                      <span>
                        The server parses PDF content and stores a SHA-256 hash.
                      </span>
                    </p>
                  </div>
                </section>
              </div>

              <aside className="submission-side-column">
                <section className="submission-panel submission-summary-panel">
                  <div className="submission-summary-heading">
                    <Fingerprint size={20} />
                    <div>
                      <span className="submission-section-label">
                        INTAKE SUMMARY
                      </span>
                      <h2>Record Overview</h2>
                    </div>
                  </div>

                  <div className="submission-summary-row">
                    <span>Case Identifier</span>
                    <strong>{selectedCase?.case_number || "No case selected"}</strong>
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
                  <div className="submission-summary-row">
                    <span>Source Device</span>
                    <strong>{sourceDevice.trim() || "Not provided"}</strong>
                  </div>

                  <div className="submission-summary-divider" />

                  <div className="submission-integrity-preview">
                    <div className="submission-integrity-icon">
                      <LockKeyhole size={17} />
                    </div>
                    <div>
                      <strong>Integrity verification</strong>
                      <span>Available after upload</span>
                    </div>
                  </div>

                  <div className="submission-summary-notice">
                    <Clock3 size={15} />
                    The backend stores a version record and SHA-256 hash when the PDF is uploaded.
                  </div>
                </section>

                <section className="submission-workflow-panel">
                  <span className="submission-section-label">
                    SUBMISSION WORKFLOW
                  </span>
                  <h3>Before you submit</h3>
                  <div className="submission-workflow-item">
                    <CheckCircle2 size={15} />
                    <span>Complete the required metadata</span>
                  </div>
                  <div className="submission-workflow-item">
                    <CheckCircle2 size={15} />
                    <span>Select a PDF evidence file</span>
                  </div>
                  <div className="submission-workflow-item">
                    <FolderOpen size={15} />
                    <span>Review the associated case</span>
                  </div>
                  <p>
                    Submission writes an evidence record and an audit event.
                  </p>
                </section>
              </aside>
            </div>

            {error && (
              <div className="submission-error" role="alert">
                <AlertTriangle size={17} />
                {error}
              </div>
            )}

            <div className="submission-form-footer">
              <div className="submission-footer-note">
                <LockKeyhole size={15} />
                <span>
                  SERVER VALIDATION <span>·</span> PDF ONLY
                </span>
              </div>

              <div className="submission-footer-actions">
                <button
                  type="button"
                  className="submission-secondary-button"
                  onClick={resetForm}
                >
                  Clear Form
                </button>
                <button
                  type="submit"
                  className="submission-primary-button"
                  disabled={submitting || !selectedCase}
                >
                  <ShieldCheck size={16} />
                  {submitting ? "Uploading…" : "Upload Evidence"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
  );

  return embedded ? content : <VaultLayout activeTab="Secure Submission" onTabChange={goTo}>{content}</VaultLayout>;
}

export default SecureSubmission;
