import asyncio
import json
import logging
import re
from typing import Any

from src.agents.gap_analysis.state import GapAnalysisState
from src.config import get_settings

logger = logging.getLogger(__name__)


def rewrite_evidence_sentence_fallback(evidence_span: str, skill: str) -> str:
    """
    Quy tắc dự phòng (Fallback): Diễn đạt lại câu văn gốc trong CV theo template chuẩn ATS.
    Được dùng khi không có API key LLM hoặc khi LLM gặp sự cố mạng / timeout.
    """
    clean_span = evidence_span.strip()

    # Nếu câu gốc chỉ là danh sách liệt kê đơn thuần (VD: "Kỹ năng: Python, Flask...")
    if any(clean_span.lower().startswith(prefix) for prefix in ["kỹ năng:", "skills:", "ngôn ngữ:"]):
        return (
            f"Vận dụng thành thạo {skill} trong quá trình xây dựng và phát triển các thành phần dịch vụ backend "
            f"(dựa trên năng lực cốt lõi: {clean_span})."
        )

    # Nếu câu gốc đã có mô tả kinh nghiệm
    return (
        f"Chủ động áp dụng {skill} vào triển khai dự án thực tế; "
        f"chuẩn hóa cấu trúc mã nguồn và tối ưu hiệu năng: '{clean_span}'."
    )


async def rewrite_with_llm(
    skill: str,
    evidence_span: str,
    jd_context: str,
    taxonomy_note: str | None = None,
) -> tuple[str, str]:
    """
    Sử dụng LLM (Groq / OpenRouter / OpenAI) để tối ưu câu văn chứa evidence_span.
    Trả về (suggested_revision, rationale).
    RÀNG BUỘC: Không bịa thông tin mới ngoài evidence_span.
    """
    settings = get_settings()
    api_key, _ = settings.get_llm_credentials()

    # Kiểm tra nếu chưa cấu hình API key thật (hoặc là placeholder), dùng fallback
    is_placeholder = any(
        api_key.startswith(p) for p in ["your-", "sk-dummy", "gsk_your-", "sk-or-v1-your", "gsk_your_"]
    )
    if not api_key or is_placeholder:
        fallback_rev = rewrite_evidence_sentence_fallback(evidence_span, skill)
        rationale = f"Tối ưu câu văn chứa từ khóa '{skill}' theo chuẩn ATS dựa trên đúng câu gốc trong CV."
        if taxonomy_note:
            rationale += f" [Taxonomy: {taxonomy_note}]"
        return fallback_rev, rationale

    try:
        llm = settings.get_chat_model(temperature=0.2)

        prompt = (
            f"Bạn là chuyên gia tư vấn tối ưu hóa hồ sơ CV theo chuẩn ATS.\n\n"
            f"BỐI CẢNH:\n"
            f"- Kỹ năng cần làm nổi bật: {skill}\n"
            f'- Trích đoạn nguyên văn từ CV gốc (evidence span): "{evidence_span}"\n'
            f"- Ngữ cảnh JD tuyển dụng: {jd_context[:250]}\n\n"
            f"YÊU CẦU:\n"
            f"Hãy viết lại 1 câu bullet point ngắn gọn (1-2 câu) làm nổi bật kỹ năng '{skill}' "
            f"bằng động từ hành động mạnh mẽ và văn phong chuyên nghiệp.\n\n"
            f"RÀNG BUỘC BẮT BUỘC:\n"
            f"1. Tuyệt đối CHỈ dựa trên nội dung có thật trong trích đoạn CV ở trên.\n"
            f"2. KHÔNG ĐƯỢC BỊA ĐẶT số liệu, tên công ty hay dự án mà câu gốc không có.\n"
            f"3. Trả về định dạng JSON thuần túy dạng:\n"
            f'{{"suggested_revision": "câu viết lại", "rationale": "lý do cải thiện"}}'
        )

        response = await asyncio.wait_for(llm.ainvoke(prompt), timeout=12.0)
        content = response.content.strip()

        # Parse JSON output từ LLM
        json_match = re.search(r"\{.*?\}", content, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group(0))
            suggested_rev = data.get("suggested_revision", "").strip()
            rationale = data.get("rationale", "").strip()
            if suggested_rev:
                if taxonomy_note:
                    rationale = f"{rationale} [Taxonomy: {taxonomy_note}]".strip()
                return suggested_rev, rationale or f"Tối ưu từ khóa '{skill}' theo chuẩn ATS."

    except Exception as e:
        logger.warning(f"LLM rewrite error for skill '{skill}': {e}. Falling back to rule-based template.")

    # Fallback khi gặp lỗi mạng / parse lỗi
    fallback_rev = rewrite_evidence_sentence_fallback(evidence_span, skill)
    rationale = f"Tối ưu câu văn chứa từ khóa '{skill}' theo chuẩn ATS dựa trên đúng câu gốc trong CV."
    if taxonomy_note:
        rationale += f" [Taxonomy: {taxonomy_note}]"
    return fallback_rev, rationale


