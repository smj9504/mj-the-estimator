backend-dev:
	cd backend && venv\Scripts\activate && uvicorn main:app --reload

frontend-dev:
	cd frontend && npm run dev

install-backend:
	cd backend && venv\Scripts\activate && pip install -r requirements.txt

install-frontend:
	cd frontend && npm install

dev:
	@echo "Starting backend and frontend..."
	start cmd /k "cd backend && venv\Scripts\activate && uvicorn main:app --reload"
	cd frontend && npm run dev