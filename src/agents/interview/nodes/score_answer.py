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

    @field_validator("feedback_text")
    @classmethod
    def plain_feedback(cls, v: str) -> str:
        """Nhận xét hiển thị dạng văn bản thường: bỏ markdown (**, `), giữ xuống dòng giữa các phần."""
        lines = (" ".join(re.sub(r"\*\*|__|`", "", line).split()).lstrip("-• ") for line in v.splitlines())
        return "\n".join(line for line in lines if line)


# Chủ ngữ ngôi thứ nhất số ít ("tôi", "em", "mình"), không tính "nhóm em", "chúng tôi", "anh em"
_FIRST_PERSON = re.compile(r"(?<!nhóm )(?<!team )(?<!chúng )(?<!anh )(?<!các )\b(?:tôi|em|mình|i|my)\b", re.IGNORECASE)
_YEAR = re.compile(r"\b(?:19|20)\d{2}\b")
_TEAM = re.compile(r"\b(?:nhóm (?:em|tôi|mình)|chúng (?:em|tôi|mình)|team (?:em|tôi|mình)|we|our)\b", re.IGNORECASE)
TEAM_ONLY_CAP = 3.0


def team_only(text: str) -> bool:
    """Câu trả lời chỉ kể việc của cả nhóm ("nhóm em", "chúng em"), không có chỗ nào nói phần việc của riêng mình."""
    return bool(_TEAM.search(text)) and not _FIRST_PERSON.search(text)


def _sentences(text: str) -> list[str]:
    return [s for s in re.split(r"[.!?;\n]+", text) if len(s.split()) >= 3]


