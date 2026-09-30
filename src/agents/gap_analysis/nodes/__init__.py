from .compare_gap import compare_gap_node
from .generate_suggestions import generate_suggestions_node
from .parse_cv import parse_cv_node
from .retrieve_context import retrieve_context_node

# Bí danh cho 4 node theo yêu cầu: parse -> retrieve -> compare -> generate
parse_node = parse_cv_node
retrieve_node = retrieve_context_node
compare_node = compare_gap_node
generate_node = generate_suggestions_node

__all__ = [
    "parse_cv_node",
    "retrieve_context_node",
    "compare_gap_node",
    "generate_suggestions_node",
    "parse_node",
    "retrieve_node",
    "compare_node",
    "generate_node",
]
