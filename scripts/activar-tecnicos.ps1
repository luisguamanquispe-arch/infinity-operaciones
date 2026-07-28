# Activa técnicos registrados (rol TECNICO) para la app de campo.
# Uso:
#   powershell -ExecutionPolicy Bypass -File .\scripts\activar-tecnicos.ps1

Write-Host ""
Write-Host "=== Activar técnicos Infinity Operaciones ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Render -> infinity-operaciones-b3ij -> Environment -> SETUP_TOKEN (Reveal)"
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

$url = "$base/api/setup/activar-tecnicos?token=$([uri]::EscapeDataString($token))"
Write-Host ""
Write-Host "Llamando $url ..." -ForegroundColor Yellow

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
Write-Host "App técnicos: $base/login?app=tecnico" -ForegroundColor Cyan
Write-Host ""
