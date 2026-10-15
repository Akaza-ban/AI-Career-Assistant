"""Deterministic input screening before Assistant retrieval or generation.

Patterns cover common attacks, not every possible semantic jailbreak. Prompt
serialization must still escape and isolate all untrusted data separately.
"""

import json
import re
import unicodedata
from html import unescape
from pathlib import Path
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from src.models.assistant import UIAction

from src.services.assistant.text import fold_diacritics

SAFETY_REFUSAL_MESSAGE = "Yêu cầu của bạn vi phạm chính sách an toàn của hệ thống."
SCOPE_REFUSAL_MESSAGE = (
    "Xin lỗi, tôi là trợ lý ảo chuyên hỗ trợ nền tảng CareerV "
    "(hướng dẫn sử dụng tính năng, phân tích CV/JD và phỏng vấn thử). "
    "Tôi không có thông tin về các chủ đề ngoài hệ thống như thời tiết hay đời sống."
)
CHITCHAT_MESSAGE = (
    "Chào bạn! Tôi là trợ lý ảo hỗ trợ nền tảng CareerV. "
    "Tôi luôn sẵn sàng giúp bạn quản lý CV, phân tích khoảng cách kỹ năng với JD "
    "và luyện tập phỏng vấn thử. Hôm nay bạn cần hỗ trợ gì trên hệ thống?"
)

# The original patterns are data shared by the legacy assistant and v2 router.
_GUARDS = json.loads((Path(__file__).parent / "resources" / "guardrails.json").read_text(encoding="utf-8"))
_CHITCHAT_PATTERN = re.compile(_GUARDS["chitchat"])
_CAREERX_TOPIC_PATTERN = re.compile(_GUARDS["topic"])
_OUT_OF_SCOPE_PATTERNS = tuple(re.compile(pattern) for pattern in _GUARDS["out_of_scope"])


def is_role_forbidden(message: str, role: str) -> bool:
    """Shared role gate; sharing guidance does not request an advisor resource."""
    text = _inspection_text(message)
    if any(re.search(pattern, text) for pattern in _GUARDS["role_forbidden"].get(role, [])):
        return True
    if role != "student":
        return False
    terms = [term for term in _GUARDS["student_forbidden"] if re.search(rf"\b{re.escape(term)}\b", text)]
    if _GUARDS["student_conditional_forbidden"] in text:
        terms.append(_GUARDS["student_conditional_forbidden"])
    if not terms:
        return False
    sharing = re.search(_GUARDS["student_sharing_exception"], text)
    # A dashboard remains a forbidden destination even in a sharing sentence.
    return not sharing or any(term not in {"advisor", _GUARDS["student_conditional_forbidden"]} for term in terms)


def is_refusal_response(message: str) -> bool:
    """Recognize refusal wording even when the model omits its refusal flag."""
    text = _inspection_text(re.sub(r"[*_#`]", "", message)).strip()
    if text.startswith("yeu cau cua ban vi pham chinh sach an toan"):
        return True
    if not re.match(r"^(?:xin loi|rat tiec|toi|minh|hien tai|tai lieu)\b", text):
        return False
    return bool(
        re.search(
            r"(?:chua|khong) (?:co|tim thay) (?:thong tin|tai lieu)|"
            r"(?:khong the|khong du|chua du) (?:tra loi|ho tro|bang chung)|"
            r"ngoai (?:pham vi|he thong)|khong (?:co bang chung|the xac dinh|the cung cap)",
            text[:500],
        )
    )


def _inspection_text(message: str) -> str:
    text = unicodedata.normalize("NFKC", unescape(message)).casefold()
    text = "".join(char for char in text if unicodedata.category(char) != "Cf")
    text = fold_diacritics(text)
    return re.sub(r"\s+", " ", text)


def is_chitchat(message: str) -> tuple[bool, str]:
    """Recognize accented/unaccented small talk, including combined greetings."""
    text = re.sub(r"[^\w\s]", " ", _inspection_text(message))
    # Vietnamese particles may be dropped, but English articles inside social
    # phrases ("have a pleasant afternoon") must survive normalization.
    text = re.sub(r"\b(?:oi|nhe|nhi)\b", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text or not re.fullmatch(
        rf"(?:{_CHITCHAT_PATTERN.pattern})(?:\s+(?:{_CHITCHAT_PATTERN.pattern}))*(?:\s+a)?", text
    ):
        return False, ""
    if re.search(r"\b(?:tam biet|goodbye|bye)\b", text):
        return True, "Tạm biệt bạn! Khi cần hỗ trợ về CareerV, CV/JD hoặc phỏng vấn thử, hãy quay lại nhé."
    if re.search(r"\b(?:cam on|thanks|thank you)\b", text):
        return True, "Rất vui được hỗ trợ bạn! Bạn cứ hỏi khi cần hướng dẫn sử dụng CareerV nhé."
    return True, CHITCHAT_MESSAGE


def has_careerx_topic(message: str) -> bool:
    """Topic evidence for filtering short, coincidental lexical matches."""
    return bool(_CAREERX_TOPIC_PATTERN.search(_inspection_text(message)))


def is_out_of_scope(message: str) -> tuple[bool, str]:
    """Reject common unrelated topics without confusing time filters with weather."""
    text = _inspection_text(message)
    if any(pattern.search(text) for pattern in _OUT_OF_SCOPE_PATTERNS):
        return True, SCOPE_REFUSAL_MESSAGE
    return False, ""


_ATTACK_PATTERNS = tuple(re.compile(pattern) for pattern in _GUARDS["attacks"])
_UNSAFE_PATTERNS = tuple(re.compile(pattern) for pattern in _GUARDS["unsafe"])


def inspect_prompt_reason(message: str) -> Literal["injection", "unsafe"] | None:
    """One normalized scan shared by the legacy sanitizer and stage zero."""
    text = _inspection_text(message)
    if any(pattern.search(text) for pattern in _ATTACK_PATTERNS):
        return "injection"
    if any(pattern.search(text) for pattern in _UNSAFE_PATTERNS):
        return "unsafe"
    return None


def sanitize_and_inspect_prompt(message: str) -> tuple[bool, str]:
    """Return (allowed, trimmed input or refusal), without invoking any model.

    Scan a normalized copy to catch casing, diacritics, HTML entities, full-width
    characters and invisible formatting. Preserve accepted text for the user.
    XML escaping belongs at the prompt boundary, not in this input sanitizer.
    """
    if inspect_prompt_reason(message) is not None:
        return False, SAFETY_REFUSAL_MESSAGE
    return True, message.strip()


def validate_ui_actions(actions: list[object], role: str) -> list["UIAction"]:
    """Reject the entire payload when any target is unknown or outside the session role."""
    from pydantic import TypeAdapter

    from src.models.assistant import UIAction
    from src.services.assistant.ui_registry import require_element, resolve_route

    validated = TypeAdapter(list[UIAction]).validate_python(actions)
    for action in validated:
        if action.type == "highlight":
            require_element(action.element_id, role)
        else:
            resolve_route(action.route_id, action.params, role)
    return validated
