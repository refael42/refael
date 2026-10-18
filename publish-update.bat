@echo off
rem Double-click: sends a quick update (no store review) to everyone with the store version.
rem Runs every check first; if one fails, nothing is sent.
cd /d "%~dp0"
rem This folder comes from a ZIP, not a git clone: let EAS pack the folder as it is.
set EAS_NO_VCS=1
rem The store version hides the testing tools (src/config.ts); the update is built the same way,
rem or it would bring them back to every player.
set EXPO_PUBLIC_STORE=1
echo Installing / updating packages...
call npm install --no-audit --no-fund
if errorlevel 1 (
  pause
  exit /b 1
)
echo.
echo Checking the code, the tests and the store texts...
call npm run release:check
if errorlevel 1 (
  echo.
  echo A check failed: nothing was sent. Send Claude a screenshot.
  pause
  exit /b 1
)
echo.
set /p MSG=What changed (one line, in English):
call eas update --channel production --environment production --message "%MSG%"
pause
