
## 백엔드 실행
```
cd backend
uvicorn main:app --reload
```

## 프론트 실행
```
cd frontend
npm run dev
```


이 프로그램은 **Reconstruction 견적** 기능을 핵심으로 하며, 여러 단계의 작업(예: work scope, measurement, material type, current status)에 대해 내장 프롬프트를 활용해 AI가 처리하고, 사용자 확인(컨펌)을 거쳐 다음 단계로 진행합니다. 최종 출력은 **PDF 파일**로 생성되며, 추후 **프로젝트 관리**와 **인보이스 관리** 기능을 추가할 수 있도록 확장성을 고려합니다. 기존 스택(React + FastAPI + LangChain + Grok 3/Llama 3 + Pinecone + Google Cloud Vision API + PostgreSQL)을 기반으로 하되, PDF 생성과 단계별 워크플로우에 맞게 조정합니다. 보안은 낮은 우선순위이고, 비용은 성능 우선이지만 무료 티어를 활용해 합리적으로 관리합니다.

### 요구사항 요약

- **핵심 기능**: Reconstruction 견적서 작성
    - **입력**: Work scope, measurement, material type, current status 등.
    - **워크플로우**: 단계별 프롬프트 기반 AI 처리, 사용자 확인 후 다음 단계 진행.
    - **프롬프트 관리**: 단계별 프롬프트 테스트 및 검증, 실무 적용.
    - **출력**: 완성된 견적서를 PDF로 생성.
- **추가 기능 (미래)**: 프로젝트 관리, 인보이스 관리.
- **환경**: 클라우드 배포(로컬 테스트 가능), 단일 사용자에서 시작, 추후 확장.
- **스택 요구**: 유연한 UI(React), OCR, RAG/CAG, 내장 프롬프트, PDF 생성.
- **비용**: 성능 우선, 무료 티어 활용.
- **보안**: 낮은 우선순위.

### 개발 로드맵

로드맵은 **Reconstruction 견적 기능**을 우선 구현하고, 점진적으로 기능을 확장하는 단계별 계획으로 구성됩니다. 각 단계는 요구사항을 충족하며, 테스트와 배포를 포함합니다.

---

### **Phase 1: 기초 설계 및 초기 구현 (4-6주)**

**목표**: Reconstruction 견적서 작성 프로그램의 최소 기능 구현(MVP). 단계별 워크플로우, 내장 프롬프트, PDF 출력 포함. 로컬 환경에서 테스트.

1. **스택 설정 및 환경 구축**
    - **프로그래밍 언어**: Python 3.10+ (백엔드), JavaScript (프론트엔드).
    - **프론트엔드**: React + Tailwind CSS
        - 사용자 입력 UI(텍스트, 파일 업로드), 단계별 컨펌 UI, 프롬프트 테스트 UI.
        - CDN: `cdn.jsdelivr.net` (React, ReactDOM, Babel, Tailwind CSS).
    - **백엔드**: FastAPI + LangChain
        - 단계별 엔드포인트(예: `/step1-work-scope`, `/step2-measurement`).
        - 내장 프롬프트 관리 및 테스트 엔드포인트.
    - **데이터 저장**: SQLite (로컬 테스트용, PostgreSQL로 마이그레이션 준비).
        - 테이블: `prompts` (내장 프롬프트), `estimates` (견적 데이터), `feedback` (사용자 피드백).
    - **AI 모델**: Llama 3 (Ollama, 로컬 실행)
        - 비용 절감, GPU 없어도 CPU 실행 가능.
    - **OCR**: Google Cloud Vision API
        - 입력 이미지(예: 현장 사진)에서 텍스트 추출.
    - **PDF 생성**: LaTeX (PDFLaTeX, `latexmk` 사용)
        - 견적서 포맷 정의, `article` documentclass 사용.
        - 패키지: `geometry`, `tabularx`, `booktabs`, `amsmath`, `fontenc`, `inputenc`.
        - 폰트: `times` (Latin 문자, texlive-fonts-extra).
    - **개발 환경**: VS Code, Docker (로컬 테스트용).
    - **버전 관리**: Git + GitHub.
