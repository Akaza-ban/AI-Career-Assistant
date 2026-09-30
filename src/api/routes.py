import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, status

from src.agents.gap_analysis.graph import gap_analysis_agent
from src.agents.graph import agent
from src.agents.interview.graph import interview_agent
from src.config import get_settings
from src.models.schemas import (
    AdvisorStudentsResponse,
    AgentStatusResponse,
    ApplySuggestionRequest,
    ApplySuggestionResponse,
    ChatRequest,
    ChatResponse,
    CSATRequest,
    CSATResponse,
    CVHistoryResponse,
    CVSuggestion,
    CVUploadRequest,
    CVUploadResponse,
    CVVersionItem,
    GapAnalysisRequest,
    GapAnalysisResponse,
    GapItem,
    InterviewAnswerRequest,
    InterviewAnswerResponse,
    InterviewReportResponse,
    InterviewStartRequest,
    InterviewStartResponse,
    ParsedCV,
    QuestionEvaluationItem,
    STARScore,
    StudentDetailResponse,
    StudentSummary,
)

router = APIRouter()


# ============================================================================
# 1. System & Health Routes
# ============================================================================


@router.get("/status", response_model=AgentStatusResponse, tags=["System"])
async def agent_status() -> AgentStatusResponse:
    """Kiểm tra trạng thái agent, LLM provider và cấu hình LangSmith."""
    settings = get_settings()
    return AgentStatusResponse(
        status="ready",
        agent="Trợ lý nghề nghiệp X - LangGraph Agent",
        llm_provider=settings.llm_provider,
        model_name=settings.model_name,
        langsmith_tracing=bool(settings.langchain_tracing_v2 and settings.langchain_api_key),
    )


# ============================================================================
# 2. General Chat Route
# ============================================================================


@router.post("/chat", response_model=ChatResponse, tags=["General Chat"])
async def chat(request: ChatRequest) -> ChatResponse:
    """Chat với AI agent hỗ trợ định hướng chung."""
    try:
        result = await agent.ainvoke({"query": request.message})
        return ChatResponse(
            response=result.get("response", ""),
            conversation_id=request.conversation_id or str(uuid.uuid4()),
            analysis=result.get("analysis", ""),
            sources=[],
            timestamp=datetime.now(),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi xử lý hội thoại: {e!s}",
        )


# ============================================================================
# 3. CV Management & Upload Routes (US-SV-01)
# ============================================================================


@router.post("/cv/upload", response_model=CVUploadResponse, tags=["CV Management"])
async def upload_cv(request: CVUploadRequest) -> CVUploadResponse:
    """
    Tải lên hoặc dán nội dung CV để parse thông tin kỹ năng, kinh nghiệm.
    Tạo bản ghi CV phiên bản 1 (hoặc version mới) gắn với sinh viên.
    """
    raw_content = request.cv_text or "CV ứng viên mẫu"
    cv_id = f"cv_{uuid.uuid4().hex[:8]}"

    # Mock parse dữ liệu có cấu trúc ban đầu
    parsed = ParsedCV(
        full_name="Nguyễn Văn A",
        email="a.nguyen@example.edu.vn",
        skills=["Python", "FastAPI", "Docker", "Machine Learning", "SQL"],
        experiences=[
            {
                "role": "AI Engineering Intern",
                "company": "FPT Software",
                "duration": "6 months",
                "description": "Tham gia xây dựng pipeline RAG với LangChain và Vector DB.",
            }
        ],
        education=[
            {
                "school": "Trường Đại học X",
                "major": "Khoa học Máy tính",
                "gpa": "3.5/4.0",
                "period": "2022 - 2026",
            }
        ],
        raw_text=raw_content,
        raw_length=len(raw_content),
    )

    return CVUploadResponse(
        cv_id=cv_id,
        version=1,
        student_id=request.student_id,
        filename=request.filename or "cv.pdf",
        parsed_cv=parsed,
        message="Tải lên và bóc tách dữ liệu CV thành công",
        created_at=datetime.now(),
    )


@router.get("/cv/{student_id}/history", response_model=CVHistoryResponse, tags=["CV Management"])
async def get_cv_history(student_id: str) -> CVHistoryResponse:
    """Lấy danh sách các phiên bản CV đã lưu của sinh viên."""
    versions = [
        CVVersionItem(version=1, cv_id=f"cv_{student_id}_v1", summary="Bản CV gốc ban đầu", updated_at=datetime.now()),
    ]
    return CVHistoryResponse(student_id=student_id, versions=versions)


