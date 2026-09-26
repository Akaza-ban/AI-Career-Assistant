from langgraph.graph import END, START, StateGraph

from src.agents.interview.nodes import (
    ask_question_node,
    score_answer_node,
)
from src.agents.interview.state import InterviewState


def build_interview_graph():
    """Khởi tạo StateGraph cho Interview Agent."""
    workflow = StateGraph(InterviewState)

    # Thêm các nodes
    workflow.add_node("ask_question", ask_question_node)
    workflow.add_node("score_answer", score_answer_node)

    # Thêm các edges
    workflow.add_edge(START, "ask_question")
    workflow.add_edge("ask_question", "score_answer")
    workflow.add_edge("score_answer", END)

    return workflow.compile()


interview_agent = build_interview_graph()
