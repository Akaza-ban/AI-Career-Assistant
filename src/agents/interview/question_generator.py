"""
Sinh câu hỏi phỏng vấn thử theo phương pháp STAR (US-SV-04).
Hoàn toàn sử dụng LLM để đọc và phân tích nội dung chi tiết của CV (kể cả văn bản sau OCR)
và Mô tả công việc (JD), sau đó tự động sinh ra 4 câu hỏi tình huống thực chiến.
Tuyệt đối không dùng câu hỏi văn mẫu hay khuôn mẫu cố định.
"""

import asyncio
import json
import logging
import re

from src.config import get_settings

logger = logging.getLogger(__name__)

THEMES = [
    "Nhiệm vụ & Kinh nghiệm tiêu biểu",
    "Xử lý khó khăn & Thử thách kỹ thuật",
    "Làm việc nhóm & Phối hợp",
    "Học hỏi & Định hướng phát triển",
]


async def _invoke_llm_for_questions(prompt: str, timeout: float = 25.0) -> list[dict[str, str]]:
    """Gọi LLM với cơ chế tự động chuyển model dự phòng nếu model chính bị quá tải (rate limit)."""
    settings = get_settings()
    api_key, _ = settings.get_llm_credentials()

    is_placeholder = any(
        api_key.startswith(p) for p in ["your-", "sk-dummy", "gsk_your-", "sk-or-v1-your", "gsk_your_"]
    )
    if not api_key or is_placeholder:
        raise ValueError("Chưa cấu hình API Key cho LLM để tạo câu hỏi phỏng vấn.")

    provider = settings.llm_provider.lower()
    if provider == "deepseek":
        models_to_try = [settings.model_name or "deepseek-chat"]
    elif provider == "groq":
        models_to_try = [settings.model_name]
        if settings.model_name != "openai/gpt-oss-20b":
            models_to_try.append("openai/gpt-oss-20b")
    else:
        models_to_try = [settings.model_name]

    last_error: Exception | None = None
    for model_name in models_to_try:
        try:
            llm = settings.get_chat_model(model=model_name, temperature=0.3)
            response = await asyncio.wait_for(llm.ainvoke(prompt), timeout=timeout)
            content = response.content.strip()

            json_match = re.search(r"\[.*\]", content, re.DOTALL)
            if not json_match:
                continue

            parsed = json.loads(json_match.group(0))
            if isinstance(parsed, list) and len(parsed) >= 4:
                return parsed[:4]
        except Exception as e:
            logger.warning("Thử model %s thất bại: %s", model_name, e)
            last_error = e

    raise last_error or ValueError("LLM không trả về danh sách câu hỏi hợp lệ.")


