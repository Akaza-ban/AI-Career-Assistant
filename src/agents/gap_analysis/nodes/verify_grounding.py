from typing import Any

from src.agents.gap_analysis.state import GapAnalysisState
from src.services.guardrails import check_output_grounding


async def verify_grounding_node(state: GapAnalysisState) -> dict[str, Any]:
    """Node kiểm định chất lượng output (Output Guardrail - Hallucination/Grounding check)."""
    gap_summary = state.get("gap_summary", "")
    recommendations = state.get("recommendations", [])
    context = f"{state.get('cv_raw', '')}\n{state.get('jd_raw', '')}"

    output_to_verify = f"{gap_summary}\n" + "\n".join(recommendations)

    # Kiểm tra tính grounding với input gốc
    is_grounded, grounding_score = check_output_grounding(output_to_verify, context)

    return {
        "grounding_score": grounding_score,
        "is_grounded": is_grounded,
    }
