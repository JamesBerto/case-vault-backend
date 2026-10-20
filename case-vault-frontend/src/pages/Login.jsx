import { useEffect, useRef, useState } from "react";
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
import TotpSetup from "../components/TotpSetup";

function Login() {
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [retryDeadline, setRetryDeadline] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState("");
  const requestInFlight = useRef(false);
  const { login, verifyTotp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (retryDeadline === null) return undefined;
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((retryDeadline - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [retryDeadline]);

  const clearRetry = () => {
    setRetryDeadline(null);
    setSecondsLeft(0);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (requestInFlight.current) return;
    setError("");
    const submittedCode = challenge ? new FormData(e.currentTarget).get("totp_code") : null;
    if (challenge && !/^[0-9]{6}$/.test(submittedCode ?? "")) {
      setError("Enter the current six-digit code.");
      return;
    }
    requestInFlight.current = true;
    setSubmitting(true);
    try {
      const result = challenge
        ? await verifyTotp(challenge.challenge, submittedCode)
        : await login(email.trim(), password);
      if (result.access_token) navigate("/welcome", { replace: true });
      else { setChallenge(result); setCode(""); setPassword(""); clearRetry(); }
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.status === 409 && requestError.retryAfterSeconds) {
        setRetryDeadline(Date.now() + requestError.retryAfterSeconds * 1000);
      } else {
        clearRetry();
      }
    } finally {
      requestInFlight.current = false;
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
        <section className={`login-card${challenge?.setup ? " login-card-enrollment" : ""}`}>

          <div className="login-logo">
            <ShieldCheck size={22} />
          </div>

          <h1>CASE-VAULT</h1>

          <p className="login-subtitle">
            FORENSIC ARCHIVE LEDGER
          </p>

          <div className="login-divider" />

          <form onSubmit={handleLogin} aria-busy={submitting}>
            {!challenge && <>
            <div className="form-group">
              <label htmlFor="login-email">EMAIL ADDRESS</label>

              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => { setEmail(event.target.value); clearRetry(); }}
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
                  onChange={(event) => { setPassword(event.target.value); clearRetry(); }}
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

            </>}
            {challenge && <div className="login-totp-step">
              <div className="login-totp-heading">
                <span className="login-totp-eyebrow">TWO-FACTOR AUTHENTICATION</span>
                <h2>{challenge.setup ? "Set up your authenticator" : "Authenticator verification"}</h2>
                <span className="login-password-accepted"><ShieldCheck size={14} aria-hidden="true" />Password accepted</span>
                <p>{challenge.setup ? "Administrator accounts require an authenticator. Confirm setup to finish signing in." : "Enter the current six-digit code from your authenticator app to finish signing in."}</p>
              </div>
              {challenge.setup && <TotpSetup key={challenge.challenge} setup={challenge.setup} disabled={submitting} />}
              <div className="form-group login-totp-code-field"><label htmlFor="login-totp-code">AUTHENTICATOR CODE</label>
                <input id="login-totp-code" name="totp_code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus readOnly={submitting}
                  aria-describedby="login-totp-help" />
                <p className="login-totp-help" id="login-totp-help">Use a fresh code. If this sign-in step expires, return to sign in.</p>
              </div>
            </div>}
            {error && <p role="alert" className="login-error">{error}</p>}
            {retryDeadline !== null && <div className="login-retry-timer" role="timer" aria-label="Estimated time until session expires">
              {secondsLeft > 0
                ? <>Estimated retry in <strong>{String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:{String(secondsLeft % 60).padStart(2, "0")}</strong></>
                : <>You can try signing in again now.</>}
              <small>The time may reset if the other device is still active. You can retry sooner if it signs out.</small>
            </div>}

            <div className={challenge ? "login-totp-actions" : undefined}>
              <button className="access-button" type="submit" disabled={submitting}>
                {submitting ? "SIGNING IN…" : challenge ? "VERIFY AND SIGN IN" : "SIGN IN"}
              </button>
              {challenge && <button className="login-totp-back" type="button" disabled={submitting}
                onClick={() => { setChallenge(null); setCode(""); setError(""); clearRetry(); }}>Back to sign in</button>}
            </div>

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
