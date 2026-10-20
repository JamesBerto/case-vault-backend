import { useRef, useState } from "react";
import { Check, Clock3, Copy } from "lucide-react";
import "./TotpSetup.css";

export default function TotpSetup({ setup, disabled = false }) {
  const secretInput = useRef(null);
  const [copyMessage, setCopyMessage] = useState("");
  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(setup.secret);
      else {
        secretInput.current.focus();
        secretInput.current.select();
        if (!document.execCommand("copy")) throw new Error("Copy unavailable");
      }
      setCopyMessage({ text: "Secret copied.", success: true });
    } catch { setCopyMessage({ text: "Select the secret and copy it manually.", success: false }); }
  };
  return <div className="totp-setup">
    <span className="totp-setup-pending"><Clock3 size={13} aria-hidden="true" />Setup pending</span>
    <p>Scan the QR code with your authenticator app, or enter the secret manually. Keep the secret private.</p>
    <div className="totp-qr"><img src={setup.qr_image} alt="Authenticator setup QR code" width="200" height="200" /></div>
    <label className="totp-manual-field">Manual setup secret
      <input ref={secretInput} value={setup.secret} readOnly aria-label="Authenticator manual setup secret" />
    </label>
    <button className="totp-copy-button" type="button" onClick={copy} disabled={disabled}>
      {copyMessage?.success ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}Copy secret
    </button>
    {copyMessage && <p className={`totp-feedback ${copyMessage.success ? "totp-feedback-success" : "totp-feedback-error"}`} role="status">{copyMessage.text}</p>}
    <p className="totp-setup-help">Enter a six-digit code below to confirm setup and activate 2FA.</p>
  </div>;
}
