
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, RefreshCw, ArrowUpRight } from "lucide-react";
import VaultLayout from "../layouts/VaultLayout";
import "./CaseLibrary.css";

const API = "http://127.0.0.1:8000";


const routes = {
  Overview: "/welcome",
  "Case Library": "/cases",
  "Case Detail": "/cases/detail",
  "Secure Submission": "/submission",
  "Audit Trail": "/audit",
  "Access Control": "/access-control",
};

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function CaseLibrary() {
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Evidence");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEvidence = useCallback(async (signal) => {
    const token = sessionStorage.getItem("caseVaultToken");

    if (!token) {
      setRecords([]);
      setError("Your session has expired. Please log in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      let evidenceRes;
      let casesRes;

      try {
        [evidenceRes, casesRes] = await Promise.all([
          fetch(`${API}/evidence`, { headers, signal }),
          fetch(`${API}/cases`, { headers, signal }),
        ]);
} catch (err) {
  if (err.name === "AbortError") {
    throw err;
  }

  throw new Error(
    "Cannot connect to the backend. Make sure FastAPI is running at http://127.0.0.1:8000.",
    { cause: err }
  );
}

      if (!evidenceRes.ok) {
        throw new Error(
          `Could not load evidence (HTTP ${evidenceRes.status}).`
        );
      }

      if (!casesRes.ok) {
        throw new Error(
          `Could not load cases (HTTP ${casesRes.status}).`
        );
      }

      const [evidenceData, casesData] = await Promise.all([
        evidenceRes.json(),
        casesRes.json(),
      ]);

      if (!Array.isArray(evidenceData) || !Array.isArray(casesData)) {
        throw new Error("The backend returned an unexpected response.");
      }

      const caseMap = new Map(
        casesData.map((item) => [String(item.id), item])
      );

      const results = await Promise.all(
        evidenceData.map(async (item) => {
          let version = null;

          if (item.current_version_id) {
            try {
              const response = await fetch(
                `${API}/evidence/${item.id}/versions`,
                { headers, signal }
              );

              if (response.ok) {
                const versions = await response.json();

                if (Array.isArray(versions)) {
                  version =
                    versions.find(
                      (v) =>
                        String(v.id) ===
                        String(item.current_version_id)
                    ) || null;
                }
              }
            } catch (err) {
              if (err.name === "AbortError") throw err;
              // Keep the evidence visible if version details are unavailable.
            }
          }

          const relatedCase = caseMap.get(String(item.case_id));

          const hash = version?.file_hash || item.file_hash || "";

          const flagged =
            version?.is_tamper_flagged ??
            item.is_tamper_flagged ??
            false;

          return {
            id: String(item.id),
            caseId: item.case_id,
            caseNumber:
              relatedCase?.case_number ||
              item.case_number ||
              item.case_id ||
              "—",
            title: item.title || item.file_name || "Untitled evidence",
            fileName: version?.file_name || item.file_name || "",
            hash,
            evidenceType: item.evidence_type || "Unclassified",
            analyst:
              version?.uploaded_by ||
              item.submitted_by ||
              item.uploaded_by ||
              "—",
            submittedAt:
              version?.uploaded_at ||
              item.uploaded_at ||
              item.created_at,
            integrity: flagged
              ? "FLAGGED"
              : hash
                ? "RECORDED"
                : "PENDING",
          };
        })
      );

      if (!signal?.aborted) {
        setRecords(results);
      }
    } catch (err) {
      if (err.name === "AbortError") return;

      setError(err.message || "Unable to load saved evidence.");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const startLoading = async () => {
      await loadEvidence(controller.signal);
    };

    startLoading();

    return () => {
      controller.abort();
    };
  }, [loadEvidence]);

  const evidenceTypes = useMemo(
    () => [
      "All Evidence",
      ...new Set(
        records.map((record) => record.evidenceType).filter(Boolean)
      ),
    ],
    [records]
  );

  const visibleRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchesType =
        typeFilter === "All Evidence" ||
        record.evidenceType === typeFilter;

      const searchable = [
        record.caseNumber,
        record.title,
        record.fileName,
        record.hash,
        record.analyst,
        record.evidenceType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesType && (!query || searchable.includes(query));
    });
  }, [records, search, typeFilter]);

  const handleNavigate = (tab) => {
    if (routes[tab]) {
      navigate(routes[tab]);
    }
  };

  const handleRefresh = () => {
    loadEvidence();
  };

  return (
    <VaultLayout
  activeTab="Case Library"
  onTabChange={handleNavigate}
>
      <main className="evidence-library">
        <div className="evidence-library-kicker">
          ARCHIVE DIRECTORY / EVIDENCE LEDGER
        </div>

        <header className="evidence-library-header">
          <div>
            <h1>Secure Case Library</h1>
            <span className="ledger-badge">LEDGER</span>
            <p>
              Filter, search, and examine archived evidentiary records.
            </p>
          </div>

          <button
            className="ledger-primary-button"
            type="button"
            onClick={() => navigate("/submission")}
          >
            <Plus size={15} />
            New Submission
          </button>
        </header>

        <div className="ledger-toolbar">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search case ID, title, hash, or analyst..."
            aria-label="Search evidence records"
          />

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            aria-label="Filter by evidence type"
          >
            {evidenceTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <button
            className="ledger-secondary-button"
            type="button"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw size={14} />
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="ledger-error" role="alert">
            {error}
          </div>
        )}

        <section className="ledger-panel">
          <div className="ledger-table-scroll">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>CASE ID</th>
                  <th>TITLE &amp; CRYPTOGRAPHIC HASH</th>
                  <th>EVIDENCE TYPE</th>
                  <th>ANALYST</th>
                  <th>SUBMISSION TIMESTAMP</th>
                  <th>INTEGRITY</th>
                  <th aria-label="Open record"></th>
                </tr>
              </thead>

              <tbody>
                {loading && records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="ledger-empty">
                      Loading saved evidence...
                    </td>
                  </tr>
                ) : visibleRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="ledger-empty">
                      {error
                        ? "Records could not be loaded. Check the error above."
                        : records.length === 0
                          ? "No saved evidence yet. Submit a PDF through Secure Submission."
                          : "No records match your search or filter."}
                    </td>
                  </tr>
                ) : (
                  visibleRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="ledger-case-id">
                        {record.caseNumber}
                      </td>

                      <td className="ledger-file-cell">
                        <strong>{record.title}</strong>

                        {record.fileName && (
                          <small>{record.fileName}</small>
                        )}

                        <small>
                          SHA-256:{" "}
                          {record.hash
                            ? `${record.hash.slice(0, 16)}...`
                            : "Not available"}
                        </small>
                      </td>

                      <td>
                        <span className="ledger-type">
                          {record.evidenceType}
                        </span>
                      </td>

                      <td>{record.analyst}</td>

                      <td>{formatDate(record.submittedAt)}</td>

                      <td>
                        <span
                          className={`ledger-integrity ${
                            record.integrity === "FLAGGED"
                              ? "ledger-integrity-warning"
                              : ""
                          }`}
                        >
                          {record.integrity}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="ledger-open-button"
                          title="Open case details"
                          onClick={() =>
                            navigate(
                              `/cases/detail?caseId=${encodeURIComponent(
                                record.caseId || ""
                              )}`
                            )
                          }
                        >
                          <ArrowUpRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <footer className="ledger-footer">
            <span>
              SHOWING {visibleRecords.length} OF {records.length} RECORDS
            </span>
            <span>ARCHIVE NODE: APSY-SECURE-01</span>
          </footer>
        </section>

        <div className="ledger-notice">
          <strong>SECURE ARCHIVE</strong>
          <p>
            Evidence records are loaded from the backend. “RECORDED”
            indicates that a file hash is available; it does not confirm
            that cryptographic integrity verification has passed.
          </p>
        </div>
      </main>
    </VaultLayout>
  );
}
