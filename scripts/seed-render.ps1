# Ejecutar desde PowerShell:
#   cd C:\Users\MONITOREO-INFINITY\infinity-operaciones
#   powershell -ExecutionPolicy Bypass -File .\scripts\seed-render.ps1

Write-Host ""
Write-Host "=== Seed Infinity Operaciones (Render PostgreSQL) ===" -ForegroundColor Cyan
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
Write-Host "Ejecutando seed..." -ForegroundColor Yellow
& "C:\Program Files\nodejs\npx.cmd" tsx prisma/seed.ts

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "Listo. Prueba login en:" -ForegroundColor Green
  Write-Host "  https://infinity-operaciones.onrender.com/login"
  Write-Host ""
  Write-Host "  supervisor@infinity.ec / super123"
  Write-Host ""
} else {
  Write-Host "El seed fallo. Revisa el error arriba." -ForegroundColor Red
  exit $LASTEXITCODE
}
