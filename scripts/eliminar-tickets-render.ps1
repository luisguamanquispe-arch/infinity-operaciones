# Elimina tickets por codigo en la base de Render (restaura inventario).
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File .\scripts\eliminar-tickets-render.ps1 ST-1002 ST-1003

param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Codigos
)

if ($Codigos.Count -eq 0) {
  Write-Host "Uso: .\scripts\eliminar-tickets-render.ps1 ST-1002 ST-1003" -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "=== Eliminar tickets (Render PostgreSQL) ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. En Render: infinity-ops-db -> Connect -> External Database URL"
Write-Host "2. Copia la URL completa (postgresql://...)"
Write-Host ""

$url = Read-Host "Pega la External Database URL aqui"

if ([string]::IsNullOrWhiteSpace($url)) {
  Write-Host "Error: no pegaste ninguna URL." -ForegroundColor Red
  exit 1
}

$url = $url.Trim().Trim('"').Trim("'")

if (-not $url.Contains("sslmode=")) {
  if ($url.Contains("?")) { $url += "&sslmode=require" } else { $url += "?sslmode=require" }
}

if (-not $url.StartsWith("postgresql://")) {
  Write-Host "Error: la URL debe empezar con postgresql://" -ForegroundColor Red
  exit 1
}

$env:DATABASE_URL = $url
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host ""
Write-Host "Eliminando: $($Codigos -join ', ')" -ForegroundColor Yellow
& "C:\Program Files\nodejs\npx.cmd" tsx scripts/eliminar-tickets-por-codigo.ts @Codigos

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "Listo." -ForegroundColor Green
} else {
  Write-Host "Fallo la eliminacion. Revisa el error arriba." -ForegroundColor Red
  exit $LASTEXITCODE
}
