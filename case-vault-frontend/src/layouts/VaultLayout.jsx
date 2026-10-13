
import { Fingerprint, FolderLock } from "lucide-react";
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
          <span className="vault-status-dot" aria-hidden="true" />
          <span>FORENSIC ARCHIVE LEDGER</span>
        </div>

        <div className="vault-system-status">
          <span className="vault-secure-label">
            <span className="vault-secure-dot" aria-hidden="true" />
            SECURE LOCK: HSM-BOUND
          </span>

          <span className="vault-analyst-label">
            ANALYST: T. SANTOS
          </span>
        </div>
      </header>

      <div className="vault-nav-shell">
        <div className="vault-identity">
          <div className="vault-identity-icon" aria-hidden="true">
            <Fingerprint size={22} strokeWidth={1.7} />
          </div>

          <div className="vault-identity-text">
            <div className="vault-identity-title">CASE-VAULT</div>
            <div className="vault-identity-subtitle">
              APSY-SECURE // PROTOCOL-V2
            </div>
          </div>
        </div>

        <div className="vault-track">
          <div className="vault-track-inner">
            <nav className="vault-tabs" aria-label="Main navigation">
              {tabs.map((tab) => {
                const isActive = activeTab === tab;

                return (
                  <button
                    key={tab}
                    type="button"
                    className={`vault-tab ${
                      isActive ? "is-active" : "is-inactive"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => onTabChange?.(tab)}
                  >
                    <FolderLock
                      className="vault-tab-icon"
                      size={15}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <span>{tab}</span>
                  </button>
                );
              })}
            </nav>

            <div className="vault-rail" aria-hidden="true" />
          </div>
        </div>
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
