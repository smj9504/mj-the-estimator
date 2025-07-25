from fastapi import FastAPI, UploadFile, File, Form
from langchain_ollama import OllamaLLM
from langchain.prompts import PromptTemplate
import sqlite3
from google.cloud import vision
import os

app = FastAPI()
llm = OllamaLLM(model="llama3")
# Vision client는 OCR 사용 시에만 초기화

# SQLite 설정
conn = sqlite3.connect("db/estimate.db")
c = conn.cursor()
c.execute('''CREATE TABLE IF NOT EXISTS estimates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    step TEXT,
    input TEXT,
    output TEXT,
    confirmed BOOLEAN
)''')
c.execute('''CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    step TEXT,
    template TEXT
)''')
c.execute("INSERT OR IGNORE INTO prompts (step, template) VALUES (?, ?)",
          ("work_scope", "작업 범위: {scope}\n주요 작업 항목을 나열하고 간단히 설명해:"))
conn.commit()

# 내장 프롬프트
scope_prompt = PromptTemplate(
    input_variables=["scope"],
    template="작업 범위: {scope}\n주요 작업 항목을 나열하고 간단히 설명해:"
)

@app.post("/step1-work-scope")
async def step1_work_scope(scope: str = Form(...)):
    output = llm(scope_prompt.format(scope=scope))
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