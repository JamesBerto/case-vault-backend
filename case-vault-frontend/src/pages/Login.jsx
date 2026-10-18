
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Fingerprint,
  ShieldCheck,
  Eye,
  EyeOff
} from "lucide-react";
import "./Login.css";

const API_URL = "http://127.0.0.1:8000";

function Login() {
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [email, setEmail] = useState("admin@casevault.org");
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: email.trim(),
          password: passphrase
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Unable to authenticate.");
        return;
      }

      sessionStorage.setItem("caseVaultToken", data.access_token);
      navigate("/welcome");
    } catch {
      setError("Cannot connect to the server. Check that the backend is running.");
    } finally {
      setIsLoading(false);
    }
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
              <label htmlFor="analyst-email">ANALYST EMAIL</label>
              <input
                id="analyst-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="analyst-password">
                SECURE CRYPTOGRAPHIC PASSPHRASE
              </label>

              <div className="password-input">
                <input
                  id="analyst-password"
                  type={showPassphrase ? "text" : "password"}
                  autoComplete="current-password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassphrase(!showPassphrase)}
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

            {error && (
              <p role="alert" className="login-error">
                {error}
              </p>
            )}

            <button
              className="access-button"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? "AUTHENTICATING..." : "ACCESS SEALED CASE VAULT"}
            </button>
          </form>
        </section>
      </main>

      <footer className="login-footer">
        <span>CRYPTOGRAPHIC CLOCK:</span>
        <span>{new Date().toISOString().replace("T", " ").slice(0, 19)} UTC</span>
      </footer>
    </div>
  );
}

export default Login;
