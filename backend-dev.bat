@echo off
cd backend
call venv\Scripts\activate
uvicorn main:app --reload --port 8001