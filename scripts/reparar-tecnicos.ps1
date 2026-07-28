# Repara acceso de técnicos a la app (activar cuentas + diagnóstico).
# Uso:
#   powershell -ExecutionPolicy Bypass -File .\scripts\reparar-tecnicos.ps1

Write-Host ""
Write-Host "=== Reparar acceso técnicos (app móvil) ===" -ForegroundColor Cyan
Write-Host ""

$base = Read-Host "URL (Enter = https://infinity-operaciones-b3ij.onrender.com)"
if ([string]::IsNullOrWhiteSpace($base)) {
  $base = "https://infinity-operaciones-b3ij.onrender.com"
}
$base = $base.Trim().TrimEnd("/")

$token = Read-Host "SETUP_TOKEN (Render -> Environment)"
if ([string]::IsNullOrWhiteSpace($token)) {
  Write-Host "Falta el token." -ForegroundColor Red
  exit 1
}

$url = "$base/api/setup/reparar-tecnicos?token=$([uri]::EscapeDataString($token.Trim()))"
Write-Host "Llamando reparar-tecnicos..." -ForegroundColor Yellow

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
Write-Host "Si hay bloqueados: Gerencia -> Usuarios y claves -> restablecer contraseña" -ForegroundColor Cyan
Write-Host ""
