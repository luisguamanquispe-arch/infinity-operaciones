# Aplica claves de técnicos operativos (david, johan, kevin, dario, sergio).
# Uso:
#   powershell -ExecutionPolicy Bypass -File .\scripts\set-tecnicos-claves.ps1

Write-Host ""
Write-Host "=== Claves tecnicos app de campo ===" -ForegroundColor Cyan
Write-Host ""

$base = Read-Host "URL (Enter = https://infinity-operaciones-b3ij.onrender.com)"
if ([string]::IsNullOrWhiteSpace($base)) {
  $base = "https://infinity-operaciones-b3ij.onrender.com"
}
$base = $base.Trim().TrimEnd("/")

$token = Read-Host "SETUP_TOKEN (Render -> Environment -> Reveal)"
if ([string]::IsNullOrWhiteSpace($token)) {
  Write-Host "Falta el token." -ForegroundColor Red
  exit 1
}

$url = "$base/api/setup/tecnicos-claves?token=$([uri]::EscapeDataString($token.Trim()))"
Write-Host "Aplicando claves..." -ForegroundColor Yellow

try {
  $res = Invoke-WebRequest -Uri $url -Method POST -UseBasicParsing -TimeoutSec 120
  Write-Host $res.Content -ForegroundColor Green
} catch {
  Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
  if ($_.Exception.Response) {
    $reader = [IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
    Write-Host $reader.ReadToEnd()
  }
  exit 1
}

Write-Host ""
Write-Host "Probar: $base/login?app=tecnico" -ForegroundColor Cyan
Write-Host ""
