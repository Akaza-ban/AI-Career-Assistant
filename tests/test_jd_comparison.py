"""Tests cho tính năng So sánh 2-3 JD với CV của sinh viên bằng LLM (Multi-JD LLM Matching)."""

from unittest.mock import AsyncMock, patch

import pytest

from src.services.jd_recommendation import compare_selected_jds_with_llm
from tests.helpers import ADVISOR, STUDENT, make_docx, upload_cv


@pytest.mark.asyncio
async def test_compare_selected_jds_with_llm_service():
    """Kiểm tra hàm service so sánh 2-3 JD bằng LLM."""
    cv_text = """
    # Nguyễn Văn A - Backend Engineer
    ## Kỹ năng
    - Python, FastAPI, SQL, PostgreSQL, Git, Docker
    ## Kinh nghiệm
    - 1 năm phát triển REST API với Python và PostgreSQL
    """

    jd_ids = ["jd-be-intern", "jd-da-intern"]
    result = await compare_selected_jds_with_llm(cv_text=cv_text, jd_ids=jd_ids)

    comparisons = result["comparisons"]
    assert len(comparisons) == 2

    # Đảm bảo được sắp xếp theo match_score giảm dần
    assert comparisons[0]["match_score"] >= comparisons[1]["match_score"]

    # Đảm bảo đánh số thứ tự rank chuẩn xác
    assert comparisons[0]["rank"] == 1
    assert comparisons[1]["rank"] == 2

    # Kiểm tra các trường dữ liệu đầy đủ
    for item in comparisons:
        assert "jd_id" in item
        assert "title" in item
        assert "match_score" in item
        assert "match_label" in item
        assert "matched_skills" in item
        assert "partial_skills" in item
        assert "missing_skills" in item
        assert "breakdown" in item

    # Backend Developer chắc chắn phải có điểm match cao hơn hoặc bằng Data Analyst với CV chuyên Backend
    be_item = next(c for c in comparisons if c["jd_id"] == "jd-be-intern")
    assert "Python" in be_item["matched_skills"] or "SQL" in be_item["matched_skills"]


@pytest.mark.asyncio
async def test_compare_selected_jds_with_mocked_llm():
    """Kiểm tra luồng có gọi LLM thật sự khi llm_configured() = True."""
    cv_text = "Kỹ năng: Python, SQL. Kinh nghiệm làm việc: 2 năm lập trình backend."
    jd_ids = ["jd-be-intern", "jd-da-intern"]

    mock_llm_response = {
        "requirements": [
            {"id": "r1", "match": 1, "evidence_lines": [1], "note": "Có kinh nghiệm thực tế"},
            {"id": "r2", "match": 0.5, "evidence_lines": [1], "note": "Liệt kê kỹ năng"},
        ],
        "summary": "Ứng viên có nền tảng tốt về backend.",
    }

    with (
        patch("src.services.llm.llm_configured", return_value=True),
        patch("src.agents.gap_analysis.nodes.compare_gap.invoke_json", new=AsyncMock(return_value=mock_llm_response)),
    ):
        result = await compare_selected_jds_with_llm(cv_text=cv_text, jd_ids=jd_ids)
        assert len(result["comparisons"]) == 2
        for item in result["comparisons"]:
            assert item["llm_used"] is True
            assert item["llm_summary"] == "Ứng viên có nền tảng tốt về backend."


@pytest.mark.asyncio
async def test_compare_empty_cv():
    result = await compare_selected_jds_with_llm(cv_text="", jd_ids=["jd-be-intern", "jd-da-intern"])
    assert result["comparisons"] == []
    assert result["common_missing_skills"] == []


@pytest.mark.asyncio
async def test_compare_jds_api_success(client):
    """Kiểm tra gọi API POST /api/v1/jd/compare thành công."""
    payload = {
        "cv_text": "Họ tên: Trần Sinh Viên. Kỹ năng: SQL, Excel, Python. Kinh nghiệm: Thực tập phân tích dữ liệu bán lẻ.",
        "jd_ids": ["jd-da-intern", "jd-ba-intern"],
    }

    response = await client.post("/api/v1/jd/compare", json=payload, headers=STUDENT)
    assert response.status_code == 200, response.text

    data = response.json()
    assert "comparisons" in data
    assert len(data["comparisons"]) == 2
    assert "common_missing_skills" in data
    assert data["total_compared"] == 2

    comps = data["comparisons"]
    # Kiểm tra thứ tự giảm dần theo match_score
    assert comps[0]["match_score"] >= comps[1]["match_score"]
    assert comps[0]["rank"] == 1
    assert comps[1]["rank"] == 2


@pytest.mark.asyncio
async def test_compare_three_jds_api(client):
    """Kiểm tra so sánh tối đa 3 JD cùng lúc và kiểm tra thứ tự sắp xếp 1-2-3."""
    cv_text = """
    Nguyễn Văn B - Frontend Developer
    Kỹ năng: React, TypeScript, HTML, CSS, Next.js, Redux, REST API, Git
    Kinh nghiệm: 1 năm làm việc với Frontend React
    """
    payload = {
        "cv_text": cv_text,
        "jd_ids": ["jd-fe-junior", "jd-be-intern", "jd-da-intern"],
    }
    response = await client.post("/api/v1/jd/compare", json=payload, headers=STUDENT)
    assert response.status_code == 200

    data = response.json()
    comps = data["comparisons"]
    assert len(comps) == 3
    assert data["total_compared"] == 3

    # Kiểm tra thứ tự rank 1 -> 2 -> 3
    assert [c["rank"] for c in comps] == [1, 2, 3]
    assert comps[0]["match_score"] >= comps[1]["match_score"] >= comps[2]["match_score"]

    # Với CV chuyên React/Frontend, Frontend Junior phải xếp hạng 1
    assert comps[0]["jd_id"] == "jd-fe-junior"


