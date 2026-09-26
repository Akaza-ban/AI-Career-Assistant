from typing import Any

from src.agents.gap_analysis.state import GapAnalysisState
from src.services.taxonomy import apply_taxonomy_matching


async def compare_gap_node(state: GapAnalysisState) -> dict[str, Any]:
    """
    Node 3: Compare
    So sánh khoảng cách giữa CV và JD có áp dụng bảng Taxonomy tĩnh.
    Phân loại chính xác matched_skills và missing_skills.
    """
    parsed_cv = state.get("parsed_cv", {})
    parsed_jd = state.get("parsed_jd", {})

    cv_skills = parsed_cv.get("skills", [])
    jd_skills = parsed_jd.get("required_skills", [])

    matched_skills, missing_skills, taxonomy_matches = apply_taxonomy_matching(
        cv_skills=cv_skills,
        jd_skills=jd_skills,
    )

    # Tạo tóm tắt khoảng cách kỹ năng
    summary_parts = [
        f"Kỹ năng đã đáp ứng ({len(matched_skills)}): {', '.join(matched_skills) if matched_skills else 'Chưa có'}.",
        f"Kỹ năng còn thiếu ({len(missing_skills)}): {', '.join(missing_skills) if missing_skills else 'Không có'}.",
    ]
    if taxonomy_matches:
        taxonomy_notes = "; ".join([f"{k}: {v}" for k, v in taxonomy_matches.items()])
        summary_parts.append(f"Ghi nhận tương đương qua Taxonomy: {taxonomy_notes}.")

    gap_summary = " ".join(summary_parts)

    return {
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "taxonomy_matches": taxonomy_matches,
        "gap_summary": gap_summary,
    }
