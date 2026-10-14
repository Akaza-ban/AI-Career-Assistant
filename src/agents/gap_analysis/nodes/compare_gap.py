import logging
from typing import Any

from src.agents.gap_analysis.state import GapAnalysisState
from src.services.llm import invoke_json, llm_configured
from src.services.skill_matching import (
    IMPORTANCE_LABELS,
    SECTION_LABELS,
    assess_by_rules,
    assessment,
    is_descriptive,
    lift_parents,
    listing_note,
)

logger = logging.getLogger(__name__)

# PRD mục 5.2: tối đa 2 lệnh gọi LLM cho một lượt phân tích
MAX_LLM_CALLS = 2
# Giới hạn độ dài CV gửi cho LLM (CV 1–2 trang thường chỉ 3.000–6.000 ký tự)
MAX_CV_CHARS = 12_000
MAX_SUGGESTIONS = 5


def _cv_block(lines: list[dict[str, Any]]) -> str:
    out, total = [], 0
    for line in lines:
        row = f"[{line['line_no']}|{SECTION_LABELS.get(line['section'], line['section'])}] {line['text']}"
        total += len(row)
        if total > MAX_CV_CHARS:
            break
        out.append(row)
    return "\n".join(out)


def _requirements_block(requirements: list[dict[str, Any]]) -> str:
    rows = []
    for r in requirements:
        aliases = f" — tên tương đương: {', '.join(r['aliases'])}" if r.get("aliases") else ""
        rows.append(f"{r['id']}. {r['name']} ({IMPORTANCE_LABELS[r['importance']]}){aliases}")
    return "\n".join(rows)