@pytest.mark.asyncio
async def test_compare_jds_api_by_cv_version_id(client):
    """Kiểm tra so sánh JD bằng cv_version_id từ CV đã upload lên hệ thống."""
    docx_bytes = make_docx(["Nguyen Van C", "Ky nang: Python, FastAPI, SQL, Docker", "Kinh nghiem: Backend"])
    upload_res = await upload_cv(client, "my_cv.docx", docx_bytes, headers=STUDENT)
    assert upload_res.status_code == 201
    cv_id = upload_res.json()["id"]

    payload = {
        "cv_version_id": cv_id,
        "jd_ids": ["jd-be-intern", "jd-da-intern"],
    }
    response = await client.post("/api/v1/jd/compare", json=payload, headers=STUDENT)
    assert response.status_code == 200

    data = response.json()
    assert data["cv_version_id"] == cv_id
    assert data["cv_label"] is not None
    assert data["cv_name"] == "my_cv.docx"
    assert len(data["comparisons"]) == 2


@pytest.mark.asyncio
async def test_compare_jds_api_validation_count(client):
    """Kiểm tra validation số lượng JD (chấp nhận từ 2 đến 5 JD)."""
    # Test 1: Chỉ chọn 1 JD -> lỗi 422 từ Pydantic min_length
    res_1 = await client.post(
        "/api/v1/jd/compare",
        json={"cv_text": "Python Developer", "jd_ids": ["jd-da-intern"]},
        headers=STUDENT,
    )
    assert res_1.status_code == 422

    # Test 2: Chọn 6 JD -> lỗi 422 từ Pydantic max_length (tối đa 5 JD)
    res_6 = await client.post(
        "/api/v1/jd/compare",
        json={
            "cv_text": "Python Developer",
            "jd_ids": [
                "jd-da-intern",
                "jd-ba-intern",
                "jd-be-intern",
                "jd-fe-junior",
                "jd-devops-intern",
                "jd-qa-intern",
            ],
        },
        headers=STUDENT,
    )
    assert res_6.status_code == 422

    # Test 3: Chọn trùng JD (duplicate) -> lỗi 400
    res_dup = await client.post(
        "/api/v1/jd/compare",
        json={"cv_text": "Python Developer", "jd_ids": ["jd-da-intern", "jd-da-intern"]},
        headers=STUDENT,
    )
    assert res_dup.status_code == 400
    assert res_dup.json()["code"] == "invalid_jd_selection"

    # Test 4: Chọn 4 JD -> thành công 200
    res_4 = await client.post(
        "/api/v1/jd/compare",
        json={
            "cv_text": "Python Developer",
            "jd_ids": ["jd-da-intern", "jd-ba-intern", "jd-be-intern", "jd-fe-junior"],
        },
        headers=STUDENT,
    )
    assert res_4.status_code == 200
    assert len(res_4.json()["comparisons"]) == 4


@pytest.mark.asyncio
async def test_compare_jds_api_missing_jd(client):
    """Kiểm tra chọn JD không tồn tại trong hệ thống."""
    response = await client.post(
        "/api/v1/jd/compare",
        json={"cv_text": "Python Developer", "jd_ids": ["jd-da-intern", "jd-khong-ton-tai-999"]},
        headers=STUDENT,
    )
    assert response.status_code == 404
    assert response.json()["code"] == "jd_not_found"


@pytest.mark.asyncio
async def test_compare_jds_api_no_cv(client):
    """Kiểm tra không truyền CV."""
    response = await client.post(
        "/api/v1/jd/compare",
        json={"jd_ids": ["jd-da-intern", "jd-ba-intern"]},
        headers=STUDENT,
    )
    assert response.status_code == 400
    assert response.json()["code"] == "cv_required"


@pytest.mark.asyncio
async def test_compare_jds_api_forbidden_for_advisor(client):
    """Kiểm tra chỉ sinh viên mới được gọi API này (cố vấn bị 403 Forbidden)."""
    payload = {
        "cv_text": "Kỹ năng: Python, SQL",
        "jd_ids": ["jd-be-intern", "jd-da-intern"],
    }
    response = await client.post("/api/v1/jd/compare", json=payload, headers=ADVISOR)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_comparison_history_api(client):
    """Kiểm tra lưu lịch sử so sánh và truy vấn GET /api/v1/jd/compare/history."""
    payload = {
        "cv_text": "Kỹ năng: Python, SQL. Kinh nghiệm: 1 năm làm REST API.",
        "jd_ids": ["jd-be-intern", "jd-da-intern"],
    }
    # 1. Gọi compare
    compare_res = await client.post("/api/v1/jd/compare", json=payload, headers=STUDENT)
    assert compare_res.status_code == 200
    comp_data = compare_res.json()
    assert "id" in comp_data
    history_id = comp_data["id"]

    # 2. Lấy danh sách lịch sử
    history_res = await client.get("/api/v1/jd/compare/history", headers=STUDENT)
    assert history_res.status_code == 200
    history_items = history_res.json()
    assert len(history_items) >= 1
    found = next((item for item in history_items if item["id"] == history_id), None)
    assert found is not None
    assert found["total_compared"] == 2
    assert len(found["comparisons"]) == 2

    # 3. Xóa lịch sử
    del_res = await client.delete(f"/api/v1/jd/compare/history/{history_id}", headers=STUDENT)
    assert del_res.status_code == 204

    # 4. Kiểm tra lại danh sách lịch sử sau khi xóa
    after_res = await client.get("/api/v1/jd/compare/history", headers=STUDENT)
    assert after_res.status_code == 200
    assert not any(item["id"] == history_id for item in after_res.json())
