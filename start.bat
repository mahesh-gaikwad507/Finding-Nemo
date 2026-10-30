@echo off
echo ========================================================
echo       Techflix - Finding Nemo
echo ========================================================
echo.

cd /d "%~dp0\backend"
echo Initializing database...
py init_db.py 2>nul || python init_db.py

echo Starting production server on http://localhost:8000 (100+ concurrent users enabled) ...
py -m uvicorn main:app --host 0.0.0.0 --port 8000 --limit-concurrency 500 --backlog 500 || python -m uvicorn main:app --host 0.0.0.0 --port 8000 --limit-concurrency 500 --backlog 500
pause
