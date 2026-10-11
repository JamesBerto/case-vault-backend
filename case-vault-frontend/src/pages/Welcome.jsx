
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Gauge,
  Database,
  Link,
  ArrowRight,
  CircleCheck,
} from "lucide-react";
import VaultLayout from "../layouts/VaultLayout";
import "./Welcome.css";

const routes = {
  Overview: "/welcome",
  "Case Library": "/cases",
  "Case Detail": "/cases/detail",
  "Secure Submission": "/secure-submission",
  "Audit Trail": "/audit",
  "Access Control": "/access-control",
};

const pathways = [
  {
    icon: Gauge,
    title: "Dossier Overview",
    description:
      "System health metrics, tamper alerts, and recently secured evidence logs.",
    tab: "Overview",
  },
  {
    icon: Database,
    title: "Secure Case Library",
    description:
      "Full list of secure packages, raw capture dumps, and verified logs.",
    tab: "Case Library",
  },
  {
    icon: Link,
    title: "Audit Trace Merkle",
    description:
      "Review real-time SHA-256 chain of custody and block confirmations.",
    tab: "Audit Trail",
  },
];

function Welcome() {
  const navigate = useNavigate();

  const goTo = (tab) => {
    const route = routes[tab];

    if (route) {
      navigate(route);
    }
  };

  return (
    <VaultLayout activeTab="Overview" onTabChange={goTo}>
      <div className="welcome-content">
        <section className="access-panel">
          <div className="access-heading">
            <div className="access-title-row">
              <CircleCheck className="success-icon" size={25} />

              <div>
                <h1>VAULT ACCESS GRANTED</h1>
                <p>
                  ESTABLISHED SECURE SESSION FOR J. VANCE
                  (LEVEL-3 ADMIN)
                </p>
              </div>
            </div>

            <div className="hsm-badge">
              HSM VERIFIED // SESSION-OK
            </div>
          </div>

          <div className="panel-divider" />

          <p className="access-description">
            Welcome to the Autopsy Forensic Ledger. You are currently
            connected with high-priority credentials. All queries,
            exports, and document views are tracked in the immutable
            Merkle tree. Ensure hardware key is kept mounted during
            session.
          </p>
        </section>

        <aside className="right-column">
          <section className="session-card">
            <h2>Session Dossier</h2>

            <div className="session-row">
              <span>Analyst</span>
              <strong>T. Santos</strong>
            </div>

            <div className="session-row">
              <span>Clearance</span>
              <strong>L3-ADMIN</strong>
            </div>

            <div className="session-row">
              <span>Session ID</span>
              <strong>APSY-9821-FX</strong>
            </div>

            <div className="session-row">
              <span>Replica Node</span>
              <strong>APSY-SECURE-01</strong>
            </div>

            <div className="session-row">
              <span>Status</span>
              <strong className="online">ONLINE</strong>
            </div>
          </section>

          <section className="integrity-card">
            <div className="integrity-title">
              <ShieldCheck size={15} />
              <span>LEDGER INTEGRITY OK</span>
            </div>

            <p>
              All 3,842 ledger blocks successfully checked.
              Cryptographic hash trees correspond with master HSM
              server database.
            </p>
          </section>
        </aside>

        <section className="pathway-section">
          <h2>CHOOSE DIRECT DOSSIER PATHWAY</h2>

          <div className="pathway-grid">
            {pathways.map((pathway) => {
              const Icon = pathway.icon;

              return (
                <article className="pathway-card" key={pathway.title}>
                  <div className="pathway-icon">
                    <Icon size={17} />
                  </div>

                  <h3>{pathway.title}</h3>
                  <p>{pathway.description}</p>

                  <button
                    type="button"
                    className="open-tab"
                    onClick={() => goTo(pathway.tab)}
                  >
                    OPEN TAB
                    <ArrowRight size={13} />
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </VaultLayout>
  );
}

export default Welcome;
