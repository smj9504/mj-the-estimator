# MJ The Estimator

AI-powered construction estimation tool for accurate project measurements and material scope analysis.

## 🏗️ Overview

MJ The Estimator is a comprehensive construction estimation platform that combines AI analysis with traditional measurement processing to provide accurate project estimates. The system features:

- **AI-Powered Analysis**: Automated measurement extraction from PDF documents and image analysis
- **Multi-Stage Workflow**: Pre-estimate process with measurement data, material scope, demo scope, and work scope
- **Project Management**: Dashboard for managing multiple estimation projects
- **Auto-Save**: Automatic data persistence with real-time status indicators

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 16+
- OpenAI API Key (recommended) or Ollama (local development)

### Installation & Setup

#### Option 1: Using npm scripts (Recommended)
```bash
# Install all dependencies
npm run install:all

# Start both servers concurrently
npm run dev

# Or start individually
npm run dev:backend
npm run dev:frontend
```

#### Option 2: Using batch scripts
```bash
# Start both servers
scripts\dev-start.bat

# Or start individually
scripts\backend-dev.bat
scripts\frontend-dev.bat

# Stop all servers
scripts\dev-stop.bat
```

#### Option 3: Manual setup
```bash
# Backend setup
cd backend
python -m venv venv
call venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt

# Create database
python -c "from models.database import init_database; init_database()"

# Start backend
uvicorn main:app --reload --port 8001

# Frontend setup (new terminal)
cd frontend
npm install
npm run dev
```

### Environment Configuration

Create a `.env` file in the backend directory:

```env
# AI Configuration
ENVIRONMENT=production
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Claude AI
ANTHROPIC_API_KEY=your_claude_api_key_here

# Optional: Ollama (for local development)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=gemma3

# Optional: Google Cloud Vision (for OCR)
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
```

**AI Provider Selection (Automatic):**
1. `ENVIRONMENT=production` → OpenAI/Claude API 사용
2. Ollama 서버 감지 → Ollama 사용
3. 둘 다 없음 → Mock 데이터 사용

## 📱 Application Features

### Pre-Estimate Workflow
1. **Measurement Data**: Upload PDF files for automated measurement extraction
2. **Material Scope**: Define materials and work scope for each room
3. **Demo Scope**: AI-powered demolition area analysis from photos
4. **Work Scope**: Final scope definition and project completion

### AI Analysis Capabilities
- **PDF Processing**: Extract room measurements from insurance estimates
- **Image Analysis**: Detect demolished areas in construction photos
- **Area Calculation**: AI-powered area estimation from text descriptions
- **Material Detection**: Identify building materials from images

### Project Management
- **Dashboard**: Overview of all projects with status tracking
- **Auto-Save**: Real-time data persistence with visual indicators
- **Session Management**: Maintain project state across browser sessions
- **Data Export**: Export project data for external use

## 🌐 Access Points

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8001
- **API Documentation**: http://localhost:8001/docs

## 🛠️ Technology Stack

### Backend
- **FastAPI**: Modern Python web framework
- **SQLite**: Local database for development
- **LangChain**: AI/LLM integration framework
- **OpenAI GPT**: Text and vision analysis
- **PyPDF2**: PDF document processing
- **Pydantic**: Data validation and settings

### Frontend
- **React 18**: Modern UI framework
- **React Router**: Client-side routing
- **Tailwind CSS**: Utility-first CSS framework
- **CSS Modules**: Component-scoped styling
- **Fetch API**: HTTP client for backend communication

### AI & Machine Learning
- **OpenAI GPT-4o**: Advanced text and vision processing
- **Claude 3**: Alternative LLM provider
- **Ollama**: Local LLM for development (optional)
- **Custom Prompts**: Centralized prompt management system

## 📁 Project Structure

```
mj-the-estimator/
├── scripts/                # Development batch scripts
│   ├── backend-dev.bat
│   ├── frontend-dev.bat
│   ├── dev-start.bat
│   └── dev-stop.bat
├── backend/                # FastAPI backend
│   ├── main.py            # Application entry point
│   ├── models/            # Database models and schemas
│   ├── routers/           # API route handlers
│   ├── services/          # Business logic and AI services
│   ├── utils/             # Utilities and prompt management
│   ├── config.py          # Configuration settings
│   └── requirements.txt   # Python dependencies
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── utils/         # Frontend utilities
│   │   └── App.jsx        # Main application component
│   ├── package.json       # Node.js dependencies
│   └── index.html         # HTML template
├── package.json           # Root package.json with npm scripts
└── README.md             # This file
```

## 🔧 Development

### Hot Reloading
Both frontend and backend support hot reloading:
- **Backend**: Auto-restarts on Python file changes
- **Frontend**: Hot Module Replacement (HMR) for instant updates

### Code Organization
- **Centralized Prompts**: All AI prompts managed in `backend/utils/prompts.py`
- **Auto-Save System**: Real-time data persistence with debouncing
- **Modular Architecture**: Separate services for different AI tasks
- **Type Safety**: Pydantic models for API validation

### Key Components
- **Measurement Processor**: Flexible system for parsing various measurement data formats
- **AI Service**: Unified interface for different AI providers
- **Room Calculator**: Automated calculation of room measurements and areas
- **Demo Analysis**: AI-powered analysis of demolition photos

### Demo Scope Features
- **Image Upload**: Support for multiple construction photos
- **AI Analysis**: Automatic detection of demolished areas
- **View Results**: Visual overlay of detected areas with confidence scores
- **Apply to Form**: Direct integration with Demo Scope workflow
- **Feedback System**: Collect user feedback for AI improvement

**Note**: Demo Scope focuses on AI analysis results viewing and application only. Manual area editing features have been removed to streamline the workflow.

## 🧪 Testing

```bash
# Backend tests
cd backend
python -m pytest

# Frontend tests
cd frontend
npm test
```

## 🚀 Deployment

The application is designed for easy deployment with:
- **Docker support**: Containerized backend and frontend
- **Environment-based configuration**: Easy switching between development and production
- **Database migrations**: Automated database setup
- **Static file serving**: Optimized for production builds

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## ⚙️ Configuration

### AI Models
The system supports multiple AI providers:
- **OpenAI GPT-4o**: Best performance for vision and text analysis
- **Claude 3**: Alternative with strong reasoning capabilities
- **Ollama**: Local development with models like Llama 3

### Database
- **Development**: SQLite (local file database)
- **Production**: PostgreSQL (configurable via environment)

### Prompt Management
All AI prompts are centralized in `backend/utils/prompts.py`:
- `MEASUREMENT_PROMPT`: For parsing measurement data
- `DEMO_ANALYSIS_PROMPT`: For demolition area detection
- `MATERIAL_ANALYSIS_PROMPT`: For material identification
- `AREA_CALCULATION_PROMPT`: For AI-based area calculations

## 🆘 Troubleshooting

### Common Issues
1. **Backend fails to start**: Check Python version and virtual environment
2. **Frontend build errors**: Ensure Node.js 16+ and clear npm cache
3. **AI analysis fails**: Verify API keys and environment variables
4. **Database errors**: Run database initialization script

### Debug Mode
Enable debug logging by setting:
```env
LOG_LEVEL=DEBUG
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔮 Roadmap

- [ ] Enhanced material library with pricing data
- [ ] Advanced project reporting and analytics
- [ ] Multi-user support with role-based access
- [ ] Mobile application for field measurements
- [ ] Integration with construction databases
- [ ] Advanced AI training on domain-specific data
- [ ] Automated cost estimation
- [ ] 3D visualization of projects