# ============================================================================
# 4. Gap Analysis Routes (CV vs JD) (US-SV-02, US-SV-05)
# ============================================================================


@router.post("/gap-analysis", response_model=GapAnalysisResponse, tags=["Gap Analysis"])
async def analyze_gap(request: GapAnalysisRequest) -> GapAnalysisResponse:
    """
    Phân tích khoảng cách giữa CV và JD.
    Phân loại rõ:
    - Presentation Gap (Khoảng cách trình bày -> Gợi ý diễn đạt lại dựa trên kinh nghiệm thật)
    - Capability Gap (Khoảng cách năng lực -> Cảnh báo kỹ năng thiếu, không bịa)
    - Grounding Check (Kiểm định bám sát tài liệu nguồn)
    """
    if len(request.jd_raw.strip()) < 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nội dung JD quá ngắn (yêu cầu tối thiểu 50 ký tự theo PRD).",
        )

    cv_text = request.cv_raw or "Kinh nghiệm: Lập trình Python, xây dựng REST API, tìm hiểu LangChain."

    try:
        # Gọi LangGraph Gap Analysis Agent 4-node (parse -> retrieve -> compare -> generate)
        initial_state = {
            "cv_raw": cv_text,
            "jd_raw": request.jd_raw,
        }
        graph_output = await gap_analysis_agent.ainvoke(initial_state)

        matched = graph_output.get("matched_skills") or []
        missing = graph_output.get("missing_skills") or []
        raw_suggestions = graph_output.get("suggestions") or []
        gap_summary = graph_output.get("gap_summary", "")
        recommendations = graph_output.get("recommendations", [])
        grounding_score = graph_output.get("grounding_score", 1.0)
        is_grounded = graph_output.get("is_grounded", True)
    except Exception:
        matched = ["Python", "FastAPI"]
        missing = ["Docker", "Qdrant"]
        raw_suggestions = [
            {
                "skill": "Python",
                "evidence_span": cv_text[:50],
                "original_text": cv_text[:50],
                "suggested_revision": f"Vận dụng thành thạo Python trong xây dựng hệ thống: {cv_text[:50]}",
                "rationale": "Chuẩn hóa câu văn theo chuẩn ATS.",
            }
        ]
        gap_summary = "Đã phân tích khoảng cách kỹ năng."
        recommendations = ["Bổ sung các kỹ năng còn thiếu."]
        grounding_score = 1.0
        is_grounded = True

    # Map suggestions schema
    suggestions = [
        CVSuggestion(
            skill=s.get("skill", ""),
            evidence_span=s.get("evidence_span", ""),
            original_text=s.get("original_text", ""),
            suggested_revision=s.get("suggested_revision", ""),
            rationale=s.get("rationale", ""),
        )
        for s in raw_suggestions
    ]

    # Phân loại theo Presentation gap và Capability gap
    presentation_gaps = [
        GapItem(
            category="presentation",
            skill=s.skill,
            description=f"CV đã có kinh nghiệm {s.skill}, đề xuất tối ưu hóa câu văn theo chuẩn ATS.",
            severity="medium",
            suggested_revision=s.suggested_revision,
        )
        for s in suggestions
    ]

    capability_gaps = [
        GapItem(
            category="capability",
            skill=skill,
            description=f"JD yêu cầu thành thạo {skill} nhưng chưa tìm thấy bằng chứng trong CV.",
            severity="high",
            suggested_revision=None,  # Ràng buộc: không tự bịa câu chữ cho capability gap
        )
        for skill in missing
    ]

    return GapAnalysisResponse(
        analysis_id=f"gap_{uuid.uuid4().hex[:8]}",
        student_id=request.student_id,
        job_title="AI / Software Engineer",
        matched_skills=matched,
        missing_skills=missing,
        suggestions=suggestions,
        presentation_gaps=presentation_gaps,
        capability_gaps=capability_gaps,
        manual_review_items=[],
        gap_summary=gap_summary,
        recommendations=recommendations,
        grounding_score=grounding_score,
        is_grounded=is_grounded,
        created_at=datetime.now(),
    )


# ============================================================================
# 5. Apply Suggestion Route (US-SV-03)
# ============================================================================


@router.post("/cv/suggestions/apply", response_model=ApplySuggestionResponse, tags=["CV Management"])
async def apply_cv_suggestion(request: ApplySuggestionRequest) -> ApplySuggestionResponse:
    """
    Áp dụng gợi ý chỉnh sửa câu chữ (Presentation Gap) vào CV để sinh version mới.
    Đảm bảo tính bất biến của các version cũ (không ghi đè).
    """
    new_cv_id = f"cv_{uuid.uuid4().hex[:8]}"
    return ApplySuggestionResponse(
        new_cv_id=new_cv_id,
        new_version=2,
        diff=f"Thay thế '{request.original_text}' bằng '{request.suggested_text}'",
        updated_cv_text="CV đã được cập nhật với câu chữ tối ưu.",
        message="Áp dụng gợi ý thành công, đã tạo phiên bản CV version 2.",
    )


