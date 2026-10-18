
import { useEffect, useMemo, useState } from "react";
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
import { api, philippineDate } from "../lib/api";
import { useAuth } from "../auth/context";

const routes = {
  Overview: "/welcome",
  "Case Library": "/cases",
  "Case Detail": "/cases/detail",
  "Secure Submission": "/submission",
  "Audit Trail": "/audit",
  "Access Control": "/access-control",
};

function CaseLibrary({ embedded = false, records, people, ready = true, loadError = "" }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [cases, setCases] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    const load = async () => {
      try {
        const sourceRecords = records === undefined ? await api("/cases") : records;
        const sourceUsers = people === undefined
          ? user.permissions.includes("user:manage") ? await api("/users") : []
          : people;
        const names = Object.fromEntries(sourceUsers.map((person) => [person.id, person.name]));
        const [counts, caseTags] = await Promise.all([
          Promise.all(sourceRecords.map((record) =>
            api(`/evidence/by-case/${record.id}`).then((items) => items.length).catch(() => null))),
          Promise.all(sourceRecords.map((record) => api(`/cases/${record.id}/tags`))),
        ]);
        if (active) setCases(sourceRecords.map((record, index) => ({
          id: record.id, caseNumber: record.case_number, title: record.case_type,
          investigator: names[record.created_by] || (record.created_by === user.id ? user.name : record.created_by),
          evidence: counts[index], tags: caseTags[index].map((tag) => tag.name),
          status: record.status, updated: philippineDate(record.updated_at),
        })));
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [user, records, people, ready]);

  const goTo = (tab) => {
    const route = routes[tab];

    if (route) {
      navigate(route);
    }
  };

  const filteredCases = useMemo(() => {
    return cases.filter((item) => {
      const matchesSearch = [
        item.caseNumber,
        item.title,
        item.investigator,
        ...item.tags,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesStatus =
        status === "All" || item.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [cases, search, status]);

  const content = (
      <div className={`library-page${embedded ? " library-page-embedded" : ""}`}>
        {!embedded && <div className="library-heading">
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

          {user.permissions.includes("case:create") && <button
            className="library-create-button"
            onClick={() => navigate("/cases/new")}
            type="button"
          >
            <Plus size={16} />
            New Case
          </button>}
        </div>}

        {embedded && user.permissions.includes("case:create") && <div className="library-embedded-actions"><button
          className="library-create-button" onClick={() => navigate("/cases/new")} type="button">
          <Plus size={16} /> New Case
        </button></div>}

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
              OPEN CASES
            </span>

            <strong>
              {cases.filter(
                (item) => item.status.toLowerCase() === "open"
              ).length}
            </strong>
          </div>

          <div className="library-stat-card">
            <span className="library-stat-icon">
              <ShieldCheck size={18} />
            </span>

            <span className="library-stat-label">
              CLOSED CASES
            </span>

            <strong>
              {cases.filter(
                (item) => item.status.toLowerCase() === "closed"
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
                placeholder="Search by case number, type, creator, or tag..."
                aria-label="Search cases by case number, type, creator, or tag"
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
                {[...new Set(cases.map((item) => item.status))].map((value) =>
                  <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>

          <div className="library-table-wrap">
            <table className="library-table">
              <thead>
                <tr>
                  <th>CASE IDENTIFIER</th>
                  <th>CASE TYPE</th>
                  <th>TAGS</th>
                  <th>CREATED BY</th>
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
                      <button className="library-case-id" type="button" onClick={() =>
                        navigate(`${routes["Case Detail"]}?caseId=${encodeURIComponent(item.id)}`)}>
                        {item.caseNumber}
                      </button>
                    </td>

                    <td className="library-case-title">
                      {item.title}
                    </td>

                    <td>
                      <div className="library-case-tags">
                        {item.tags.length ? item.tags.map((tag) =>
                          <span key={tag}>{tag}</span>) : <span className="library-no-tags">None</span>}
                      </div>
                    </td>

                    <td>{item.investigator}</td>

                    <td>
                      {item.evidence == null ? "—" : `${item.evidence} files`}
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
                        aria-label={`Open ${item.caseNumber}`}
                        onClick={() =>
                          navigate(
                            `${routes["Case Detail"]}?caseId=${encodeURIComponent(item.id)}`
                          )
                        }
                      >
                        <ArrowUpRight size={16} /> Open case
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredCases.length === 0 && (
                  <tr>
                    <td colSpan="8" className="library-empty">
                      {loading ? "Loading cases and tags…" : error || loadError || "No records match your search."}
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

            <span>LIVE CASE RECORDS</span>
          </div>
        </section>

        <div className="library-notice">
          <ShieldCheck size={16} />

          <p>
            <strong>SECURE ARCHIVE</strong>

            <span>
              Case records shown here are retrieved from the Case Vault API.
            </span>
          </p>
        </div>
      </div>
  );

  return embedded ? content : <VaultLayout activeTab="Case Library" onTabChange={goTo}>{content}</VaultLayout>;
}

export default CaseLibrary;
