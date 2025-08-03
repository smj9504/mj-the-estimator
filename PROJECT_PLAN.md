요구사항 요약

입력: 생성된 Scope of Work data (JSON 형태, 예: {"work_scope": "주방 리모델링", "measurement": "10x12 ft", "material_type": "목재, 타일", "current_status": "낡은 상태"}).
워크플로우: 입력 데이터를 바탕으로 여러 AI 에이전트가 각 파트(작업범위, quantity, 시장가조사, timeline, cleaning, disposal, description 생성)를 맡아 순차/병렬 처리. 각 단계 결과에 대해 사용자 확인(컨펌) 후 다음 단계로 진행.
수정 기능: 상황에 따라 AI에게 추가 요구사항 전달(예: "더 자세히 설명해")로 결과 수정, 또는 프롬프트 수정(예: "100자 이내로 요약해" 추가).
UI 기능: 각 단계에서 AI의 답변(출력 JSON, 원본 텍스트) 확인 가능. React UI를 통해 로그/히스토리 표시.
추가 기능 (미래): 프로젝트 관리, 인보이스 관리.
환경: 클라우드 배포(로컬 테스트 가능), 단일 사용자에서 시작, 추후 확장.
스택 요구: 유연한 UI(React), OCR, RAG/CAG, 내장 프롬프트, PDF 생성.
비용: 성능 우선, 무료 티어 활용.
보안: 낮은 우선순위.

기능 정의
아래에서 워크플로우 전체를 기능별로 정의합니다. 기능은 입력 처리부터 에이전트 실행, 사용자 상호작용, 수정/검증, 출력까지 포괄하며, 기존 스택을 기반으로 구현 가능성을 강조합니다. 각 기능은 Phase별 로드맵에서 구현 순서를 고려했습니다.

AI 에이전트 분리 및 처리 기능

설명: Scope of Work data를 바탕으로 여러 AI 에이전트가 각 파트를 맡아 병렬/순차 처리. LangChain SequentialChain 또는 ParallelChain으로 연결, Llama 3/Grok 3 호출.
에이전트 역할 및 처리:

작업범위 에이전트: Scope data로 세부 범위 생성 (프롬프트: "Scope: {scope}\n세부 작업 목록 생성.").
Quantity 에이전트: Measurement data로 수량 계산 (프롬프트: "측정: {measurement}\n수량 산출.").
시장가조사 에이전트: Material type으로 가격 조사 (RAG/Web Search 통합, 2025년 데이터 기반, 예: wiring $0.40-$1.60/ft).
Timeline 에이전트: 전체 데이터로 기간 추정 (프롬프트: "작업 목록: {tasks}\n타임라인 계산.").
Cleaning 에이전트: 청소 비용 계산 (프롬프트: "측정: {measurement}\n청소 비용 추정.").
Disposal 에이전트: 폐기 비용 계산 (유사).
Description 생성 에이전트: 모든 결과 합산해 설명 텍스트 생성 (프롬프트: "결과: {aggregated}\n견적서 설명 작성.").


워크플로우 진행: 순차(예: 작업범위 → quantity → 시장가조사) 또는 병렬(독립 에이전트). FastAPI /run-agent/{agent_name} 엔드포인트로 개별 호출, /run-workflow로 전체 실행.
출력 형식: 각 에이전트 JSON 반환 (e.g., {"quantity": {"wall": "120 sq ft"}}), PostgreSQL agent_results 테이블 저장.
통합: RAG/CAG(캐싱으로 반복 처리 최소화), 교차검증(다중 모델 평균화).

사용자 확인 및 수정 기능

설명: 각 에이전트 처리 후 사용자 확인(컨펌) 필수. 수정 필요 시 AI 추가 요구사항 전달 또는 프롬프트 수정.
세부 기능:

확인(컨펌): React UI에서 에이전트 결과 표시 후 "승인" 버튼 → 다음 에이전트 진행.
추가 요구사항 전달: UI 입력 필드(예: "더 자세히 설명해") → FastAPI /refine-agent/{agent_name} (재실행, 추가 프롬프트 삽입).
프롬프트 수정: UI 에디터에서 프롬프트 수정 → DB 업데이트 및 재실행. 버전 관리(예: prompts 테이블 version 컬럼).
검증 통합: Validator Agent 자동 호출(예: "항목 4-6개? 금액 범위 확인"), 실패 시 수정 유도.


UI 지원: <agentconfirm> 컴포넌트(결과 JSON 표시, 수정 버튼, 프롬프트 에디터).</agentconfirm>
통합: 피드백 시스템(PostgreSQL feedback 저장, 누적 학습).

AI 답변 확인 기능 (UI 로그/히스토리)

설명: 각 단계에서 AI의 답변(원본 텍스트, JSON 출력, 프롬프트 사용 내역) 확인 가능. React UI에서 로그 뷰 제공.
세부 기능:

FastAPI 엔드포인트: /agent-log/{workflow_id} (로그 반환: 에이전트별 입력/출력/프롬프트).
저장: PostgreSQL agent_logs 테이블 (agent_name, prompt_used, input, output, timestamp).
UI 표시: 테이블 형식(React ), 클릭 시 상세 뷰(프롬프트, AI 응답 원문).
검색/필터: 에이전트별 로그 필터링.


통합: RAG 검색 결과 로그 포함(예: "Pinecone에서 검색된 데이터: wiring $0.40-$1.60/ft").

5. 최종 출력 및 확장 기능

설명: 모든 에이전트 결과 합산 → 최종 견적 데이터 생성 → PDF 변환.
세부 기능:

FastAPI /finalize-estimate: Aggregated JSON 생성.
PDF 생성: LaTeX 템플릿으로 변환 (엔드포인트: /generate-pdf).
확장: 프로젝트/인보이스 테이블 연동(예: projects에 워크플로우 ID 저장).


UI 지원: <finaloutput> (PDF 미리보기/다운로드, 로그 버튼).</finaloutput>



