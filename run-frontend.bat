@echo off
title LogiMind Frontend :5173
cd /d "%~dp0frontend"
npm run dev -- --host --port 5173
pause
