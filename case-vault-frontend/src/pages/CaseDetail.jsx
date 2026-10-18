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
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import VaultLayout from "../layouts/VaultLayout";
import "./CaseDetail.css";

const caseRecord = {
  id: "APSY-2026-001",
  title: "Digital Device Extraction",
  status: "Under Review",
  priority: "High",
  investigator: "T. Santos",
  reviewer: "M. Reyes",
  created: "October 02, 2026",
  updated: "October 10, 2026",
  description:
    "Forensic examination of a seized digital device to identify, preserve, and document artifacts relevant to the ongoing investigation.",
};

const evidenceFiles = [
  {
    id: "EVD-001",
    name: "device_extraction_report.pdf",
    type: "PDF DOCUMENT",
    size: "2.4 MB",
    date: "Oct 10, 2026",
    hash: "a84f91c2...7bd03e61",
    status: "Verified",
  },
  {
    id: "EVD-002",
    name: "system_artifacts_summary.pdf",
    type: "PDF DOCUMENT",
    size: "1.8 MB",
    date: "Oct 08, 2026",
    hash: "7d32ab10...e9046f2c",
    status: "Verified",
  },
  {
    id: "EVD-003",
    name: "acquisition_notes.pdf",
    type: "PDF DOCUMENT",
    size: "860 KB",
    date: "Oct 06, 2026",
    hash: "c19e52a4...1f8a30bd",
    status: "Pending Review",
  },
];

const custodyEvents = [
  {
    date: "Oct 10, 2026 · 14:32 UTC",
    title: "Integrity check recorded",
    detail: "Evidence EVD-001 passed the demonstration integrity check.",
    actor: "T. Santos",
    type: "verified",
  },
  {
    date: "Oct 08, 2026 · 09:15 UTC",
    title: "Evidence record updated",
    detail: "System artifacts summary was added to the case inventory.",
    actor: "T. Santos",
    type: "updated",
  },
  {
    date: "Oct 02, 2026 · 08:40 UTC",
    title: "Case dossier created",
    detail: "Initial case record registered in the archive.",
    actor: "M. Reyes",
    type: "created",
  },
];