async def score_with_llm(
    lines: list[dict[str, Any]],
    requirements: list[dict[str, Any]],
    retrieved_context: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    LLM call #2 (PRD 5.2): chấm Match cho TOÀN BỘ yêu cầu trong một lần gọi (batch) theo bảng anchor,
    kèm dòng bằng chứng và gợi ý diễn đạt lại. Nhận xét tổng quan ghép bằng quy tắc từ bảng cuối (fit_summary)
    để luôn khớp với bảng.
    """
    context = "\n".join(f"- {doc.get('title', '')}: {doc.get('content', '')}" for doc in retrieved_context[:4])
    prompt = (
        "Bạn là chuyên gia tuyển dụng, chấm mức độ đáp ứng yêu cầu JD của một CV theo rubric cố định.\n\n"
        "=== CV (mỗi dòng: [số dòng|mục] nội dung) ===\n"
        f"{_cv_block(lines)}\n\n"
        "=== YÊU CẦU CỦA JD ===\n"
        f"{_requirements_block(requirements)}\n\n"
        "=== BẢNG CHẤM MATCH (bắt buộc tuân theo) ===\n"
        "- 0: yêu cầu không xuất hiện ở bất kỳ đâu trong CV.\n"
        "- 0.5: chỉ xuất hiện dạng liệt kê (mục Kỹ năng, Giới thiệu, Chứng chỉ..., hoặc dòng 'Technologies: ...' / "
        "'Công nghệ: ...' của một dự án), không có câu mô tả đã dùng để làm gì.\n"
        "- 1: có bằng chứng cụ thể trong Kinh nghiệm / Dự án / Học vấn / Hoạt động, mô tả đã dùng kỹ năng để làm gì.\n"
        "Taxonomy: FastAPI/Flask/Django tính là Python; PyTorch/TensorFlow tính là Machine Learning; "
        "React/Next.js/Vue/Angular tính là JavaScript.\n\n"
        "=== TIÊU CHUẨN THAM KHẢO ===\n"
        f"{context or '- Chỉ công nhận kỹ năng có bằng chứng thật trong CV.'}\n\n"
        "=== NHIỆM VỤ ===\n"
        "1. Chấm match (0, 0.5 hoặc 1) cho TỪNG yêu cầu, kèm evidence_lines là số dòng CV làm bằng chứng "
        "(match = 0 thì evidence_lines = []). note: ghi chú ngắn bằng tiếng Việt cho sinh viên đọc (có thể rỗng), "
        "không ghi số điểm match.\n"
        f"2. Viết tối đa {MAX_SUGGESTIONS} gợi ý diễn đạt lại cho các dòng CV thuộc mục Kinh nghiệm / Dự án / Học vấn / "
        "Hoạt động đang là bằng chứng của yêu cầu có match > 0, giúp làm rõ kỹ năng mà JD cần (không viết lại dòng chỉ "
        "liệt kê kỹ năng). RÀNG BUỘC: chỉ đổi cách diễn đạt; KHÔNG thêm số liệu, công cụ, thành tích, "
        "quy mô, tên dự án không có trong dòng gốc; không viết câu cho kỹ năng CV chưa có.\n"
        "CHỈ trả về JSON hợp lệ, không giải thích:\n"
        '{"requirements": [{"id": "r1", "match": 1, "evidence_lines": [5], "note": ""}], '
        '"suggestions": [{"requirement_id": "r1", "line": 5, "rewrite": "...", "reason": "..."}]}'
    )
    # temperature 0: cùng CV và JD thì chấm lại ra cùng kết quả nhiều nhất có thể
    return await invoke_json(prompt, temperature=0.0, timeout=60.0)


def _merge(
    requirement: dict[str, Any],
    rule: dict[str, Any],
    llm_item: dict[str, Any] | None,
    lines_by_no: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    """Kết hợp chấm của LLM với chấm theo quy tắc; quy tắc cưỡng chế bảng anchor để điểm nhất quán giữa các lần chạy."""
    if llm_item is None:
        return rule
    try:
        match = float(llm_item.get("match", 0))
    except (TypeError, ValueError):
        return rule
    if match not in (0, 0.5, 1):
        return rule

    evidence_lines = []
    for n in llm_item.get("evidence_lines") or []:
        try:
            evidence_lines.append(lines_by_no[int(n)])
        except (KeyError, TypeError, ValueError):
            continue
    evidence_lines = [line for line in evidence_lines if not line.get("is_heading")]
    note = str(llm_item.get("note") or "").strip() or None

    if match == 0:
        # CV có ghi rõ tên kỹ năng → không để LLM đánh "Thiếu" (tránh kết luận sai bất lợi cho SV)
        return rule if rule["match"] > 0 else assessment(requirement, 0, None, note or rule["note"], "llm")
    if not evidence_lines:
        # LLM khẳng định có nhưng không chỉ ra được dòng bằng chứng → không tin, dùng kết quả quy tắc
        return rule
    descriptive = [line for line in evidence_lines if is_descriptive(line)]
    if match == 1 and not descriptive:
        # Anchor: bằng chứng chỉ là dòng liệt kê thì tối đa 0.5
        match = 0.5
    line = (descriptive or evidence_lines)[0]
    if match == 0.5:
        # Ghi chú cố định thay cho lời của LLM: nói rõ kỹ năng mới được liệt kê ở đâu và cần thêm gì
        note = listing_note(requirement["name"], line)
    return assessment(requirement, match, line, note or rule["note"], "llm")


async def compare_gap_node(state: GapAnalysisState) -> dict[str, Any]:
    """
    Node 3: Compare — chấm Match từng yêu cầu JD với bằng chứng trong CV (PRD 5.2).
    Dùng LLM một lần cho cả danh sách (batch), kiểm tra chéo bằng quy tắc; không có LLM thì chấm hoàn toàn bằng quy tắc.
    """
    lines = state.get("cv_lines", [])
    requirements = state.get("requirements", [])
    llm_calls = state.get("llm_calls", 0)
    rule_results = {r["id"]: assess_by_rules(r, lines) for r in requirements}

    llm_data: dict[str, Any] | None = None
    if requirements and llm_configured():
        # Thử lại một lần nếu còn trong hạn mức 2 lệnh gọi
        while llm_data is None and llm_calls < MAX_LLM_CALLS:
            llm_calls += 1
            try:
                llm_data = await score_with_llm(lines, requirements, state.get("retrieved_context", []))
            except Exception as e:
                logger.warning("Chấm Match bằng LLM thất bại (lần %d): %s", llm_calls, e)

    llm_items = {}
    if llm_data:
        for item in llm_data.get("requirements") or []:
            if isinstance(item, dict) and item.get("id"):
                llm_items[str(item["id"])] = item

    lines_by_no = {line["line_no"]: line for line in lines}
    assessments = [_merge(r, rule_results[r["id"]], llm_items.get(r["id"]), lines_by_no) for r in requirements]
    assessments = lift_parents(requirements, assessments, lines_by_no)

    matched = [a["skill"] for a in assessments if a["match"] > 0]
    missing = [a["skill"] for a in assessments if a["match"] == 0]
    taxonomy_matches = {a["skill"]: a["note"] for a in assessments if a["note"] and "taxonomy" in a["note"]}
    raw_suggestions = [s for s in (llm_data or {}).get("suggestions") or [] if isinstance(s, dict)]

    return {
        "assessments": assessments,
        "raw_suggestions": raw_suggestions,
        "llm_used": llm_data is not None,
        "llm_calls": llm_calls,
        # Giữ các trường cũ cho script demo và báo cáo eval
        "matched_skills": matched,
        "missing_skills": missing,
        "taxonomy_matches": taxonomy_matches,
    }
