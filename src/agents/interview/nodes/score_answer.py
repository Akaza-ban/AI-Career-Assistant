import asyncio
import json
import logging
import re
from typing import Any

from pydantic import BaseModel, Field, field_validator

from src.agents.interview.state import InterviewState
from src.config import get_settings

logger = logging.getLogger(__name__)


class STARScoreOutput(BaseModel):
    """
    Schema kiểm định (Validation) kết quả chấm điểm STAR theo thang 0-5.
    Đảm bảo dữ liệu trả về từ LLM tuân thủ nghiêm ngặt hợp đồng API.
    """

    situation_score: float = Field(..., ge=0.0, le=5.0, description="Điểm Situation (0.0 - 5.0)")
    task_score: float = Field(..., ge=0.0, le=5.0, description="Điểm Task (0.0 - 5.0)")
    action_score: float = Field(..., ge=0.0, le=5.0, description="Điểm Action (0.0 - 5.0)")
    result_score: float = Field(..., ge=0.0, le=5.0, description="Điểm Result (0.0 - 5.0)")
    feedback_text: str = Field(..., min_length=10, description="Nhận xét chi tiết theo tiêu chuẩn STAR")
    next_question: str | None = Field(default=None, description="Câu hỏi tiếp theo hoặc null")

    @field_validator("situation_score", "task_score", "action_score", "result_score", mode="before")
    @classmethod
    def validate_score_range(cls, v: Any) -> float:
        """Đảm bảo điểm số luôn nằm chính xác trong khoảng [0.0, 5.0]."""
        try:
            val = float(v)
            # Nếu LLM nhầm lẫn thang 10, tự động chuẩn hoá về thang 5
            if val > 5.0 and val <= 10.0:
                val = val / 2.0
            return max(0.0, min(5.0, round(val, 2)))
        except (ValueError, TypeError):
            return 3.0

    @field_validator("feedback_text")
    @classmethod
    def plain_feedback(cls, v: str) -> str:
        """Nhận xét hiển thị dạng văn bản thường: bỏ markdown (**, `), giữ xuống dòng giữa các phần."""
        lines = (" ".join(re.sub(r"\*\*|__|`", "", line).split()).lstrip("-• ") for line in v.splitlines())
        return "\n".join(line for line in lines if line)


def evaluate_answer_fallback(
    user_answer: str,
    job_role: str,
    current_round: int,
    total_rounds: int,
) -> STARScoreOutput:
    """
    Quy tắc chấm điểm dự phòng (Structural Fallback):
    Được kích hoạt khi LLM lỗi mạng hoặc không có API key.
    Đánh giá dựa trên độ hoàn chỉnh cấu trúc văn bản (độ dài, số câu) một cách khách quan,
    tuyệt đối không dùng danh sách từ khóa thụ động để tránh phán đoán sai lệch hoặc bị gian lận từ khóa.
    """
    clean_text = user_answer.strip()
    words = clean_text.split()
    word_count = len(words)

    # Đếm số câu hoàn chỉnh dựa trên dấu kết thúc câu
    sentences = [s.strip() for s in re.split(r"[.!?\n]+", clean_text) if len(s.strip()) > 3]
    sentence_count = len(sentences)

    # Thang điểm cấu trúc trung lập (0.0 - 5.0)
    # Câu trả lời quá ngắn (< 25 từ hoặc < 2 câu): 2.0 - 2.5
    # Câu trả lời cơ bản (25 - 60 từ): 3.0
    # Câu trả lời chi tiết (> 60 từ và >= 3 câu): 3.5
    if word_count < 25 or sentence_count < 2:
        base_score = 2.0
    elif word_count < 60 or sentence_count < 3:
        base_score = 3.0
    else:
        base_score = 3.5

    sit_score = base_score
    task_score = base_score
    action_score = min(5.0, base_score + (0.5 if sentence_count >= 4 else 0.0))
    result_score = base_score

    # Phản hồi 3 phần chuẩn tắc: Điểm tốt / Cần cải thiện / Gợi ý trả lời
    feedback = "\n".join(
        [
            f"Điểm tốt: Câu trả lời đã được ghi nhận với cấu trúc {word_count} từ cho vị trí {job_role}.",
            "Cần cải thiện: Hãy đảm bảo trình bày đầy đủ cả 4 phần STAR: Bối cảnh (S), Trách nhiệm cá nhân (T), "
            "Quyết định kỹ thuật & Trade-offs (A), và Kết quả đo lường cụ thể (R).",
            "Gợi ý trả lời: Trong phỏng vấn kỹ thuật, hãy luôn nêu rõ vị trí của công nghệ trong hệ thống, "
            "lý do tại sao chọn công nghệ này thay vì phương án khác và kết quả đo lường được.",
        ]
    )

    next_q = None
    if current_round < total_rounds:
        next_q = f"Vòng {current_round + 1}: Hãy chia sẻ về một tình huống bạn gặp mâu thuẫn kỹ thuật với đồng đội và cách bạn giải quyết?"

    return STARScoreOutput(
        situation_score=round(sit_score, 2),
        task_score=round(task_score, 2),
        action_score=round(action_score, 2),
        result_score=round(result_score, 2),
        feedback_text=feedback,
        next_question=next_q,
    )


