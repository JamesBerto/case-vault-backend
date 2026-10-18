import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, AlertTriangle, Clock3, Eye, Fingerprint, Search, ShieldCheck, X } from "lucide-react";
import VaultLayout from "../layouts/VaultLayout";
import { api, philippineDate } from "../lib/api";
import "./AuditTrail.css";

const routes = {
  Overview: "/welcome", "Case Library": "/cases", "Case Detail": "/cases/detail",
  "Secure Submission": "/submission", "Audit Trail": "/audit", "Access Control": "/access-control",
};

function categoryFor(action) {
  if (action.includes("tamper") || action.includes("verif")) return "Integrity";
  if (action.includes("evidence") || action.includes("version")) return "Evidence";
  if (action.includes("case") || action.includes("tag")) return "Case";
  return "Account";
}

function statusFor(entry) {
  if (entry.action === "evidence_verification_failed") return "Check failed";
  if (entry.action === "tamper_flagged" || entry.metadata?.intact === false) return "Flagged";
  if (entry.action === "evidence_verified" && entry.metadata?.intact === true) return "Verified";
  return "Recorded";
}

function AuditTrail() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [people, setPeople] = useState({});
  const [cases, setCases] = useState({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([api("/audit?limit=500"), api("/users"), api("/cases")]).then(([logs, users, records]) => {
      if (!active) return;
      setEntries(logs);
      setPeople(Object.fromEntries(users.map((user) => [user.id, user.name])));
      setCases(Object.fromEntries(records.map((record) => [record.id, record.case_number])));
    }).catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => entries.filter((entry) => {
    const text = [entry.id, entry.action, entry.actor_user_id, people[entry.actor_user_id],
      entry.case_id, cases[entry.case_id], entry.evidence_id].join(" ").toLowerCase();
    return text.includes(search.toLowerCase()) &&
      (category === "All" || categoryFor(entry.action) === category) &&
      (status === "All" || statusFor(entry) === status);
  }), [entries, people, cases, search, category, status]);

  return <VaultLayout activeTab="Audit Trail" onTabChange={(tab) => navigate(routes[tab])}>
    <div className="audit-page">
      <div className="audit-heading"><div><div className="audit-eyebrow">SECURITY OPERATIONS / SYSTEM RECORDS</div>
        <h1>Archive System Audit Ledger</h1><p>Recent actions recorded by the backend.</p></div>
        <div className="audit-live-label"><span /> LIVE RECORDS</div></div>
      {error && <div className="audit-notice" role="alert"><AlertTriangle size={17} /><p>{error}</p></div>}
      <div className="audit-stats">
        <article className="audit-stat-card"><div className="audit-stat-top"><Activity size={18} /><span>TOTAL SHOWN</span></div><strong>{entries.length}</strong></article>
        <article className="audit-stat-card"><div className="audit-stat-top"><ShieldCheck size={18} /><span>INTACT CHECKS</span></div>
          <strong>{entries.filter((entry) => entry.action === "evidence_verified" && entry.metadata?.intact === true).length}</strong></article>
        <article className="audit-stat-card"><div className="audit-stat-top"><AlertTriangle size={18} /><span>TAMPER FLAGS</span></div>
          <strong>{entries.filter((entry) => entry.action === "tamper_flagged").length}</strong></article>
        <article className="audit-stat-card"><div className="audit-stat-top"><Fingerprint size={18} /><span>CASE REFERENCES</span></div>
          <strong>{new Set(entries.map((entry) => entry.case_id).filter(Boolean)).size}</strong></article>
      </div>
      <section className="audit-ledger-panel">
        <div className="audit-panel-heading"><div><h2>Activity Ledger</h2><p>Showing up to 500 most recent entries.</p></div>
          <div className="audit-record-total">{filtered.length} RECORDS</div></div>
        <div className="audit-toolbar">
          <label className="audit-search"><Search size={16} /><input type="search" value={search}
            onChange={(event) => setSearch(event.target.value)} placeholder="Search action, actor, case, or ID" />
            {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={14} /></button>}</label>
          <label className="audit-select"><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter category">
            {["All", "Account", "Case", "Evidence", "Integrity"].map((value) =>
              <option key={value} value={value}>{"\u00A0\u00A0\u00A0"}{value}</option>)}</select></label>
          <label className="audit-select"><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter status">
            {["All", "Recorded", "Verified", "Flagged", "Check failed"].map((value) =>
              <option key={value} value={value}>{"\u00A0\u00A0\u00A0"}{value}</option>)}</select></label>
        </div>
        <div className="audit-table-wrap"><table className="audit-table"><thead><tr>
          <th>EVENT / TIMESTAMP</th><th>ACTOR</th><th>ACTION</th><th>CASE REFERENCE</th><th>STATUS</th><th></th>
        </tr></thead><tbody>
          {filtered.map((entry) => <tr key={entry.id}>
            <td><div className="audit-event-id">{entry.id}</div><div className="audit-event-time"><Clock3 size={12} />{philippineDate(entry.occurred_at)}</div></td>
            <td><strong>{people[entry.actor_user_id] || entry.actor_user_id}</strong></td>
            <td><strong className="audit-action">{entry.action.replaceAll("_", " ")}</strong><small className="audit-target">{categoryFor(entry.action)}</small></td>
            <td><span className="audit-case-id">{cases[entry.case_id] || entry.case_id || "—"}</span></td>
            <td><span className={`audit-status audit-status-${statusFor(entry).toLowerCase().replaceAll(" ", "-")}`}>{statusFor(entry)}</span></td>
            <td><button type="button" className="audit-view-button" aria-label={`Inspect ${entry.id}`} onClick={() => setSelected(entry)}><Eye size={15} /></button></td>
          </tr>)}
          {filtered.length === 0 && <tr><td colSpan="6" className="audit-empty">{loading ? "Loading audit records…" : "No audit records match."}</td></tr>}
        </tbody></table></div>
        <div className="audit-table-footer">SHOWING {filtered.length} OF {entries.length} LOADED EVENTS</div>
      </section>
      {selected && <div className="audit-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
        <section className="audit-detail-modal" role="dialog" aria-modal="true" aria-labelledby="audit-modal-title">
          <div className="audit-modal-header"><h2 id="audit-modal-title">Audit Entry</h2><button type="button" aria-label="Close" onClick={() => setSelected(null)}><X size={19} /></button></div>
          <h3 className="audit-modal-action">{selected.action.replaceAll("_", " ")}</h3>
          <div className="audit-detail-fields">
            <div><span>EVENT ID</span><strong>{selected.id}</strong></div><div><span>TIME</span><strong>{philippineDate(selected.occurred_at)}</strong></div>
            <div><span>ACTOR</span><strong>{people[selected.actor_user_id] || selected.actor_user_id}</strong></div>
            <div><span>CASE</span><strong>{cases[selected.case_id] || selected.case_id || "—"}</strong></div>
            <div><span>EVIDENCE ID</span><strong>{selected.evidence_id || "—"}</strong></div>
            <div><span>DETAILS</span><strong>{JSON.stringify(selected.metadata || {})}</strong></div>
          </div>
          {selected.case_id && cases[selected.case_id] && <button type="button" className="audit-modal-primary"
            onClick={() => navigate(`/cases/detail?caseId=${encodeURIComponent(selected.case_id)}`)}>Open Case</button>}
        </section>
      </div>}
    </div>
  </VaultLayout>;
}

export default AuditTrail;
