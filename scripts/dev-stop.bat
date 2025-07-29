@echo off
echo Stopping MJ The Estimator Development Servers...

echo Killing uvicorn processes...
taskkill /f /im uvicorn.exe 2>nul
taskkill /f /im python.exe /fi "WINDOWTITLE eq Backend Server*" 2>nul

echo Killing npm/node processes...
taskkill /f /im node.exe /fi "WINDOWTITLE eq Frontend Server*" 2>nul

echo Development servers stopped.
pause