async def call_llm_for_scoring(
    prompt: str,
    timeout: float = 12.0,
) -> dict[str, Any] | None:
    """Gọi LLM và bóc tách khối JSON từ kết quả trả về."""
    settings = get_settings()
    api_key, _ = settings.get_llm_credentials()

    is_placeholder = any(
        api_key.startswith(p) for p in ["your-", "sk-dummy", "gsk_your-", "sk-or-v1-your", "gsk_your_"]
    )
    if not api_key or is_placeholder:
        return None

    llm = settings.get_chat_model(temperature=0.2)
    response = await asyncio.wait_for(llm.ainvoke(prompt), timeout=timeout)
    content = response.content.strip()

    json_match = re.search(r"\{.*\}", content, re.DOTALL)
    if not json_match:
        raise ValueError(f"LLM không trả về JSON hợp lệ: {content[:100]}")

    return json.loads(json_match.group(0))


async def score_answer_with_llm(
    job_role: str,
    current_question: str,
    user_answer: str,
    current_round: int,
    total_rounds: int,
) -> STARScoreOutput:
    """
    Chấm điểm câu trả lời phỏng vấn theo phương pháp STAR Kỹ thuật (Technical STAR) bằng LLM:
    - Thang điểm: 0.0 đến 5.0 cho từng tiêu chí S, T, A, R.
    - Tiêu chí Action (A) đào sâu vào Technical Decision Making & Trade-offs (Tại sao dùng, ưu điểm so với phương án khác).
    - Tiêu chí Result (R) linh hoạt công nhận cả số liệu định lượng lẫn bài học kinh nghiệm sâu sắc.
    - Validate JSON đầu ra qua Pydantic STARScoreOutput.
    - Retry tối đa 1 lần nếu LLM trả về JSON lỗi hoặc sai định dạng.
    """
    is_last_round = current_round >= total_rounds

    example_next_q = "null" if is_last_round else '"Câu hỏi cho vòng kế tiếp..."'

    base_prompt = (
        "Bạn là Chuyên gia Tuyển dụng Kỹ thuật Cấp cao (Senior Technical Interviewer & Engineering Lead).\n"
        "Nhiệm vụ của bạn là thẩm định câu trả lời phỏng vấn theo phương pháp STAR Kỹ thuật (Technical STAR). "
        "Hãy đánh giá một cách CHỦ ĐỘNG, SẮC BÉN VÀ KHẮT KHE, tuyệt đối không chấm điểm theo hình thức hay bắt từ khóa thụ động.\n\n"
        "=== THÔNG TIN PHỎNG VẤN ===\n"
        f"- Vị trí tuyển dụng: {job_role}\n"
        f"- Vòng phỏng vấn: Vòng {current_round} / Tổng số {total_rounds} vòng\n"
        f"- Câu hỏi của nhà tuyển dụng: {current_question or f'Hãy chia sẻ kinh nghiệm kỹ thuật liên quan đến vị trí {job_role}.'}\n"
        f"- Câu trả lời của ứng viên:\n{user_answer}\n\n"
        "=== 4 NGUYÊN TẮC THẨM ĐỊNH CHỦ ĐỘNG (BẮT BUỘC ÁP DỤNG) ===\n"
        "1. KIỂM TRA ĐỘ TRÚNG ĐÍCH (Relevance Check): Ứng viên có trả lời ĐÚNG TRỌNG TÂM câu hỏi không? "
        "Nếu trả lời lạc đề, nói vòng vo hoặc chỉ nhồi nhét từ khóa sáo rỗng (keyword stuffing), TẤT CẢ các điểm số KHÔNG ĐƯỢC VƯỢT QUÁ 2.0!\n"
        "2. KIỂM TRA BẢN CHẤT KỸ THUẬT (Technical Depth: What - Why - Trade-off):\n"
        "   - CÔNG NGHỆ DÙNG LÀM GÌ (What): Vị trí và vai trò của công nghệ đó trong kiến trúc hệ thống là gì?\n"
        "   - TẠI SAO LẠI CHỌN CÔNG NGHỆ NÀY (Why): Có so sánh với các phương án thay thế khác không (ví dụ: Redis vs. Memcached, "
        "FastAPI vs. Django, PostgreSQL vs. MongoDB, Microservices vs. Monolith)?\n"
        "   - ƯU ĐIỂM VÀ ĐÁNH ĐỔI (Trade-offs): Không có công nghệ nào hoàn hảo tuyệt đối — ứng viên có nhận thức được ưu điểm vượt trội "
        "và cái giá phải đánh đổi (chi phí RAM, độ phức tạp bảo trì, tính nhất quán dữ liệu...) trong bài toán đó không?\n"
        "3. TÁCH BẠCH ĐÓNG GÓP CÁ NHÂN (I vs. We): Nếu ứng viên dùng 'chúng em / nhóm em' và nói chung chung về công việc tập thể, "
        "không nêu rõ trách nhiệm và dòng code/tính năng do chính mình trực tiếp làm, điểm Task và Action TỐI ĐA CHỈ LÀ 3.0.\n"
        "4. KẾT QUẢ PHẢI XÁC THỰC (Result Verification): Kết quả phải đo lường được (số liệu %, ms, throughput, tài nguyên tiết kiệm) "
        "HOẶC là bài học kinh nghiệm sâu sắc về kiến trúc; bác bỏ các kết luận chung chung như 'dự án chạy tốt', 'được khen'.\n\n"
        "=== RUBRIC CHẤM ĐIỂM CHI TIẾT (THANG 0.0 - 5.0 CHO MỖI TIÊU CHÍ) ===\n"
        "- situation_score (Bối cảnh & Thách thức):\n"
        "  + 0.0 - 2.5: Bối cảnh mơ hồ, không rõ bài toán xảy ra ở đâu, quy mô và thách thức kỹ thuật là gì.\n"
        "  + 3.0 - 3.5: Nêu được dự án/công ty và bài toán kỹ thuật cơ bản.\n"
        "  + 4.0 - 5.0: Bối cảnh sắc nét, nêu rõ ràng kiến trúc hệ thống, quy mô dữ liệu/traffic hoặc ràng buộc thực tế.\n\n"
        "- task_score (Nhiệm vụ & Vai trò cá nhân):\n"
        "  + 0.0 - 2.5: Nói việc của cả nhóm, không rõ ứng viên được giao việc gì.\n"
        "  + 3.0 - 3.5: Xác định được vai trò cá nhân nhưng KPI/mục tiêu kỹ thuật cần đạt chưa rành mạch.\n"
        "  + 4.0 - 5.0: Phân tách rõ ràng trách nhiệm độc lập của bản thân (I) và chỉ tiêu kỹ thuật cụ thể cần hoàn thành.\n\n"
        "- action_score (Hành động & Quyết định Kỹ thuật / Trade-offs - TIÊU CHÍ QUAN TRỌNG NHẤT):\n"
        "  + 0.0 - 2.5: Chỉ liệt kê tên công nghệ như học vẹt, lý thuyết suông; không có hành động cụ thể.\n"
        "  + 3.0 - 3.5 (Mức WHAT): Nêu được công nghệ dùng để làm gì, nhưng CHƯA giải thích lý do tại sao chọn công nghệ này mà không chọn giải pháp khác.\n"
        "  + 4.0 - 5.0 (Mức WHY & TRADE-OFFS): Giải thích trọn vẹn: Công nghệ dùng để làm gì? TẠI SAO LẠI CHỌN công nghệ này (so sánh với các phương án thay thế)? và ƯU ĐIỂM / SỰ ĐÁNH ĐỔI (Trade-offs) trong bài toán đó.\n\n"
        "- result_score (Kết quả & Bài học):\n"
        "  + 0.0 - 2.5: Không có kết quả đầu ra, hoặc kết quả sáo rỗng không ăn khớp với bài toán.\n"
        "  + 3.0 - 3.5: Có kết quả công việc nhưng thiếu số liệu minh chứng cụ thể.\n"
        "  + 4.0 - 5.0: Có số liệu kỹ thuật đo lường rõ ràng (%, ms, throughput, tài nguyên) HOẶC bài học kinh nghiệm sâu sắc giúp tối ưu dự án lâu dài.\n\n"
        "=== YÊU CẦU NHẬN XÉT (feedback_text) ===\n"
        "Viết bằng tiếng Việt, văn bản thường (KHÔNG markdown: không **, không `, không gạch đầu dòng), "
        "tối đa khoảng 120 từ, đúng 3 dòng ngăn bằng ký tự xuống dòng \\n, mỗi dòng bắt đầu bằng nhãn sau:\n"
        "Điểm tốt: <nêu cụ thể 1 giải pháp kỹ thuật hoặc tư duy phân tích tốt nhất mà ứng viên đã thể hiện>\n"
        "Cần cải thiện: <chỉ rõ điểm yếu cốt lõi: NẾU chưa giải thích lý do chọn công nghệ hoặc trade-off so sánh, BẮT BUỘC chỉ rõ; NẾU nói chung chung nhóm em, nhắc làm rõ vai trò cá nhân>\n"
        "Gợi ý trả lời: <1 câu nói mẫu cụ thể hướng dẫn cách so sánh lý do chọn công nghệ hoặc đưa số liệu đo lường vào bài nói>\n\n"
        "=== YÊU CẦU CÂU HỎI TIẾP THEO ===\n"
        + (
            "Đây là vòng cuối cùng (Vòng kết thúc), trường 'next_question' BẮT BUỘC là null.\n"
            if is_last_round
            else f"Vì chưa phải vòng cuối, hãy gợi ý 1 câu hỏi phỏng vấn kỹ thuật chuyên sâu kế tiếp (Vòng {current_round + 1}) phù hợp với vị trí {job_role}.\n"
        )
        + "\n=== ĐỊNH DẠNG ĐẦU RA (CHỈ TRẢ VỀ DUY NHẤT CHUỖI JSON HỢP LỆ) ===\n"
        "{\n"
        '  "situation_score": 4.0,\n'
        '  "task_score": 3.5,\n'
        '  "action_score": 4.5,\n'
        '  "result_score": 3.0,\n'
        '  "feedback_text": "Điểm tốt: Nêu rõ bài toán bottleneck và giải pháp cache.\\nCần cải thiện: Phần Action cần giải thích rõ vì sao chọn Redis thay vì Memcached và ưu điểm cụ thể.\\nGợi ý trả lời: Thêm: Tôi chọn Redis thay vì Memcached vì cần cấu trúc Sorted Set cho bảng xếp hạng real-time...",\n'
        f'  "next_question": {example_next_q}\n'
        "}"
    )

    # Thử lần 1
    try:
        raw_json = await call_llm_for_scoring(base_prompt)
        if raw_json:
            validated = STARScoreOutput.model_validate(raw_json)
            # Ràng buộc vòng cuối
            if is_last_round:
                validated.next_question = None
            return validated
    except Exception as e:
        logger.warning(f"Lần 1 chấm điểm LLM thất bại: {e}. Đang thực hiện RETRY lần 1...")

    # Retry 1 lần (theo yêu cầu đề bài do dùng model free-tier)
    try:
        retry_prompt = (
            base_prompt + "\n\n[CẢNH BÁO QUAN TRỌNG: Lần trước định dạng JSON bị lỗi. "
            "Bạn PHẢI trả về JSON nguyên bản, không dùng markdown block, "
            "các trường điểm số BẮT BUỘC là số thực trong khoảng từ 0.0 đến 5.0!]"
        )
        raw_json = await call_llm_for_scoring(retry_prompt, timeout=15.0)
        if raw_json:
            validated = STARScoreOutput.model_validate(raw_json)
            if is_last_round:
                validated.next_question = None
            return validated
    except Exception as e:
        logger.error(f"Retry lần 1 vẫn thất bại: {e}. Kích hoạt Rule-based Fallback.")

    # Fallback an toàn nếu cả 2 lần đều không thành công
    return evaluate_answer_fallback(
        user_answer=user_answer,
        job_role=job_role,
        current_round=current_round,
        total_rounds=total_rounds,
    )


