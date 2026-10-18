import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileText, ShieldCheck, Upload, Trash2 } from "lucide-react";
import VaultLayout from "../layouts/VaultLayout";
import { useAuth } from "../auth/context";
import { api, philippineDate } from "../lib/api";
import "./CaseDetail.css";

const routes = {
  Overview: "/welcome", "Case Library": "/cases", "Case Detail": "/cases/detail",
  "Secure Submission": "/submission", "Audit Trail": "/audit", "Access Control": "/access-control",
};

function CaseDetail() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const caseId = params.get("caseId");
  const { user } = useAuth();
  const [record, setRecord] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [versions, setVersions] = useState({});
  const [histories, setHistories] = useState({});
  const [tags, setTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [tagLoading, setTagLoading] = useState(true);
  const [tagLoadedFor, setTagLoadedFor] = useState(null);
  const [tagError, setTagError] = useState("");
  const [tagActionError, setTagActionError] = useState("");
  const [tagReload, setTagReload] = useState(0);
  const tagListLoading = tagLoading || tagLoadedFor !== caseId;
  const [events, setEvents] = useState([]);
  const [people, setPeople] = useState({});
  const [checks, setChecks] = useState({});
  const [status, setStatus] = useState("");
  const [tagId, setTagId] = useState("");
  const [newTag, setNewTag] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiveError, setArchiveError] = useState("");
  const archiveDialogRef = useRef(null);
  const cancelArchiveRef = useRef(null);
  const [tagDeleteTarget, setTagDeleteTarget] = useState(null);
  const [tagDeleteError, setTagDeleteError] = useState("");
  const tagDeleteDialogRef = useRef(null);

  useEffect(() => {
    const dialog = archiveDialogRef.current;
    if (archiveTarget && !dialog.open) {
      dialog.showModal();
      cancelArchiveRef.current?.focus();
    } else if (!archiveTarget && dialog.open) {
      dialog.close();
    }
  }, [archiveTarget]);

  useEffect(() => {
    const dialog = tagDeleteDialogRef.current;
    if (tagDeleteTarget && !dialog.open) dialog.showModal();
    else if (!tagDeleteTarget && dialog.open) dialog.close();
  }, [tagDeleteTarget]);

  useEffect(() => {
    let active = true;
    if (!caseId) return;
    const load = async () => {
      try {
        const [caseData, files, userData, auditData] = await Promise.all([
          api(`/cases/${caseId}`), api(`/evidence/by-case/${caseId}`),
          user.permissions.includes("user:manage") ? api("/users") : Promise.resolve([]),
          user.permissions.includes("user:manage") ? api(`/audit?case_id=${encodeURIComponent(caseId)}`) : Promise.resolve([]),
        ]);
        const fileVersions = await Promise.all(files.map((item) => item.current_version_id
          ? api(`/evidence/${item.id}/versions/${item.current_version_id}`).catch(() => null)
          : Promise.resolve(null)));
        const fileChecks = await Promise.all(files.map((item) => item.current_version_id
          ? api(`/evidence/${item.id}/versions/${item.current_version_id}/verification-status`)
            .catch((requestError) => ({ status: "Unavailable", error: requestError.message }))
          : Promise.resolve(null)));
        if (!active) return;
        setRecord(caseData); setStatus(caseData.status); setEvidence(files);
        setEvents(auditData);
        setPeople(Object.fromEntries(userData.map((person) => [person.id, person.name])));
        setVersions(Object.fromEntries(files.map((item, index) => [item.id, fileVersions[index]])));
        setChecks(Object.fromEntries(files.flatMap((item, index) => item.current_version_id
          ? [[item.current_version_id, fileChecks[index]]] : [])));
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [caseId, user]);

  useEffect(() => {
    if (!caseId) return;
    let active = true;
    Promise.all([api(`/cases/${caseId}/tags`), api("/tags")])
      .then(([assigned, available]) => {
        if (active) {
          setTags(assigned); setAvailableTags(available);
          setTagError(""); setTagActionError("");
          setTagId((current) => available.some((tag) => tag.id === current &&
            !assigned.some((item) => item.id === current)) ? current : "");
        }
      })
      .catch((requestError) => {
        if (active) { setTags([]); setAvailableTags([]); setTagActionError(""); setTagError(requestError.message); }
      })
      .finally(() => { if (active) { setTagLoadedFor(caseId); setTagLoading(false); } });
    return () => { active = false; };
  }, [caseId, tagReload]);

  const retryTags = () => {
    setTagLoading(true); setTagError(""); setTagActionError("");
    setTagReload((current) => current + 1);
  };

  const run = async (action) => {
    setError(""); setBusy(true);
    try { await action(); } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };

  const runTag = async (action) => {
    setTagActionError(""); setBusy(true);
    try { await action(); } catch (requestError) { setTagActionError(requestError.message); }
    finally { setBusy(false); }
  };

  const updateStatus = () => run(async () => {
    const updated = await api(`/cases/${caseId}`, { method: "PATCH", body: { status } });
    setRecord(updated);
  });

  const assignTag = () => runTag(async () => {
    const assigned = await api(`/cases/${caseId}/tags`, { method: "POST", body: { tag_id: tagId } });
    setTags((current) => [...current, assigned]); setTagId("");
  });

  const removeTag = (id) => runTag(async () => {
    await api(`/cases/${caseId}/tags/${id}`, { method: "DELETE" });
    setTags((current) => current.filter((tag) => tag.id !== id));
  });

  const createTag = () => runTag(async () => {
    const created = await api("/tags", { method: "POST", body: { name: newTag.trim() } });
    setAvailableTags((current) => [...current, created]);
    setNewTag("");
  });

  const confirmDeleteTag = async () => {
    if (!tagDeleteTarget || busy) return;
    setTagDeleteError(""); setBusy(true);
    try {
      await api(`/tags/${tagDeleteTarget.id}`, { method: "DELETE" });
      setAvailableTags((current) => current.filter((tag) => tag.id !== tagDeleteTarget.id));
      setTags((current) => current.filter((tag) => tag.id !== tagDeleteTarget.id));
      setTagId((current) => current === tagDeleteTarget.id ? "" : current);
      setTagDeleteTarget(null);
    } catch (requestError) {
      setTagDeleteError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleHistory = (item) => run(async () => {
    if (histories[item.id]) { setHistories((current) => ({ ...current, [item.id]: null })); return; }
    const list = await api(`/evidence/${item.id}/versions`);
    const statuses = await Promise.all(list.map((version) =>
      api(`/evidence/${item.id}/versions/${version.id}/verification-status`)
        .catch((requestError) => ({ status: "Unavailable", error: requestError.message }))));
    setChecks((current) => ({ ...current, ...Object.fromEntries(list.map((version, index) => [version.id, statuses[index]])) }));
    setHistories((current) => ({ ...current, [item.id]: list }));
  });

  const downloadHistoryVersion = (item, version) => run(async () => {
    const blob = await api(`/evidence/${item.id}/versions/${version.id}/download`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = version.file_name;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  const verifyVersion = (item, version) => run(async () => {
    try {
      const result = await api(`/evidence/${item.id}/versions/${version.id}/verify`);
      setChecks((current) => ({ ...current, [version.id]: {
        status: result.intact ? "Intact" : "Mismatch detected",
        checked_at: result.checked_at, actor_user_id: result.actor_user_id, intact: result.intact,
      } }));
      setVersions((current) => current[item.id]?.id === version.id
        ? { ...current, [item.id]: { ...current[item.id], is_tamper_flagged: result.is_tamper_flagged } } : current);
      setHistories((current) => current[item.id]
        ? { ...current, [item.id]: current[item.id].map((past) => past.id === version.id
          ? { ...past, is_tamper_flagged: result.is_tamper_flagged } : past) } : current);
    } catch (requestError) {
      const status = await api(`/evidence/${item.id}/versions/${version.id}/verification-status`).catch(() => null);
      if (status) setChecks((current) => ({ ...current, [version.id]: status }));
      throw requestError;
    }
  });

  const download = (item) => run(async () => {
    const version = versions[item.id];
    const blob = await api(`/evidence/${item.id}/versions/${item.current_version_id}/download`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url;
    link.download = version?.file_name || `${item.title}.pdf`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  const replace = (item, file) => run(async () => {
    if (!file) return;
    const form = new FormData(); form.append("file", file);
    const version = await api(`/evidence/${item.id}/versions`, { method: "POST", body: form });
    setVersions((current) => ({ ...current, [item.id]: version }));
    setEvidence((current) => current.map((entry) => entry.id === item.id
      ? { ...entry, current_version_id: version.id } : entry));
    setChecks((current) => ({ ...current, [version.id]: { status: "Not checked", checked_at: null } }));
  });

  const confirmArchive = async () => {
    if (!archiveTarget || busy) return;
    setArchiveError("");
    setBusy(true);
    try {
      if (archiveTarget.type === "case") {
        await api(`/cases/${caseId}`, { method: "DELETE" });
        setArchiveTarget(null);
        navigate("/cases", { replace: true });
      } else {
        await api(`/evidence/${archiveTarget.id}`, { method: "DELETE" });
        setEvidence((current) => current.filter((entry) => entry.id !== archiveTarget.id));
        setArchiveTarget(null);
      }
    } catch (requestError) {
      setArchiveError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const canUpload = user.permissions.includes("evidence:upload");
  const canReview = user.permissions.includes("case:update_status");
  const canAssignTag = user.permissions.includes("tag:assign");
  const canRemoveTag = user.permissions.includes("case:view");
  const canCreateTag = user.permissions.includes("tag:create") && user.role_name !== "reviewer";
  const assignableTags = availableTags.filter((tag) => !tags.some((assigned) => assigned.id === tag.id));
  const isAdmin = user.role_name === "admin";

  return <VaultLayout activeTab="Case Detail" onTabChange={(tab) => navigate(routes[tab])}>
    <div className="detail-page">
      <div className="detail-heading">
        <div>
          <div className="detail-eyebrow">CASE ARCHIVE / DOSSIER DETAILS</div>
          <h1>{record?.case_type || (loading ? "Loading case…" : "Case not found")}</h1>
          {record && <p>{record.case_number} · {record.status}</p>}
        </div>
        {record && <div className="detail-heading-actions">
          {canUpload && <button className="detail-primary-button" type="button"
            onClick={() => navigate(`/submission?caseId=${encodeURIComponent(caseId)}`)}>
            <Upload size={16} /> Add Evidence
          </button>}
          {isAdmin && <button className="detail-archive-button" type="button" disabled={busy}
            onClick={() => { setArchiveError(""); setArchiveTarget({ type: "case", label: record.case_number }); }}>
            <Trash2 size={16} /> Archive case
          </button>}
        </div>}
      </div>
      {error && <p role="alert" style={{ color: "#a6372e" }}>{error}</p>}
      {!caseId && <div className="detail-select-case">
        <p>Select a case from the Case Library to view its details{isAdmin ? " and archive controls" : ""}.</p>
        <button type="button" onClick={() => navigate("/cases")}>Open Case Library</button>
      </div>}
      {record && <>
        <section className="detail-panel detail-information">
          <div className="detail-panel-heading"><h2>Case Information</h2><ShieldCheck size={18} /></div>
          <div className="detail-information-grid">
            <div><span className="detail-field-label">CASE NUMBER</span><strong>{record.case_number}</strong></div>
            <div><span className="detail-field-label">CASE TYPE</span><strong>{record.case_type}</strong></div>
            <div><span className="detail-field-label">CREATED BY</span><strong>{people[record.created_by] || (record.created_by === user.id ? user.name : record.created_by)}</strong></div>
            <div><span className="detail-field-label">SUBMITTED</span><strong>{philippineDate(record.submission_date)}</strong></div>
            <div><span className="detail-field-label">LAST UPDATED</span><strong>{philippineDate(record.updated_at)}</strong></div>
            <div><span className="detail-field-label">EVIDENCE ITEMS</span><strong>{evidence.length}</strong></div>
          </div>
        </section>

        {canReview && <section className="detail-panel detail-review-panel" aria-labelledby="detail-review-title">
          <div className="detail-panel-heading">
            <h2 id="detail-review-title">Case Review</h2>
            <span className="detail-review-current">Current status: <strong>{record.status}</strong></span>
          </div>
          <p>Update the case status as the review progresses.</p>
          <div className="detail-review-controls">
            <label htmlFor="detail-review-status">Case status</label>
            <select id="detail-review-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              {[...new Set([record.status, "open", "under review", "closed"])].map((value) =>
                <option key={value} value={value}>{value}</option>)}
            </select>
            <button type="button" disabled={busy || status === record.status} onClick={updateStatus}>Save status</button>
          </div>
        </section>}

        <section className="detail-panel detail-evidence-panel">
          <div className="detail-panel-heading"><h2>Registered Evidence</h2><span>{evidence.length} ITEMS</span></div>
          <div className="detail-evidence-list">
            {evidence.map((item) => {
              const version = versions[item.id];
              return <article className="detail-evidence-row" key={item.id}>
                <div className="detail-file-icon"><FileText size={20} /></div>
                <div className="detail-file-main"><strong>{item.title}</strong><span>{item.evidence_type} · {version?.file_name || "No version"}</span>
                  {item.description && <small>{item.description}</small>}
                  {item.source_device && <small>Source: {item.source_device}</small>}
                  {item.notes && <small>Notes: {item.notes}</small>}</div>
                <div className="detail-file-meta"><span>VERSION</span><strong>{version?.version_no || "—"}</strong></div>
                <div className="detail-file-meta detail-file-hash"><span>SHA-256</span><code>{version?.file_hash || "—"}</code></div>
                <div className="detail-file-status-wrap"><strong>{version ? checks[version.id]?.status || "Loading check…" : "No version"}</strong>
                  <small>{version && checks[version.id]?.checked_at
                    ? `${checks[version.id].status === "Check failed" ? "Last attempt" : "Last checked"}: ${philippineDate(checks[version.id].checked_at)}`
                    : checks[version?.id]?.error || "No completed check recorded"}</small>
                  {version?.is_tamper_flagged && <small className="detail-tamper-warning">Tamper flagged</small>}</div>
                <div className="detail-evidence-actions">
                  <button type="button" disabled={busy || !version} onClick={() => verifyVersion(item, version)}>Verify</button>
                  <button type="button" disabled={busy || !version} onClick={() => download(item)}>Download</button>
                  <button type="button" disabled={busy} onClick={() => toggleHistory(item)}>Versions</button>
                  {canUpload && <label className="detail-replace-file">Replace PDF<input type="file" accept=".pdf,application/pdf" disabled={busy}
                    onChange={(event) => { replace(item, event.target.files?.[0]); event.target.value = ""; }} /></label>}
                  {isAdmin && <button className="detail-archive-button" type="button" disabled={busy}
                    onClick={() => { setArchiveError(""); setArchiveTarget({ type: "evidence", id: item.id, label: item.title }); }}
                    aria-label={`Archive ${item.title}`}><Trash2 size={15} /> Archive evidence</button>}
                </div>
                {histories[item.id] && <div className="detail-version-history">
                  <h3>Version history</h3>
                  {histories[item.id].map((past) => <div key={past.id} className="detail-version-row">
                    <span>Version {past.version_no}: {past.file_name} · {philippineDate(past.uploaded_at)}</span>
                    <button type="button" disabled={busy} onClick={() => downloadHistoryVersion(item, past)}>Download</button>
                    <button type="button" disabled={busy} onClick={() => verifyVersion(item, past)}>Verify</button>
                    <span>{checks[past.id]?.status || "Loading check…"}{checks[past.id]?.checked_at ? ` · ${philippineDate(checks[past.id].checked_at)}` : ""}{past.is_tamper_flagged ? " · Tamper flagged" : ""}</span>
                  </div>)}
                </div>}
              </article>;
            })}
            {evidence.length === 0 && <p>No evidence is registered for this case.</p>}
          </div>
        </section>

        <section className="detail-panel detail-tags-panel">
          <div className="detail-panel-heading"><h2>Case Tags</h2></div>
          {tagListLoading && <p className="detail-tag-message" role="status">Loading tags…</p>}
          {!tagListLoading && tagError && <p className="detail-tag-message detail-tag-error" role="alert">
            {tagError} <button type="button" onClick={retryTags}>Retry</button>
          </p>}
          {!tagListLoading && tagActionError && <p className="detail-tag-message detail-tag-error" role="alert">{tagActionError}</p>}
          {!tagListLoading && !tagError && <div className="detail-tags-list">
            {tags.map((tag) => <span key={tag.id}>{tag.name} {canRemoveTag &&
              <button type="button" disabled={busy} onClick={() => removeTag(tag.id)} aria-label={`Remove ${tag.name}`}>×</button>}</span>)}
            {tags.length === 0 && <span>No tags assigned.</span>}
          </div>}
          {!tagListLoading && !tagError && canAssignTag && <div className="detail-tag-controls">
            <select aria-label="Tag to assign" value={tagId} onChange={(event) => setTagId(event.target.value)}>
              <option value="">Select a tag</option>
              {assignableTags.map((tag) =>
                <option key={tag.id} value={tag.id}>{tag.name}</option>)}
            </select>
            <button type="button" disabled={busy || !tagId} onClick={assignTag}>Assign tag</button>
          </div>}
          {!tagListLoading && !tagError && availableTags.length === 0 &&
            <p className="detail-tag-message">{canCreateTag ? "No tags available. Create a tag first." : "No tags available. Ask an analyst or admin to create one."}</p>}
          {!tagListLoading && !tagError && canAssignTag && availableTags.length > 0 && assignableTags.length === 0 &&
            <p className="detail-tag-message">All available tags are assigned to this case.</p>}
          {!tagListLoading && !tagError && canCreateTag && <div className="detail-tag-controls">
            <input aria-label="New tag name" placeholder="New tag name" value={newTag} minLength={2} maxLength={50}
              onChange={(event) => setNewTag(event.target.value)} />
            <button type="button" disabled={busy || newTag.trim().length < 2} onClick={createTag}>Create tag</button>
          </div>}
          {!tagListLoading && !tagError && canCreateTag && !canAssignTag && availableTags.length > 0 &&
            <p className="detail-tag-message">Available tags: {availableTags.map((tag) => tag.name).join(", ")}</p>}
          {!tagListLoading && !tagError && isAdmin && availableTags.length > 0 &&
            <div className="detail-tag-manage">
              <strong>Manage available tags</strong>
              <div className="detail-tag-manage-list">
                {availableTags.map((tag) => <span key={tag.id}>{tag.name}
                  <button type="button" disabled={busy} aria-label={`Delete tag ${tag.name} everywhere`}
                    onClick={() => { setTagDeleteError(""); setTagDeleteTarget(tag); }}>Delete</button>
                </span>)}
              </div>
            </div>}
        </section>

        {isAdmin && <section className="detail-panel detail-custody-panel">
          <div className="detail-panel-heading detail-custody-heading">
            <h2>Recorded Activity</h2><span>{events.length} EVENTS</span>
          </div>
          <div className="detail-activity-table-wrap">
            <table className="detail-activity-table">
              <thead><tr><th scope="col">Date and time</th><th scope="col">Action</th><th scope="col">Recorded by</th></tr></thead>
              <tbody>
                {events.map((event) => <tr key={event.id}>
                  <td><time dateTime={event.occurred_at}>{philippineDate(event.occurred_at)}</time></td>
                  <td className="detail-activity-action">{event.action.replaceAll("_", " ")}</td>
                  <td>{people[event.actor_user_id] || event.actor_user_id}</td>
                </tr>)}
                {events.length === 0 && <tr><td colSpan={3} className="detail-activity-empty">No audit entries for this case.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>}
      </>}
      <div className="detail-bottom-note"><button type="button" onClick={() => navigate("/cases")}>
        Return to Case Library <ArrowLeft size={14} /></button></div>
    </div>
    <dialog ref={archiveDialogRef} className="detail-archive-dialog" role="alertdialog"
      aria-labelledby="detail-archive-title" aria-describedby="detail-archive-description"
      onCancel={(event) => { event.preventDefault(); if (!busy) setArchiveTarget(null); }}>
      {archiveTarget && <>
        <div className="detail-archive-dialog-icon"><Trash2 size={22} aria-hidden="true" /></div>
        <h2 id="detail-archive-title">Archive {archiveTarget.type}?</h2>
        <p className="detail-archive-target">{archiveTarget.label}</p>
        <p id="detail-archive-description">This item will disappear from normal views. Its record and stored files will be retained.</p>
        {archiveError && <p className="detail-archive-error" role="alert">{archiveError}</p>}
        <div className="detail-archive-dialog-actions">
          <button ref={cancelArchiveRef} type="button" disabled={busy} onClick={() => setArchiveTarget(null)}>Cancel</button>
          <button type="button" disabled={busy} onClick={confirmArchive}>
            {busy ? "Archiving…" : `Archive ${archiveTarget.type}`}
          </button>
        </div>
      </>}
    </dialog>
    <dialog ref={tagDeleteDialogRef} className="detail-archive-dialog" role="alertdialog"
      aria-labelledby="detail-tag-delete-title" aria-describedby="detail-tag-delete-description"
      onCancel={(event) => { event.preventDefault(); if (!busy) setTagDeleteTarget(null); }}>
      {tagDeleteTarget && <>
        <div className="detail-archive-dialog-icon"><Trash2 size={22} aria-hidden="true" /></div>
        <h2 id="detail-tag-delete-title">Delete tag?</h2>
        <p className="detail-archive-target">{tagDeleteTarget.name}</p>
        <p id="detail-tag-delete-description">This removes the tag from the available options and from every case where it is assigned.</p>
        {tagDeleteError && <p className="detail-archive-error" role="alert">{tagDeleteError}</p>}
        <div className="detail-archive-dialog-actions">
          <button type="button" disabled={busy} onClick={() => setTagDeleteTarget(null)}>Cancel</button>
          <button type="button" disabled={busy} onClick={confirmDeleteTag}>
            {busy ? "Deleting…" : "Delete tag"}
          </button>
        </div>
      </>}
    </dialog>
  </VaultLayout>;
}

export default CaseDetail;
