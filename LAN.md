# Case Vault on the same Wi-Fi

This mode lets other devices on the host computer's local Wi-Fi **IP subnet** open Case Vault. MongoDB Atlas remains the database and still needs internet access. The normal localhost backend and Vite commands remain available for development.

The server cannot determine a visitor's Wi-Fi network name (SSID) from an HTTP request. It binds to the selected Wi-Fi IPv4 address and checks the connecting device's IP against the selected private subnet. A routed network, VPN, or campus network can include devices beyond one SSID. For a strict device list, use firewall address rules or a separate trusted Wi-Fi network.

## Start

1. Connect the host computer and client devices to the intended Wi-Fi. Confirm the MongoDB Atlas connection in `.env` works; the API will not start if Atlas is unavailable.
2. Install backend requirements in `venv`, then run `npm.cmd ci` once from `case-vault-frontend` if `node_modules` is missing.
3. In PowerShell at the repository root, run:

   ```powershell
   .\scripts\Start-CaseVaultLAN.ps1
   ```

   The script selects the preferred IPv4 address of the `Wi-Fi` interface, builds the frontend with the same-origin `/api` URL, and starts one Uvicorn process. If your adapter has a different name, use `-InterfaceAlias "Wi-Fi 3"`. You may select an address explicitly with `-LanIp 192.168.1.20 -PrefixLength 24`.

4. Wait for `Application startup complete`. The script prints the address, for example `http://192.168.1.20:8000`. Open it on another device on the allowed subnet. The API documentation is at the same address followed by `/api/docs`.
5. Press **Ctrl+C** in the hosting PowerShell window to stop the server. If PowerShell blocks scripts, set the execution policy for that PowerShell session only: `Set-ExecutionPolicy -Scope Process RemoteSigned`.

The frontend and API use the same host and port, so browsers do not need a separate CORS origin. The LAN launcher disables proxy-header trust; the IP check uses the actual socket peer rather than `X-Forwarded-For`. The frontend is built before each start, so source edits require a restart to appear in LAN mode.

## Windows Firewall

If other devices cannot connect while the host can, allow inbound TCP port 8000 **only from the chosen local subnet and Wi-Fi interface**. Run an elevated PowerShell and substitute the IP/subnet printed by the launcher:

```powershell
New-NetFirewallRule -DisplayName "Case Vault LAN" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000 -LocalAddress 192.168.1.20 -RemoteAddress 192.168.1.0/24 -InterfaceType Wireless -Profile Private
```

Use this only on a Wi-Fi network you trust. If Windows marks the current Wi-Fi as **Public**, replace `-Profile Private` with `-Profile Public` while keeping the exact local IP, remote subnet, port, and wireless-interface restrictions. Creating a firewall rule requires an **Administrator** PowerShell window. Do not add a broad `Any`-address firewall rule. Remove this example rule when LAN access is no longer wanted: `Remove-NetFirewallRule -DisplayName "Case Vault LAN"`. The application also checks the subnet, even if another firewall rule permits a connection.

Wi-Fi routers may isolate clients from each other. If the page still cannot open, check client isolation and host/client subnet addresses. A working `/api/health` proves API startup, while sign-in also depends on MongoDB Atlas.

## Security limits

Login and role permissions continue to apply. This mode uses plain HTTP unless you add TLS termination or Uvicorn certificates. HTTP can expose passwords and tokens to observers on an untrusted network; use a trusted Wi-Fi for demos and HTTPS for sensitive evidence or regular deployment. The subnet check is an access restriction, not proof that a client is physically connected to the same SSID. No router, firewall, or Atlas settings are changed by the launcher.
