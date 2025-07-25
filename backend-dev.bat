@echo off
cd backend
call venv\Scripts\activate
uvicorn main:app --reload