function CaseDetail({ onNavigate }) {
  const navigate = useNavigate();

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


    if (routes[tab]) {
      navigate(routes[tab]);
    }
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
              <h1>{caseRecord.title}</h1>
              <span className="detail-status">
                <span />
                {caseRecord.status}
              </span>
            </div>
            <p>
              Review case information, associated evidence, and recorded
              chain-of-custody activity.
            </p>
          </div>

          <button
            className="detail-primary-button"
            type="button"
            onClick={() => goTo("Secure Submission")}
          >
            <Upload size={16} />
            Add Evidence
          </button>
        </div>

        <section className="detail-case-banner">
          <div className="detail-case-symbol">
            <Fingerprint size={26} />
          </div>

          <div className="detail-case-identity">
            <span>CASE IDENTIFIER</span>
            <strong>{caseRecord.id}</strong>
            <small>FORENSIC DOSSIER · DIGITAL EVIDENCE</small>
          </div>

          <div className="detail-banner-divider" />

          <div className="detail-banner-item">
            <span>PRIORITY</span>
            <strong className="detail-priority">
              <span />
              {caseRecord.priority}
            </strong>
          </div>

          <div className="detail-banner-item">
            <span>REGISTERED</span>
            <strong>{caseRecord.created}</strong>
          </div>
        </section>

        <div className="detail-overview-grid">
          <section className="detail-panel detail-information">
            <div className="detail-panel-heading">
              <div>
                <span className="detail-section-index">01 / OVERVIEW</span>
                <h2>Case Information</h2>
              </div>
              <LockKeyhole size={18} />
            </div>

            <p className="detail-description">
              {caseRecord.description}
            </p>

            <div className="detail-information-grid">
              <div>
                <span className="detail-field-label">
                  <UserRound size={14} />
                  LEAD INVESTIGATOR
                </span>
                <strong>{caseRecord.investigator}</strong>
              </div>
              <div>
                <span className="detail-field-label">
                  <ShieldCheck size={14} />
                  ASSIGNED REVIEWER
                </span>
                <strong>{caseRecord.reviewer}</strong>
              </div>
              <div>
                <span className="detail-field-label">
                  <Clock3 size={14} />
                  LAST MODIFIED
                </span>
                <strong>{caseRecord.updated}</strong>
              </div>
              <div>
                <span className="detail-field-label">
                  <FileText size={14} />
                  EVIDENCE ITEMS
                </span>
                <strong>{String(evidenceFiles.length).padStart(2, "0")} listed</strong>
              </div>
            </div>
          </section>

          <section className="detail-panel detail-integrity">
            <div className="detail-panel-heading">
              <div>
                <span className="detail-section-index">02 / INTEGRITY</span>
                <h2>Archive Integrity</h2>
              </div>
              <ShieldCheck size={19} />
            </div>

            <div className="detail-integrity-icon">
              <CheckCircle2 size={25} />
            </div>
            <strong className="detail-integrity-title">
              Integrity Records Available
            </strong>
            <p>
              Hash references are displayed for interface demonstration.
              Live verification requires connection to the backend.
            </p>

            <div className="detail-integrity-row">
              <span>Listed evidence</span>
              <strong>{String(evidenceFiles.length).padStart(2, "0")} files</strong>
            </div>
            <div className="detail-integrity-row">
              <span>Verified in demo data</span>
              <strong>
                {String(
                  evidenceFiles.filter((file) => file.status === "Verified").length
                ).padStart(2, "0")}{" "}
                files
              </strong>
            </div>

            <div className="detail-demo-warning">
              <AlertTriangle size={14} />
              Demonstration status only
            </div>
          </section>
        </div>

        <section className="detail-panel detail-evidence-panel">
          <div className="detail-panel-heading detail-evidence-heading">
            <div>
              <span className="detail-section-index">03 / EVIDENCE INVENTORY</span>
              <h2>Registered Evidence</h2>
              <p>Evidence files associated with this case dossier.</p>
            </div>
            <span className="detail-evidence-count">
              {String(evidenceFiles.length).padStart(2, "0")} ITEMS
            </span>
          </div>

          <div className="detail-evidence-list">
            {evidenceFiles.map((file) => (
              <article className="detail-evidence-row" key={file.id}>
                <div className="detail-file-icon">
                  <FileText size={20} />
                </div>

                <div className="detail-file-main">
                  <strong>{file.name}</strong>
                  <span>
                    {file.id} <span className="detail-dot">·</span> {file.type}
                  </span>
                </div>

                <div className="detail-file-meta">
                  <span>FILE SIZE</span>
                  <strong>{file.size}</strong>
                </div>

                <div className="detail-file-meta detail-file-hash">
                  <span>SHA-256 REFERENCE</span>
                  <code>{file.hash}</code>
                </div>

                <div className="detail-file-status-wrap">
                  <span
                    className={`detail-file-status ${
                      file.status === "Verified"
                        ? "detail-file-verified"
                        : "detail-file-pending"
                    }`}
                  >
                    {file.status === "Verified" ? (
                      <CheckCircle2 size={13} />
                    ) : (
                      <Clock3 size={13} />
                    )}
                    {file.status}
                  </span>
                  <small>{file.date}</small>
                </div>

                <button
                  className="detail-file-action"
                  type="button"
                  title="Delete Evidence"
                  onClick={() =>
                    window.alert(
                      "This is demonstration data. Evidence preview will be available after backend integration."
                    )
                  }
                >
                  <ExternalLink size={15} />
                </button>
              </article>
            ))}
          </div>

          <div className="detail-evidence-footer">
            <span>HASH VALUES ARE PLACEHOLDERS</span>
            <button type="button" onClick={() => goTo("Secure Submission")}>
              <Upload size={14} />
              Register Evidence
            </button>
          </div>
        </section>

        <section className="detail-panel detail-custody-panel">
          <div className="detail-panel-heading detail-custody-heading">
            <div>
              <span className="detail-section-index">04 / CHAIN OF CUSTODY</span>
              <h2>Activity Ledger</h2>
              <p>Chronological overview of recorded dossier activity.</p>
            </div>
            <History size={19} />
          </div>

          <div className="detail-timeline">
            {custodyEvents.map((event, index) => (
              <article className="detail-timeline-event" key={event.title}>
                <div className={`detail-timeline-marker marker-${event.type}`}>
                  {event.type === "verified" ? (
                    <CheckCircle2 size={15} />
                  ) : event.type === "updated" ? (
                    <FileText size={15} />
                  ) : (
                    <LockKeyhole size={15} />
                  )}
                </div>

                <div className="detail-timeline-content">
                  <div className="detail-timeline-title-row">
                    <h3>{event.title}</h3>
                    <time>{event.date}</time>
                  </div>
                  <p>{event.detail}</p>
                  <span>RECORDED BY: {event.actor}</span>
                </div>

                {index !== custodyEvents.length - 1 && (
                  <div className="detail-timeline-line" />
                )}
              </article>
            ))}
          </div>

          <div className="detail-ledger-footer">
            <ShieldCheck size={15} />
            <span>
              This activity ledger uses mock entries and is not a verified
              audit log.
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
      </div>
    </VaultLayout>
  );
}

export default CaseDetail;