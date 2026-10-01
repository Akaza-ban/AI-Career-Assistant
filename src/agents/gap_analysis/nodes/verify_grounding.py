import logging
from typing import Any

from src.agents.gap_analysis.state import GapAnalysisState
from src.services.guardrails import check_output_grounding

logger = logging.getLogger(__name__)


async def verify_grounding_node(state: GapAnalysisState) -> dict[str, Any]:
    """
    Node kiểm định chất lượng output (Output Guardrail - Hallucination/Grounding check).
    Input: suggestion từ T2 + CV gốc.
    Output: {passed, suggestion, evidence_span} — passed=false thì đánh dấu 'cần cố vấn xem lại'.
    Yêu cầu: so khớp suggestion với đoạn CV gốc; ghi vào bảng audit_log.
    """
    suggestions = state.get("suggestions", [])
    cv_raw = state.get("cv_raw", "")

    grounding_results: list[dict[str, Any]] = []
    verified_suggestions: list[dict[str, Any]] = []
    manual_review_items: list[dict[str, Any]] = []

    for item in suggestions:
        # Gọi hàm kiểm định so khớp với CV gốc và tự động ghi vào audit_log
        result = check_output_grounding(
            suggestion=item,
            cv_raw=cv_raw,
            log_audit=True,
        )
        grounding_results.append(result)

        updated_suggestion = result["suggestion"]

        if result["passed"]:
            verified_suggestions.append(updated_suggestion)
        else:
            # passed=false thì đánh dấu "cần cố vấn xem lại"
            updated_suggestion["review_status"] = "cần cố vấn xem lại"
            updated_suggestion["needs_advisor_review"] = True
            manual_review_items.append(updated_suggestion)

    total_count = len(grounding_results)
    if total_count > 0:
        passed_count = sum(1 for r in grounding_results if r["passed"])
        avg_score = sum(r.get("grounding_score", 0.0) for r in grounding_results) / total_count
        is_grounded = passed_count == total_count
    else:
        avg_score = 1.0
        is_grounded = True

    return {
        "suggestions": verified_suggestions,
        "grounding_results": grounding_results,
        "manual_review_items": manual_review_items,
        "grounding_score": round(avg_score, 2),
        "is_grounded": is_grounded,
    }
