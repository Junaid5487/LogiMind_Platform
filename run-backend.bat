@echo off
title LogiMind Backend :8000
cd /d "%~dp0"
call backend\.venv\Scripts\activate.bat
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 --reload
pause
