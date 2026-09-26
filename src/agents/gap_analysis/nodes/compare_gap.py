import asyncio
import json
import logging
import re
from typing import Any

from src.agents.gap_analysis.state import GapAnalysisState
from src.config import get_settings
from src.services.taxonomy import apply_taxonomy_matching

logger = logging.getLogger(__name__)


async def compare_with_llm(
    cv_text: str,
    jd_text: str,
    cv_skills: list[str],
    jd_skills: list[str],
    retrieved_context: list[dict[str, Any]] | None = None,
) -> tuple[list[str], list[str], dict[str, str], str] | None:
    """
    Sử dụng LLM (Groq / OpenRouter / OpenAI) để so sánh chuyên sâu (Semantic Gap Analysis):
    - Phân tích đối chiếu năng lực thực tế của ứng viên trong CV với từng kỹ năng JD yêu cầu.
    - Áp dụng các quy tắc taxonomy bắt buộc (FastAPI/Flask/Django -> Python, PyTorch/TF -> ML, React/Next.js -> JS).
    - Tích hợp tiêu chuẩn ATS & tiêu chí đánh giá từ Vector DB / Qdrant (retrieved_context).
    - Phân loại chính xác matched_skills, missing_skills, giải thích taxonomy_matches và viết gap_summary.
    """
    settings = get_settings()
    api_key, _ = settings.get_llm_credentials()

    is_placeholder = any(
        api_key.startswith(p) for p in ["your-", "sk-dummy", "gsk_your-", "sk-or-v1-your", "gsk_your_"]
    )
    if not api_key or is_placeholder:
        return None

    try:
        llm = settings.get_chat_model(temperature=0.1)

        # Định dạng ngữ cảnh tiêu chuẩn ATS từ Node 2 (Qdrant RAG)
        context_str = ""
        if retrieved_context:
            context_bullets = []
            for doc in retrieved_context[:4]:
                title = doc.get("title", "Tiêu chuẩn")
                content = doc.get("content", "")
                context_bullets.append(f"- {title}: {content}")
            context_str = "\n".join(context_bullets)

        prompt = (
            "Bạn là chuyên gia thẩm định hồ sơ kỹ thuật (Senior Technical Recruiter & ATS Gap Analyst).\n"
            "Hãy thực hiện so sánh đối chiếu khoảng cách kỹ năng (Gap Analysis) giữa CV của ứng viên và bản mô tả công việc (JD).\n\n"
            "=== THÔNG TIN ĐỐI CHIẾU ===\n"
            f"1. TOÀN VĂN CV ỨNG VIÊN:\n{cv_text[:3000]}\n\n"
            f"Kỹ năng bóc tách từ CV: {', '.join(cv_skills) if cv_skills else 'Chưa phát hiện'}\n\n"
            f"2. BẢN MÔ TẢ CÔNG VIỆC (JD):\n{jd_text[:2500]}\n\n"
            f"Danh sách kỹ năng JD yêu cầu: {', '.join(jd_skills) if jd_skills else 'Tất cả kỹ năng kỹ thuật trong JD'}\n\n"
            "3. QUY TẮC TAXONOMY BẮT BUỘC:\n"
            "- FastAPI / Flask / Django -> Được tính là đã đáp ứng kỹ năng 'Python'\n"
            "- PyTorch / TensorFlow -> Được tính là đã đáp ứng kỹ năng 'Machine Learning'\n"
            "- React / Next.js / Vue / Angular -> Được tính là đã đáp ứng kỹ năng 'JavaScript'\n"
            "- Nếu ứng viên có kỹ năng nền tảng vững chắc hoặc công nghệ tương đương trong cùng hệ sinh thái thì được ghi nhận.\n\n"
            f"4. TIÊU CHUẨN ATS TỪ VECTOR DB:\n{context_str or 'Đánh giá trung thực, chỉ công nhận kỹ năng có bằng chứng thực tế trong CV.'}\n\n"
            "=== NHIỆM VỤ CỦA BẠN ===\n"
            "Đối chiếu từng kỹ năng trong danh sách JD yêu cầu với CV ứng viên và phân loại:\n"
            "1. matched_skills: Danh sách kỹ năng trong JD mà ứng viên ĐÃ ĐÁP ỨNG (trực tiếp có trong CV, hoặc qua quy tắc taxonomy, hoặc có kinh nghiệm tương đương rõ ràng trong dự án).\n"
            "2. missing_skills: Danh sách kỹ năng trong JD mà ứng viên THỰC SỰ CHƯA CÓ hoặc chưa từng đề cập trong CV.\n"
            "3. taxonomy_matches: Dict giải thích ngắn gọn lý do match cho mỗi kỹ năng matched (VD: {'Python': 'Ứng viên có kinh nghiệm làm việc với Flask và Django'}).\n"
            "4. gap_summary: Bản nhận xét phân tích (2-3 câu) đánh giá khách quan độ phù hợp của ứng viên theo chuẩn ATS.\n\n"
            "=== YÊU CẦU ĐẦU RA ===\n"
            "CHỈ trả về duy nhất chuỗi JSON hợp lệ theo định dạng sau (không giải thích ngoài JSON):\n"
            "{\n"
            '  "matched_skills": ["Python", ...],\n'
            '  "missing_skills": ["Redis", ...],\n'
            '  "taxonomy_matches": {\n'
            '    "Python": "Thỏa mãn trực tiếp và qua kinh nghiệm Flask/Django trong dự án"\n'
            "  },\n"
            '  "gap_summary": "Ứng viên đáp ứng tốt các yêu cầu cốt lõi về Backend với Python và Docker, tuy nhiên còn thiếu kinh nghiệm thực tế với Redis và Qdrant."\n'
            "}"
        )

        response = await asyncio.wait_for(llm.ainvoke(prompt), timeout=15.0)
        content = response.content.strip()

        # Bóc tách JSON an toàn
        json_match = re.search(r"\{.*\}", content, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group(0))
            matched = [str(s).strip() for s in data.get("matched_skills", []) if str(s).strip()]
            missing = [str(s).strip() for s in data.get("missing_skills", []) if str(s).strip()]
            taxonomy_matches = {str(k).strip(): str(v).strip() for k, v in data.get("taxonomy_matches", {}).items()}
            gap_summary = str(data.get("gap_summary", "")).strip()

            return matched, missing, taxonomy_matches, gap_summary

    except Exception as e:
        logger.warning(f"LLM compare execution failed: {e}. Reverting to static taxonomy rule matching.")

    return None


