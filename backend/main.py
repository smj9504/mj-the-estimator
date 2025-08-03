from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from langchain_ollama import OllamaLLM
from langchain.prompts import PromptTemplate
import sqlite3
import os
from config import settings

# Optional Google Cloud Vision import
try:
    from google.cloud import vision
    VISION_AVAILABLE = True
except ImportError:
    VISION_AVAILABLE = False
    vision = None

# Import routers
from routers.pre_estimate import router as pre_estimate_router
from routers.material_analysis import router as material_analysis_router
from routers.demo_analysis import router as demo_analysis_router
from routers.rag_demo_analysis import router as rag_demo_analysis_router
from models.database import init_database

# Import our custom logger
from utils.logger import logger
from middleware.logging_middleware import LoggingRoute, log_request_body
from utils.prompts import LEGACY_SCOPE_PROMPT

app = FastAPI(
    title="MJ Estimator API", 
    version="1.0.0",
    route_class=LoggingRoute  # Use custom route class for automatic logging
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:5174", 
        "http://localhost:5175",
        f"http://localhost:{settings.port}"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add logging middleware
app.middleware("http")(log_request_body)

# Initialize database
init_database()

# Include routers
app.include_router(pre_estimate_router)
app.include_router(material_analysis_router, prefix="/api")
app.include_router(demo_analysis_router)
app.include_router(rag_demo_analysis_router)

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    logger.info("MJ The Estimator API starting up", 
                host=settings.host, 
                port=settings.port,
                environment=settings.environment)

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("MJ The Estimator API shutting down")

# Legacy code (keeping for backward compatibility)
try:
    environment = os.getenv('ENVIRONMENT', 'development')
    if environment == 'production' and os.getenv('OPENAI_API_KEY'):
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(model=settings.openai_text_model, api_key=os.getenv('OPENAI_API_KEY'))
    else:
        llm = OllamaLLM(model="gemma3")
except Exception as e:
    logger.error(f"Failed to initialize legacy LLM: {e}")
    llm = None

# Legacy SQLite connection (for existing endpoints)
conn = sqlite3.connect("db/estimate.db")
c = conn.cursor()

# Use imported legacy scope prompt
scope_prompt = LEGACY_SCOPE_PROMPT

@app.post("/step1-work-scope")
async def step1_work_scope(scope: str = Form(...)):
    if llm:
        output = llm.invoke(scope_prompt.format(scope=scope))
    else:
        output = f"Mock response for scope: {scope}"
    c.execute("INSERT INTO estimates (step, input, output, confirmed) VALUES (?, ?, ?, ?)",
              ("work_scope", scope, output, False))
    conn.commit()
    return {"output": output, "step_id": c.lastrowid}

@app.post("/step1-confirm")
async def confirm_step1(step_id: int, confirmed: bool = Form(...)):
    c.execute("UPDATE estimates SET confirmed = ? WHERE id = ?", (confirmed, step_id))
    conn.commit()
    return {"status": "confirmed" if confirmed else "rejected"}

@app.post("/ocr")
async def ocr_process(file: UploadFile = File(...)):
    if not VISION_AVAILABLE:
        return {"error": "Google Cloud Vision is not available"}
    
    try:
        # Vision client를 사용할 때만 초기화
        vision_client = vision.ImageAnnotatorClient()
        image = await file.read()
        vision_image = vision.Image(content=image)
        response = vision_client.text_detection(image=vision_image)
        text = response.text_annotations[0].description if response.text_annotations else ""
        return {"text": text}
    except Exception as e:
        return {"error": str(e)}

@app.post("/test-prompt")
async def test_prompt(step: str = Form(...), input: str = Form(...), template: str = Form(...)):
    prompt = PromptTemplate(input_variables=["input"], template=template)
    output = llm(prompt.format(input=input))
    return {"output": output}