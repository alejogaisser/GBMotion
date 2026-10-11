@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0INICIAR_GB_MOTION.ps1"
set "GB_EXIT=%ERRORLEVEL%"
if not "%GB_EXIT%"=="0" if not "%GB_NO_PAUSE%"=="1" pause
endlocal & exit /b %GB_EXIT%