async def generate_suggestions_node(state: GapAnalysisState) -> dict[str, Any]:
    """
    Node 4: Generate (Tích hợp AI / LLM)
    Sinh các gợi ý tối ưu câu chữ bằng LLM, mỗi gợi ý bắt buộc kèm evidence_span trích từ CV gốc.
    Tuân thủ ràng buộc: Chỉ diễn đạt lại nội dung có trong CV, không bịa thêm thông tin.
    """
    cv_raw = state.get("cv_raw", "")
    jd_raw = state.get("jd_raw", "")
    parsed_cv = state.get("parsed_cv", {})
    evidence_spans: dict[str, str] = parsed_cv.get("evidence_spans", {})
    matched_skills = state.get("matched_skills", [])
    missing_skills = state.get("missing_skills", [])
    taxonomy_matches = state.get("taxonomy_matches", {})

    # Chuẩn bị danh sách kỹ năng có evidence_span
    tasks_info = []
    for skill in matched_skills:
        span = evidence_spans.get(skill)
        if not span:
            for line in cv_raw.splitlines():
                if skill.lower() in line.lower():
                    span = line.strip()
                    break

        if span:
            tax_note = taxonomy_matches.get(skill)
            tasks_info.append((skill, span, tax_note))

    # Chạy song song các tác vụ gọi LLM rewrite cho các kỹ năng đã match
    tasks = [
        rewrite_with_llm(skill=skill, evidence_span=span, jd_context=jd_raw, taxonomy_note=tax_note)
        for skill, span, tax_note in tasks_info
    ]
    results = await asyncio.gather(*tasks)

    suggestions = []
    for (skill, span, _), (suggested_text, rationale) in zip(tasks_info, results):
        suggestions.append(
            {
                "skill": skill,
                "evidence_span": span,
                "original_text": span,
                "suggested_revision": suggested_text,
                "rationale": rationale,
            }
        )

    # Khuyến nghị hành động (Recommendations)
    recommendations = []
    if suggestions:
        recommendations.append(
            f"Áp dụng {len(suggestions)} gợi ý do AI đề xuất để tối ưu hóa từ khóa và chuẩn ATS cho các kỹ năng bạn đã có."
        )

    if missing_skills:
        recommendations.append(
            f"Bổ sung hoặc học thêm các kỹ năng JD yêu cầu nhưng chưa có trong hồ sơ: {', '.join(missing_skills)}. "
            f"(Lưu ý: Không tự ý thêm vào CV nếu chưa có kinh nghiệm thực tế)."
        )

    # Kiểm tra tính grounding: 100% evidence_span phải trích xuất từ cv_raw
    valid_spans_count = sum(1 for s in suggestions if s["evidence_span"] in cv_raw)
    grounding_score = round(valid_spans_count / len(suggestions), 2) if suggestions else 1.0
    is_grounded = grounding_score >= 0.8

    return {
        "suggestions": suggestions,
        "recommendations": recommendations,
        "grounding_score": grounding_score,
        "is_grounded": is_grounded,
    }
