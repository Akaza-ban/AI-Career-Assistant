import logging
from typing import Any

from src.agents.gap_analysis.state import GapAnalysisState
from src.services.jd_parser import fold, split_sections
from src.services.llm import invoke_json, llm_configured
from src.services.rag import get_rag_service
from src.services.skill_matching import MAX_REQUIREMENTS, normalize_requirements

logger = logging.getLogger(__name__)


# Mục của JD dùng để trích yêu cầu; mô tả nhiệm vụ, quyền lợi, giới thiệu công ty không đưa cho AI
_REQUIREMENT_SECTIONS = (("requirements", "Yêu cầu ứng viên"), ("preferred", "Ưu tiên"), ("additional", "Điểm cộng"))
# Phần yêu cầu ngắn hơn mức này (JD không có tiêu đề mục rõ ràng) thì gửi cả JD
_MIN_REQUIREMENT_WORDS = 12


def requirements_text(jd_text: str) -> str:
    """
    Phần yêu cầu của JD. Gửi cả JD thì AI hay lấy luôn nhiệm vụ trong "Mô tả công việc" (viết tài liệu, phối hợp
    nhóm...) làm yêu cầu, số yêu cầu và điểm dao động mạnh giữa các lần chạy.
    """
    sections = split_sections(jd_text)
    parts = [f"{label}:\n" + "\n".join(sections[key]) for key, label in _REQUIREMENT_SECTIONS if sections.get(key)]
    body = "\n\n".join(parts)
    return body if len(body.split()) >= _MIN_REQUIREMENT_WORDS else jd_text


# Yêu cầu chung chung AI hay trả về dù prompt dặn bỏ; CV nào có kinh nghiệm cũng "thiếu" nên làm điểm vô lý
_GENERIC_REQUIREMENTS = {
    "lap trinh co ban",
    "kien thuc lap trinh",
    "kien thuc lap trinh co ban",
    "programming fundamentals",
    "basic programming",
    "programming basics",
    "kien thuc cntt",
    "kien thuc cong nghe thong tin",
    "tu duy logic",
    "logical thinking",
}


def is_generic_requirement(name: str) -> bool:
    return fold(name).strip() in _GENERIC_REQUIREMENTS


async def extract_requirements_with_llm(jd_text: str) -> list[dict[str, Any]]:
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
        "giới thiệu công ty, yêu cầu bằng cấp chung chung, và yêu cầu chung chung không gọi tên kỹ năng cụ thể "
        "(lập trình cơ bản, kiến thức CNTT, tư duy logic...). Ví dụ 'kiến thức cơ bản về lập trình, đặc biệt là "
        "Python' chỉ lấy 'Python'.\n"
        "- Không thêm yêu cầu không có trong JD.\n\n"
        f"JD:\n{requirements_text(jd_text)[:6000]}\n\n"
        "CHỈ trả về JSON hợp lệ, không giải thích:\n"
        '{"requirements": [{"name": "SQL", "importance": "required", "aliases": ["MySQL"]}]}'
    )
    data = await invoke_json(prompt, temperature=0.0, timeout=30.0)
    items = data.get("requirements")
    if not isinstance(items, list):
        raise ValueError("Thiếu trường requirements trong kết quả LLM")
    return [item for item in items if isinstance(item, dict) and not is_generic_requirement(str(item.get("name", "")))]


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
    source = "given" if requirements else "llm"

    if not requirements:
        if llm_configured():
            llm_calls += 1
            try:
                requirements = await extract_requirements_with_llm(jd_raw)
            except Exception as e:
                logger.warning("Trích yêu cầu JD bằng LLM thất bại: %s. Dùng từ điển kỹ năng.", e)
        if not requirements:
            dictionary_skills = state.get("parsed_jd", {}).get("required_skills", [])
            requirements = [{"name": skill, "importance": "required"} for skill in dictionary_skills]
            source = "dictionary"

    requirements = normalize_requirements(requirements)

    names = " ".join(r["name"] for r in requirements)
    retrieved_docs = get_rag_service().retrieve_context(query=f"{names} {jd_raw[:200]}".strip(), top_k=4)

    return {
        "requirements": requirements,
        "requirements_source": source,
        "retrieved_context": retrieved_docs,
        "llm_calls": llm_calls,
    }
