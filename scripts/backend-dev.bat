@echo off
cd /d "%~dp0..\backend"
call venv\Scripts\activate
uvicorn main:app --reload --port 8001