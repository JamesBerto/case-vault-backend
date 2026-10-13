
import { useRef, useState } from "react";
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
import { useNavigate } from "react-router-dom";
import VaultLayout from "../layouts/VaultLayout";
import "./SecureSubmission.css";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

function SecureSubmission() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [caseId, setCaseId] = useState("APSY-2026-001");
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

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");

    if (!file) {
      setError("Please select a PDF evidence file before submitting.");
      return;
    }

    if (!evidenceTitle.trim()) {
      setError("Please enter an evidence title.");
      return;
    }

    const newReference = `DEMO-${Date.now().toString().slice(-8)}`;
    setReference(newReference);
    setSubmitted(true);
  };

  const resetForm = () => {
    setCaseId("APSY-2026-001");
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

  return (
    <VaultLayout
      activeTab="Secure Submission"
      onTabChange={goTo}
    >
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
            <span className="submission-eyebrow">DEMONSTRATION COMPLETE</span>
            <h2>Submission Prepared</h2>
            <p>
              Your form passed the local checks. No file has been uploaded
              to the server, and no integrity hash has been verified.
            </p>

            <div className="submission-reference">
              <span>DEMONSTRATION REFERENCE</span>
              <strong>{reference}</strong>
            </div>

            <div className="submission-success-details">
              <div>
                <span>CASE IDENTIFIER</span>
                <strong>{caseId}</strong>
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
                This is a frontend-only demonstration. The record is not
                saved to the database.
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
                onClick={() => navigate("/cases")}
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
                    <label className="submission-field">
                      <span>Associated Case <b>*</b></span>
                      <select
                        value={caseId}
                        onChange={(event) => setCaseId(event.target.value)}
                        required
                      >
                        <option value="APSY-2026-001">
                          APSY-2026-001 · Digital Device Extraction
                        </option>
                        <option value="APSY-2026-002">
                          APSY-2026-002 · Network Intrusion Analysis
                        </option>
                        <option value="APSY-2026-003">
                          APSY-2026-003 · Mobile Artifact Examination
                        </option>
                        <option value="APSY-2026-004">
                          APSY-2026-004 · System Log Reconstruction
                        </option>
                      </select>
                    </label>

                    <label className="submission-field">
                      <span>Evidence Title <b>*</b></span>
                      <input
                        type="text"
                        value={evidenceTitle}
                        onChange={(event) => setEvidenceTitle(event.target.value)}
                        placeholder="e.g. Device Extraction Report"
                        maxLength={150}
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
                      <span>Description <b>*</b></span>
                      <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Describe the evidence and its relevance to the case..."
                        rows={4}
                        maxLength={2000}
                        required
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
                        <span>
                          {formatSize(file.size)} · PDF DOCUMENT
                        </span>
                        <small>
                          Selected locally; not uploaded to the server.
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
                        The browser checks the PDF extension and file size.
                        Server-side validation and integrity verification are
                        not yet connected.
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
                    <strong>{caseId}</strong>
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
                      <span>Pending backend integration</span>
                    </div>
                  </div>

                  <div className="submission-summary-notice">
                    <Clock3 size={15} />
                    A real evidence record and cryptographic hash will be
                    generated by the backend in a later step.
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
                    This demo prepares a local confirmation only. It does not
                    preserve a legal chain of custody.
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
                  DEMONSTRATION MODE <span>·</span> NO SERVER UPLOAD
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
                >
                  <ShieldCheck size={16} />
                  Prepare Submission
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </VaultLayout>
  );
}

export default SecureSubmission;
