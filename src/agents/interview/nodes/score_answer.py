import logging
import re
from typing import Any

from pydantic import BaseModel, Field, field_validator

from src.agents.interview.state import InterviewState
from src.config import get_settings
from src.services.llm import invoke_json

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


def evaluate_answer_fallback(
    user_answer: str,
    job_role: str,
    current_round: int,
    total_rounds: int,
) -> STARScoreOutput:
    """
    Quy tắc chấm điểm dự phòng (Rule-based Fallback):
    Được kích hoạt khi LLM lỗi mạng hoặc không có API key.
    Phân tích độ dài câu trả lời và từ khóa STAR để ước tính điểm số khách quan trên thang 0-5.
    """
    ans_lower = user_answer.lower()
    words = user_answer.split()
    word_count = len(words)

    # Heuristic cho Situation (bối cảnh dự án, công ty, vấn đề)
    sit_keywords = ["dự án", "project", "hệ thống", "bối cảnh", "công ty", "khi", "lúc", "khách hàng"]
    sit_matches = sum(1 for k in sit_keywords if k in ans_lower)
    sit_score = min(5.0, 2.5 + (0.5 * sit_matches) + (0.5 if word_count > 30 else 0.0))

    # Heuristic cho Task (mục tiêu, nhiệm vụ, yêu cầu)
    task_keywords = ["nhiệm vụ", "mục tiêu", "yêu cầu", "task", "trách nhiệm", "cần phải", "deadline"]
    task_matches = sum(1 for k in task_keywords if k in ans_lower)
    task_score = min(5.0, 2.5 + (0.5 * task_matches) + (0.5 if word_count > 40 else 0.0))

    # Heuristic cho Action (hành động cụ thể, kỹ thuật đã làm)
    action_keywords = ["tôi đã", "sử dụng", "triển khai", "tối ưu", "xây dựng", "viết", "cấu hình", "debug", "refactor"]
    action_matches = sum(1 for k in action_keywords if k in ans_lower)
    action_score = min(5.0, 2.5 + (0.5 * action_matches) + (0.5 if word_count > 50 else 0.0))

    # Heuristic cho Result (kết quả, con số, %)
    has_numbers = bool(re.search(r"\d+%|\d+\s*(ms|s|req|ccu|user|người|lần)", ans_lower))
    result_keywords = ["kết quả", "giúp", "hoàn thành", "thành công", "cải thiện", "đạt"]
    result_matches = sum(1 for k in result_keywords if k in ans_lower)
    result_score = min(5.0, 2.0 + (1.5 if has_numbers else 0.5) + (0.5 * result_matches))

    feedback = (
        f"Đánh giá sơ bộ vòng {current_round}/{total_rounds} cho vị trí {job_role}: "
        f"Câu trả lời dài {word_count} từ. "
        + (
            "Bạn đã nêu được các con số minh chứng định lượng. "
            if has_numbers
            else "Nên bổ sung thêm số liệu cụ thể (%) để làm nổi bật kết quả (Result). "
        )
        + "Cần nhấn mạnh rõ hơn các hành động kỹ thuật cá nhân (Action) đã thực hiện để giải quyết bài toán."
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

    return await invoke_json(prompt, temperature=0.2, timeout=timeout)


async def score_answer_with_llm(
    job_role: str,
    current_question: str,
    user_answer: str,
    current_round: int,
    total_rounds: int,
) -> STARScoreOutput:
    """
    Chấm điểm câu trả lời phỏng vấn theo phương pháp STAR bằng LLM:
    - Thang điểm: 0.0 đến 5.0 cho từng tiêu chí.
    - Validate JSON đầu ra qua Pydantic STARScoreOutput.
    - Retry tối đa 1 lần nếu LLM trả về JSON lỗi hoặc sai định dạng (do dùng model free-tier).
    """
    is_last_round = current_round >= total_rounds

    example_next_q = "null" if is_last_round else '"Câu hỏi cho vòng kế tiếp..."'

    base_prompt = (
        "Bạn là Chuyên gia Tuyển dụng Kỹ thuật Cấp cao (Senior Technical Interviewer & STAR Assessor).\n"
        "Hãy đánh giá câu trả lời của ứng viên cho vị trí tuyển dụng theo phương pháp STAR.\n\n"
        "=== THÔNG TIN PHỎNG VẤN ===\n"
        f"- Vị trí ứng tuyển: {job_role}\n"
        f"- Vòng hiện tại: Vòng {current_round} / Tổng số {total_rounds} vòng\n"
        f"- Câu hỏi phỏng vấn: {current_question or f'Hãy chia sẻ kinh nghiệm kỹ thuật liên quan đến vị trí {job_role}.'}\n"
        f"- Câu trả lời của ứng viên:\n{user_answer}\n\n"
        "=== THANG ĐIỂM CHẤM (TỪ 0.0 ĐẾN 5.0 CHO MỖI TIÊU CHÍ) ===\n"
        "1. situation_score (0.0 - 5.0): Bối cảnh dự án, quy mô bài toán, khó khăn thực tế có rõ ràng không?\n"
        "2. task_score (0.0 - 5.0): Trách nhiệm cá nhân và mục tiêu cần giải quyết có rành mạch không?\n"
        "3. action_score (0.0 - 5.0): Các giải pháp kỹ thuật, công nghệ đã sử dụng và tư duy xử lý có chi tiết không?\n"
        "4. result_score (0.0 - 5.0): Kết quả đạt được có đo lường được bằng số liệu định lượng (%, ms, throughput) không?\n\n"
        "=== YÊU CẦU CÂU HỎI TIẾP THEO ===\n"
        + (
            "Đây là vòng cuối cùng (Vòng kết thúc), trường 'next_question' BẮT BUỘC là null.\n"
            if is_last_round
            else f"Vì chưa phải vòng cuối, hãy gợi ý 1 câu hỏi phỏng vấn chuyên sâu kế tiếp (Vòng {current_round + 1}) phù hợp với vị trí {job_role}.\n"
        )
        + "\n=== ĐỊNH DẠNG ĐẦU RA (CHỈ TRẢ VỀ DUY NHẤT CHUỖI JSON HỢP LỆ) ===\n"
        "{\n"
        '  "situation_score": 4.0,\n'
        '  "task_score": 3.5,\n'
        '  "action_score": 4.5,\n'
        '  "result_score": 3.0,\n'
        '  "feedback_text": "Nhận xét chi tiết điểm mạnh và điểm cần cải thiện theo từng tiêu chí STAR...",\n'
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
    except Exception:
        logger.warning("Lần 1 chấm điểm LLM thất bại. Đang thực hiện RETRY lần 1...")

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
    except Exception:
        logger.error("Retry lần 1 vẫn thất bại. Kích hoạt Rule-based Fallback.")

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
