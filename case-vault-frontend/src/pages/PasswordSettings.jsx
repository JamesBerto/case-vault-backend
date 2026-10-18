import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, ShieldCheck, X } from "lucide-react";
import { useAuth } from "../auth/context";
import { api } from "../lib/api";
import { displayRoleName } from "../lib/roles";
import "./PasswordSettings.css";

function PasswordSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const currentInput = useRef(null);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [visible, setVisible] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const isAdmin = user?.role_name === "admin";
  const roleTitle = isAdmin ? "Admin" : displayRoleName(user?.role_name);

  useEffect(() => {
    const background = document.querySelector(".vault-app");
    const previousHidden = background?.getAttribute("aria-hidden");
    const previousOverflow = document.body.style.overflow;
    background?.setAttribute("inert", "");
    background?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "hidden";
    currentInput.current?.focus();
    return () => {
      background?.removeAttribute("inert");
      if (previousHidden === null) background?.removeAttribute("aria-hidden");
      else background?.setAttribute("aria-hidden", previousHidden);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const close = () => {
    if (busy) return;
    if (location.state?.backgroundLocation) navigate(-1);
    else navigate("/welcome", { replace: true });
  };

  const handleKeys = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll("button:not(:disabled), input:not(:disabled)")];
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    setMessage("");
    if (passwords.next !== passwords.confirm) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api("/users/me/password", { method: "PATCH", body: {
        current_password: passwords.current,
        new_password: passwords.next,
      } });
      setPasswords({ current: "", next: "", confirm: "" });
      setVisible({ current: false, next: false, confirm: false });
      setMessage("Your password was changed.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const passwordField = (key, label, placeholder, autoComplete) => (
    <div className="password-settings-group" key={key}>
      <label htmlFor={`${key}-password`}>{label}</label>
      <div className="password-settings-field">
        <input id={`${key}-password`} ref={key === "current" ? currentInput : undefined}
          type={visible[key] ? "text" : "password"} autoComplete={autoComplete}
          minLength={key === "current" ? undefined : 8} maxLength={key === "current" ? undefined : 128}
          required disabled={busy} placeholder={placeholder}
          aria-describedby={key === "next" ? "password-rules" : undefined}
          value={passwords[key]} onChange={(event) => setPasswords({ ...passwords, [key]: event.target.value })} />
        <button type="button" aria-label={visible[key] ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible[key]} onClick={() => setVisible({ ...visible, [key]: !visible[key] })}>
          {visible[key] ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {key === "next" && <p className="password-settings-help" id="password-rules">Use 8–128 characters. Common passwords and predictable sequences are not allowed.</p>}
    </div>
  );

  return <div className="password-settings-backdrop">
    <section className="password-settings-dialog" role="dialog" aria-modal="true"
      aria-labelledby="password-dialog-title" aria-describedby="password-dialog-description"
      onKeyDown={handleKeys}>
      <div className="password-settings-header">
        <div><span>{isAdmin ? "PRIVILEGED ACCOUNT" : "ACCOUNT SECURITY"}</span>
          <h1 id="password-dialog-title">Change {roleTitle} Password</h1></div>
        <button type="button" className="password-settings-close" aria-label="Close password settings" onClick={close} disabled={busy}><X size={17} /></button>
      </div>
      <div className="password-settings-identity">
        <span className="password-settings-identity-icon"><ShieldCheck size={19} /></span>
        <div><strong>{user?.name}</strong><small>{user?.email}</small><small>{displayRoleName(user?.role_name)}</small></div>
      </div>
      <p className="password-settings-description" id="password-dialog-description">Enter your current password and choose a new password for this account.</p>
      <form onSubmit={changePassword}>
        {passwordField("current", "Current password", "Enter current password", "current-password")}
        {passwordField("next", "New password", "Enter new password", "new-password")}
        {passwordField("confirm", "Confirm new password", "Re-enter new password", "new-password")}
        <div className="password-settings-note"><KeyRound size={15} /><span>Your password change is recorded in the activity ledger. Passwords are never shown there.</span></div>
        {error && <p className="password-settings-error" role="alert">{error}</p>}
        {message && <p className="password-settings-success" role="status">{message}</p>}
        <div className="password-settings-actions">
          <button type="button" className="password-settings-cancel" onClick={close} disabled={busy}>Cancel</button>
          <button type="submit" className="password-settings-submit" disabled={busy}><KeyRound size={14} />{busy ? "Saving…" : "Confirm Change"}</button>
        </div>
      </form>
    </section>
  </div>;
}

export default PasswordSettings;
