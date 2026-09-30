from langgraph.graph import END, START, StateGraph

from src.agents.gap_analysis.nodes import (
    compare_gap_node,
    generate_suggestions_node,
    parse_cv_node,
    retrieve_context_node,
)
from src.agents.gap_analysis.state import GapAnalysisState


def build_gap_analysis_graph():
    """
    Khởi tạo StateGraph 4-node cho Gap Analysis Agent:
    parse -> retrieve -> compare -> generate
    Ràng buộc: Chỉ diễn đạt lại nội dung có trong CV, kèm evidence_span trích từ CV gốc.
    """
    workflow = StateGraph(GapAnalysisState)

    # 1. Thêm 4 nodes
    workflow.add_node("parse", parse_cv_node)
    workflow.add_node("retrieve", retrieve_context_node)
    workflow.add_node("compare", compare_gap_node)
    workflow.add_node("generate", generate_suggestions_node)

    # 2. Thêm các cạnh nối (Edges) tuần tự
    workflow.add_edge(START, "parse")
    workflow.add_edge("parse", "retrieve")
    workflow.add_edge("retrieve", "compare")
    workflow.add_edge("compare", "generate")
    workflow.add_edge("generate", END)

    return workflow.compile()


gap_analysis_agent = build_gap_analysis_graph()