async def score_answer_node(state: InterviewState) -> dict[str, Any]:
    """
    Node 1 (hoặc Node chấm điểm): Đánh giá câu trả lời của ứng viên theo rubric STAR.
    Output: {situation_score, task_score, action_score, result_score, feedback_text, next_question|null}
    """
    job_role = state.get("job_role", "Software Engineer")
    user_answer = state.get("user_answer", "").strip()
    current_round = max(1, state.get("current_round", 1))
    total_rounds = max(3, state.get("total_rounds", 3))  # 3-4 vòng cố định, mặc định 3
    current_question = state.get("current_question", "")

    # Gọi hàm chấm điểm có validate JSON và retry 1 lần
    score_result = await score_answer_with_llm(
        job_role=job_role,
        current_question=current_question,
        user_answer=user_answer,
        current_round=current_round,
        total_rounds=total_rounds,
    )

    is_finished = current_round >= total_rounds
    next_q = None if is_finished else score_result.next_question

    # Lưu lại lịch sử đánh giá vòng
    eval_item = {
        "round": current_round,
        "question": current_question,
        "answer": user_answer,
        "situation_score": score_result.situation_score,
        "task_score": score_result.task_score,
        "action_score": score_result.action_score,
        "result_score": score_result.result_score,
        "feedback_text": score_result.feedback_text,
    }
    scores_history = list(state.get("evaluation_scores", []))
    scores_history.append(eval_item)

    return {
        "situation_score": score_result.situation_score,
        "task_score": score_result.task_score,
        "action_score": score_result.action_score,
        "result_score": score_result.result_score,
        "feedback_text": score_result.feedback_text,
        "next_question": next_q,
        "is_finished": is_finished,
        "evaluation_scores": scores_history,
        "current_round": current_round,
        "total_rounds": total_rounds,
    }
