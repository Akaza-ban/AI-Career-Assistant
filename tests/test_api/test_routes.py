import pytest


@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_chat_empty_message(client):
    response = await client.post("/api/v1/chat", json={"message": ""})
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_agent_status(client):
    response = await client.get("/api/v1/status")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "llm_provider" in data
    assert "model_name" in data


@pytest.mark.asyncio
async def test_cv_upload(client):
    payload = {
        "student_id": "SV2026001",
        "filename": "my_cv.pdf",
        "cv_text": "Họ tên: Nguyễn Văn A. Kỹ năng: Python, FastAPI, Docker, SQL.",
    }
    response = await client.post("/api/v1/cv/upload", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "cv_id" in data
    assert data["version"] == 1
    assert data["student_id"] == "SV2026001"
    assert "parsed_cv" in data


@pytest.mark.asyncio
async def test_gap_analysis(client):
    payload = {
        "student_id": "SV2026001",
        "cv_raw": "Kinh nghiệm 1 năm Python, xây dựng REST API bằng FastAPI, cơ bản về Docker.",
        "jd_raw": "Tuyển dụng AI Engineer: Thành thạo Python, LangGraph, Qdrant Vector DB, kinh nghiệm triển khai RAG và tối ưu LLM.",
    }
    response = await client.post("/api/v1/gap-analysis", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "matched_skills" in data
    assert "presentation_gaps" in data
    assert "capability_gaps" in data
    assert "is_grounded" in data


@pytest.mark.asyncio
async def test_gap_analysis_short_jd_error(client):
    payload = {
        "student_id": "SV2026001",
        "cv_raw": "Kinh nghiệm Python.",
        "jd_raw": "JD quá ngắn",
    }
    response = await client.post("/api/v1/gap-analysis", json=payload)
    assert response.status_code == 422  # Pydantic min_length=50 validation


@pytest.mark.asyncio
async def test_interview_flow(client):
    # 1. Start interview
    start_payload = {
        "student_id": "SV2026001",
        "job_role": "AI Engineer",
        "jd_text": "Tuyển dụng AI Engineer...",
    }
    start_res = await client.post("/api/v1/interview/start", json=start_payload)
    assert start_res.status_code == 200
    start_data = start_res.json()
    session_id = start_data["session_id"]
    assert "first_question" in start_data

    # 2. Answer question
    answer_payload = {
        "session_id": session_id,
        "question_index": 1,
        "answer": "Bối cảnh: Tôi xây dựng pipeline RAG. Hành động: Tôi dùng LangGraph và Qdrant. Kết quả: Giảm 40% latency.",
    }
    ans_res = await client.post("/api/v1/interview/answer", json=answer_payload)
    assert ans_res.status_code == 200
    ans_data = ans_res.json()
    assert "star_evaluation" in ans_data

    # 3. Get report
    report_res = await client.get(f"/api/v1/interview/{session_id}/report")
    assert report_res.status_code == 200
    report_data = report_res.json()
    assert "overall_score" in report_data
    assert "star_breakdown" in report_data


@pytest.mark.asyncio
async def test_csat_feedback(client):
    payload = {
        "student_id": "SV2026001",
        "activity_type": "gap_analysis",
        "rating": 5,
        "feedback_text": "Công cụ gợi ý rất hữu ích!",
    }
    response = await client.post("/api/v1/feedback/csat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"


@pytest.mark.asyncio
async def test_advisor_dashboard(client):
    # Get students
    res = await client.get("/api/v1/advisor/students?advisor_id=ADV_01")
    assert res.status_code == 200
    data = res.json()
    assert "students" in data
    assert len(data["students"]) > 0

    # Get student detail
    student_id = data["students"][0]["student_id"]
    detail_res = await client.get(f"/api/v1/advisor/students/{student_id}")
    assert detail_res.status_code == 200
    detail_data = detail_res.json()
    assert detail_data["student_id"] == student_id
