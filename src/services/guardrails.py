import logging
import re
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Đường dẫn file SQLite lưu trữ audit log
DEFAULT_AUDIT_DB_PATH = Path("data/audit_log.db")

# Danh sách từ khoá hoặc mẫu câu cấm / prompt injection cơ bản
INJECTION_PATTERNS = [
    r"ignore previous instructions",
    r"system override",
    r"jailbreak",
    r"reveal your system prompt",
    r"drop database",
]


def init_audit_db(db_path: Path = DEFAULT_AUDIT_DB_PATH) -> None:
    """Khởi tạo bảng audit_log trong SQLite nếu chưa tồn tại."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                skill TEXT,
                evidence_span TEXT,
                suggested_revision TEXT,
                grounding_score REAL,
                passed INTEGER NOT NULL,
                review_status TEXT NOT NULL,
                reason TEXT
            )
            """
        )
        conn.commit()


def record_audit_log(
    skill: str,
    evidence_span: str,
    suggested_revision: str,
    grounding_score: float,
    passed: bool,
    review_status: str,
    reason: str = "",
    db_path: Path = DEFAULT_AUDIT_DB_PATH,
) -> int:
    """Ghi một bản ghi kiểm định vào bảng audit_log."""
    try:
        init_audit_db(db_path)
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO audit_log (
                    timestamp, skill, evidence_span, suggested_revision,
                    grounding_score, passed, review_status, reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    datetime.now().isoformat(),
                    skill,
                    evidence_span,
                    suggested_revision,
                    grounding_score,
                    1 if passed else 0,
                    review_status,
                    reason,
                ),
            )
            conn.commit()
            return cursor.lastrowid or 0
    except Exception:
        logger.warning("Lỗi ghi bảng audit_log")
        return -1


def get_audit_logs(limit: int = 50, db_path: Path = DEFAULT_AUDIT_DB_PATH) -> list[dict[str, Any]]:
    """Truy vấn các bản ghi kiểm toán gần nhất từ bảng audit_log."""
    try:
        if not db_path.exists():
            return []
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, timestamp, skill, evidence_span, suggested_revision,
                       grounding_score, passed, review_status, reason
                FROM audit_log
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            )
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    except Exception:
        logger.warning("Lỗi đọc bảng audit_log")
        return []


def check_input_safety(text: str) -> tuple[bool, str]:
    """Kiểm tra an toàn đầu vào (Input Guardrail) - chống Prompt Injection và nội dung độc hại."""
    text_lower = text.lower()
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, text_lower):
            return False, f"Phát hiện nội dung không hợp lệ hoặc nghi vấn injection: {pattern}"
    return True, "Input an toàn"


def check_output_grounding(
    suggestion: dict[str, Any] | str,
    cv_raw: str,
    threshold: float = 0.2,
    log_audit: bool = True,
    db_path: Path = DEFAULT_AUDIT_DB_PATH,
) -> dict[str, Any]:
    """
    (#4) So khớp suggestion với đoạn CV gốc (Grounding Check / Output Guardrail) và ghi vào bảng audit_log.

    Input:
        suggestion: Dict chứa các trường 'skill', 'evidence_span', 'suggested_revision' (hoặc str)
        cv_raw: Toàn văn CV gốc làm tài liệu đối chiếu sự thật
        threshold: Ngưỡng tỷ lệ từ vựng trùng khớp tối thiểu (mặc định 0.2)
        log_audit: Tự động ghi kết quả vào bảng audit_log

    Output:
        {
            "passed": bool,
            "suggestion": dict | str,
            "evidence_span": str,
            "grounding_score": float,
            "review_status": str,  # "passed" hoặc "cần cố vấn xem lại"
            "reason": str
        }
    """
    # 1. Chuẩn hoá cấu trúc suggestion đầu vào
    if isinstance(suggestion, dict):
        s_dict = dict(suggestion)
        skill = str(s_dict.get("skill", "General")).strip()
        evidence_span = str(s_dict.get("evidence_span", "")).strip()
        suggested_text = str(
            s_dict.get("suggested_revision") or s_dict.get("suggested_text") or s_dict.get("original_text") or ""
        ).strip()
    else:
        suggested_text = str(suggestion).strip()
        skill = "General"
        evidence_span = ""
        s_dict = {
            "skill": skill,
            "suggested_revision": suggested_text,
            "evidence_span": evidence_span,
        }

    # 2. Kiểm tra tính hiện diện của evidence_span trong CV gốc
    clean_span = " ".join(evidence_span.split()).lower()
    clean_cv = " ".join(cv_raw.split()).lower()

    span_found = clean_span in clean_cv if clean_span else False

    # 3. Tính điểm bám sát từ vựng (Token Overlap Grounding Score)
    suggested_words = set(re.findall(r"\w+", suggested_text.lower()))
    cv_words = set(re.findall(r"\w+", clean_cv))

    if suggested_words:
        overlap = suggested_words.intersection(cv_words)
        grounding_score = len(overlap) / len(suggested_words)
    else:
        grounding_score = 1.0

    grounding_score = round(float(grounding_score), 2)

    # 4. Quyết định passed hay failed
    # Điều kiện passed:
    # - Nếu có evidence_span: Bắt buộc evidence_span phải có mặt trong CV gốc (100% trích xuất từ CV).
    # - Điểm bám sát từ vựng gợi ý phải đạt ngưỡng threshold.
    # Số liệu trong gợi ý mà CV gốc không có = thêm thông tin mới (PRD mục 6.3 "New Information")
    new_numbers = sorted(
        set(re.findall(r"\d+(?:[.,]\d+)?", suggested_text)) - set(re.findall(r"\d+(?:[.,]\d+)?", clean_cv))
    )

    if evidence_span and not span_found:
        passed = False
        reason = f"evidence_span '{evidence_span[:50]}...' không tìm thấy trong CV gốc."
    elif new_numbers:
        passed = False
        reason = f"Gợi ý thêm số liệu không có trong CV gốc: {', '.join(new_numbers)}."
    elif grounding_score < threshold:
        passed = False
        reason = f"Độ bám sát từ ngữ CV thấp ({grounding_score} < {threshold})."
    else:
        passed = True
        reason = "Bám sát bằng chứng CV gốc."

    # 5. Gắn nhãn review_status: passed=false thì đánh dấu "cần cố vấn xem lại"
    review_status = "passed" if passed else "cần cố vấn xem lại"
    s_dict["review_status"] = review_status
    s_dict["needs_advisor_review"] = not passed

    # 6. Ghi vào bảng audit_log
    if log_audit:
        record_audit_log(
            skill=skill,
            evidence_span=evidence_span,
            suggested_revision=suggested_text,
            grounding_score=grounding_score,
            passed=passed,
            review_status=review_status,
            reason=reason,
            db_path=db_path,
        )

    return {
        "passed": passed,
        "suggestion": s_dict,
        "evidence_span": evidence_span,
        "grounding_score": grounding_score,
        "review_status": review_status,
        "reason": reason,
    }
