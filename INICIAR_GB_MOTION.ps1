# Launcher de produccion de GB Motion. Mismo entrypoint que `npm start`:
#   node --experimental-strip-types server/runtime.ts
# Nunca arranca Vite, no instala nada y no mata procesos existentes.
# Variables opcionales: GB_PORT (default 4173), GB_NO_BROWSER=1 (no abre navegador).
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Set-Location $root

$port = if ($env:GB_PORT) { $env:GB_PORT } else { '4173' }
if ($port -notmatch '^\d+$' -or [int]$port -lt 1 -or [int]$port -gt 65535) {
  Write-Host "GB_PORT debe ser un puerto entre 1 y 65535 (valor: $port)."; exit 1
}
$base = "http://127.0.0.1:$port"

# 1. Node: runtime local de Codex, o node del PATH.
$node = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (-not (Test-Path -LiteralPath $node)) {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $cmd) {
    Write-Host 'No se encontro Node.js ni el runtime local de Codex.'
    Write-Host 'Instala Node.js o inicia la app desde Codex.'; exit 1
  }
  $node = $cmd.Source
}

# 2. Dependencias y build.
if (-not (Test-Path -LiteralPath (Join-Path $root 'node_modules'))) {
  Write-Host 'GB Motion necesita instalar sus dependencias primero.'
  Write-Host 'Abri esta carpeta en Codex y pedi: instalar GB Motion.'; exit 1
}
$missing = @('dist\index.html', 'dist\editor\index.html', 'dist\404.html') | Where-Object { -not (Test-Path -LiteralPath (Join-Path $root $_)) }
if ($missing) {
  Write-Host "Falta compilar GB Motion (no se encontro: $($missing -join ', '))."
  Write-Host 'Ejecuta una vez, en esta carpeta:'
  Write-Host "  `"$node`" node_modules\vite\bin\vite.js build"
  Write-Host '(o `npm run build` si tenes npm). Despues volve a abrir este launcher.'
  exit 1
}

# 3. Estado del puerto: libre, runtime compatible, u ocupado por otra cosa.
function Get-PortState {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect('127.0.0.1', [int]$port, $null, $null)
    if (-not ($async.AsyncWaitHandle.WaitOne(1000) -and $client.Connected)) { return 'free' }
  } catch { return 'free' } finally { $client.Close() }
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "$base/api/health" -TimeoutSec 2
    $j = $r.Content | ConvertFrom-Json
    if ($r.StatusCode -eq 200 -and $j.version -eq 1 -and $j.mode -eq 'local') { return 'gb' }
  } catch {}
  return 'other'
}

$state = Get-PortState
if ($state -eq 'other') {
  Write-Host "El puerto $port esta ocupado por otro programa (no es GB Motion)."
  Write-Host 'No se cerro nada. Cerralo vos o usa otro puerto con GB_PORT.'; exit 1
}
if ($state -eq 'free') {
  Write-Host 'Iniciando GB Motion...'
  Start-Process -FilePath $node -ArgumentList @('--experimental-strip-types', 'server/runtime.ts') -WorkingDirectory $root -WindowStyle Hidden
  $ok = $false
  for ($i = 0; $i -lt 30 -and -not $ok; $i++) {
    Start-Sleep -Seconds 1
    $ok = (Get-PortState) -eq 'gb'
  }
  if (-not $ok) {
    Write-Host "No se pudo iniciar GB Motion en el puerto $port."
    Write-Host 'Revisa que no haya otra copia abierta e intenta nuevamente.'; exit 1
  }
} else {
  Write-Host "GB Motion ya esta corriendo en el puerto $port; se reutiliza."
}

if ($env:GB_NO_BROWSER -ne '1') { Start-Process "$base/editor/" }
Write-Host "GB Motion listo: $base/editor/"
exit 0
