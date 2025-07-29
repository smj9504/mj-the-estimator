@echo off
echo Starting MJ The Estimator Development Environment...
echo.

echo Starting Backend Server...
start "Backend Server" cmd /k "cd /d "%~dp0..\backend" && call venv\Scripts\activate && uvicorn main:app --reload --port 8001"

echo Waiting for backend to start...
timeout /t 3 /nobreak >nul

echo Starting Frontend Server...
start "Frontend Server" cmd /k "cd /d "%~dp0..\frontend" && npm run dev"

echo.
echo Both servers are starting!
echo Backend: http://localhost:8001
echo Frontend: http://localhost:5173
echo.
echo Press any key to close this window...
pause >nul