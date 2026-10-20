# Case Vault frontend

This React app reads and writes Case Vault data through the FastAPI backend. It uses the backend's JWT login, role permissions, case and evidence routes, audit records, and user administration routes.

## Run locally

1. Set up MongoDB and the backend as described in `../BACKEND.md`. Run the explicit migration before starting an existing database. Start the API with `uvicorn app.main:app --reload` on port 8000.
2. In this directory, run `npm ci`, then `npm run dev` (or `npm.cmd run dev` in PowerShell when script execution is disabled).
3. Open the Vite URL, usually `http://localhost:5173`. The development server proxies `/api` to `http://127.0.0.1:8000`.
4. Sign in with a backend account. Fresh database seeding creates `admin@casevault.org`; change its bootstrap password immediately.

The administrator's Add User form requires a `@casevault.org` email address. The backend enforces the same rule for new accounts.

The New Case form shows a read-only preview such as `20261020-001`. On save, the backend assigns the final date-based case number; it may differ from the preview if another case was created first. The database case ID used by evidence is unchanged.

Page changes happen inside the app without adding page names to the browser URL. Opening a page path directly resets the address to the app base and starts at the login or overview page. Refreshing also starts there, so return to a case through the Case Library after a refresh. Backend permissions still control which data and actions each account can access.

For a separately hosted frontend, set `VITE_API_BASE_URL` to the backend's absolute URL before building. Set backend `CORS_ORIGINS` to the exact frontend origin. A same-origin reverse proxy can instead route `/api/*` to the backend after removing the `/api` prefix.

The bearer token is kept in tab session storage and sent with API requests. Log out calls `/auth/logout`, which revokes that token in MongoDB, and then clears the tab's token. Closing the tab clears the browser copy, but does not call the logout endpoint.

An account can have one active login at a time. A second sign-in displays the API's 409 message until the first session logs out or its three-minute lease expires. The app renews that lease every minute while open, and normal authenticated requests renew it too. If logout cannot reach the API, the frontend keeps the token so the user can retry. Closing the tab stops renewals; it does not reliably send an immediate logout request. A sleeping or throttled tab may also lose its lease and require a fresh sign-in. The JWT's maximum lifetime remains eight hours.

When a second sign-in is blocked, the login page shows the remaining lease time reported by the API. It is an estimate that can reset if the first device is active; the user can retry sooner if that device signs out. The page never retries with stored credentials automatically.

## Current backend fields

Administrators must set up an authenticator at sign-in. Other accounts use the normal password form until 2FA is enabled for them. The login page displays a second code-entry step when needed; it stores a bearer token only after completion. In administrator User Details, **Set up 2FA** displays a QR and copyable manual secret; a valid six-digit test code activates it. **Disable / reset 2FA** handles lost devices and signs the target account out. Replacing an authenticator retains the current one until confirmation. The same UI supports administrator accounts. See [backend TOTP setup](../BACKEND.md#authenticator-two-factor-authentication-totp) for the encryption key and explicit migration.

Cases store a number, type, status, creator, and dates. Evidence stores title, type, description, source device, notes, and PDF versions. The interface shows only values returned by the API; it does not invent reviewer assignments, HSM status, file size, or continuously verified integrity. Verification runs only when a user selects **Verify**.

Run `npm run lint` and `npm run build` for frontend checks. The backend's integration test needs a separate transaction-capable `TEST_MONGO_URI` test replica set.

For access from devices on the host computer's Wi-Fi subnet, use the separate [LAN setup](../LAN.md). It serves the built frontend and API from one address; the usual Vite development command remains for localhost work.