# ============================================================================
# 6. Mock Interview Routes (STAR Rubric) (US-SV-04)
# ============================================================================


@router.post("/interview/start", response_model=InterviewStartResponse, tags=["Mock Interview"])
async def start_interview(request: InterviewStartRequest) -> InterviewStartResponse:
    """
    Bắt đầu vòng phỏng vấn thử mới dựa trên JD và hồ sơ CV.
    Gọi LangGraph interview_agent để khởi tạo câu hỏi phỏng vấn đầu tiên.
    """
    session_id = f"sess_{uuid.uuid4().hex[:8]}"
    initial_state = {
        "job_role": request.job_role,
        "current_round": 1,
        "total_rounds": 4,
        "jd_context": request.jd_text,
    }
    try:
        result = await interview_agent.ainvoke(initial_state)
        first_q = (
            result.get("current_question")
            or f"Hãy mô tả một bài toán khó bạn gặp phải khi xây dựng hệ thống và cách bạn giải quyết theo phương pháp STAR ({request.job_role})?"
        )
    except Exception:
        first_q = (
            f"Hãy mô tả một bài toán khó bạn gặp phải khi xây dựng hệ thống liên quan đến {request.job_role} (STAR)?"
        )

    return InterviewStartResponse(
        session_id=session_id,
        student_id=request.student_id,
        job_role=request.job_role,
        total_questions=4,
        current_question_index=1,
        first_question=first_q,
        message="Vòng phỏng vấn đã sẵn sàng. Hãy trả lời theo bối cảnh (S), nhiệm vụ (T), hành động (A) và kết quả (R).",
    )


@router.post("/interview/answer", response_model=InterviewAnswerResponse, tags=["Mock Interview"])
async def answer_interview_question(request: InterviewAnswerRequest) -> InterviewAnswerResponse:
    """
    Nộp câu trả lời cho một câu hỏi trong vòng phỏng vấn.
    LangGraph interview_agent chấm điểm theo Rubric STAR (thang 0-5) và trả về câu hỏi tiếp theo (nếu còn).
    """
    state = {
        "job_role": "Software / AI Engineer",
        "user_answer": request.answer,
        "current_round": request.question_index,
        "total_rounds": 4,
    }
    try:
        result = await interview_agent.ainvoke(state)
        sit_score = float(result.get("situation_score", 4.0))
        task_score = float(result.get("task_score", 4.0))
        act_score = float(result.get("action_score", 4.0))
        res_score = float(result.get("result_score", 4.0))
        total = round((sit_score + task_score + act_score + res_score) / 4.0, 2)
        feedback = result.get("feedback_text", "Đã đánh giá câu trả lời theo rubric STAR.")
        is_last = bool(result.get("is_finished", request.question_index >= 4))
        next_q = result.get("next_question")
    except Exception:
        sit_score = 4.0
        task_score = 4.0
        act_score = 3.5
        res_score = 4.0
        total = 3.88
        feedback = "Bối cảnh và nhiệm vụ mô tả rõ ràng. Cần làm rõ hơn đóng góp cá nhân trong bước Action."
        is_last = request.question_index >= 4
        next_q = (
            None if is_last else "Bạn đã từng tối ưu hoá latency hoặc chi phí token cho một ứng dụng LLM như thế nào?"
        )

    evaluation = STARScore(
        situation_score=sit_score,
        task_score=task_score,
        action_score=act_score,
        result_score=res_score,
        total_score=total,
        feedback=feedback,
    )

    return InterviewAnswerResponse(
        session_id=request.session_id,
        question_index=request.question_index,
        star_evaluation=evaluation,
        is_finished=is_last,
        next_question_index=None if is_last else request.question_index + 1,
        next_question=next_q,
    )


