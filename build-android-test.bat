@echo off
rem Double-click: builds a test version of the game for an Android phone in Expo's cloud, then
rem prints a link (and a QR code) to install it. Needs eas-cli and `eas login` done once.
cd /d "%~dp0"
rem This folder comes from a ZIP, not a git clone: let EAS pack the folder as it is
rem (it still leaves out node_modules and everything in .gitignore).
set EAS_NO_VCS=1
echo Installing / updating packages...
call npm install --no-audit --no-fund
if errorlevel 1 (
  pause
  exit /b 1
)
echo.
echo Building in the cloud. The first time it asks about an Android Keystore: press Enter (Yes).
echo It takes about 15-30 minutes (more if the free queue is busy). You can close this window;
echo the build keeps going and the link is also on expo.dev under the project's Builds.
call eas build --profile preview --platform android
pause
