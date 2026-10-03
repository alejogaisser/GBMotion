@echo off
setlocal
cd /d "%~dp0"

set "GB_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "GB_VITE=%CD%\node_modules\vite\bin\vite.js"

if not exist "%GB_VITE%" (
  echo GB Motion necesita instalar sus dependencias primero.
  echo Abri esta carpeta en Codex y pedi: instalar GB Motion.
  pause
  exit /b 1
)

if exist "%GB_NODE%" goto start_app
where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js ni el runtime local de Codex.
  echo Instala Node.js o inicia la app desde Codex.
  pause
  exit /b 1
)
set "GB_NODE=node"

:start_app
powershell.exe -NoProfile -Command "Start-Process -FilePath '%GB_NODE%' -ArgumentList @('%GB_VITE%','--host','127.0.0.1','--port','4173','--strictPort') -WorkingDirectory '%CD%' -WindowStyle Hidden"

echo Iniciando GB Motion...
for /L %%G in (1,1,30) do (
  powershell.exe -NoProfile -Command "try { $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:4173/' -TimeoutSec 1; if ($response.StatusCode -eq 200) { exit 0 } } catch {}; exit 1" >nul 2>nul
  if not errorlevel 1 goto open_app
  timeout /t 1 /nobreak >nul
)

echo No se pudo iniciar GB Motion en el puerto 4173.
echo Cerra otra copia de la app si ya esta abierta e intenta nuevamente.
pause
exit /b 1

:open_app
start "" "http://127.0.0.1:4173/"
endlocal
