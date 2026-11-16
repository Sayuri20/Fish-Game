@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js first, then run this file again.
  pause
  exit /b 1
)
if not exist node_modules\better-sqlite3 (
  call npm ci
  if errorlevel 1 exit /b 1
)
echo Open http://localhost:3004 in your browser after the server starts.
node server.mjs
pause
