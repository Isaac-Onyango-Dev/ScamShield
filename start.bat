@echo off
setlocal enabledelayedexpansion
set NODE_ENV=production
cd /d "%~dp0"
call npm run start
pause