2. **단계별 워크플로우 설계**
    - **단계 정의**:
        1. Work Scope: 작업 범위 정의 (예: "주방 리모델링").
        2. Measurement: 치수 입력 (예: "10x12 피트").
        3. Material Type: 자재 선택 (예: "목재, 타일").
        4. Current Status: 현장 상태 입력 (예: "낡은 벽지").
        5. Final Estimate: 최종 견적 계산 및 PDF 생성.
    - **프롬프트 설계**:
        - 각 단계에 내장 프롬프트 정의(예: "작업 범위: {scope}\n간단히 설명해").
        - LangChain의 `PromptTemplate`으로 관리.
    - **사용자 컨펌**: 각 단계 결과에 대해 React UI에서 "확인" 또는 "수정" 버튼 제공.
    - **프롬프트 테스트**: 테스트용 UI(React)에서 프롬프트 입력/수정/실행 가능.
3. **구현**
    - **프론트엔드 (React)**:
        - 입력 폼: 텍스트(작업 범위 등), 파일 업로드(OCR용).
        - 단계별 진행 바: 현재 단계 표시, "다음" 버튼으로 컨펌.
        - 프롬프트 테스트 UI: 내장 프롬프트 수정 및 테스트 결과 표시.
        - PDF 다운로드 버튼.
    - **백엔드 (FastAPI)**:
        - 엔드포인트: `/step1`, `/step2`, ..., `/generate-pdf`.
        - OCR 처리: Google Cloud Vision API로 텍스트 추출.
        - SQLite 저장: 단계별 입력 및 피드백.
        - LangChain: 단계별 내장 프롬프트 실행, Llama 3 호출.
    - **PDF 생성 (LaTeX)**:
        - 견적서 템플릿 정의(예: 고객 정보, 작업 항목, 비용).
        - `latexmk`로 PDF 컴파일.
4. **테스트**
    - 로컬 환경에서 Reconstruction 견적 워크플로우 테스트.
    - 샘플 데이터(예: 주방 리모델링)로 단계별 프롬프트 및 PDF 출력 확인.
    - 프롬프트 테스트 UI로 다양한 프롬프트 검증.
5. **성과물**
    - 로컬에서 실행 가능한 Reconstruction 견적 프로그램(MVP).
    - 단계별 내장 프롬프트 및 테스트 기능.
    - PDF 견적서 출력.

**예상 기간**: 4-6주 (개발자 1명 기준, 하루 4-6시간 작업 가정).

**비용**: 무료 (Llama 3, SQLite, 오픈소스 도구), Google Cloud Vision API 무료 티어(월 1,000 요청).

---

### **Phase 2: RAG/CAG 통합 및 클라우드 배포 (4-6주)**

**목표**: RAG/CAG로 데이터 검색 및 캐싱 추가, 클라우드 배포(Render)로 접근성 향상.

1. **RAG 통합**
    - **벡터 데이터베이스**: Pinecone (무료 티어, 2GB).
        - OCR 텍스트, 외부 API 데이터(예: 자재 가격) 인덱싱.
        - LangChain의 `Pinecone` 모듈로 검색.
    - **임베딩 모델**: Hugging Face `sentence-transformers/all-MiniLM-L6-v2` (무료).
    - **사용 사례**: 과거 견적 데이터 검색, 자재 정보 보강.
2. **CAG 통합**
    - **캐시 저장**: SQLite (로컬), PostgreSQL (배포).
        - 정적 데이터(예: 자재 목록, 표준 작업 범위) 캐싱.
        - LangChain의 `InMemoryCache`로 빠른 응답.
    - **사용 사례**: 자주 사용하는 작업 범위 또는 자재 데이터 즉시 로드.
3. **클라우드 배포 (Render)**
    - FastAPI, React, PostgreSQL 컨테이너화(Docker).
    - Render 무료 티어로 배포(~$7/월 유료 전환 가능).
    - Pinecone 클라우드 호스팅.
    - Google Cloud Vision API 통합.
