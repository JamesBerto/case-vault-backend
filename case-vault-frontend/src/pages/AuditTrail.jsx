
import { useMemo, useState } from "react";
import {
  Search,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Clock3,
  Fingerprint,
  ChevronDown,
  Eye,
  X,
  FileText,
  LockKeyhole,
  UserRound,
  Filter,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import VaultLayout from "../layouts/VaultLayout";
import "./AuditTrail.css";

const auditEvents = [
  {
    id: "EVT-20261010-0142",
    timestamp: "2026-10-10 14:32:08 UTC",
    actor: "T. Santos",
    role: "FORENSIC ANALYST",
    action: "Evidence Integrity Check",
    category: "Integrity",
    caseId: "APSY-2026-001",
    target: "device_extraction_report.pdf",
    status: "Verified",
    details:
      "A demonstration integrity-check event was recorded for the device extraction report.",
    reference: "REF-DEMO-00142",
  },
  {
    id: "EVT-20261010-0139",
    timestamp: "2026-10-10 13:47:21 UTC",
    actor: "M. Reyes",
    role: "CASE REVIEWER",
    action: "Case Record Accessed",
    category: "Access",
    caseId: "APSY-2026-002",
    target: "Network Intrusion Analysis",
    status: "Recorded",
    details:
      "The case overview was opened during a demonstration review session.",
    reference: "REF-DEMO-00139",
  },
  {
    id: "EVT-20261009-0118",
    timestamp: "2026-10-09 10:16:45 UTC",
    actor: "T. Santos",
    role: "FORENSIC ANALYST",
    action: "Evidence Record Updated",
    category: "Evidence",
    caseId: "APSY-2026-001",
    target: "system_artifacts_summary.pdf",
    status: "Recorded",
    details:
      "The demonstration evidence record was updated with additional descriptive metadata.",
    reference: "REF-DEMO-00118",
  },
  {
    id: "EVT-20261008-0093",
    timestamp: "2026-10-08 16:04:12 UTC",
    actor: "J. Cruz",
    role: "FORENSIC ANALYST",
    action: "Review Required",
    category: "Review",
    caseId: "APSY-2026-003",
    target: "Mobile Artifact Examination",
    status: "Flagged",
    details:
      "This sample event represents a record awaiting reviewer attention. It does not indicate a real security incident.",
    reference: "REF-DEMO-00093",
  },
  {
    id: "EVT-20261008-0087",
    timestamp: "2026-10-08 09:35:04 UTC",
    actor: "M. Reyes",
    role: "CASE REVIEWER",
    action: "Dossier Review Completed",
    category: "Review",
    caseId: "APSY-2026-002",
    target: "Network Intrusion Analysis",
    status: "Verified",
    details:
      "A sample review-completion event was recorded for the network intrusion case.",
    reference: "REF-DEMO-00087",
  },
  {
    id: "EVT-20261007-0061",
    timestamp: "2026-10-07 11:28:53 UTC",
    actor: "System",
    role: "ARCHIVE SERVICE",
    action: "Session Closed",
    category: "Access",
    caseId: "APSY-2026-004",
    target: "System Log Reconstruction",
    status: "Recorded",
    details:
      "A demonstration session-closure event was written to the sample ledger.",
    reference: "REF-DEMO-00061",
  },
  {
    id: "EVT-20261006-0048",
    timestamp: "2026-10-06 08:52:19 UTC",
    actor: "T. Santos",
    role: "FORENSIC ANALYST",
    action: "Evidence Registered",
    category: "Evidence",
    caseId: "APSY-2026-004",
    target: "system_log_extract.pdf",
    status: "Recorded",
    details:
      "A sample evidence-registration event was added to the demonstration ledger.",
    reference: "REF-DEMO-00048",
  },
];

function AuditTrail() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const [selectedEvent, setSelectedEvent] = useState(null);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();

    return auditEvents.filter((event) => {
      const matchesSearch = [
        event.id,
        event.actor,
        event.action,
        event.category,
        event.caseId,
        event.target,
        event.reference,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);

      const matchesCategory =
        category === "All" || event.category === category;

      const matchesStatus = status === "All" || event.status === status;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [search, category, status]);

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

  const verifiedCount = auditEvents.filter(
    (event) => event.status === "Verified"
  ).length;

  const flaggedCount = auditEvents.filter(
    (event) => event.status === "Flagged"
  ).length;

  return (
    <VaultLayout activeTab="Audit Trail" onTabChange={goTo}>
      <div className="audit-page">
        <div className="audit-heading">
          <div>
            <div className="audit-eyebrow">
              SECURITY OPERATIONS / SYSTEM RECORDS
            </div>
            <h1>Archive System Audit Ledger</h1>
            <p>
              Review recorded archive activity, evidence operations, and
              demonstration integrity events.
            </p>
          </div>

          <div className="audit-live-label">
            <span />
            DEMONSTRATION LEDGER
          </div>
        </div>

        <div className="audit-notice">
          <AlertTriangle size={17} />
          <p>
            <strong>Sample audit data</strong>
            <span>
              These entries are mock records for the interface. They are not
              retrieved from the backend and do not constitute a verified,
              tamper-evident audit log.
            </span>
          </p>
        </div>

        <div className="audit-stats">
          <article className="audit-stat-card">
            <div className="audit-stat-top">
              <span className="audit-stat-icon">
                <Activity size={18} />
              </span>
              <span className="audit-stat-label">TOTAL EVENTS</span>
            </div>
            <strong>{String(auditEvents.length).padStart(2, "0")}</strong>
            <span className="audit-stat-caption">Sample ledger entries</span>
          </article>

          <article className="audit-stat-card">
            <div className="audit-stat-top">
              <span className="audit-stat-icon audit-stat-green">
                <ShieldCheck size={18} />
              </span>
              <span className="audit-stat-label">VERIFIED EVENTS</span>
            </div>
            <strong>{String(verifiedCount).padStart(2, "0")}</strong>
            <span className="audit-stat-caption">Sample verification status</span>
          </article>

          <article className="audit-stat-card">
            <div className="audit-stat-top">
              <span className="audit-stat-icon audit-stat-red">
                <AlertTriangle size={18} />
              </span>
              <span className="audit-stat-label">FLAGGED EVENTS</span>
            </div>
            <strong>{String(flaggedCount).padStart(2, "0")}</strong>
            <span className="audit-stat-caption">Requires sample review</span>
          </article>

          <article className="audit-stat-card">
            <div className="audit-stat-top">
              <span className="audit-stat-icon">
                <Fingerprint size={18} />
              </span>
              <span className="audit-stat-label">CASE REFERENCES</span>
            </div>
            <strong>
              {String(new Set(auditEvents.map((event) => event.caseId)).size).padStart(2, "0")}
            </strong>
            <span className="audit-stat-caption">Unique referenced cases</span>
          </article>
        </div>

        <section className="audit-ledger-panel">
          <div className="audit-panel-heading">
            <div>
              <span className="audit-section-label">
                CHRONOLOGICAL RECORDS
              </span>
              <h2>Activity Ledger</h2>
              <p>Search, filter, and inspect individual sample events.</p>
            </div>
            <div className="audit-record-total">
              {filteredEvents.length} RECORDS
            </div>
          </div>

          <div className="audit-toolbar">
            <label className="audit-search">
              <Search size={16} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search event, actor, case ID, or reference..."
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                >
                  <X size={14} />
                </button>
              )}
            </label>

            <label className="audit-select">
              <Filter size={14} />
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                aria-label="Filter by category"
              >
                <option value="All">All categories</option>
                <option value="Access">Access</option>
                <option value="Evidence">Evidence</option>
                <option value="Integrity">Integrity</option>
                <option value="Review">Review</option>
              </select>
              <ChevronDown size={13} />
            </label>

            <label className="audit-select">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                aria-label="Filter by event status"
              >
                <option value="All">All statuses</option>
                <option value="Recorded">Recorded</option>
                <option value="Verified">Verified</option>
                <option value="Flagged">Flagged</option>
              </select>
              <ChevronDown size={13} />
            </label>
          </div>

          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>EVENT / TIMESTAMP</th>
                  <th>ACTOR</th>
                  <th>ACTION</th>
                  <th>CASE REFERENCE</th>
                  <th>STATUS</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <div className="audit-event-id">{event.id}</div>
                      <div className="audit-event-time">
                        <Clock3 size={12} />
                        {event.timestamp}
                      </div>
                    </td>
                    <td>
                      <div className="audit-actor">
                        <span>
                          <UserRound size={15} />
                        </span>
                        <div>
                          <strong>{event.actor}</strong>
                          <small>{event.role}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong className="audit-action">{event.action}</strong>
                      <small className="audit-target">{event.target}</small>
                    </td>
                    <td>
                      <span className="audit-case-id">{event.caseId}</span>
                      <small className="audit-reference">{event.reference}</small>
                    </td>
                    <td>
                      <span
                        className={`audit-status audit-status-${event.status.toLowerCase()}`}
                      >
                        <span />
                        {event.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="audit-view-button"
                        aria-label={`Inspect ${event.id}`}
                        onClick={() => setSelectedEvent(event)}
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan="6" className="audit-empty">
                      No audit entries match the selected search and filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="audit-table-footer">
            <span>
              SHOWING {filteredEvents.length} OF {auditEvents.length} SAMPLE EVENTS
            </span>
            <span>ARCHIVE NODE: APSY-SECURE-01</span>
          </div>
        </section>

        <div className="audit-footer-note">
          <LockKeyhole size={15} />
          <span>
            AUDIT RECORDS ARE DEMONSTRATION DATA UNTIL BACKEND INTEGRATION
          </span>
        </div>

        {selectedEvent && (
          <div
            className="audit-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedEvent(null);
              }
            }}
          >
            <section
              className="audit-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="audit-modal-title"
            >
              <div className="audit-modal-header">
                <div>
                  <span className="audit-section-label">
                    AUDIT ENTRY / DETAIL VIEW
                  </span>
                  <h2 id="audit-modal-title">Event Details</h2>
                </div>
                <button
                  type="button"
                  className="audit-modal-close"
                  aria-label="Close event details"
                  onClick={() => setSelectedEvent(null)}
                >
                  <X size={19} />
                </button>
              </div>

              <div className="audit-modal-status-row">
                <span
                  className={`audit-status audit-status-${selectedEvent.status.toLowerCase()}`}
                >
                  <span />
                  {selectedEvent.status}
                </span>
                <span className="audit-modal-category">
                  {selectedEvent.category}
                </span>
              </div>

              <h3 className="audit-modal-action">{selectedEvent.action}</h3>
              <p className="audit-modal-description">
                {selectedEvent.details}
              </p>

              <div className="audit-detail-fields">
                <div>
                  <span>EVENT IDENTIFIER</span>
                  <strong>{selectedEvent.id}</strong>
                </div>
                <div>
                  <span>TIMESTAMP</span>
                  <strong>{selectedEvent.timestamp}</strong>
                </div>
                <div>
                  <span>ACTOR</span>
                  <strong>{selectedEvent.actor}</strong>
                </div>
                <div>
                  <span>ACTOR ROLE</span>
                  <strong>{selectedEvent.role}</strong>
                </div>
                <div>
                  <span>CASE IDENTIFIER</span>
                  <strong>{selectedEvent.caseId}</strong>
                </div>
                <div>
                  <span>TARGET</span>
                  <strong>{selectedEvent.target}</strong>
                </div>
                <div>
                  <span>EVENT REFERENCE</span>
                  <strong>{selectedEvent.reference}</strong>
                </div>
              </div>

              <div className="audit-modal-warning">
                <AlertTriangle size={15} />
                This entry is a UI demonstration and is not a server-verified
                security record.
              </div>

              <div className="audit-modal-footer">
                <button
                  type="button"
                  className="audit-modal-secondary"
                  onClick={() => setSelectedEvent(null)}
                >
                  Close Details
                </button>
                <button
                  type="button"
                  className="audit-modal-primary"
                  onClick={() => {
                    setSelectedEvent(null);
                    navigate("/cases/detail");
                  }}
                >
                  <FileText size={14} />
                  Open Case Detail
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </VaultLayout>
  );
}

export default AuditTrail;
