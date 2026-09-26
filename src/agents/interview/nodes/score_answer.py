from typing import Any

from src.agents.interview.state import InterviewState


async def score_answer_node(state: InterviewState) -> dict[str, Any]:
    """Node chấm điểm và đánh giá câu trả lời của ứng viên (STAR method, độ chính xác kỹ thuật)."""
    current_question = state.get("current_question", "")
    user_answer = state.get("user_answer", "")
    current_index = state.get("current_question_index", 0)
    questions = state.get("questions", [])

    # TODO: Gọi LLM đánh giá câu trả lời theo rubric STAR & kỹ thuật
    evaluation = {
        "question_index": current_index,
        "question": current_question,
        "answer": user_answer,
        "score": 8.0,
        "feedback": "Câu trả lời rõ ràng, có cấu trúc tốt.",
    }

    scores = list(state.get("evaluation_scores", []))
    scores.append(evaluation)

    next_index = current_index + 1
    is_finished = next_index >= len(questions) if questions else True

    return {
        "evaluation_scores": scores,
        "current_question_index": next_index,
        "is_finished": is_finished,
        "feedback": evaluation["feedback"],
    }
