"""
Sửa tên công cụ / kỹ năng bị OCR đọc nhầm ("Scikit-leam" → "Scikit-Learn", "Kubemetes" → "Kubernetes") bằng danh sách
kỹ năng hệ thống đã dùng để phân tích CV–JD: taxonomy, bảng lộ trình và kỹ năng của thư viện JD (tự lớn lên khi thư
viện thêm vị trí). Chỉ dùng cho chữ đọc bằng OCR; chỉ xét dòng liệt kê (có dấu phẩy, "Nhãn: a, b", trong ngoặc) để
câu văn thường không bị đổi; chỉ sửa khi gần đúng và chỉ có một tên khớp nhất.
"""

import re
from collections.abc import Iterable

from src.services.roadmap import SKILL_ROADMAP_MAP
from src.services.taxonomy import STATIC_TAXONOMY

_TOKEN = re.compile(r"[A-Za-z][A-Za-z0-9.+#-]*[A-Za-z0-9+#]")
# Hai mảnh liền nhau cách bởi đúng một dấu cách ("Scikit-lea m"), mảnh sau ngắn
_PAIR = re.compile(r"(?<![\w.+#-])([A-Za-z][A-Za-z0-9.+#-]*) ([A-Za-z0-9+#]{1,4})(?![\w.+#-])")
_LIST_LINE = re.compile(r",.*,|^[^:]{1,40}:\s*\S|\(")


def static_vocabulary() -> list[str]:
    return [*STATIC_TAXONOMY, *STATIC_TAXONOMY.values(), *SKILL_ROADMAP_MAP]


def _distance(a: str, b: str, limit: int) -> int:
    """Khoảng cách Levenshtein, dừng sớm khi chắc chắn vượt `limit`."""
    if abs(len(a) - len(b)) > limit:
        return limit + 1
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        if min(cur) > limit:
            return limit + 1
        prev = cur
    return prev[-1]


def _styled(term: str, original: str) -> str:
    """Giữ kiểu viết của tên chuẩn; tên chuẩn viết thường thì viết hoa chữ đầu nếu chữ OCR viết hoa."""
    if term.islower() and original[:1].isupper():
        return term[:1].upper() + term[1:]
    return term


def fix_terms(text: str, vocabulary: Iterable[str]) -> str:
    terms: dict[str, str] = {}
    for term in vocabulary:
        term = term.strip()
        if " " not in term and len(term) >= 5:
            # Tên chuẩn có chữ hoa (từ thư viện / taxonomy) được ưu tiên hơn bản viết thường của bảng lộ trình
            if term.lower() not in terms or not terms[term.lower()].islower():
                terms.setdefault(term.lower(), term)
                if not term.islower():
                    terms[term.lower()] = term
    if not terms:
        return text

    def best(low: str) -> str | None:
        """Tên chuẩn gần nhất (sai ≤ 1 ký tự với từ ngắn, ≤ 2 với từ dài) nếu chỉ có một tên khớp nhất."""
        limit = 1 if len(low) <= 7 else 2
        scored = sorted((d, key) for key in terms if (d := _distance(low, key, limit)) <= limit)
        if not scored or (len(scored) > 1 and scored[0][0] == scored[1][0]):
            return None
        return terms[scored[0][1]]

    def fix_pair(match: re.Match[str]) -> str:
        # Dấu cách chèn nhầm giữa một tên công cụ ("Scikit-lea m"): thử ghép hai mảnh rồi mới so với danh sách
        a, b = match.group(1), match.group(2)
        if a.lower() in terms or b.lower() in terms or len(a + b) < 5:
            return match.group(0)
        term = best((a + b).lower())
        return _styled(term, a) if term else match.group(0)

    def fix_token(match: re.Match[str]) -> str:
        token = match.group(0)
        low = token.lower()
        if len(low) < 5 or low in terms:
            return token
        term = best(low)
        return _styled(term, token) if term else token

    def fix_line(line: str) -> str:
        if not _LIST_LINE.search(line):
            return line
        line = _PAIR.sub(fix_pair, line)
        return _TOKEN.sub(fix_token, line)

    return "\n".join(fix_line(line) for line in text.splitlines())


def rejoin_headings(text: str) -> str:
    """
    Tiêu đề mục bị OCR tách đôi ("EDU CATION", "SKI LLS"): dòng đã được nhận là tiêu đề, từ khoá gốc viết liền thì
    ghép lại. "WORK EXPERIENCE" (từ khoá có dấu cách) giữ nguyên.
    """
    from src.services.skill_matching import _SECTION_KEYWORDS, _match_section, fold

    joined = {fold(kw) for _, kws in _SECTION_KEYWORDS for kw in kws if " " not in kw}
    out = []
    for line in text.splitlines():
        stripped = line.strip()
        if " " in stripped and fold(stripped) in joined and _match_section(stripped)[1]:
            line = line.replace(stripped, stripped.replace(" ", ""))
        out.append(line)
    return "\n".join(out)