async def generate_interview_questions(
    role: str,
    jd_text: str = "",
    cv_text: str | None = None,
    mode: str = "with_cv",
) -> list[tuple[str, str]]:
    """
    Sử dụng trực tiếp LLM để đọc toàn bộ nội dung CV (sau OCR/trích xuất) và JD,
    tự động suy nghĩ và tạo ra 4 câu hỏi phỏng vấn STAR thực chiến cá nhân hóa.
    """
    clean_role = role.strip() or "Vị trí tuyển dụng"
    jd_snippet = (jd_text or "")[:3500].strip()
    cv_snippet = (cv_text or "")[:3500].strip()

    if mode == "with_cv" and cv_snippet and len(cv_snippet) > 40:
        prompt = f"""Bạn là Trưởng ban Tuyển dụng Chuyên môn (Lead Technical Interviewer) đang trực tiếp phỏng vấn ứng viên cho vị trí: {clean_role}.

Nhiệm vụ của bạn: Hãy nghiên cứu kỹ hồ sơ CV của ứng viên (vừa được trích xuất từ văn bản/OCR) và Bản mô tả công việc (JD) dưới đây. Hãy TỰ NGHĨ RA VÀ SINH ĐÚNG 4 CÂU HỎI PHỎNG VẤN THỰC CHIẾN theo phương pháp STAR (Situation - Task - Action - Result).

QUY TẮC BẮT BUỘC:
1. TUYỆT ĐỐI KHÔNG dùng câu hỏi văn mẫu, câu hỏi rập khuôn hay câu hỏi thụ động (CẤM các mẫu câu như "Hãy kể về một lần bạn tự hào...", "Bạn đã lên kế hoạch học tập như thế nào...").
2. BẮT BUỘC đọc và trích dẫn trực tiếp tên dự án, thành tích, công cụ, ngôn ngữ, chứng từ hoặc quy trình cụ thể mà ứng viên đã nêu trong CV để đối chiếu với bài toán trong JD.
3. Câu hỏi phải mang tính tình huống thực chiến, đào sâu vào cách ứng viên xử lý sự cố kỹ thuật, phản biện giải pháp, phối hợp khi có xung đột deadline và năng lực giải quyết bài toán cốt lõi.

=== VỊ TRÍ ỨNG TUYỂN ===
{clean_role}

=== BẢN MÔ TẢ CÔNG VIỆC (JD) ===
{jd_snippet or clean_role}

=== HỒ SƠ CV CỦA ỨNG VIÊN (TRÍCH XUẤT TỪ OCR/FILE) ===
{cv_snippet}

=== 4 CHỦ ĐỀ CÂU HỎI CẦN TẠO ===
1. '{THEMES[0]}': Đào sâu trực diện vào 1 dự án/nhiệm vụ nổi bật trong CV liên quan đến vị trí {clean_role} (bối cảnh, bài toán giải quyết, giải pháp và kết quả định lượng).
2. '{THEMES[1]}': Đặt tình huống sự cố thực tế với công cụ/nghiệp vụ trong CV khi gặp lỗi phát sinh nghiêm trọng (cách khoanh vùng nguyên nhân và khắc phục dứt điểm).
3. '{THEMES[2]}': Thử thách cách phối hợp, đàm phán hoặc xử lý bất đồng tiến độ/kỹ thuật với các bên liên quan khi gặp áp lực deadline.
4. '{THEMES[3]}': Đặt bài toán yêu cầu cao trong JD và hỏi cách ứng viên vận dụng kinh nghiệm sẵn có trong CV để giải quyết bài toán đó.

Trả về DUY NHẤT một mảng JSON 4 object (không kèm markdown khác):
[
  {{"theme": "{THEMES[0]}", "question": "..."}},
  {{"theme": "{THEMES[1]}", "question": "..."}},
  {{"theme": "{THEMES[2]}", "question": "..."}},
  {{"theme": "{THEMES[3]}", "question": "..."}}
]"""
    else:
        prompt = f"""Bạn là Trưởng ban Tuyển dụng Chuyên môn (Lead Technical Interviewer) đang phỏng vấn ứng viên cho vị trí: {clean_role}.
Ứng viên chọn phỏng vấn dựa trên Bản mô tả công việc (JD).

Nhiệm vụ của bạn: Hãy nghiên cứu kỹ các trách nhiệm, yêu cầu kỹ năng và bài toán thực tế trong JD dưới đây. Hãy TỰ NGHĨ RA VÀ SINH ĐÚNG 4 CÂU HỎI PHỎNG VẤN THỰC CHIẾN theo phương pháp STAR (Situation - Task - Action - Result).

QUY TẮC BẮT BUỘC:
1. TUYỆT ĐỐI KHÔNG dùng câu hỏi văn mẫu chung chung chỉ ghép tên vị trí vào.
2. BẮT BUỘC đặt câu hỏi trực diện vào các trách nhiệm cốt lõi, bài toán kỹ thuật, công cụ và quy trình làm việc cụ thể được nêu trong JD.
3. Câu hỏi phải mang tính tình huống thực tế, thử thách tư duy giải quyết vấn đề và năng lực chuyên môn.

=== VỊ TRÍ ỨNG TUYỂN ===
{clean_role}

=== BẢN MÔ TẢ CÔNG VIỆC (JD) ===
{jd_snippet or clean_role}

=== 4 CHỦ ĐỀ CÂU HỎI CẦN TẠO ===
1. '{THEMES[0]}': Đặt câu hỏi thực tế về việc giải quyết bài toán/nhiệm vụ kỹ thuật cốt lõi trong JD (tiếp cận, giải pháp, đo lường).
2. '{THEMES[1]}': Đặt câu hỏi về xử lý sự cố kỹ thuật, tối ưu hiệu năng hoặc giải quyết lỗi nghiêm trọng khi làm việc với công nghệ trong JD.
3. '{THEMES[2]}': Đặt câu hỏi về làm việc nhóm, giao tiếp với các bên liên quan hoặc xử lý mâu thuẫn trong môi trường của vị trí {clean_role}.
4. '{THEMES[3]}': Đặt câu hỏi về khả năng tự nghiên cứu công nghệ mới, thích ứng với quy trình hoặc cải tiến hiệu suất cho công việc này.

Trả về DUY NHẤT một mảng JSON 4 object (không kèm markdown khác):
[
  {{"theme": "{THEMES[0]}", "question": "..."}},
  {{"theme": "{THEMES[1]}", "question": "..."}},
  {{"theme": "{THEMES[2]}", "question": "..."}},
  {{"theme": "{THEMES[3]}", "question": "..."}}
]"""

    raw_items = await _invoke_llm_for_questions(prompt)
    result = []
    for i, item in enumerate(raw_items):
        theme = str(item.get("theme") or THEMES[i]).strip()
        q_text = str(item.get("question") or "").strip()
        if not q_text:
            raise ValueError(f"Câu hỏi {i+1} rỗng")
        if i == 0 and clean_role.lower() not in q_text.lower():
            q_text = f"Đối với vị trí {clean_role}: {q_text}"
        result.append((theme, q_text))
    return result
