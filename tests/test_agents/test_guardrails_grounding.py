import sqlite3
from pathlib import Path

import pytest

from src.agents.gap_analysis.nodes.verify_grounding import verify_grounding_node
from src.services.guardrails import (
    check_output_grounding,
    get_audit_logs,
    init_audit_db,
)

TEST_DB_PATH = Path("data/test_audit_log.db")


@pytest.fixture(autouse=True)
def setup_test_db():
    """Khởi tạo database test và xóa sạch bản ghi trước mỗi test."""
    init_audit_db(TEST_DB_PATH)
    with sqlite3.connect(TEST_DB_PATH) as conn:
        conn.execute("DELETE FROM audit_log")
        conn.commit()
    yield
    try:
        with sqlite3.connect(TEST_DB_PATH) as conn:
            conn.execute("DELETE FROM audit_log")
            conn.commit()
    except Exception:
        pass


def test_check_output_grounding_passed():
    """Kiểm tra trường hợp suggestion chuẩn bám sát CV gốc -> passed=True."""
    cv_raw = (
        "# Nguyễn Văn A\n"
        "- Kỹ năng: Python, FastAPI, Docker, PostgreSQL\n"
        "- Kinh nghiệm: 2 năm phát triển backend với FastAPI và PostgreSQL. Xây dựng REST API xử lý 1000 req/s."
    )
    suggestion = {
        "skill": "FastAPI",
        "evidence_span": "2 năm phát triển backend với FastAPI và PostgreSQL.",
        "suggested_revision": "Thiết kế và phát triển REST API hiệu năng cao bằng FastAPI và PostgreSQL.",
    }

    result = check_output_grounding(
        suggestion=suggestion,
        cv_raw=cv_raw,
        threshold=0.2,
        log_audit=True,
        db_path=TEST_DB_PATH,
    )

    assert result["passed"] is True
    assert result["evidence_span"] == suggestion["evidence_span"]
    assert result["review_status"] == "passed"
    assert result["grounding_score"] >= 0.2

    # Kiểm tra bản ghi đã được ghi vào bảng audit_log
    logs = get_audit_logs(limit=10, db_path=TEST_DB_PATH)
    assert len(logs) == 1
    assert logs[0]["skill"] == "FastAPI"
    assert logs[0]["passed"] == 1
    assert logs[0]["review_status"] == "passed"


def test_check_output_grounding_failed_marks_advisor_review():
    """Kiểm tra trường hợp suggestion bịa đặt evidence_span -> passed=False, đánh dấu 'cần cố vấn xem lại'."""
    cv_raw = (
        "# Lê Văn B\n- Kỹ năng: HTML, CSS, JavaScript cơ bản.\n- Dự án: Làm trang landing page giới thiệu sản phẩm."
    )
    # Bịa đặt kinh nghiệm Kubernetes chưa từng có trong CV
    fake_suggestion = {
        "skill": "Kubernetes",
        "evidence_span": "Quản trị cụm Kubernetes 50 nodes trên AWS EKS và tối ưu chi phí 30%",
        "suggested_revision": "Triển khai hạ tầng microservices trên Kubernetes EKS chịu tải 50.000 CCU.",
    }

    result = check_output_grounding(
        suggestion=fake_suggestion,
        cv_raw=cv_raw,
        threshold=0.2,
        log_audit=True,
        db_path=TEST_DB_PATH,
    )

    # Ràng buộc Task 4: passed=false thì đánh dấu "cần cố vấn xem lại"
    assert result["passed"] is False
    assert result["evidence_span"] == fake_suggestion["evidence_span"]
    assert result["review_status"] == "cần cố vấn xem lại"
    assert result["suggestion"]["review_status"] == "cần cố vấn xem lại"
    assert result["suggestion"]["needs_advisor_review"] is True

    # Kiểm tra bản ghi audit_log
    logs = get_audit_logs(limit=10, db_path=TEST_DB_PATH)
    assert len(logs) == 1
    assert logs[0]["skill"] == "Kubernetes"
    assert logs[0]["passed"] == 0
    assert logs[0]["review_status"] == "cần cố vấn xem lại"


@pytest.mark.asyncio
async def test_verify_grounding_node_separation():
    """Kiểm tra node verify_grounding phân tách gợi ý hợp lệ và các mục cần cố vấn xem lại."""
    cv_raw = (
        "Trần Văn C - Backend Developer\n"
        "Kinh nghiệm: Lập trình dịch vụ RESTful với Python và Flask. Sử dụng Docker để đóng gói ứng dụng."
    )
    suggestions = [
        {
            "skill": "Python",
            "evidence_span": "Lập trình dịch vụ RESTful với Python và Flask.",
            "suggested_revision": "Vận dụng thành thạo Python và Flask trong xây dựng dịch vụ RESTful.",
        },
        {
            "skill": "Blockchain",
            "evidence_span": "Lập trình Smart Contract bằng Solidity trên mạng Ethereum.",  # Không có trong CV
            "suggested_revision": "Phát triển Smart Contract DeFi trên Ethereum.",
        },
    ]

    state = {
        "cv_raw": cv_raw,
        "suggestions": suggestions,
    }

    result = await verify_grounding_node(state)

    assert "suggestions" in result
    assert "grounding_results" in result
    assert "manual_review_items" in result

    # 1 suggestion hợp lệ, 1 suggestion bị loại ra manual_review_items
    assert len(result["suggestions"]) == 1
    assert result["suggestions"][0]["skill"] == "Python"

    assert len(result["manual_review_items"]) == 1
    assert result["manual_review_items"][0]["skill"] == "Blockchain"
    assert result["manual_review_items"][0]["review_status"] == "cần cố vấn xem lại"

    # Điểm kiểm định tổng thể
    assert result["is_grounded"] is False  # Có 1 mục bị lỗi
    assert 0.0 <= result["grounding_score"] <= 1.0