def evaluate_answer_fallback(
    user_answer: str,
    job_role: str,
    current_round: int,
    total_rounds: int,
) -> STARScoreOutput:
    """
    Chấm dự phòng khi LLM lỗi hoặc không có API key. Không đếm từ khoá (dễ bị nhồi từ, lệch theo ngành), chỉ dùng
    tín hiệu khách quan áp dụng cho mọi vị trí: có con số → Kết quả, có vai trò cá nhân → Nhiệm vụ,
    kể đủ nhiều bước (≥ 4 câu) → Hành động; câu trả lời chủ yếu là danh sách từ khoá → điểm thấp.
    Điểm tối đa 4,0 vì đây chỉ là ước lượng (không hiểu nghĩa nên không nhận ra câu lạc đề).
    """
    words = user_answer.split()
    sentences = _sentences(user_answer)
    has_numbers = bool(re.search(r"\d", _YEAR.sub(" ", user_answer)))
    personal = bool(_FIRST_PERSON.search(user_answer))
    detailed = len(sentences) >= 4
    # Danh sách kỹ năng / công cụ ("Python, Docker, Redis, ..."): cứ khoảng 5 từ lại có một dấu phân cách
    keyword_list = len(re.findall(r"[,/;]", user_answer)) >= 0.2 * max(len(words), 1)

    if len(words) < 15:
        # Quá ngắn để có câu chuyện STAR
        sit = task = action = result = 1.0
    elif keyword_list:
        sit = task = action = result = 1.5
    else:
        base = 2.5 if len(words) >= 40 else 2.0
        sit = base + (0.5 if len(sentences) >= 2 else 0.0)
        task = base + (1.0 if personal else 0.0)
        action = base + (1.0 if detailed else 0.0) + (0.5 if len(words) >= 90 else 0.0)
        result = base - 0.5 + (1.5 if has_numbers else 0.0)
    scores = [min(4.0, x) for x in (sit, task, action, result)]

    if keyword_list:
        good = f"Bạn đã nêu các kỹ năng, công cụ liên quan tới vị trí {job_role}."
    elif has_numbers:
        good = "Bạn đã nêu con số cụ thể cho kết quả."
    elif personal:
        good = "Bạn đã nói về phần việc của chính mình."
    else:
        good = f"Bạn đã kể một trải nghiệm có liên quan tới vị trí {job_role}."
    if keyword_list:
        improve = "Câu trả lời mới liệt kê kỹ năng, chưa kể một việc cụ thể bạn đã làm theo đúng câu hỏi."
    elif not personal:
        improve = "Chưa rõ phần việc của riêng bạn (Nhiệm vụ, Hành động); tránh chỉ nói chung về cả nhóm."
    elif not detailed:
        improve = "Các bước bạn đã làm còn ít chi tiết (Hành động)."
    elif not has_numbers:
        improve = "Phần Kết quả chưa có con số hoặc bài học cụ thể."
    else:
        improve = "Nêu rõ hơn bối cảnh và khó khăn lúc đầu (Tình huống)."
    feedback = "\n".join(
        [
            f"Điểm tốt: {good}",
            f"Cần cải thiện: {improve}",
            "Gợi ý trả lời: Nói rõ vai trò của riêng bạn, các bước đã làm theo thứ tự và kết quả thật (con số hoặc "
            "điều bạn rút ra được).",
        ]
    )
        ]
    )

    next_q = None
    if current_round < total_rounds:
        next_q = f"Vòng {current_round + 1}: Hãy kể về một lần bạn bất đồng ý kiến với đồng đội và cách bạn xử lý."

    return STARScoreOutput(
        situation_score=scores[0],
        task_score=scores[1],
        action_score=scores[2],
        result_score=scores[3],
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

    return await invoke_json(prompt, temperature=0.0, timeout=timeout)


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
    question = current_question or f"Hãy chia sẻ một trải nghiệm liên quan đến vị trí {job_role}."

    base_prompt = (
        f"Bạn là người phỏng vấn tuyển dụng cho vị trí {job_role}, chấm câu trả lời của một sinh viên theo phương "
        "pháp STAR. Chấm theo những gì ứng viên thực sự kể, không suy đoán thêm.\n\n"
        "=== THÔNG TIN PHỎNG VẤN ===\n"
        f"- Vòng hiện tại: {current_round} / {total_rounds}\n"
        f"- Câu hỏi: {question}\n"
        f"- Câu trả lời của ứng viên:\n{user_answer}\n\n"
        "=== THANG ĐIỂM (0.0–5.0 cho mỗi tiêu chí) ===\n"
        "Mức chung: 0–1 = không có hoặc không liên quan; 2–3 = có nhưng chung chung; 4 = rõ và cụ thể; "
        "5 = rất cụ thể, thuyết phục.\n"
        "1. situation_score: bối cảnh (dự án, môn học, công việc, câu lạc bộ...) và khó khăn lúc đó có rõ không.\n"
        "2. task_score: mục tiêu và phần việc của RIÊNG ứng viên có rõ không.\n"
        "3. action_score: các bước ứng viên đã làm và lý do chọn cách làm đó. Tuỳ vị trí, ví dụ: kỹ thuật = giải "
        "pháp, công cụ đã dùng; phân tích = dữ liệu nào, phân tích ra sao; marketing = kênh, nội dung, cách theo "
        "dõi hiệu quả.\n"
        "4. result_score: kết quả đạt được. Con số đo được (thời gian, %, số người, doanh số...) hoặc phản hồi cụ "
        "thể được 4–5; chưa có kết quả đo được nhưng nêu rõ bài học rút ra được tối đa 3.\n\n"
        "=== QUY TẮC BẮT BUỘC ===\n"
        "- Câu trả lời lạc đề, không trả lời câu hỏi, hoặc chỉ liệt kê từ khoá / công cụ mà không kể việc đã làm: "
        "MỌI tiêu chí tối đa 2.0.\n"
        '- Chỉ nói "nhóm em / chúng em" mà không nêu phần việc của riêng ứng viên: task_score và action_score '
        "tối đa 3.0.\n"
        "- Không cộng điểm vì câu dài hay dùng nhiều thuật ngữ.\n\n"
        "=== YÊU CẦU NHẬN XÉT (feedback_text) ===\n"
        "Viết bằng tiếng Việt, văn bản thường (KHÔNG markdown: không **, không `, không gạch đầu dòng), "
        "tối đa khoảng 120 từ, đúng 3 dòng ngăn bằng ký tự xuống dòng \\n, mỗi dòng bắt đầu bằng nhãn sau:\n"
        "Điểm tốt: <điều ứng viên đã làm tốt, cụ thể theo câu trả lời>\n"
        "Cần cải thiện: <phần STAR còn thiếu hoặc yếu nhất, nói rõ thiếu gì>\n"
        "Gợi ý trả lời: <2–3 ý cụ thể nên kể thêm cho ĐÚNG câu hỏi này, ví dụ vai trò cá nhân, "
        "các bước đã làm, kết quả đo được; chỉ gợi ý, không viết sẵn câu trả lời, không bịa sự việc thay ứng viên>\n\n"
        "=== ĐỊNH DẠNG ĐẦU RA (CHỈ TRẢ VỀ DUY NHẤT CHUỖI JSON HỢP LỆ) ===\n"
        "{\n"
        '  "situation_score": 3.5,\n'
        '  "task_score": 3.0,\n'
        '  "action_score": 3.5,\n'
        '  "result_score": 2.5,\n'
        '  "feedback_text": "Điểm tốt: ...\\nCần cải thiện: ...\\nGợi ý trả lời: ..."\n'
        "}"
    )

    # Thử lần 1
    try:
        raw_json = await call_llm_for_scoring(base_prompt)
        if raw_json:
            validated = STARScoreOutput.model_validate(raw_json)
            # Câu hỏi kế tiếp do ask_question chọn từ ngân hàng câu hỏi, không lấy câu LLM tự nghĩ
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
    if team_only(user_answer):
        score_result.task_score = min(score_result.task_score, TEAM_ONLY_CAP)
        score_result.action_score = min(score_result.action_score, TEAM_ONLY_CAP)

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
