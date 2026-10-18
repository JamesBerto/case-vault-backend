import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gauge, Database, ArrowRight, CircleCheck, ShieldCheck, FileText } from "lucide-react";
import VaultLayout from "../layouts/VaultLayout";
import { useAuth } from "../auth/context";
import { api } from "../lib/api";
import { displayRoleName } from "../lib/roles";
import "./Welcome.css";

const routes = {
  Overview: "/welcome", "Case Library": "/cases", "Case Detail": "/cases/detail",
  "Secure Submission": "/submission", "Audit Trail": "/audit", "Access Control": "/access-control",
};

function Welcome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [evidenceCount, setEvidenceCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api("/cases").then(async (records) => {
      const counts = await Promise.all(records.map((record) =>
        api(`/evidence/by-case/${record.id}`).then((items) => items.length)));
      if (active) { setCases(records); setEvidenceCount(counts.reduce((sum, count) => sum + count, 0)); }
    }).catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const pathways = [
    { icon: Gauge, title: "Case Overview", description: "Browse active cases and review their current status.", tab: "Case Library", permission: "case:view" },
    { icon: Database, title: "Secure Submission", description: "Submit a PDF evidence record to an existing case.", tab: "Secure Submission", permission: "evidence:upload" },
    { icon: FileText, title: "Admin Dashboard", description: "Manage accounts and review archive activity.", tab: "Access Control", permission: "user:manage" },
  ].filter((item) => !item.permission || user.permissions.includes(item.permission));

  return <VaultLayout activeTab="Overview" onTabChange={(tab) => navigate(routes[tab])}>
    <div className="welcome-content">
      <section className="access-panel">
        <div className="access-heading"><div className="access-title-row"><CircleCheck className="success-icon" size={25} />
          <div><h1>VAULT ACCESS GRANTED</h1><p>SECURE SESSION FOR {user.name.toUpperCase()} · {displayRoleName(user.role_name).toUpperCase()}</p></div>
        </div><span className="session-badge">SESSION ACTIVE</span></div>
        <div className="panel-divider" />
        <p className="access-description">Welcome to the Case Vault forensic archive. Your assigned role controls access to case records and evidence. Authorized actions are recorded in the activity ledger.</p>
        {error && <p role="alert">{error}</p>}
      </section>
      <aside className="right-column"><section className="session-card">
        <h2>Session Dossier</h2>
        <div className="session-row"><span>Account</span><strong>{user.name}</strong></div>
        <div className="session-row"><span>Assigned role</span><strong>{displayRoleName(user.role_name)}</strong></div>
        <div className="session-row"><span>Cases</span><strong>{loading || error ? "—" : cases.length}</strong></div>
        <div className="session-row"><span>Open cases</span><strong>{loading || error ? "—" : cases.filter((item) => item.status.toLowerCase() === "open").length}</strong></div>
        <div className="session-row"><span>Evidence records</span><strong>{loading || error ? "—" : evidenceCount}</strong></div>
        <div className="session-row"><span>Status</span><strong className="online">ONLINE</strong></div>
      </section><section className="integrity-card">
        <div className="integrity-title"><ShieldCheck size={15} /><span>EVIDENCE VERIFICATION</span></div>
        <p>Check a stored file against its recorded hash from the case detail page.</p>
      </section></aside>
      <section className="pathway-section"><h2>CHOOSE A DOSSIER PATHWAY</h2><div className="pathway-grid">
        {pathways.map((pathway) => { const Icon = pathway.icon; return <article className="pathway-card" key={pathway.title}>
          <div className="pathway-icon"><Icon size={17} /></div><h3>{pathway.title}</h3><p>{pathway.description}</p>
          <button type="button" className="open-tab" onClick={() => navigate(routes[pathway.tab])}>OPEN TAB <ArrowRight size={13} /></button>
        </article>; })}
      </div></section>
    </div>
  </VaultLayout>;
}

export default Welcome;