async def compare_gap_node(state: GapAnalysisState) -> dict[str, Any]:
    """
    Node 3: Compare (Sử dụng AI / LLM làm động cơ so sánh chính + Taxonomy tĩnh)
    So sánh khoảng cách giữa CV và JD kết hợp:
    1. AI LLM Semantic Reasoning đối chiếu sâu từng kỹ năng với CV, JD, ATS criteria và taxonomy rules.
    2. Bảng Taxonomy tĩnh (bắt buộc theo đề bài) làm chuẩn mực xác thực nền tảng.
    """
    parsed_cv = state.get("parsed_cv", {})
    parsed_jd = state.get("parsed_jd", {})
    cv_raw = state.get("cv_raw", "")
    jd_raw = state.get("jd_raw", "")
    retrieved_context = state.get("retrieved_context", [])

    cv_skills = parsed_cv.get("skills", [])
    jd_skills = parsed_jd.get("required_skills", [])

    # Bước 1: Áp dụng bảng Taxonomy tĩnh làm nền tảng chuẩn xác
    base_matched, base_missing, base_tax_matches = apply_taxonomy_matching(
        cv_skills=cv_skills,
        jd_skills=jd_skills,
    )

    # Bước 2: Gọi AI / LLM thực hiện so sánh chuyên sâu (Semantic Gap Analysis)
    llm_result = await compare_with_llm(
        cv_text=cv_raw,
        jd_text=jd_raw,
        cv_skills=cv_skills,
        jd_skills=jd_skills,
        retrieved_context=retrieved_context,
    )

    if llm_result is not None:
        llm_matched, llm_missing, llm_tax_matches, llm_summary = llm_result

        # Hợp nhất an toàn: Bảo đảm tất cả các kỹ năng đã được static taxonomy chứng minh không bị bỏ sót
        final_matched_set = set(llm_matched).union(base_matched)

        # Các kỹ năng thiếu là các kỹ năng JD yêu cầu mà chưa được match
        final_missing = [s for s in jd_skills if s not in final_matched_set]

        # Sắp xếp danh sách matched theo thứ tự xuất hiện trong jd_skills hoặc cv_skills
        final_matched = [s for s in jd_skills if s in final_matched_set]
        for s in final_matched_set:
            if s not in final_matched:
                final_matched.append(s)

        # Kết hợp thông tin taxonomy matches
        final_tax_matches = dict(base_tax_matches)
        final_tax_matches.update(llm_tax_matches)

        gap_summary = llm_summary or (
            f"Kỹ năng đã đáp ứng ({len(final_matched)}): {', '.join(final_matched) if final_matched else 'Chưa có'}. "
            f"Kỹ năng còn thiếu ({len(final_missing)}): {', '.join(final_missing) if final_missing else 'Không có'}."
        )

        return {
            "matched_skills": final_matched,
            "missing_skills": final_missing,
            "taxonomy_matches": final_tax_matches,
            "gap_summary": gap_summary,
        }

    # Bước 3: Fallback nếu không có LLM hoặc gặp lỗi kết nối
    summary_parts = [
        f"Kỹ năng đã đáp ứng ({len(base_matched)}): {', '.join(base_matched) if base_matched else 'Chưa có'}.",
        f"Kỹ năng còn thiếu ({len(base_missing)}): {', '.join(base_missing) if base_missing else 'Không có'}.",
    ]
    if base_tax_matches:
        taxonomy_notes = "; ".join([f"{k}: {v}" for k, v in base_tax_matches.items()])
        summary_parts.append(f"Ghi nhận qua bảng Taxonomy: {taxonomy_notes}.")
    gap_summary = " ".join(summary_parts)

    return {
        "matched_skills": base_matched,
        "missing_skills": base_missing,
        "taxonomy_matches": base_tax_matches,
        "gap_summary": gap_summary,
    }
