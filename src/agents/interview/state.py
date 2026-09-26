from typing import Any

from typing_extensions import TypedDict


class InterviewState(TypedDict, total=False):
    """State schema cho Mock Interview Agent."""

    job_role: str
    jd_context: str
    cv_summary: str
    questions: list[dict[str, Any]]
    current_question_index: int
    current_question: str
    user_answer: str
    chat_history: list[dict[str, str]]
    evaluation_scores: list[dict[str, Any]]
    feedback: str
    is_finished: bool
    error: str | None
