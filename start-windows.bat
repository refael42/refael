@echo off
rem Double-click to run the game: installs what is needed, then starts the dev server.
rem Then scan the QR code with Expo Go on the phone (same Wi-Fi), or press w for the browser.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed. Get the LTS version from https://nodejs.org and run this file again.
  echo.
  pause
  exit /b 1
)
echo Installing / updating packages (the first time takes a few minutes)...
call npm install --no-audit --no-fund
if errorlevel 1 (
  pause
  exit /b 1
)
echo.
echo Starting. Scan the QR code with Expo Go, or press w to open it in the browser.
call npx expo start
pause
