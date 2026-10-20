param(
    [string]$InterfaceAlias = "Wi-Fi",
    [string]$LanIp,
    [ValidateRange(1, 32)][int]$PrefixLength,
    [ValidateRange(1, 65535)][int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$repository = Split-Path -Parent $PSScriptRoot
$python = Join-Path $repository "venv\Scripts\python.exe"
$frontend = Join-Path $repository "case-vault-frontend"

if (-not (Test-Path -LiteralPath $python)) {
    throw "Python environment missing. Create venv and install requirements.txt first."
}
if (-not (Test-Path -LiteralPath (Join-Path $frontend "node_modules"))) {
    throw "Frontend packages missing. Run npm.cmd ci in case-vault-frontend first."
}

if (-not $LanIp) {
    $addresses = @(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias $InterfaceAlias |
        Where-Object { $_.AddressState -eq "Preferred" -and $_.IPAddress -notlike "169.254.*" })
    if ($addresses.Count -ne 1) {
        throw "Select one Wi-Fi IPv4 address with -LanIp and -PrefixLength (see ipconfig)."
    }
    $LanIp = $addresses[0].IPAddress
    $PrefixLength = $addresses[0].PrefixLength
} elseif (-not $PSBoundParameters.ContainsKey("PrefixLength")) {
    throw "When using -LanIp, also provide -PrefixLength (see ipconfig or Get-NetIPAddress)."
}

$subnet = & $python -c 'import ipaddress,sys; print(ipaddress.ip_network(sys.argv[1] + chr(47) + sys.argv[2], strict=False))' $LanIp $PrefixLength
if ($LASTEXITCODE -ne 0) { throw "The Wi-Fi address or prefix length is invalid." }

Push-Location $frontend
try {
    $env:VITE_API_BASE_URL = "/api"
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "Frontend build failed." }
} finally {
    Pop-Location
}

Push-Location $repository
try {
    $env:CASE_VAULT_LAN_CIDR = $subnet
    Write-Host "Case Vault LAN address: http://${LanIp}:$Port"
    Write-Host "Permitted subnet: $subnet; MongoDB remains configured by .env."
    Write-Host "Press Ctrl+C to stop. If other devices cannot connect, check Windows Firewall and Wi-Fi client isolation."
    & $python -m uvicorn app.lan:create_app --factory --host $LanIp --port $Port --no-proxy-headers
    if ($LASTEXITCODE -ne 0) { throw "LAN server stopped with an error." }
} finally {
    Pop-Location
}
