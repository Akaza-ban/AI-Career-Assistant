"""Kiểm thử tính năng ánh xạ lộ trình học tập roadmap.sh cho kỹ năng thiếu (US-SV-02, US-SV-05)."""

from fastapi.testclient import TestClient

from src.main import app
from src.services.roadmap import DEFAULT_ROADMAP_URL, get_roadmap_info, get_roadmap_url
from src.services.skill_matching import assessment


def test_get_roadmap_url_exact_and_variations():
    """Kiểm tra ánh xạ chính xác và các biến thể tên kỹ năng."""
    assert get_roadmap_url("Python") == "https://roadmap.sh/python"
    assert get_roadmap_url("python") == "https://roadmap.sh/python"
    assert get_roadmap_url("Python (cơ bản)") == "https://roadmap.sh/python"
    assert get_roadmap_url("Docker") == "https://roadmap.sh/docker"
    assert get_roadmap_url("ReactJS") == "https://roadmap.sh/react"
    assert get_roadmap_url("FastAPI") == "https://roadmap.sh/python"
    assert get_roadmap_url("PostgreSQL") == "https://roadmap.sh/postgresql"
    assert get_roadmap_url("Postgres") == "https://roadmap.sh/postgresql"
    assert get_roadmap_url("Spring Boot") == "https://roadmap.sh/spring-boot"
    assert get_roadmap_url("DevOps") == "https://roadmap.sh/devops"
    assert get_roadmap_url("Git") == "https://roadmap.sh/git-github"


def test_get_roadmap_url_fallback():
    """Kỹ năng không xác định hoặc chuỗi rỗng trả về trang roadmaps mặc định."""
    assert get_roadmap_url("") == DEFAULT_ROADMAP_URL
    assert get_roadmap_url(None) == DEFAULT_ROADMAP_URL
    assert get_roadmap_url("Kỹ năng hiếm không có trong danh mục 12345") == DEFAULT_ROADMAP_URL


def test_get_roadmap_info():
    """Kiểm tra hàm get_roadmap_info trả về đầy đủ metadata và phân biệt kỹ năng IT / Non-IT."""
    info_matched = get_roadmap_info("Docker")
    assert info_matched["skill"] == "Docker"
    assert info_matched["roadmap_url"] == "https://roadmap.sh/docker"
    assert info_matched["is_matched"] is True
    assert info_matched["is_it_supported"] is True
    assert "roadmap.sh" in info_matched["message"]

    info_non_it = get_roadmap_info("Kế toán tài chính")
    assert info_non_it["skill"] == "Kế toán tài chính"
    assert info_non_it["roadmap_url"] == DEFAULT_ROADMAP_URL
    assert info_non_it["is_matched"] is False
    assert info_non_it["is_it_supported"] is False
    assert "chỉ hỗ trợ các lĩnh vực liên quan đến Công nghệ thông tin" in info_non_it["message"]


def test_assessment_includes_roadmap_url():
    """Kiểm tra hàm assessment gán trường roadmap_url và cờ is_it_supported vào kết quả."""
    req = {"id": "r1", "name": "Docker", "importance": "required"}
    result = assessment(req, match=0, evidence_line=None, note=None, source="rule")
    assert result["status"] == "missing"
    assert result["roadmap_url"] == "https://roadmap.sh/docker"
    assert result["is_it_supported"] is True

    req_non_it = {"id": "r2", "name": "Kỹ năng kế toán", "importance": "required"}
    result_non_it = assessment(req_non_it, match=0, evidence_line=None, note=None, source="rule")
    assert result_non_it["status"] == "missing"
    assert result_non_it["is_it_supported"] is False
    assert "chỉ hỗ trợ các lĩnh vực liên quan đến Công nghệ thông tin" in result_non_it["roadmap_message"]


def test_api_skill_roadmap_endpoint():
    """Kiểm tra gọi API GET /api/v1/skills/roadmap cho cả kỹ năng IT và kỹ năng Non-IT."""
    client = TestClient(app)
    # 1. Kỹ năng IT
    response = client.get("/api/v1/skills/roadmap", params={"skill": "PostgreSQL"})
    assert response.status_code == 200
    data = response.json()
    assert data["skill"] == "PostgreSQL"
    assert data["roadmap_url"] == "https://roadmap.sh/postgresql"
    assert data["is_matched"] is True
    assert data["is_it_supported"] is True

    # 2. Kỹ năng Non-IT
    response_non_it = client.get("/api/v1/skills/roadmap", params={"skill": "Kế toán"})
    assert response_non_it.status_code == 200
    data_non_it = response_non_it.json()
    assert data_non_it["skill"] == "Kế toán"
    assert data_non_it["is_it_supported"] is False
    assert "chỉ hỗ trợ các lĩnh vực liên quan đến Công nghệ thông tin" in data_non_it["message"]
