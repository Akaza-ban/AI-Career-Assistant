from typing import Any

from src.agents.gap_analysis.state import GapAnalysisState
from src.services.rag import get_rag_service


async def retrieve_context_node(state: GapAnalysisState) -> dict[str, Any]:
    """
    Node 2: Retrieve
    Truy xuất ngữ cảnh tiêu chuẩn ATS và thông tin JD liên quan từ Vector DB (Qdrant) với top-k=3-5.
    """
    parsed_jd = state.get("parsed_jd", {})
    required_skills = parsed_jd.get("required_skills", [])
    jd_raw = state.get("jd_raw", "")

    # Tạo truy vấn tìm kiếm tiêu chuẩn ATS / JD tương ứng
    query = f"{' '.join(required_skills)} {jd_raw[:200]}".strip()

    rag_service = get_rag_service()
    # Lấy top-k = 4 (nằm trong dải 3-5 theo yêu cầu)
    retrieved_docs = rag_service.retrieve_context(query=query, top_k=4)

    return {
        "retrieved_context": retrieved_docs,
    }
