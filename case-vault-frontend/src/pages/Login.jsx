import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Fingerprint,
  ShieldCheck,
  Eye,
  EyeOff
} from "lucide-react";
import "./Login.css";
import { useAuth } from "../auth/context";
import PhilippineClock from "../components/PhilippineClock";

function Login() {
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate("/welcome", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
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
              <label htmlFor="login-email">EMAIL ADDRESS</label>

              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password">PASSWORD</label>

              <div className="password-input">
                <input
                  type={showPassphrase ? "text" : "password"}
                  id="login-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
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

            {error && <p role="alert" style={{ color: "#a6372e" }}>{error}</p>}

            <button className="access-button" type="submit" disabled={submitting}>
              {submitting ? "SIGNING IN…" : "SIGN IN"}
            </button>

          </form>

        </section>
      </main>

      <footer className="login-footer">
        <span>CRYPTOGRAPHIC CLOCK:</span>

        <PhilippineClock />
      </footer>

    </div>
  );
}

export default Login;
