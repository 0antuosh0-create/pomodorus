@echo off
title Pomodorus
echo ======================================================
echo   Starting Pomodorus...
echo ======================================================

:: Open default browser after a brief delay
start "" cmd /c "timeout /t 1 /nobreak >nul && start http://localhost:5174"

:: Run server
node server.mjs

pause
