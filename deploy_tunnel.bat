@echo off
echo ========================================================
echo       Techflix - Finding Nemo: Public Deployment
echo ========================================================
echo.

cd /d "%~dp0"

echo 1. Ensuring frontend is built...
cd frontend
call npm.cmd run build
cd ..

echo 2. Starting backend server on port 8000...
start /b py -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 2>nul || start /b python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

echo 3. Starting Cloudflare Public Tunnel...
echo Generating public link for anyone on the internet to join...
echo ========================================================
.\cloudflared.exe tunnel --url http://127.0.0.1:8000
pause
