# Restaura códigos originales tras migrar 3z9n → b3ij (requiere deploy con PATCH codigo).
param(
  [string]$Base = "https://infinity-operaciones-b3ij.onrender.com",
  [string]$Email = "supervisor@infinity.ec",
  [string]$Password = "super123"
)

$ErrorActionPreference = "Stop"

# id actual → codigo final (origen 3z9n)
$final = @(
  @{ id = "cms56q7z30004g82ntqgs4o15"; codigo = "ST-1002" } # AMBATOPADEL
  @{ id = "cms56q8qx000bg82nqg3g3odk"; codigo = "ST-1003" } # LEMA
  @{ id = "cms56q99r000ig82n4299zbep"; codigo = "ST-1008" } # HILANO
  @{ id = "cms56q9u6000pg82n8zdp1e2t"; codigo = "ST-1010" } # SANTAMARIA
)

$sess = $null
Invoke-WebRequest -Uri "$Base/api/auth/login" -Method POST `
  -ContentType "application/json" `
  -Body (@{ email = $Email; password = $Password } | ConvertTo-Json) `
  -UseBasicParsing -SessionVariable sess -TimeoutSec 90 | Out-Null

function Set-Codigo([string]$id, [string]$codigo) {
  $body = @{ codigo = $codigo } | ConvertTo-Json
  $r = Invoke-WebRequest -Uri "$Base/api/tickets/$id" -Method PATCH `
    -ContentType "application/json" -Body $body `
    -WebSession $sess -UseBasicParsing -TimeoutSec 60
  return ($r.Content | ConvertFrom-Json).ticket.codigo
}

Write-Output "=== FASE 1: temporales ==="
$i = 0
foreach ($row in $final) {
  $i++
  $tmp = "TMP-MIG-$i"
  $got = Set-Codigo $row.id $tmp
  Write-Output ("$($row.id) -> $got")
}

Write-Output "=== FASE 2: codigos originales ==="
foreach ($row in $final) {
  $got = Set-Codigo $row.id $row.codigo
  Write-Output ("$($row.id) -> $got (wanted $($row.codigo))")
}

Write-Output "=== VERIFY Kevin ==="
$k = $null
Invoke-WebRequest -Uri "$Base/api/auth/login" -Method POST `
  -ContentType "application/json" `
  -Headers @{ "x-infinity-app" = "tecnico" } `
  -Body (@{ email = "kevin@infinity.ec"; password = "Kevin2026@"; appTecnico = $true } | ConvertTo-Json) `
  -UseBasicParsing -SessionVariable k -TimeoutSec 90 | Out-Null
$dash = Invoke-RestMethod -Uri "$Base/api/tecnico/dashboard" -WebSession $k -TimeoutSec 90
$codigos = @()
foreach ($list in @($dash.ordenesPendientes, $dash.ordenesEnProceso, $dash.agenda)) {
  if ($list) { $codigos += ($list | ForEach-Object { $_.codigo }) }
}
($codigos | Sort-Object -Unique) -join ", "
