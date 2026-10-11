
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  FolderOpen,
  ShieldCheck,
  FileSearch,
  ArrowUpRight,
  SlidersHorizontal,
} from "lucide-react";
import VaultLayout from "../layouts/VaultLayout";
import "./CaseLibrary.css";

const routes = {
  Overview: "/welcome",
  "Case Library": "/cases",
  "Case Detail": "/cases/detail",
  "Secure Submission": "/submission",
  "Audit Trail": "/audit",
  "Access Control": "/access-control",
};

const initialCases = [
  {
    id: "APSY-2026-001",
    title: "Digital Device Extraction",
    investigator: "T. Santos",
    evidence: 8,
    status: "Under Review",
    updated: "2026-10-10",
  },
  {
    id: "APSY-2026-002",
    title: "Network Intrusion Analysis",
    investigator: "M. Reyes",
    evidence: 12,
    status: "Active",
    updated: "2026-10-09",
  },
  {
    id: "APSY-2026-003",
    title: "Mobile Artifact Examination",
    investigator: "J. Cruz",
    evidence: 5,
    status: "Sealed",
    updated: "2026-10-08",
  },
  {
    id: "APSY-2026-004",
    title: "System Log Reconstruction",
    investigator: "T. Santos",
    evidence: 4,
    status: "Active",
    updated: "2026-10-06",
  },
];

function CaseLibrary() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [cases] = useState(initialCases);

  const goTo = (tab) => {
    const route = routes[tab];

    if (route) {
      navigate(route);
    }
  };

  const filteredCases = useMemo(() => {
    return cases.filter((item) => {
      const matchesSearch = [
        item.id,
        item.title,
        item.investigator,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesStatus =
        status === "All" || item.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [cases, search, status]);

  return (
    <VaultLayout
      activeTab="Case Library"
      onTabChange={goTo}
    >
      <div className="library-page">
        <div className="library-heading">
          <div>
            <div className="library-eyebrow">
              ARCHIVE DIRECTORY / RECORDS
            </div>

            <h1>Secure Case Library</h1>

            <p>
              Centralized access to registered forensic cases and
              their chain-of-custody records.
            </p>
          </div>

          <button
            className="library-create-button"
            onClick={() => navigate(routes["Secure Submission"])}
            type="button"
          >
            <Plus size={16} />
            New Case
          </button>
        </div>

        <div className="library-stats">
          <div className="library-stat-card">
            <span className="library-stat-icon">
              <FolderOpen size={18} />
            </span>

            <span className="library-stat-label">
              TOTAL RECORDS
            </span>

            <strong>
              {cases.length.toString().padStart(2, "0")}
            </strong>
          </div>

          <div className="library-stat-card">
            <span className="library-stat-icon">
              <FileSearch size={18} />
            </span>

            <span className="library-stat-label">
              UNDER REVIEW
            </span>

            <strong>
              {cases.filter(
                (item) => item.status === "Under Review"
              ).length}
            </strong>
          </div>

          <div className="library-stat-card">
            <span className="library-stat-icon">
              <ShieldCheck size={18} />
            </span>

            <span className="library-stat-label">
              SEALED RECORDS
            </span>

            <strong>
              {cases.filter(
                (item) => item.status === "Sealed"
              ).length}
            </strong>
          </div>
        </div>

        <section className="library-records">
          <div className="library-records-heading">
            <div>
              <h2>Registered Cases</h2>
              <p>
                Browse and locate secured forensic dossiers.
              </p>
            </div>

            <span className="library-record-count">
              {filteredCases.length} RECORDS
            </span>
          </div>

          <div className="library-toolbar">
            <label className="library-search">
              <Search size={16} />

              <input
                type="search"
                placeholder="Search by case ID, title, or investigator..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </label>

            <label className="library-filter">
              <SlidersHorizontal size={15} />

              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
                aria-label="Filter by case status"
              >
                <option value="All">All statuses</option>
                <option value="Active">Active</option>
                <option value="Under Review">Under Review</option>
                <option value="Sealed">Sealed</option>
              </select>
            </label>
          </div>

          <div className="library-table-wrap">
            <table className="library-table">
              <thead>
                <tr>
                  <th>CASE IDENTIFIER</th>
                  <th>CASE TITLE</th>
                  <th>INVESTIGATOR</th>
                  <th>EVIDENCE</th>
                  <th>STATUS</th>
                  <th>LAST UPDATED</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filteredCases.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="library-case-id">
                        {item.id}
                      </span>
                    </td>

                    <td className="library-case-title">
                      {item.title}
                    </td>

                    <td>{item.investigator}</td>

                    <td>
                      {String(item.evidence).padStart(2, "0")} files
                    </td>

                    <td>
                      <span
                        className={`library-status status-${item.status
                          .toLowerCase()
                          .replaceAll(" ", "-")}`}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td className="library-date">
                      {item.updated}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="library-open-button"
                        aria-label={`Open ${item.id}`}
                        onClick={() =>
                          navigate(
                            `${routes["Case Detail"]}?caseId=${encodeURIComponent(item.id)}`
                          )
                        }
                      >
                        <ArrowUpRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredCases.length === 0 && (
                  <tr>
                    <td colSpan="7" className="library-empty">
                      No records match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="library-table-footer">
            <span>
              SHOWING {filteredCases.length} OF {cases.length} RECORDS
            </span>

            <span>ARCHIVE NODE: APSY-SECURE-01</span>
          </div>
        </section>

        <div className="library-notice">
          <ShieldCheck size={16} />

          <p>
            <strong>SECURE ARCHIVE</strong>

            <span>
              Case records displayed here are demonstration data until
              the live API is connected.
            </span>
          </p>
        </div>
      </div>
    </VaultLayout>
  );
}

export default CaseLibrary;
