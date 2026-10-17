from langgraph.graph import END, START, StateGraph

from src.agents.interview.nodes import (
    ask_question_node,
    score_answer_node,
)
from src.agents.interview.state import InterviewState
from src.services.providers.gateway import UntracedGraph


def route_interview_entry(state: InterviewState) -> str:
    """
    Định tuyến điểm bắt đầu của Graph:
    - Nếu sinh viên gửi câu trả lời (user_answer): Chuyển thẳng vào node 'score_answer' để chấm điểm STAR.
    - Nếu chưa có câu trả lời (khởi tạo buổi phỏng vấn): Chuyển vào 'ask_question' để tạo câu hỏi đầu tiên.
    """
    if state.get("user_answer") and state["user_answer"].strip():
        return "score_answer"
    return "ask_question"


def build_interview_graph():
    """
    Khởi tạo StateGraph cho Mock Interview Agent:
    - Ràng buộc: 3-4 vòng cố định, không có logic escalation.
    - Validate JSON output + retry 1 lần qua node score_answer.
    - Luồng:
      * Chấm điểm: START -> score_answer -> ask_question -> END
      * Khởi tạo: START -> ask_question -> END
    """
    workflow = StateGraph(InterviewState)

    # Thêm các nodes
    workflow.add_node("score_answer", score_answer_node)
    workflow.add_node("ask_question", ask_question_node)

    # Thêm conditional entry edge
    workflow.add_conditional_edges(
        START,
        route_interview_entry,
        {
            "score_answer": "score_answer",
            "ask_question": "ask_question",
        },
    )

    # Sau khi score_answer thì chuyển sang ask_question để hoàn thiện next_question hoặc kết thúc
    workflow.add_edge("score_answer", "ask_question")
    workflow.add_edge("ask_question", END)

    return UntracedGraph(workflow.compile())


interview_agent = build_interview_graph()