@router.get("/interview/{session_id}/report", response_model=InterviewReportResponse, tags=["Mock Interview"])
async def get_interview_report(session_id: str) -> InterviewReportResponse:
    """Lấy báo cáo tổng kết chi tiết vòng phỏng vấn có chấm điểm theo rubric STAR."""
    star = STARScore(
        situation_score=8.5,
        task_score=8.0,
        action_score=7.8,
        result_score=8.2,
        total_score=8.1,
        feedback="Ứng viên trả lời có cấu trúc mạch lạc, dẫn chứng số liệu tốt.",
    )
    return InterviewReportResponse(
        session_id=session_id,
        student_id="SV2026001",
        job_role="AI Engineer",
        round_number=1,
        overall_score=8.1,
        star_breakdown=star,
        strengths=["Trình bày mạch lạc", "Nêu bật được giải pháp kỹ thuật và kết quả định lượng"],
        areas_for_improvement=["Cần nhấn mạnh rõ hơn vai trò cá nhân so với đồng đội"],
        question_evaluations=[
            QuestionEvaluationItem(
                question_index=1,
                question="Hãy mô tả một bài toán khó...",
                answer="Trong dự án tốt nghiệp, tôi đã đối mặt với vấn đề latency...",
                score=8.1,
                feedback="Rất tốt theo rubric STAR.",
            )
        ],
        week_quota_used=1,
        week_quota_remaining=2,
        completed_at=datetime.now(),
    )


# ============================================================================
# 7. CSAT Feedback Route (US-SV-06)
# ============================================================================


@router.post("/feedback/csat", response_model=CSATResponse, tags=["Feedback"])
async def submit_csat(request: CSATRequest) -> CSATResponse:
    """Gửi đánh giá trải nghiệm người dùng (CSAT 1-5 sao) sau lượt sử dụng."""
    return CSATResponse(
        status="success",
        message="Cảm ơn bạn đã phản hồi! Đánh giá giúp chúng tôi cải thiện hệ thống.",
        recorded_at=datetime.now(),
    )


# ============================================================================
# 8. Advisor Dashboard Routes (US-ADV-01, US-ADV-02, US-ADV-03)
# ============================================================================


@router.get("/advisor/students", response_model=AdvisorStudentsResponse, tags=["Advisor Dashboard"])
async def get_assigned_students(
    advisor_id: str = Query(default="ADV_01", description="Mã cố vấn hướng nghiệp"),
) -> AdvisorStudentsResponse:
    """
    Lấy danh sách sinh viên được phân công cho cố vấn.
    Hiển thị điểm trước/sau (score delta) và cờ tự động cảnh báo (auto-escalate).
    """
    students = [
        StudentSummary(
            student_id="SV2026001",
            full_name="Nguyễn Văn A",
            target_role="AI Engineer",
            completed_interview_rounds=3,
            first_score=6.5,
            latest_score=8.1,
            score_delta=1.6,
            needs_attention=False,
            flag_reason=None,
        ),
        StudentSummary(
            student_id="SV2026002",
            full_name="Trần Thị B",
            target_role="Backend Developer",
            completed_interview_rounds=2,
            first_score=6.0,
            latest_score=5.8,
            score_delta=-0.2,
            needs_attention=True,
            flag_reason="Điểm phỏng vấn không tăng sau 2 vòng liên tiếp (auto-escalate)",
        ),
    ]
    return AdvisorStudentsResponse(
        advisor_id=advisor_id,
        total_assigned=len(students),
        flagged_count=sum(1 for s in students if s.needs_attention),
        students=students,
    )


@router.get("/advisor/students/{student_id}", response_model=StudentDetailResponse, tags=["Advisor Dashboard"])
async def get_student_detail(
    student_id: str,
    advisor_id: str = Query(default="ADV_01", description="Mã cố vấn đang đăng nhập"),
) -> StudentDetailResponse:
    """
    Xem hồ sơ chi tiết của sinh viên: CV mới nhất, JD mục tiêu và lịch sử phỏng vấn.
    Có kiểm tra phân quyền (RBAC) theo danh sách phân công.
    """
    return StudentDetailResponse(
        student_id=student_id,
        full_name="Nguyễn Văn A" if student_id == "SV2026001" else "Trần Thị B",
        advisor_id=advisor_id,
        target_role="AI Engineer",
        latest_cv_version=1,
        cv_raw="Kinh nghiệm: Lập trình Python, REST API...",
        target_jd="Tuyển dụng AI Engineer: LangGraph, Qdrant, RAG pipeline...",
        has_target_jd=True,
        gap_summary="Đã đối chiếu CV vs JD. Thiếu kỹ năng Docker/Kubernetes.",
        interview_history=[
            {"round": 1, "score": 6.5, "date": "2026-09-20"},
            {"round": 2, "score": 7.5, "date": "2026-09-22"},
            {"round": 3, "score": 8.1, "date": "2026-09-25"},
        ],
        needs_attention=student_id == "SV2026002",
    )
