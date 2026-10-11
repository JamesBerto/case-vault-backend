
import { Fingerprint, Folder, ShieldCheck } from "lucide-react";
import "./VaultLayout.css";

const tabs = [
  "Overview",
  "Case Library",
  "Case Detail",
  "Secure Submission",
  "Audit Trail",
  "Access Control",
];

function VaultLayout({ activeTab = "Overview", onTabChange, children }) {
  const clock = new Date()
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);

  return (
    <div className="vault-app">
      <header className="vault-topbar">
        <div className="vault-topbar-brand">
          <span className="vault-status-dot" />
          <span>FORENSIC ARCHIVE LEDGER</span>
        </div>

        <div className="vault-system-status">
          <span className="vault-secure-label">
            <span className="vault-secure-dot" />
            SECURE LOCK: HSM-BOUND
          </span>
          <span className="vault-analyst-label">ANALYST: T. SANTOS</span>
        </div>
      </header>

      <div className="vault-nav-shell">
        <div className="vault-identity">
          <div className="vault-identity-icon">
            <Fingerprint size={23} strokeWidth={1.7} />
          </div>

          <div className="vault-identity-text">
            <div className="vault-identity-title">CASE-VAULT</div>
            <div className="vault-identity-subtitle">
              APSY-SECURE // PROTOCOL-V2
            </div>
          </div>

          <ShieldCheck className="vault-identity-shield" size={15} />
        </div>

        <nav className="vault-tabs" aria-label="Main navigation">
          {tabs.map((tab, index) => (
            <button
              key={tab}
              type="button"
              className={`vault-tab ${
                activeTab === tab ? "is-active" : "is-inactive"
              }`}
              style={{ "--tab-index": index }}
              aria-current={activeTab === tab ? "page" : undefined}
              onClick={() => onTabChange?.(tab)}
            >
              <span className="vault-tab-inner">
                <Folder size={14} strokeWidth={1.8} />
                <span>{tab}</span>
              </span>
            </button>
          ))}
        </nav>
      </div>

      <main className="vault-main">{children}</main>

      <footer className="vault-footer">
        <span>CRYPTOGRAPHIC CLOCK:</span>
        <span>{clock} UTC</span>
      </footer>
    </div>
  );
}

export default VaultLayout;
