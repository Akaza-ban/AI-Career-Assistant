import logging
from typing import Any

from src.agents.gap_analysis.state import GapAnalysisState
from src.services.llm import invoke_json, llm_configured
from src.services.providers.gateway import provider_scope
from src.services.rag import get_rag_service
from src.services.skill_matching import MAX_REQUIREMENTS, normalize_requirements

logger = logging.getLogger(__name__)


def _extract_prompt(jd_text: str) -> str:
    """LLM call #1 (PRD 5.2): trích yêu cầu kỹ năng từ JD tự dán và gán mức Required / Preferred / Additional."""
    prompt = (
        "Bạn là chuyên gia tuyển dụng. Hãy trích xuất các yêu cầu về kỹ năng, kiến thức, công cụ, ngoại ngữ "
        f"từ bản mô tả công việc (JD) dưới đây, tối đa {MAX_REQUIREMENTS} yêu cầu, và phân loại mức độ:\n"
        "- required: yêu cầu bắt buộc / chính\n"
        "- preferred: ưu tiên\n"
        "- additional: có lợi, không bắt buộc (điểm cộng)\n\n"
        "Quy tắc:\n"
        "- Mỗi yêu cầu là một tên ngắn gọn (1–4 từ), giữ nguyên thuật ngữ trong JD.\n"
        "- aliases: vài tên gọi tương đương hoặc công cụ cụ thể thể hiện yêu cầu đó (có thể rỗng).\n"
        "- Chỉ lấy yêu cầu kiểm chứng được bằng nội dung CV: kỹ năng chuyên môn, công cụ, kiến thức, ngoại ngữ, "
        "chứng chỉ.\n"
        "- Bỏ qua: phẩm chất / thái độ (năng động, ham học hỏi, chăm chỉ...), mô tả nhiệm vụ của vị trí, quyền lợi, "
        "giới thiệu công ty, yêu cầu bằng cấp chung chung.\n"
        "- Không thêm yêu cầu không có trong JD.\n\n"
        f"JD:\n{jd_text[:6000]}\n\n"
        "CHỈ trả về JSON hợp lệ, không giải thích:\n"
        '{"requirements": [{"name": "SQL", "importance": "required", "aliases": ["MySQL"]}]}'
    )
    return prompt


async def extract_requirements_with_llm(jd_text: str) -> list[dict[str, Any]]:
    with provider_scope() as scope:
        jd_wire = scope.mask_payload(jd_text[:6000])
        data = await invoke_json(scope.prepared(_extract_prompt(jd_wire)), temperature=0.0, timeout=30.0)
    items = data.get("requirements")
    if not isinstance(items, list):
        raise ValueError("Thiếu trường requirements trong kết quả LLM")
    return [item for item in items if isinstance(item, dict)]


async def retrieve_context_node(state: GapAnalysisState) -> dict[str, Any]:
    """
    Node 2: Retrieve — tra cứu yêu cầu vị trí.
    - JD thư viện: dùng danh sách yêu cầu đã chuẩn hoá sẵn (không gọi LLM).
    - JD tự dán: trích yêu cầu bằng LLM (call #1), dự phòng bằng từ điển kỹ năng (mọi kỹ năng coi là Required).
    Đồng thời truy xuất tiêu chuẩn ATS / JD liên quan từ kho tri thức (top-k = 3–5) làm ngữ cảnh cho bước so sánh.
    """
    jd_raw = state.get("jd_raw", "")
    llm_calls = state.get("llm_calls", 0)
    requirements = state.get("requirements") or []

    if not requirements:
        if llm_configured():
            llm_calls += 1
            try:
                requirements = await extract_requirements_with_llm(jd_raw)
            except Exception:
                logger.warning("Trích yêu cầu JD bằng LLM thất bại. Dùng từ điển kỹ năng.")
        if not requirements:
            dictionary_skills = state.get("parsed_jd", {}).get("required_skills", [])
            requirements = [{"name": skill, "importance": "required"} for skill in dictionary_skills]

    requirements = normalize_requirements(requirements)

    names = " ".join(r["name"] for r in requirements)
    retrieved_docs = get_rag_service().retrieve_context(query=f"{names} {jd_raw[:200]}".strip(), top_k=4)

    return {
        "requirements": requirements,
        "retrieved_context": retrieved_docs,
        "llm_calls": llm_calls,
    }
