import uuid
from typing import Any

from src.agents.gap_analysis.state import GapAnalysisState
from src.services.fit_summary import compose_summary
from src.services.skill_matching import SECTION_LABELS, compute_score, is_descriptive

MAX_SUGGESTIONS = 5


def build_suggestions(
    raw_suggestions: list[dict[str, Any]],
    assessments: list[dict[str, Any]],
    lines: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Chuẩn hoá gợi ý viết lại từ LLM. Chỉ giữ gợi ý trỏ tới một dòng mô tả việc đã làm có thật trong CV
    (bỏ dòng liệt kê kỹ năng), thuộc yêu cầu CV đã đáp ứng (Match > 0) — không bao giờ tạo câu mới cho kỹ năng
    CV chưa có (PRD mục 6.1).
    """
    by_id = {a["id"]: a for a in assessments}
    lines_by_no = {line["line_no"]: line for line in lines}
    result: list[dict[str, Any]] = []
    used_lines: set[int] = set()
    for raw in raw_suggestions:
        requirement = by_id.get(str(raw.get("requirement_id", "")))
        try:
            line = lines_by_no[int(raw.get("line"))]
        except (KeyError, TypeError, ValueError):
            continue
        rewrite = str(raw.get("rewrite") or "").strip()
        if not requirement or requirement["match"] == 0 or not is_descriptive(line) or line["line_no"] in used_lines:
            continue
        if not rewrite or rewrite.lower() == line["text"].lower():
            continue
        used_lines.add(line["line_no"])
        result.append(
            {
                "id": f"sg_{uuid.uuid4().hex[:12]}",
                "skill": requirement["skill"],
                "line_no": line["line_no"],
                "section_label": SECTION_LABELS.get(line["section"], line["section"]),
                # evidence_span/original_text: nguyên văn dòng CV; verify_grounding đối chiếu với CV gốc
                "evidence_span": line["text"],
                "original_text": line["text"],
                "suggested_revision": rewrite,
                "rationale": str(raw.get("reason") or "").strip(),
            }
        )
        if len(result) >= MAX_SUGGESTIONS:
            break
    return result


def fallback_summary(assessments: list[dict[str, Any]], score: float | None) -> str:
    matched = [a["skill"] for a in assessments if a["status"] == "matched"]
    partial = [a["skill"] for a in assessments if a["status"] == "partial"]
    missing = [a["skill"] for a in assessments if a["status"] == "missing"]
    parts = []
    if score is not None:
        parts.append(f"CV hiện đáp ứng {score:g}% tổng trọng số các yêu cầu được hệ thống trích xuất từ JD.")
    if matched:
        parts.append(f"Có bằng chứng cụ thể cho: {', '.join(matched)}.")
    if partial:
        parts.append(f"Mới chỉ liệt kê, chưa có mô tả sử dụng: {', '.join(partial)}.")
    if missing:
        parts.append(f"Chưa tìm thấy trong CV: {', '.join(missing)}.")
    if score is not None and score >= 80.0:
        parts.append(
            "Hồ sơ có độ tương thích từ khóa rất cao; trên thực tế tuyển dụng, vòng phỏng vấn sẽ đào sâu kiểm chứng năng lực thực tế."
        )
    elif score is not None and score <= 30.0:
        parts.append(
            "Độ tương thích hiện còn khoảng cách với JD đặc thù này; hãy dựa vào nền tảng sẵn có để hoàn thiện thêm các kỹ năng cốt lõi."
        )
    return " ".join(parts)


async def generate_suggestions_node(state: GapAnalysisState) -> dict[str, Any]:
    """
    Node 4: Generate — chuẩn hoá gợi ý diễn đạt lại (đã sinh cùng lệnh gọi LLM ở bước so sánh để giữ hạn mức
    2 lệnh gọi/lượt), tính CV–JD Matching Score và soạn khuyến nghị.
    """
    assessments = state.get("assessments", [])
    suggestions = build_suggestions(state.get("raw_suggestions", []), assessments, state.get("cv_lines", []))
    score, breakdown = compute_score(assessments)

    missing = [a["skill"] for a in assessments if a["status"] == "missing"]
    partial = [a["skill"] for a in assessments if a["status"] == "partial"]
    recommendations = []
    if partial:
        recommendations.append(
            f"Bổ sung mô tả dự án hoặc kinh nghiệm thật cho các kỹ năng mới chỉ được liệt kê: {', '.join(partial)}."
        )
    if missing:
        # PRD 5.2: không khuyên thêm từ khoá còn thiếu vào CV; đây là kỹ năng cần học thêm nếu SV chưa có
        recommendations.append(
            f"Kỹ năng JD yêu cầu nhưng chưa thấy trong CV: {', '.join(missing)}. Nếu bạn thực sự đã làm, hãy bổ sung "
            "kèm bằng chứng; nếu chưa, đây là kỹ năng nên học thêm."
        )

    llm_summary = state.get("llm_summary")
    summary = (
        llm_summary or compose_summary(assessments, state.get("cv_lines", [])) or fallback_summary(assessments, score)
    )

    return {
        "suggestions": suggestions,
        "recommendations": recommendations,
        "match_score": score,
        "score_breakdown": breakdown,
        "gap_summary": summary,
    }
