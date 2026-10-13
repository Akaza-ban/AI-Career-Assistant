"""Deterministic input screening before Assistant retrieval or generation.

Patterns cover common attacks, not every possible semantic jailbreak. Prompt
serialization must still escape and isolate all untrusted data separately.
"""

import re
import unicodedata
from html import unescape

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

# Match complete social utterances so a greeting cannot swallow a real request.
_CHITCHAT_PATTERN = re.compile(
    r"(?:(?:xin\s+)?chao(?:\s+ban)?|hello(?:\s+there)?|hi|hey|"
    r"ban\s+(?:la\s+ai|ten\s+(?:la\s+)?gi)|"
    r"(?:hom\s+nay\s+)?(?:ban\s+)?(?:cam\s+thay\s+)?(?:nhu\s+)?the\s+nao|"
    r"(?:hom\s+nay\s+)?ban\s+(?:co\s+)?khoe\s+(?:khong|chua)|"
    r"(?:toi\s+)?cam\s+on(?:\s+ban)?|tam\s+biet(?:\s+ban)?|"
    r"thanks(?:\s+you)?|thank\s+you|goodbye|bye|how\s+are\s+you|who\s+are\s+you)"
)

_CAREERX_TOPIC_PATTERN = re.compile(
    r"\b(?:careerv|careerx|edu\s*17|cv|jd|star|phong van|interview|sinh vien|student|advisor|"
    r"ky nang|skill|tai lieu|lich su|history|diem|score|match|phan tich|analysis|"
    r"ho so|tai len|upload|chia se|co van|bo loc|filter|cai dat|settings|"
    r"dang nhap|dang ky|he thong|nen tang|thong ke|dashboard|nhan xet|feedback|"
    r"pdf|docx|nghe nghiep|tien bo|readiness|analytics|reviews|dinh dang)\b"
)

_OUT_OF_SCOPE_PATTERNS = tuple(
    re.compile(pattern)
    for pattern in (
        r"\b(?:thoi tiet|weather|weather forecast)\b",
        r"\bdu bao\s+(?:mua|nang|bao|nhiet do|ngay mai|hom nay)\b",
        r"\b(?:nau an|nau mon|cong thuc\s+(?:mon an|nau|lam banh|banh|pizza)|recipe|recipes)\b",
        r"\b(?:hom nay|ngay mai|toi nay|trua nay)\b.{0,30}\ban\s+gi\b",
        r"\b(?:an gi\s+(?:hom nay|ngay mai)|goi y\s+mon an)\b",
        r"\b(?:tu vi|boi toan|boi bai|cung hoang dao|horoscope|astrology)\b",
        r"\b(?:ket qua|ty so|lich thi dau|xem|tran)\b.{0,50}\b(?:bong da|the thao|world cup|premier league|nba)\b",
        r"\b(?:bong da|the thao|world cup|premier league|nba)\b.{0,50}\b(?:ai thang|ty so|toi nay|hom nay|ket qua)\b",
        r"\b(?:tin tuc\s+(?:tong hop|the gioi|hom nay|moi nhat)|thoi su|general news)\b",
        r"\b(?:toan do vui|do vui\s+(?:toan|toan hoc)|giai\s+(?:cau do|bai toan)|math puzzle)\b",
    )
)


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
    text = unicodedata.normalize("NFD", text).replace("đ", "d")
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", text)


def is_chitchat(message: str) -> tuple[bool, str]:
    """Recognize accented/unaccented small talk, including combined greetings."""
    text = re.sub(r"[^\w\s]", " ", _inspection_text(message))
    text = re.sub(r"\b(?:oi|a|nhe|nhi)\b", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text or not re.fullmatch(rf"(?:{_CHITCHAT_PATTERN.pattern})(?:\s+(?:{_CHITCHAT_PATTERN.pattern}))*", text):
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


_ATTACK_PATTERNS = tuple(
    re.compile(pattern)
    for pattern in (
        # Attempts to override instructions, including Vietnamese without accents.
        r"\b(?:ignore|disregard|forget|override|bypass)\b.{0,80}\b(?:instructions?|rules?|polic(?:y|ies))\b",
        r"\b(?:quen|bo qua|phot lo|vo hieu hoa)\b.{0,80}\b(?:chi dan|huong dan|quy tac)\b",
        r"\b(?:ban la|you are|act as|pretend to be)\b.{0,80}\b(?:khong gioi han|unrestricted|unlimited|uncensored)\b",
        r"\b(?:developer mode|jailbreak|do anything now)\b",
        # System/developer prompt exfiltration in either word order.
        r"\b(?:reveal|show|print|read|repeat|expose|display|dump)\b.{0,80}\b(?:system|developer)\s+(?:prompt|instructions?)\b",
        r"\b(?:system|developer)\s+(?:prompt|instructions?)\b.{0,80}\b(?:reveal|show|print|read|repeat|expose|display|dump)\b",
        r"\b(?:doc|hien thi|tiet lo|in ra|cho xem|cho toi xem)\b.{0,80}\b(?:system prompt|prompt he thong|chi dan he thong|loi nhac he thong)\b",
        # Destructive requests are outside the Assistant action protocol.
        r"\b(?:delete|erase|wipe|destroy|remove|drop|truncate)\b.{0,80}\b(?:data|database|tables?|records?|files?)\b",
        r"\b(?:xoa|huy|pha huy)\b.{0,80}\b(?:du lieu|co so du lieu|bang|tep|tap tin|ho so|cv)\b",
        r"\b(?:rm\s+-[a-z]*r[a-z]*f|rm\s+-[a-z]*f[a-z]*r|remove-item|del\s+/[fsq])\b",
        # Reject markup, including fake XML role/delimiter tags and scripts.
        r"<\s*/?\s*[a-z][\w:.-]*(?:\s[^<>]*?)?\s*/?\s*>",
        r"<!\s*(?:doctype|--)",
        r"\b(?:javascript\s*:|on(?:click|error|load)\s*=)",
        r"\[\s*(?:/?inst|system)\s*\]|<\|(?:im_start|im_end|system)\|>",
    )
)


def sanitize_and_inspect_prompt(message: str) -> tuple[bool, str]:
    """Return (allowed, trimmed input or refusal), without invoking any model.

    Scan a normalized copy to catch casing, diacritics, HTML entities, full-width
    characters and invisible formatting. Preserve accepted text for the user.
    XML escaping belongs at the prompt boundary, not in this input sanitizer.
    """
    text = _inspection_text(message)
    if any(pattern.search(text) for pattern in _ATTACK_PATTERNS):
        return False, SAFETY_REFUSAL_MESSAGE
    return True, message.strip()
