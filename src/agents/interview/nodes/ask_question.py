from typing import Any

from src.agents.interview.state import InterviewState


async def ask_question_node(state: InterviewState) -> dict[str, Any]:
    """Node tạo câu hỏi phỏng vấn dựa trên JD, CV hoặc câu hỏi tiếp theo trong danh sách."""
    questions = state.get("questions", [])
    current_index = state.get("current_question_index", 0)

    # Nếu chưa có câu hỏi nào được sinh ra, tạo câu hỏi đầu tiên
    if not questions:
        current_question = f"Chào bạn, hãy giới thiệu ngắn gọn về bản thân và kinh nghiệm liên quan đến vị trí {state.get('job_role', 'này')}."
    elif current_index < len(questions):
        current_question = questions[current_index].get("question", "")
    else:
        current_question = "Buổi phỏng vấn đã hoàn thành. Cảm ơn bạn!"

    return {
        "current_question": current_question,
        "current_question_index": current_index,
    }
