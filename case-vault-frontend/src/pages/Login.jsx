import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Fingerprint,
  ShieldCheck,
  Eye,
  EyeOff
} from "lucide-react";
import "./Login.css";

function Login() {
  const [showPassphrase, setShowPassphrase] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    navigate("/welcome");
  };

  return (
    <div className="login-page">

      <header className="login-header">
        <div className="header-brand">
          <div className="header-icon">
            <Fingerprint size={22} />
          </div>

          <span>CASE-VAULT</span>
        </div>

        <span className="header-description">
          FORENSIC ARCHIVE LEDGER
        </span>
      </header>

      <main className="login-main">
        <section className="login-card">

          <div className="login-logo">
            <ShieldCheck size={22} />
          </div>

          <h1>CASE-VAULT</h1>

          <p className="login-subtitle">
            FORENSIC ARCHIVE LEDGER
          </p>

          <div className="login-divider" />

          <form onSubmit={handleLogin}>

            <div className="form-group">
              <label>ANALYST IDENTIFIER</label>

              <input
                type="text"
                defaultValue="APSY-SANTOS-98"
              />
            </div>

            <div className="form-group">
              <label>SECURE CRYPTOGRAPHIC PASSPHRASE</label>

              <div className="password-input">
                <input
                  type={showPassphrase ? "text" : "password"}
                  defaultValue="securecryptographicpassphrase"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassphrase(!showPassphrase)
                  }
                  aria-label="Toggle passphrase visibility"
                >
                  {showPassphrase ? (
                    <EyeOff size={15} />
                  ) : (
                    <Eye size={15} />
                  )}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>HARDWARE MODULE (HSM) PIN</label>

              <input
                type="text"
                defaultValue="[ 849-012 ]"
              />
            </div>

            <button className="access-button" type="submit">
              ACCESS SEALED CASE VAULT
            </button>

          </form>

        </section>
      </main>

      <footer className="login-footer">
        <span>CRYPTOGRAPHIC CLOCK:</span>

        <span>
          2026-10-24 14:38:09 UTC
        </span>
      </footer>

    </div>
  );
}

export default Login;