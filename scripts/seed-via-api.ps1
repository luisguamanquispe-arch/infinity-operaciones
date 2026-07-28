# Crea o restablece usuarios admin/supervisor/helpdesk vía API (sin pegar DATABASE_URL).
# Uso:
#   powershell -ExecutionPolicy Bypass -File .\scripts\seed-via-api.ps1

Write-Host ""
Write-Host "=== Seed usuarios Infinity Operaciones (API) ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Render -> infinity-operaciones-b3ij -> Environment"
Write-Host "2. Copia el valor de SETUP_TOKEN (Reveal)"
Write-Host ""

$base = Read-Host "URL del servicio (Enter = https://infinity-operaciones-b3ij.onrender.com)"
if ([string]::IsNullOrWhiteSpace($base)) {
  $base = "https://infinity-operaciones-b3ij.onrender.com"
}
$base = $base.Trim().TrimEnd("/")

$token = Read-Host "Pega SETUP_TOKEN"
if ([string]::IsNullOrWhiteSpace($token)) {
  Write-Host "Falta el token." -ForegroundColor Red
  exit 1
}
$token = $token.Trim()

$force = Read-Host "¿Restablecer claves aunque ya existan usuarios? (s/N)"
$qs = "token=$([uri]::EscapeDataString($token))"
if ($force -match "^[sS]") {
  $qs += "&force=reset-passwords"
}

$url = "$base/api/setup/seed?$qs"
Write-Host ""
Write-Host "Llamando $base/api/setup/seed ..." -ForegroundColor Yellow

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
Write-Host "Prueba login:" -ForegroundColor Cyan
Write-Host "  $base/login"
Write-Host "  admin@infinity.ec / admin123"
Write-Host ""
Write-Host "App técnicos (si no hay técnicos en la base):" -ForegroundColor Cyan
Write-Host "  POST $base/api/setup/seed?token=SETUP_TOKEN&ensure-tecnico=1"
Write-Host "  Demo: tecnico@infinity.ec / tecnico123"
Write-Host "  Cree técnicos reales en /gerencia/tecnicos/nuevo"
Write-Host ""
