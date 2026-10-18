
import { useLayoutEffect, useRef, useState } from "react";
import { Fingerprint, FolderLock, KeyRound, LogOut } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/context";
import PhilippineClock from "../components/PhilippineClock";
import { displayRoleName } from "../lib/roles";
import "./VaultLayout.css";

const tabs = [
  { name: "Case Library", permission: "case:view" },
  { name: "Case Detail", permission: "case:view" },
  { name: "Secure Submission", permission: "evidence:upload" },
  { name: "Access Control", label: "Status" },
];

const tabRoutes = {
  "Case Library": "/cases",
  "Case Detail": "/cases/detail",
  "Secure Submission": "/submission",
  "Audit Trail": "/audit",
  "Access Control": "/access-control",
};

function VaultLayout({ activeTab = "Overview", onTabChange, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [logoutError, setLogoutError] = useState("");
  const trackRef = useRef(null);
  const activeTabRef = useRef(null);
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const keepActiveVisible = () => {
      const tab = activeTabRef.current;
      if (!tab) { track.scrollLeft = 0; return; }
      const trackRect = track.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      if (tabRect.left < trackRect.left) track.scrollLeft += tabRect.left - trackRect.left - 8;
      else if (tabRect.right > trackRect.right) track.scrollLeft += tabRect.right - trackRect.right + 8;
    };
    keepActiveVisible();
    const observer = new ResizeObserver(keepActiveVisible);
    observer.observe(track);
    return () => observer.disconnect();
  }, [activeTab]);
  const openTab = (name) => {
    if (activeTab === name) return;
    if (onTabChange) onTabChange(name);
    else navigate(tabRoutes[name]);
  };

  return (
    <div className="vault-app">
      <header className="vault-topbar">
        <div className="vault-topbar-brand">
          <span className="vault-status-dot" aria-hidden="true" />
          <span>FORENSIC ARCHIVE LEDGER</span>
        </div>

        <div className="vault-system-status">
          <span className="vault-analyst-label">
            {displayRoleName(user?.role_name).toUpperCase()}: {user?.name}
          </span>

          <div className="vault-account-actions">
            <button
              className="vault-logout"
              type="button"
              onClick={async () => {
                setLogoutError("");
                try {
                  await logout();
                  navigate("/login", { replace: true });
                } catch (error) {
                  setLogoutError(`${error.message} Try logging out again.`);
                }
              }}
            >
              <LogOut size={15} aria-hidden="true" />
              <span>LOG OUT</span>
            </button>
            <button className="vault-password-button"
              type="button" aria-label="Open password settings"
              onClick={() => navigate("/settings/password", { state: { backgroundLocation: location } })}>
              <KeyRound size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        {logoutError && <p className="vault-logout-error" role="alert">{logoutError}</p>}
      </header>

      <div className={`vault-nav-shell${activeTab === "Overview" ? "" : " has-identity-gap"}`}>
        <button
          className={`vault-identity${activeTab === "Overview" ? " is-active" : ""}`}
          type="button"
          aria-label="CASE-VAULT overview"
          aria-current={activeTab === "Overview" ? "page" : undefined}
          onClick={() => { if (activeTab !== "Overview") navigate("/welcome"); }}
        >
          <div className="vault-identity-icon" aria-hidden="true">
            <Fingerprint size={22} strokeWidth={1.7} />
          </div>

          <div className="vault-identity-text">
            <div className="vault-identity-title">CASE-VAULT</div>
            <div className="vault-identity-subtitle">
              CASE VAULT / LIVE API
            </div>
          </div>
        </button>

        <div className="vault-track" ref={trackRef}>
          <div className="vault-track-inner">
            <nav className="vault-tabs" aria-label="Main navigation">
              {tabs.filter((tab) => (tab.name !== "Access Control" || user?.role_name !== "admin") &&
                (!tab.permission || user?.permissions.includes(tab.permission))).map((tab) => {
                const isActive = activeTab === tab.name;

                return (
                  <button
                    key={tab.name}
                    ref={isActive ? activeTabRef : undefined}
                    type="button"
                    className={`vault-tab ${isActive ? "is-active" : "is-inactive"}`}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => openTab(tab.name)}
                  >
                    <FolderLock
                      className="vault-tab-icon"
                      size={15}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <span>{tab.label || tab.name}</span>
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
        <PhilippineClock />
      </footer>
    </div>
  );
}

export default VaultLayout;
