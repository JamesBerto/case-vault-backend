import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, AlertTriangle, Check, Clock3, Eye, FileText, LockKeyhole, Minus, Plus, Search, ShieldCheck, UserCheck, Users, X } from "lucide-react";
import VaultLayout from "../layouts/VaultLayout";
import { useAuth } from "../auth/context";
import { api, philippineDate, streamAudit } from "../lib/api";
import { displayRoleName } from "../lib/roles";
import "./AccessControl.css";

const routes = {
  Overview: "/welcome", "Case Library": "/cases", "Case Detail": "/cases/detail",
  "Secure Submission": "/submission", "Audit Trail": "/audit", "Access Control": "/access-control",
};

function registeredDate(value) {
  if (!value) return "—";
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`;
  return new Date(normalized).toLocaleDateString("en-US", {
    month: "short", day: "2-digit", year: "numeric", timeZone: "Asia/Manila",
  });
}

function PermissionMark({ allowed }) {
  return allowed ? <span className="access-permission-yes" aria-label="Allowed"><Check size={15} /></span>
    : <span className="access-permission-no" aria-label="Not allowed"><Minus size={15} /></span>;
}

function activityCategoryFor(action) {
  if (action.includes("tamper") || action.includes("verif")) return "Integrity";
  if (action.includes("evidence") || action.includes("version")) return "Evidence";
  if (action.includes("case") || action.includes("tag")) return "Case";
  return "Account";
}

function activityStatusFor(entry) {
  if (entry.action === "evidence_verification_failed") return "Check failed";
  if (entry.action === "tamper_flagged" || entry.metadata?.intact === false) return "Flagged";
  if (entry.action === "evidence_verified" && entry.metadata?.intact === true) return "Verified";
  return "Recorded";
}

function accountStatus(person, onlineUserIds, presenceAvailable) {
  if (!person.is_active) return "Deactivated";
  if (!presenceAvailable) return "Unknown";
  return onlineUserIds.includes(person.id) ? "Online" : "Offline";
}

function integrityStatus(entry) {
  if (!entry) return "Not checked";
  if (entry.action === "evidence_verification_failed") return "Check failed";
  if (entry.metadata?.intact === true) return "Verified";
  if (entry.metadata?.intact === false) return "Mismatch detected";
  return "Result unavailable";
}

function AccessControl({ asOverview = false }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageUsers = user.permissions.includes("user:manage");
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [cases, setCases] = useState([]);
  const [auditEntries, setAuditEntries] = useState([]);
  const [latestIntegrity, setLatestIntegrity] = useState(null);
  const [integrityLoading, setIntegrityLoading] = useState(canManageUsers);
  const [integrityError, setIntegrityError] = useState("");
  const [checkedEvidence, setCheckedEvidence] = useState(null);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [presenceLoading, setPresenceLoading] = useState(canManageUsers);
  const [auditLoading, setAuditLoading] = useState(canManageUsers);
  const [liveError, setLiveError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [activitySearch, setActivitySearch] = useState("");
  const [activityCategory, setActivityCategory] = useState("All");
  const [activityStatus, setActivityStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role_id: "" });
  const [createError, setCreateError] = useState("");
  const [error, setError] = useState("");
  const [failedSources, setFailedSources] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(canManageUsers);
  const lastAuditHead = useRef(null);

  useEffect(() => {
    if (!canManageUsers) return;
    let active = true;
    Promise.allSettled([api("/users"), api("/roles"), api("/cases")])
      .then((results) => {
        if (!active) return;
        const setters = [setUsers, setRoles, setCases];
        results.forEach((result, index) => {
          if (result.status === "fulfilled") setters[index](result.value);
        });
        const failures = results.flatMap((result, index) => result.status === "rejected"
          ? [`${["Users", "Roles", "Cases"][index]}: ${result.reason.message}`] : []);
        setFailedSources(results.flatMap((result, index) => result.status === "rejected" ? [index] : []));
        if (failures.length) setError(failures.join(" "));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canManageUsers]);

  useEffect(() => {
    if (!canManageUsers) return;
    let active = true;
    api("/audit/integrity/latest")
      .then((entry) => { if (active && entry) setLatestIntegrity((current) =>
        !current || new Date(entry.occurred_at) > new Date(current.occurred_at) ? entry : current); })
      .catch((requestError) => { if (active) setIntegrityError(requestError.message); })
      .finally(() => { if (active) setIntegrityLoading(false); });
    return () => { active = false; };
  }, [canManageUsers]);

  useEffect(() => {
    if (!canManageUsers) return;
    let active = true;
    let controller;
    let reconnectTimer;
    const connect = async () => {
      controller = new AbortController();
      const startedAt = Date.now();
      let reconnectDelay = 3000;
      try {
        await streamAudit((entries) => {
          if (!active) return;
          const previousHead = lastAuditHead.current;
          const previousIndex = entries.findIndex((entry) => entry.id === previousHead);
          const newEntries = previousHead
            ? entries.slice(0, previousIndex < 0 ? entries.length : previousIndex) : [];
          lastAuditHead.current = entries[0]?.id || null;
          setAuditEntries(entries);
          const latestCheck = entries.find((entry) => ["evidence_verified", "evidence_verification_failed"].includes(entry.action));
          if (latestCheck) setLatestIntegrity((current) =>
            !current || new Date(latestCheck.occurred_at) > new Date(current.occurred_at) ? latestCheck : current);
          setAuditLoading(false);
          setLiveError("");
          if (newEntries.some((entry) => ["user_created", "user_updated"].includes(entry.action))) {
            api("/users").then((people) => { if (active) setUsers(people); })
              .catch((error) => { if (active) setError(`Accounts could not be refreshed: ${error.message}`); });
          }
        }, controller.signal, (ids) => {
          if (!active) return;
          setOnlineUserIds(ids);
          setPresenceLoading(false);
        });
        if (active && Date.now() - startedAt >= 30_000) reconnectDelay = 0;
        else if (active) setLiveError("Live updates disconnected. Reconnecting…");
      } catch (requestError) {
        if (!active || requestError.name === "AbortError") return;
        setAuditLoading(false);
        setPresenceLoading(false);
        setLiveError(`Live updates paused: ${requestError.message}`);
        if (requestError.status === 401 || requestError.status === 403) return;
      }
      if (active) reconnectTimer = window.setTimeout(connect, reconnectDelay);
    };
    connect();
    return () => {
      active = false;
      window.clearTimeout(reconnectTimer);
      controller?.abort();
    };
  }, [canManageUsers]);

  useEffect(() => {
    if (!showCreate) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.getElementById("create-user-name")?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, [showCreate]);

  const roleName = (id) => displayRoleName(roles.find((role) => role.id === id)?.name);
  const initials = (name) => name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const permissions = useMemo(() => [...new Set(roles.flatMap((role) => role.permissions || []))].sort(), [roles]);
  const presenceAvailable = !presenceLoading && !liveError;
  const filtered = useMemo(() => users.filter((person) => {
    const role = roles.find((item) => item.id === person.role_id)?.name || "Unknown";
    return [person.name, person.email, person.id, role].join(" ").toLowerCase().includes(search.toLowerCase()) &&
      (roleFilter === "All" || person.role_id === roleFilter) &&
      (statusFilter === "All" || statusFilter === accountStatus(person, onlineUserIds, presenceAvailable));
  }), [users, roles, search, roleFilter, statusFilter, onlineUserIds, presenceAvailable]);
  const filteredActivity = useMemo(() => auditEntries.filter((entry) => {
    const actor = users.find((person) => person.id === entry.actor_user_id)?.name || "";
    return [entry.action, entry.actor_user_id, actor, entry.case_id, entry.evidence_id, entry.id]
      .join(" ").toLowerCase().includes(activitySearch.toLowerCase()) &&
      (activityCategory === "All" || activityCategoryFor(entry.action) === activityCategory) &&
      (activityStatus === "All" || activityStatusFor(entry) === activityStatus);
  }), [auditEntries, users, activitySearch, activityCategory, activityStatus]);
  useEffect(() => {
    let active = true;
    if (!latestIntegrity?.evidence_id) return;
    api(`/evidence/${latestIntegrity.evidence_id}`)
      .then((item) => { if (active) setCheckedEvidence(item); })
      .catch(() => { if (active) setCheckedEvidence(null); });
    return () => { active = false; };
  }, [latestIntegrity?.evidence_id]);

  const run = async (action) => {
    setError(""); setMessage(""); setBusy(true);
    try { await action(); } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };

  const closeCreate = () => {
    if (busy) return;
    setShowCreate(false);
    setCreateError("");
  };

  const createUser = async (event) => {
    event.preventDefault();
    const name = newUser.name.trim();
    const email = newUser.email.trim();
    if (name.length < 2 || !email || !newUser.password.trim() || !newUser.role_id) {
      setCreateError("Complete every field. Full name must contain at least two characters.");
      return;
    }
    setCreateError("");
    setBusy(true);
    try {
      const created = await api("/users", { method: "POST", body: { ...newUser, name, email } });
      setUsers((current) => [...current, created]);
      setNewUser({ name: "", email: "", password: "", role_id: "" });
      setShowCreate(false);
      setMessage("Account created.");
    } catch (requestError) {
      setCreateError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const updateUser = (changes) => run(async () => {
    const updated = await api(`/users/${selected.id}`, { method: "PATCH", body: changes });
    setUsers((current) => current.map((person) => person.id === updated.id ? updated : person));
    setSelected(updated); setMessage("Account updated.");
  });

  const closeDetails = () => { if (!busy) setSelected(null); };

  return <VaultLayout activeTab={asOverview ? "Overview" : "Access Control"} onTabChange={(tab) => navigate(routes[tab])}>
    <div className="access-page">
      <div className="access-heading"><div><div className="access-eyebrow">{canManageUsers ? "SECURITY ADMINISTRATION / STATUS" : "ACCOUNT / STATUS"}</div>
        <h1>{canManageUsers ? "Archive Administration" : "Account Status"}</h1>
        <p>{canManageUsers ? "Manage accounts and review live archive activity." : "Review your current account and access permissions."}</p></div>
        <div className="access-security-label"><ShieldCheck size={15} /> ROLE-BASED ACCESS</div></div>
      {error && <div className="access-notice" role="alert"><AlertTriangle size={17} /><p>{error}</p></div>}
      {message && <p role="status">{message}</p>}
      {!canManageUsers && <section className="access-matrix-panel access-self-panel">
        <div className="access-panel-heading"><div><h2>Your Status</h2><p>Access assigned to your signed-in account.</p></div></div>
        <div className="access-self-details">
          <div><span>ACCOUNT</span><strong>{user.name}</strong></div>
          <div><span>EMAIL</span><strong>{user.email}</strong></div>
          <div><span>ROLE</span><strong>{displayRoleName(user.role_name)}</strong></div>
          <div><span>SESSION</span><strong>Online</strong></div>
        </div>
        <div className="access-self-permissions"><span>YOUR PERMISSIONS</span><div>{user.permissions.length
          ? user.permissions.map((code) => <span key={code}>{code}</span>)
          : <p>No permissions assigned.</p>}</div></div>
      </section>}
      {canManageUsers && <>
      <div className="admin-stats">
        <article className="admin-stat-card"><Users size={19} /><span>REGISTERED USERS</span><strong>{loading || failedSources.includes(0) ? "—" : users.length}</strong><small>Across assigned roles</small></article>
        <article className="admin-stat-card"><UserCheck size={19} /><span>ONLINE NOW</span><strong>{loading || failedSources.includes(0) || !presenceAvailable ? "—" : users.filter((person) => accountStatus(person, onlineUserIds, presenceAvailable) === "Online").length}</strong><small>{failedSources.includes(0) ? "Account data unavailable" : !presenceAvailable ? "Session status unavailable" : `${users.filter((person) => accountStatus(person, onlineUserIds, presenceAvailable) === "Offline").length} offline · ${users.filter((person) => !person.is_active).length} deactivated`}</small></article>
        <article className="admin-stat-card"><FileText size={19} /><span>CASE RECORDS</span><strong>{loading || failedSources.includes(2) ? "—" : cases.length}</strong><small>Active cases in the archive</small></article>
        <article className="admin-stat-card admin-integrity-stat"><ShieldCheck size={19} /><span>LATEST INTEGRITY CHECK</span>
          <strong className={integrityStatus(latestIntegrity) === "Mismatch detected" || integrityStatus(latestIntegrity) === "Check failed" ? "admin-integrity-mismatch" : ""}>
            {integrityLoading ? "Loading…" : integrityError && !latestIntegrity ? "Unavailable" : integrityStatus(latestIntegrity)}
          </strong>
          <small>{latestIntegrity ? `${checkedEvidence?.id === latestIntegrity.evidence_id ? checkedEvidence.title : `Evidence ${latestIntegrity.evidence_id}`} · ${philippineDate(latestIntegrity.occurred_at)}` : "On-demand verification"}</small></article>
      </div>
      <section className="access-matrix-panel admin-permission-panel" aria-labelledby="admin-permission-title">
        <div className="access-panel-heading"><div><h2 id="admin-permission-title">Permission Matrix</h2><p>Current grants from the database.</p></div></div>
        <div className="access-matrix-wrap"><table className="access-matrix"><thead><tr>
          <th>PERMISSION</th>{roles.map((role) => <th key={role.id}>{displayRoleName(role.name).toUpperCase()}</th>)}
        </tr></thead><tbody>{permissions.map((code) => <tr key={code}>
          <td><strong>{code}</strong></td>{roles.map((role) => <td key={role.id}><PermissionMark allowed={role.permissions.includes(code)} /></td>)}
        </tr>)}</tbody></table></div>
      </section>
      <div className="admin-dashboard-grid">
      <section className="access-users-panel admin-users-panel">
        <div className="access-panel-heading"><div><span className="access-eyebrow">ACCESS MANAGEMENT</span><h2>Registered Users</h2><p>Review accounts and their assigned access roles.</p></div>
          <button type="button" className="admin-add-user" onClick={() => { setCreateError(""); setShowCreate(true); }}><Plus size={14} /> Add User</button></div>
        <div className="access-toolbar"><label className="access-search"><Search size={16} /><input type="search" value={search}
          onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, role, or ID" />
          {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={14} /></button>}</label>
          <label className="access-select"><span>Role</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="All">All roles</option>{roles.map((role) => <option key={role.id} value={role.id}>{displayRoleName(role.name)}</option>)}</select></label>
          <label className="access-select"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="All">All statuses</option><option>Online</option><option>Offline</option><option>Deactivated</option><option>Unknown</option></select></label>
        </div>
        <div className="admin-users-table-wrap"><table className="admin-users-table"><thead><tr><th>USER</th><th>ROLE</th><th>STATUS</th><th>VIEW</th></tr></thead><tbody>
          {filtered.map((person) => <tr key={person.id}>
            <td><div className="admin-user-cell"><span className="access-user-avatar" aria-hidden="true">{initials(person.name)}</span><div><strong>{person.name}</strong><small>{person.email}</small></div></div></td>
            <td><span className={`access-role-badge access-role-${roleName(person.role_id).toLowerCase()}`}>{roleName(person.role_id)}</span></td>
            <td><span className={`access-account-status access-account-${accountStatus(person, onlineUserIds, presenceAvailable).toLowerCase()}`}><span aria-hidden="true" />{accountStatus(person, onlineUserIds, presenceAvailable)}</span></td>
            <td><button type="button" className="access-inspect-button" onClick={() => { setSelected(person); setError(""); }} aria-label={`Inspect ${person.name}`}><Eye size={15} /></button></td>
          </tr>)}
          {filtered.length === 0 && <tr><td colSpan="4" className="access-empty">{loading ? "Loading users…" : failedSources.includes(0) ? "Accounts could not be loaded." : "No users match."}</td></tr>}
        </tbody></table></div>
        <div className="access-users-footer">SHOWING {filtered.length} OF {users.length} ACCOUNTS</div>
      </section>
      <div className="admin-side-column">
        <section className="admin-side-card"><div className="admin-side-heading"><span className="access-eyebrow">PERMISSION OVERVIEW</span><h2>System Roles</h2></div>
          <div className="admin-role-list">{roles.map((role) => <div className="admin-role-row" key={role.id}>
            <span className="admin-role-icon"><LockKeyhole size={14} /></span><div><strong>{displayRoleName(role.name)}</strong><small>{role.description || `${role.permissions.length} permissions assigned`}</small></div>
            <span className="admin-role-count">{users.filter((person) => person.role_id === role.id).length}</span>
          </div>)}{roles.length === 0 && <p className="admin-side-note">{loading ? "Loading roles…" : failedSources.includes(1) ? "Roles could not be loaded." : "No roles available."}</p>}</div>
          <p className="admin-side-note">Permission descriptions are a UI summary. Backend grants remain authoritative.</p>
        </section>
        <section className="admin-side-card admin-integrity-card"><div className="admin-side-heading"><span className="access-eyebrow">ON-DEMAND CHECKS</span><h2>Evidence Integrity</h2></div>
          <p>Latest integrity attempt across the archive. Open evidence details to check a stored version.</p>
          <div className="admin-integrity-state">{integrityLoading ? "Loading verification records…" : integrityError && !latestIntegrity ? "Verification records unavailable" : latestIntegrity
            ? <div className="admin-integrity-details">
              <div><span>{latestIntegrity.action === "evidence_verification_failed" ? "LAST ATTEMPT" : "LAST CHECKED"}</span><strong>{philippineDate(latestIntegrity.occurred_at)}</strong></div>
              <div><span>CHECKED BY</span><strong>{users.find((person) => person.id === latestIntegrity.actor_user_id)?.name || latestIntegrity.actor_user_id}</strong></div>
              <div><span>EVIDENCE</span><strong>{checkedEvidence?.id === latestIntegrity.evidence_id ? checkedEvidence.title : `ID ${latestIntegrity.evidence_id}`}</strong></div>
              <div><span>VERSION</span><strong>{latestIntegrity.metadata?.version_id || "Not recorded"}</strong></div>
              <div><span>RESULT</span><strong className={latestIntegrity.action === "evidence_verification_failed" || latestIntegrity.metadata?.intact === false ? "admin-integrity-mismatch" : ""}>{latestIntegrity.action === "evidence_verification_failed" ? "Check failed" : latestIntegrity.metadata?.intact === true ? "Verified" : latestIntegrity.metadata?.intact === false ? "Mismatch detected" : "Result unavailable"}</strong></div>
              <small>{latestIntegrity.action === "evidence_verification_failed" ? "Verification could not finish because the stored file was unavailable." : latestIntegrity.metadata?.intact === true ? "The file matched its baseline at the displayed check time." : latestIntegrity.metadata?.intact === false ? "The computed hash differed from the baseline." : "This record has no comparison result."}</small>
              {latestIntegrity.case_id && <button type="button" className="admin-integrity-link" onClick={() => navigate(`/cases/detail?caseId=${encodeURIComponent(latestIntegrity.case_id)}`)}>Open evidence case</button>}
            </div>
            : <div className="admin-integrity-details"><strong>Not checked</strong><small>No integrity check has been recorded yet.</small></div>}</div>
        </section>
      </div>
      </div>
      <section className="access-users-panel admin-activity-panel" id="admin-ledger"><div className="access-panel-heading"><div><span className="access-eyebrow">RECENT RECORDS</span><h2>Activity Ledger</h2><p>Live activity from the backend. Up to 500 recent entries are available here.</p></div>
        <button type="button" className="admin-read-only" onClick={() => setShowAllActivity((current) => !current)}>{showAllActivity ? "SHOW RECENT" : "VIEW ALL"}</button></div>
        <p className={`admin-live-status${liveError ? " is-error" : ""}`} role="status">{liveError || (auditLoading ? "Connecting to live activity…" : "Live activity connected")}</p>
        {showAllActivity && <div className="admin-activity-search"><label className="access-search"><Search size={16} /><input type="search" value={activitySearch}
          onChange={(event) => setActivitySearch(event.target.value)} placeholder="Search action, actor, case, evidence, or ID" /></label>
          <label className="access-select"><span>Category</span><select value={activityCategory} onChange={(event) => setActivityCategory(event.target.value)}>
            {["All", "Account", "Case", "Evidence", "Integrity"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="access-select"><span>Status</span><select value={activityStatus} onChange={(event) => setActivityStatus(event.target.value)}>
            {["All", "Recorded", "Verified", "Flagged", "Check failed"].map((value) => <option key={value}>{value}</option>)}</select></label></div>}
        <div className="admin-activity-list">{(showAllActivity ? filteredActivity : auditEntries.slice(0, 5)).map((entry) => <details className="admin-activity-entry" key={entry.id}>
          <summary className="admin-activity-row"><span className="admin-activity-icon"><Activity size={15} /></span><div><strong>{entry.action.replaceAll("_", " ")}</strong><small>{entry.case_id ? `Case ${cases.find((record) => record.id === entry.case_id)?.case_number || entry.case_id}` : entry.evidence_id ? `Evidence ${entry.evidence_id}` : "Account or system activity"}</small></div>
          <span className="admin-activity-actor">{users.find((person) => person.id === entry.actor_user_id)?.name || entry.actor_user_id}</span>
          <time><Clock3 size={12} /> {philippineDate(entry.occurred_at)}</time></summary>
          <div className="admin-activity-details"><span>RECORD ID: {entry.id}</span><span>CASE: {entry.case_id || "—"}</span><span>EVIDENCE: {entry.evidence_id || "—"}</span><span>DETAILS: {JSON.stringify(entry.metadata || {})}</span></div>
        </details>)}{(showAllActivity ? filteredActivity : auditEntries).length === 0 && <p className="access-empty">{auditLoading ? "Loading activity…" : liveError && !auditEntries.length ? "Recent activity could not be loaded." : "No activity matches."}</p>}</div>
      </section>
      {showCreate && <div className="access-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCreate(); }}>
        <section className="admin-create-modal" role="dialog" aria-modal="true" aria-labelledby="admin-create-title"
          aria-describedby="admin-create-description" onKeyDown={(event) => {
            if (event.key === "Escape") { event.preventDefault(); closeCreate(); }
            if (event.key !== "Tab") return;
            const controls = [...event.currentTarget.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled)")];
            if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
            else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
          }}>
          <div className="access-modal-header"><div><span className="access-modal-eyebrow">USER ADMINISTRATION</span>
            <h2 id="admin-create-title">Create Account</h2></div>
            <button type="button" className="access-modal-close" aria-label="Close create account" disabled={busy} onClick={closeCreate}><X size={20} /></button></div>
          <p className="admin-create-description" id="admin-create-description">Add a new account to Case Vault. All fields are required.</p>
          <form className="access-create-form" onSubmit={createUser}>
            <div className="access-create-field">
              <label htmlFor="create-user-name">Full name</label>
              <input id="create-user-name" placeholder="e.g. L. Dela Cruz" value={newUser.name} minLength={2} maxLength={150} required
                autoComplete="name" onChange={(event) => setNewUser({ ...newUser, name: event.target.value })} />
            </div>
            <div className="access-create-field">
              <label htmlFor="create-user-email">Email address</label>
              <input id="create-user-email" type="email" placeholder="name@example.com" value={newUser.email} required
                autoComplete="email" onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} />
            </div>
            <div className="access-create-field">
              <label htmlFor="create-user-password">Temporary password</label>
              <input id="create-user-password" type="password" placeholder="8–128 characters" value={newUser.password}
                minLength={8} maxLength={128} required autoComplete="new-password"
                onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} />
              <small>Users can change this password from the key icon after signing in.</small>
            </div>
            <div className="access-create-field">
              <label htmlFor="create-user-role">Assigned role</label>
              <select id="create-user-role" value={newUser.role_id} required disabled={roles.length === 0}
                onChange={(event) => setNewUser({ ...newUser, role_id: event.target.value })}>
                <option value="" disabled>{roles.length ? "Select a role" : "Roles unavailable"}</option>
                {roles.map((role) => <option key={role.id} value={role.id}>{displayRoleName(role.name)}</option>)}
              </select>
            </div>
            {createError && <div className="access-modal-error" role="alert">{createError}</div>}
            <div className="access-create-actions">
              <button type="button" className="access-create-cancel" disabled={busy} onClick={closeCreate}>Cancel</button>
              <button type="submit" className="access-create-submit" disabled={busy || roles.length === 0}>
                <UserCheck size={16} />{busy ? "Adding…" : "Add User"}
              </button>
            </div>
          </form>
        </section>
      </div>}
      {selected && <div className="access-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetails(); }}>
        <section className="access-detail-modal" role="dialog" aria-modal="true" aria-labelledby="access-modal-title">
          <div className="access-modal-header"><div><span className="access-modal-eyebrow">ACCOUNT RECORD</span><h2 id="access-modal-title">User Details</h2></div><button type="button" className="access-modal-close" aria-label="Close" onClick={closeDetails} disabled={busy}><X size={18} /></button></div>
          <div className="access-user-modal-identity">
            <div className="access-user-avatar-large" aria-hidden="true">{initials(selected.name)}</div>
            <div><h3>{selected.name}</h3><p>{selected.email}</p>
              <span className={`access-modal-status ${selected.is_active ? "access-modal-status-active" : ""}`}>{selected.is_active ? "Active account" : "Inactive account"}</span>
            </div>
          </div>
          <div className="access-user-detail-fields">
            <div><span>USER ID</span><strong>{selected.id}</strong></div>
            <div><span>ASSIGNED ROLE</span><select aria-label="Change role" value={selected.role_id} disabled={busy}
              onChange={(event) => updateUser({ role_id: event.target.value })}>
              {roles.map((role) => <option key={role.id} value={role.id}>{displayRoleName(role.name)}</option>)}
            </select></div>
            <div><span>DATE REGISTERED</span><strong>{registeredDate(selected.created_at)}</strong></div>
            <div><span>ACCOUNT STATUS</span><strong>{selected.is_active ? "Enabled" : "Deactivated"}</strong></div>
            <div><span>SESSION STATUS</span><strong>{accountStatus(selected, onlineUserIds, presenceAvailable)}</strong></div>
          </div>
          <div className="access-modal-notice"><LockKeyhole size={15} /><span>Passwords and password hashes are never displayed.</span></div>
          {error && <div className="access-modal-error" role="alert">{error}</div>}
          <div className="access-modal-footer">
            <button type="button" className="access-modal-secondary" onClick={closeDetails}>Close</button>
            <button type="button" className="access-modal-primary" disabled={busy} onClick={() => updateUser({ is_active: !selected.is_active })}>
              {selected.is_active ? "Deactivate Account" : "Reactivate Account"}
            </button>
          </div>
        </section>
      </div>}
      </>}
    </div>
  </VaultLayout>;
}

export default AccessControl;
