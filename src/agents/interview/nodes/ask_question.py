import logging
from typing import Any

from src.agents.interview.state import InterviewState

logger = logging.getLogger(__name__)

# Ngân hàng câu hỏi mẫu theo phương pháp STAR cho các vòng phỏng vấn cố định (3-4 vòng)
DEFAULT_STAR_QUESTIONS_BY_ROUND = {
    1: [
        "Hãy mô tả một bài toán kỹ thuật phức tạp nhất bạn từng giải quyết trong dự án thực tế liên quan đến {role}. "
        "Bạn đã tiếp cận và đưa ra giải pháp kỹ thuật như thế nào (STAR)?",
        "Hãy chia sẻ về một tính năng quan trọng bạn đã trực tiếp xây dựng từ đầu cho vị trí {role}. "
        "Mục tiêu là gì và bạn đã đo lường sự thành công của nó như thế nào?",
    ],
    2: [
        "Hãy kể về một sự cố hệ thống nghiêm trọng (system outage / bug nghiêm trọng) bạn từng đối mặt khi làm việc với {role}. "
        "Bạn đã debug và khắc phục sự cố ra sao dưới áp lực thời gian?",
        "Bạn đã từng tối ưu hoá hiệu năng (latency, memory, database query, hoặc cost) cho hệ thống như thế nào? "
        "Kết quả định lượng cụ thể trước và sau khi tối ưu là gì?",
    ],
    3: [
        "Hãy chia sẻ về một tình huống bạn có bất đồng quan điểm kỹ thuật với đồng đội hoặc Tech Lead trong dự án {role}. "
        "Bạn đã thuyết phục hoặc thỏa hiệp như thế nào để đưa ra giải pháp tốt nhất cho dự án?",
        "Khi phải đối mặt với một deadline gấp và khối lượng công việc quá tải, bạn đã ưu tiên (prioritize) các nhiệm vụ kỹ thuật "
        "và quản lý tiến độ bàn giao như thế nào?",
    ],
    4: [
        "Nếu được thiết kế lại một thành phần kiến trúc trong dự án cũ của bạn để chịu tải gấp 10 lần, "
        "bạn sẽ đưa ra các quyết định kỹ thuật nào và tại sao?",
        "Hãy chia sẻ về một công nghệ hoặc kiến trúc mới bạn đã tự học và thuyết phục áp dụng thành công vào dự án {role}.",
    ],
}


def get_default_question_for_round(job_role: str, round_num: int) -> str:
    """Lấy câu hỏi phỏng vấn chuẩn hóa theo chủ đề STAR cho từng vòng cụ thể."""
    role = job_role or "Software Engineer"
    questions = DEFAULT_STAR_QUESTIONS_BY_ROUND.get(round_num) or DEFAULT_STAR_QUESTIONS_BY_ROUND[1]
    return questions[0].format(role=role)


async def ask_question_node(state: InterviewState) -> dict[str, Any]:
    """
    Node tạo/quản lý câu hỏi phỏng vấn:
    - Nếu đã qua vòng cuối (current_round >= total_rounds): Đảm bảo next_question là null.
    - Nếu còn vòng tiếp theo: Giữ next_question từ score_answer hoặc chọn câu hỏi phù hợp cho vòng kế tiếp.
    - Nếu là vòng khởi tạo (chưa có câu trả lời): Khởi tạo current_question cho vòng 1.
    """
    job_role = state.get("job_role", "Software Engineer")
    current_round = max(1, state.get("current_round", 1))
    total_rounds = max(3, state.get("total_rounds", 3))  # 3-4 vòng cố định
    user_answer = state.get("user_answer", "").strip()

    is_finished = current_round >= total_rounds

    if is_finished:
        return {
            "next_question": None,
            "is_finished": True,
        }

    # Nếu đang ở giữa các vòng (current_round < total_rounds)
    next_round = current_round + 1
    existing_next_q = state.get("next_question")

    if existing_next_q and existing_next_q.strip():
        next_q = existing_next_q.strip()
    else:
        next_q = get_default_question_for_round(job_role, next_round)

    # Nếu đây là lệnh khởi tạo buổi phỏng vấn (user_answer rỗng)
    current_q = state.get("current_question")
    if not user_answer or not current_q:
        current_q = get_default_question_for_round(job_role, current_round)

    return {
        "current_question": current_q,
        "next_question": next_q,
        "is_finished": False,
        "current_round": current_round,
        "total_rounds": total_rounds,
    }
