@echo off
setlocal enabledelayedexpansion
set NODE_ENV=development
set PORT=5000
cd /d "%~dp0"
echo.
echo 🚀 Starting ScamShield Development Server...
echo 📍 Environment: development
echo 🔌 Port: 5000
echo.
call npx.cmd tsx server/index.ts
pause
