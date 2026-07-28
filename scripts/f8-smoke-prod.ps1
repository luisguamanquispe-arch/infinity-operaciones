# F8 smoke prod (PowerShell) — sin SETUP_TOKEN
param(
  [string]$Base = "https://infinity-operaciones-b3ij.onrender.com",
  [string]$TargetSha = "9ff82f3"
)

$ErrorActionPreference = "Stop"
$health = Invoke-RestMethod -Uri "$Base/api/health" -TimeoutSec 90
try {
  Invoke-WebRequest -Uri "$Base/api/setup/reconciliar-e1" -UseBasicParsing -TimeoutSec 60 | Out-Null
  $e1 = 200
} catch {
  $e1 = [int]$_.Exception.Response.StatusCode
}
try {
  $login = Invoke-WebRequest -Uri "$Base/login" -UseBasicParsing -TimeoutSec 60
  $loginStatus = [int]$login.StatusCode
} catch {
  $loginStatus = 0
}

$report = [ordered]@{
  base                  = $Base
  targetSha             = $TargetSha
  prodSha               = $health.gitShaShort
  shaMatch              = ($health.gitShaShort -eq $TargetSha)
  dbOk                  = [bool]$health.db.ok
  enumLeido             = [bool]$health.db.enumLeido
  setupConfigured       = [bool]$health.setupTokenConfigured
  reconciliarE1         = $e1
  reconciliarNeedsToken = ($e1 -eq 401)
  loginStatus           = $loginStatus
  readyForManualSmoke   = (($health.gitShaShort -eq $TargetSha) -and [bool]$health.db.ok)
}

$report | ConvertTo-Json
if (-not $report.shaMatch) {
  Write-Host ""
  Write-Host "Render still on $($report.prodSha). Manual Deploy image :latest / $TargetSha" -ForegroundColor Yellow
  exit 2
}
Write-Host "SHA OK - ready for manual smoke / DRY_RUN with SETUP_TOKEN" -ForegroundColor Green