4. **프론트엔드 개선**
    - 단계별 진행 상태 저장(React 상태 관리, `useState`/`useEffect`).
    - RAG/CAG 결과 표시(예: "검색된 자재 정보: [Pinecone 결과]").
    - 오류 처리 UI(예: OCR 실패 시 재시도 버튼).
5. **테스트**
    - 클라우드 환경에서 단계별 워크플로우 및 PDF 출력 테스트.
    - RAG/CAG 성능 확인(예: 검색 속도, 캐시 응답 시간).
    - 프롬프트 테스트 UI로 다양한 시나리오 검증.
6. **성과물**
    - 클라우드 배포된 Reconstruction 견적 프로그램.
    - RAG/CAG 통합으로 데이터 활용성 향상.
    - 안정적인 PDF 출력.

**예상 기간**: 4-6주.

**비용**: Render 무료 티어, Pinecone 무료 티어, Google Cloud Vision API 무료 티어. 유료 전환 시 ~$20/월(Render + Pinecone).

---

### **Phase 3: 프롬프트 최적화 및 확장 준비 (3-4주)**

**목표**: 프롬프트 검증 및 관리 강화, 추후 기능 확장을 위한 기반 마련.

1. **프롬프트 관리**
    - PostgreSQL에 `prompts` 테이블로 작업별 프롬프트 저장.
    - FastAPI 엔드포인트: `/prompt-test`, `/prompt-save`.
    - React UI: 프롬프트 테스트 및 수정 인터페이스 개선.
2. **피드백 시스템 강화**
    - 사용자 피드백 저장 및 프롬프트 자동 업데이트.
    - 예: "너무 길다" 피드백 → 프롬프트에 "100자 이내" 추가.
3. **확장 준비**
    - 데이터베이스 스키마 확장: 프로젝트 관리(`projects`), 인보이스(`invoices`) 테이블 추가.
    - API 설계: `/projects`, `/invoices` 엔드포인트 예약.
    - 모듈화: 견적 유형별 코드 분리(예: `reconstruction.py`, `moving.py`).
4. **테스트**
    - 프롬프트 테스트 기능 검증(다양한 입력으로 결과 비교).
    - 다중 견적 유형 시뮬레이션(예: Roofing 테스트 데이터).
5. **성과물**
    - 최적화된 프롬프트 관리 시스템.
    - 확장 가능한 코드 및 데이터베이스 구조.

**예상 기간**: 3-4주.

**비용**: 기존 인프라 사용, 추가 비용 없음.

---

### **Phase 4: 추가 견적 유형 및 기능 확장 (6-8주)**

**목표**: Moving, Roofing 등 추가 견적 유형 지원, 프로젝트/인보이스 관리 기능 구현.

1. **추가 견적 유형**
    - 각 유형별 워크플로우 정의(예: Roofing은 "지붕 재질" 단계 추가).
    - 내장 프롬프트 추가(예: `roofing_prompt`).
    - React UI에 견적 유형 선택 드롭다운 추가.
2. **프로젝트 관리**
    - FastAPI 엔드포인트: `/projects/create`, `/projects/list`.
    - PostgreSQL 테이블: `projects` (견적 ID, 고객 정보, 상태).
    - React UI: 프로젝트 목록, 상태 필터링.
3. **인보이스 관리**
    - FastAPI 엔드포인트: `/invoices/create`, `/invoices/list`.
    - LaTeX로 인보이스 PDF 생성.
    - React UI: 인보이스 생성 및 다운로드.
4. **배포 최적화**
    - AWS로 전환(Render 성능 한계 시).
    - EC2(t3.micro), RDS(PostgreSQL), S3(이미지/PDF 저장).
5. **테스트**
    - 다중 견적 유형 워크플로우 테스트.
    - 프로젝트/인보이스 기능 통합 테스트.
6. **성과물**
    - 다중 견적 유형 지원 프로그램.
    - 프로젝트 및 인보이스 관리 기능.

**예상 기간**: 6-8주.

**비용**: AWS(~$30/월), Pinecone(~$50/월), Google Cloud Vision API(사용량 기반).