
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ShieldCheck,
  FileText,
  Clock3,
  UserRound,
  Fingerprint,
  ExternalLink,
  LockKeyhole,
  CheckCircle2,
  AlertTriangle,
  History,
  Upload,
  RefreshCw,
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import VaultLayout from "../layouts/VaultLayout";
import "./CaseDetail.css";

const API_BASE = "http://127.0.0.1:8000";

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatDateTime(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleString();
}

function formatStatus(value) {
  if (!value) return "Unknown";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getIntegrityStatus(value) {
  const status = String(value || "").toUpperCase();

  if (status === "VERIFIED") return "Verified";
  if (status === "TAMPERED") return "Tampered";

  return "Pending";
}

function CaseDetail({ onNavigate }) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const searchParams = new URLSearchParams(location.search);
  const queryCaseId =
    searchParams.get("caseId") || searchParams.get("case_id") || "";

  const requestedCaseId =
    location.state?.caseId ||
    location.state?.case?.id ||
    queryCaseId ||
    params.caseId ||
    params.id ||
    "";

  const [cases, setCases] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [manualSelectedCaseId, setManualSelectedCaseId] = useState("");
  const selectedCaseId = requestedCaseId || manualSelectedCaseId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [evidenceError, setEvidenceError] = useState("");
  const [verifyingId, setVerifyingId] = useState("");
  const [verifyMessage, setVerifyMessage] = useState("");

  const loadData = useCallback(async (signal) => {
    if (!signal?.aborted) {
      setLoading(true);
      setError("");
      setEvidenceError("");
    }

    try {
      const token = sessionStorage.getItem("caseVaultToken");

      if (!token) {
        throw new Error(
          "Your session token was not found. Please log in again."
        );
      }

      const headers = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      };

      const [casesResponse, evidenceResponse] = await Promise.all([
        fetch(`${API_BASE}/cases`, { headers, signal }),
        fetch(`${API_BASE}/evidence`, { headers, signal }),
      ]);

      if (signal?.aborted) return;

      if (
        casesResponse.status === 401 ||
        evidenceResponse.status === 401
      ) {
        throw new Error("Your session has expired. Please log in again.");
      }

      if (!casesResponse.ok) {
        throw new Error(
          `Could not load cases (HTTP ${casesResponse.status}).`
        );
      }

      const casesData = await casesResponse.json();

      if (signal?.aborted) return;

      setCases(Array.isArray(casesData) ? casesData : []);

      if (evidenceResponse.ok) {
        const evidenceData = await evidenceResponse.json();

        if (signal?.aborted) return;

        setEvidence(Array.isArray(evidenceData) ? evidenceData : []);
      } else {
        setEvidence([]);
        setEvidenceError(
          `Cases loaded, but evidence could not be loaded (HTTP ${evidenceResponse.status}).`
        );
      }
    } catch (err) {
      if (err.name !== "AbortError" && !signal?.aborted) {
        setError(err.message || "Unable to load case details.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // Defer the initial request until after effect setup.
    const controller = new AbortController();

    const timer = setTimeout(() => {
      loadData(controller.signal);
    }, 0);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadData]);

  const caseRecord = useMemo(() => {
    if (!cases.length) return null;

    if (selectedCaseId) {
      // Match by Mongo ID or case number.
      // Never silently display a different requested case.
      return (
        cases.find(
          (item) =>
            String(item.id) === String(selectedCaseId) ||
            String(item.case_number) === String(selectedCaseId)
        ) || null
      );
    }

    // Use the first case only when no case was requested.
    return cases[0];
  }, [cases, selectedCaseId]);

  const caseEvidence = useMemo(() => {
    if (!caseRecord) return [];

    const selectedId = String(caseRecord.id || "");
    const selectedNumber = String(caseRecord.case_number || "");

    return evidence.filter((item) => {
      const evidenceCaseId = String(item.case_id || "");
      const evidenceCaseNumber = String(item.case_number || "");

      return (
        evidenceCaseId === selectedId ||
        evidenceCaseId === selectedNumber ||
        evidenceCaseNumber === selectedNumber
      );
    });
  }, [evidence, caseRecord]);

  const goTo = (tab) => {
    if (onNavigate) {
      onNavigate(tab);
      return;
    }

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

  const verifyEvidence = async (file) => {
    setVerifyingId(file.id);
    setVerifyMessage("");

    try {
      const token = sessionStorage.getItem("caseVaultToken");

      if (!token) {
        throw new Error(
          "Your session token was not found. Please log in again."
        );
      }

      if (!file.current_version_id) {
        throw new Error("This evidence has no current version to verify.");
      }

      const response = await fetch(
        `${API_BASE}/evidence/${encodeURIComponent(file.id)}/versions/${encodeURIComponent(file.current_version_id)}/verify`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.detail || `Verification failed (HTTP ${response.status}).`
        );
      }

      const newStatus = getIntegrityStatus(result.integrity);

      setEvidence((current) =>
        current.map((item) =>
          String(item.id) === String(file.id)
            ? { ...item, integrity: result.integrity }
            : item
        )
      );

      setVerifyMessage(
        `${file.file_name || file.title}: ${newStatus}. The server completed the integrity check.`
      );
    } catch (err) {
      setVerifyMessage(err.message || "Could not verify this evidence.");
    } finally {
      setVerifyingId("");
    }
  };

  const verifiedCount = caseEvidence.filter(
    (file) => getIntegrityStatus(file.integrity) === "Verified"
  ).length;

  const tamperedCount = caseEvidence.filter(
    (file) => getIntegrityStatus(file.integrity) === "Tampered"
  ).length;

  const status = formatStatus(caseRecord?.status);
  const registeredDate =
    caseRecord?.submission_date || caseRecord?.created_at;

  const retryLoad = () => {
    const controller = new AbortController();
    loadData(controller.signal);
  };

  return (
    <VaultLayout activeTab="Case Detail" onTabChange={goTo}>
      <div className="detail-page">
        <div className="detail-heading">
          <div>
            <div className="detail-eyebrow">
              CASE ARCHIVE / DOSSIER DETAILS
            </div>

            <div className="detail-title-row">
              <h1>{caseRecord?.case_type || "Case Details"}</h1>

              {caseRecord && (
                <span className="detail-status">
                  <span />
                  {status}
                </span>
              )}
            </div>

            <p>
              Review live case information and the evidence associated with
              this case.
            </p>
          </div>

          <button
            className="detail-primary-button"
            type="button"
            onClick={() =>
              navigate("/submission", {
                state: {
                  caseId: caseRecord?.id,
                  caseNumber: caseRecord?.case_number,
                },
              })
            }
            disabled={!caseRecord}
          >
            <Upload size={16} />
            Add Evidence
          </button>
        </div>

        {loading && (
          <div className="detail-panel" role="status">
            <RefreshCw size={18} />
            <span>Loading cases and evidence...</span>
          </div>
        )}

        {!loading && error && (
          <section className="detail-panel" role="alert">
            <AlertTriangle size={20} />
            <h2>Unable to load case details</h2>
            <p>{error}</p>

            <button
              className="detail-primary-button"
              type="button"
              onClick={retryLoad}
            >
              <RefreshCw size={15} />
              Retry
            </button>
          </section>
        )}

        {!loading && !error && cases.length === 0 && (
          <section className="detail-panel">
            <h2>No cases found</h2>
            <p>There are currently no cases available from the backend.</p>
          </section>
        )}

        {!loading && !error && cases.length > 0 && !caseRecord && (
          <section className="detail-panel" role="alert">
            <AlertTriangle size={20} />
            <h2>Case not found</h2>
            <p>
              The requested case ID or case number does not match any case
              currently returned by the backend.
            </p>
            <p>
              Requested ID: <strong>{selectedCaseId}</strong>
            </p>
            <button
              className="detail-primary-button"
              type="button"
              onClick={() => navigate("/cases")}
            >
              <ArrowLeft size={15} />
              Return to Case Library
            </button>
          </section>
        )}

        {!loading && !error && cases.length > 0 && caseRecord && (
          <>
            {cases.length > 1 && (
              <div className="detail-panel">
                <label htmlFor="detail-case-selector">Select a case</label>

                <select
                  id="detail-case-selector"
                  value={caseRecord.id || ""}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    const nextCase = cases.find(
                      (item) => String(item.id) === String(nextId)
                    );

                    setManualSelectedCaseId(nextId);
                    setVerifyMessage("");

                    navigate(
                      `/cases/detail?caseId=${encodeURIComponent(nextId)}`,
                      {
                        replace: true,
                        state: {
                          caseId: nextId,
                          caseNumber: nextCase?.case_number,
                        },
                      }
                    );
                  }}
                >
                  {cases.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.case_number || item.id} —{" "}
                      {item.case_type || "Case"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <section className="detail-case-banner">
              <div className="detail-case-symbol">
                <Fingerprint size={26} />
              </div>

              <div className="detail-case-identity">
                <span>CASE IDENTIFIER</span>
                <strong>{caseRecord.case_number || caseRecord.id}</strong>
                <small>
                  FORENSIC DOSSIER · {caseRecord.case_type || "CASE"}
                </small>
              </div>

              <div className="detail-banner-divider" />

              <div className="detail-banner-item">
                <span>STATUS</span>
                <strong>{status}</strong>
              </div>

              <div className="detail-banner-item">
                <span>REGISTERED</span>
                <strong>{formatDate(registeredDate)}</strong>
              </div>
            </section>

            <div className="detail-overview-grid">
              <section className="detail-panel detail-information">
                <div className="detail-panel-heading">
                  <div>
                    <span className="detail-section-index">
                      01 / OVERVIEW
                    </span>
                    <h2>Case Information</h2>
                  </div>
                  <LockKeyhole size={18} />
                </div>

                <p className="detail-description">
                  {caseRecord.description ||
                    `Case record for ${caseRecord.case_type || "forensic investigation"}. No additional description is available in the current case record.`}
                </p>

                <div className="detail-information-grid">
                  <div>
                    <span className="detail-field-label">
                      <UserRound size={14} />
                      LEAD INVESTIGATOR
                    </span>
                    <strong>
                      {caseRecord.investigator ||
                        caseRecord.created_by_name ||
                        caseRecord.created_by ||
                        "Not assigned"}
                    </strong>
                  </div>

                  <div>
                    <span className="detail-field-label">
                      <ShieldCheck size={14} />
                      ASSIGNED REVIEWER
                    </span>
                    <strong>{caseRecord.reviewer || "Not assigned"}</strong>
                  </div>

                  <div>
                    <span className="detail-field-label">
                      <Clock3 size={14} />
                      LAST MODIFIED
                    </span>
                    <strong>
                      {formatDateTime(
                        caseRecord.updated_at || caseRecord.created_at
                      )}
                    </strong>
                  </div>

                  <div>
                    <span className="detail-field-label">
                      <FileText size={14} />
                      EVIDENCE ITEMS
                    </span>
                    <strong>
                      {String(caseEvidence.length).padStart(2, "0")} listed
                    </strong>
                  </div>
                </div>
              </section>

              <section className="detail-panel detail-integrity">
                <div className="detail-panel-heading">
                  <div>
                    <span className="detail-section-index">
                      02 / INTEGRITY
                    </span>
                    <h2>Archive Integrity</h2>
                  </div>
                  <ShieldCheck size={19} />
                </div>

                <div className="detail-integrity-icon">
                  {caseEvidence.length > 0 &&
                  verifiedCount === caseEvidence.length ? (
                    <CheckCircle2 size={25} />
                  ) : (
                    <AlertTriangle size={25} />
                  )}
                </div>

                <strong className="detail-integrity-title">
                  {caseEvidence.length > 0 &&
                  verifiedCount === caseEvidence.length
                    ? "Evidence Integrity Verified"
                    : "Integrity Review Required"}
                </strong>

                <p>
                  This summary uses the integrity statuses returned by the
                  backend. Verify individual evidence versions to refresh
                  their status.
                </p>

                <div className="detail-integrity-row">
                  <span>Associated evidence</span>
                  <strong>{caseEvidence.length} files</strong>
                </div>

                <div className="detail-integrity-row">
                  <span>Verified</span>
                  <strong>{verifiedCount} files</strong>
                </div>

                <div className="detail-integrity-row">
                  <span>Tampered</span>
                  <strong>{tamperedCount} files</strong>
                </div>
              </section>
            </div>

            <section className="detail-panel detail-evidence-panel">
              <div className="detail-panel-heading detail-evidence-heading">
                <div>
                  <span className="detail-section-index">
                    03 / EVIDENCE INVENTORY
                  </span>
                  <h2>Registered Evidence</h2>
                  <p>
                    Evidence records returned by the backend for this case.
                  </p>
                </div>

                <span className="detail-evidence-count">
                  {String(caseEvidence.length).padStart(2, "0")} ITEMS
                </span>
              </div>

              {evidenceError && <p role="alert">{evidenceError}</p>}

              {verifyMessage && <p role="status">{verifyMessage}</p>}

              {caseEvidence.length === 0 ? (
                <div className="detail-empty-evidence">
                  <FileText size={24} />
                  <p>No evidence is linked to this case yet.</p>
                  <span>
                    If you expected to see evidence here, check its case
                    association in the backend.
                  </span>
                </div>
              ) : (
                <div className="detail-evidence-list">
                  {caseEvidence.map((file) => {
                    const integrity = getIntegrityStatus(file.integrity);

                    return (
                      <article className="detail-evidence-row" key={file.id}>
                        <div className="detail-file-icon">
                          <FileText size={20} />
                        </div>

                        <div className="detail-file-main">
                          <strong>{file.file_name || file.title}</strong>
                          <span>
                            {file.title || file.evidence_id || file.id}
                            <span className="detail-dot"> · </span>
                            {String(file.file_type || "File").toUpperCase()}
                          </span>
                          <small>{file.evidence_type || "Evidence"}</small>
                        </div>

                        <div className="detail-file-meta detail-file-hash">
                          <span>SHA-256 HASH</span>
                          <code title={file.file_hash || "No hash available"}>
                            {file.file_hash || "Not available"}
                          </code>
                        </div>

                        <div className="detail-file-status-wrap">
                          <span
                            className={`detail-file-status ${
                              integrity === "Verified"
                                ? "detail-file-verified"
                                : "detail-file-pending"
                            }`}
                          >
                            {integrity === "Verified" ? (
                              <CheckCircle2 size={13} />
                            ) : integrity === "Tampered" ? (
                              <AlertTriangle size={13} />
                            ) : (
                              <Clock3 size={13} />
                            )}
                            {integrity}
                          </span>

                          <small>
                            {formatDate(file.uploaded_at || file.created_at)}
                          </small>
                        </div>

                        <button
                          className="detail-file-action"
                          type="button"
                          title="Verify evidence integrity"
                          aria-label={`Verify ${file.file_name || file.title}`}
                          disabled={
                            !file.current_version_id || Boolean(verifyingId)
                          }
                          onClick={() => verifyEvidence(file)}
                        >
                          {verifyingId === file.id ? (
                            <RefreshCw size={15} />
                          ) : (
                            <ExternalLink size={15} />
                          )}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}

              <div className="detail-evidence-footer">
                <span>LIVE EVIDENCE DATA</span>
                <button
                  type="button"
                  onClick={() =>
                    navigate("/submission", {
                      state: {
                        caseId: caseRecord.id,
                        caseNumber: caseRecord.case_number,
                      },
                    })
                  }
                >
                  <Upload size={14} />
                  Register Evidence
                </button>
              </div>
            </section>

            <section className="detail-panel detail-custody-panel">
              <div className="detail-panel-heading detail-custody-heading">
                <div>
                  <span className="detail-section-index">
                    04 / CHAIN OF CUSTODY
                  </span>
                  <h2>Activity Ledger</h2>
                  <p>
                    The verified audit history is not yet connected to this
                    page.
                  </p>
                </div>
                <History size={19} />
              </div>

              <div className="detail-empty-evidence">
                <LockKeyhole size={23} />
                <p>Live audit events are not available here yet.</p>
                <span>
                  No mock events are shown as real chain-of-custody activity.
                  Connect this section to the backend audit endpoint to display
                  recorded events.
                </span>
              </div>
            </section>

            <div className="detail-bottom-note">
              <LockKeyhole size={15} />
              CASE ACCESS IS SUBJECT TO AUTHENTICATION AND ROLE PERMISSIONS
              <span>·</span>
              <button type="button" onClick={() => navigate("/cases")}>
                Return to archive <ArrowLeft size={13} />
              </button>
            </div>
          </>
        )}
      </div>
    </VaultLayout>
  );
}

export default CaseDetail;
