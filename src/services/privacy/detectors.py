"""Four ordered detection layers. All offsets refer to the input string."""

import re
import unicodedata
from collections.abc import Iterable

from src.services.privacy.types import KINDS, Identity, MaskingError, Ner, NerUnavailableError, Span

_WORD = r"[^\W\d_]+(?:[-'][^\W\d_]+)*"
_NAME = rf"{_WORD}(?:[ \t]+{_WORD}){{1,5}}"
_EMAIL = re.compile(r"(?<![\w.+-])[\w.!#$%&'*+/=?^`{|}~-]+@[\w-]+(?:\.[\w-]+)+", re.UNICODE)
_URL = re.compile(r"\b(?:https?://|www\.)[^\s<>\[\]\"']+|\b(?:linkedin\.com/in|github\.com)/[^\s<>]+", re.I)
_HANDLE = re.compile(r"(?<![\w@])@[\w][\w.-]{1,63}\b")
_PHONE = re.compile(r"(?<!\w)(?:\+\d{1,3}[ .-]?)?(?:\(?\d{2,4}\)?[ .-]?){2,5}\d{2,4}(?!\w)")
_ID = re.compile(r"(?<!\w)(?:\d{9}|\d{12}|[A-Z]{1,2}\d{6,9})(?!\w)")
_ID_LABEL = re.compile(
    r"(?im)\b(?:CCCD|CMND|national\s*ID|student\s*ID|mã\s*sinh\s*viên|MSSV|passport|hộ\s*chiếu|ID)\s*[:=#-]\s*([\w-]{5,24})"
)
_DOB = re.compile(
    r"(?im)\b(?:DOB|date of birth|birthdate|ngày sinh|sinh ngày)\s*[:=-]?\s*(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})"
)
_ADDRESS = re.compile(r"(?im)^\s*(?:home\s+address|address|địa chỉ|nơi ở|residence)\s*[:=-]\s*(\S[^\r\n;|]*)")
_ADDRESS_LINE = re.compile(
    r"(?im)^[ \t]*(?:đường|phố|street|phường|ward|quận|district)(?:[ \t]*[:=-][ \t]*|[ \t]+)(\S[^\r\n;|]*)"
)
_STREET = re.compile(
    r"(?im)(?<!\w)\d+[A-Za-z]?(?:[/.-]\d+)?[ \t]+(?:(?:đường|street|phố)[ \t]+)?"
    r"[^\r\n;|]{1,100}?(?:\b(?:Street|St\.?|Road|Rd\.?|Lane|Ln\.?|Avenue|Ave\.?|Drive|Dr\.?)\b|"
    r",[ \t]*(?:phường|quận|ward|district)[ \t]+[^\r\n;|]+)"
)
_NAME_LABEL = re.compile(
    rf"(?im)\b(?:full name|candidate|name|họ và tên|họ tên|tên|referee|reference|recruiter|contact person|"
    rf"người tham chiếu|người tuyển dụng|sinh viên|student|advisor|cố vấn)\s*[:=-]\s*({_NAME})"
)
_PERSON_CONTEXT = re.compile(
    rf"(?im)\b(?:my name is|I am|tôi là|tên tôi là|ứng viên|applicant|candidate)[ \t]+({_NAME})"
)
_REFEREE_CONTEXT = re.compile(
    rf"(?m)^[ \t]*({_NAME})(?=[ \t]+(?:supervised|mentored|referred|reviewed|hướng dẫn|giới thiệu)\b)"
)
_PII_LABEL = re.compile(
    r"(?i)^[ \t]*(?:full name|candidate|name|họ và tên|họ tên|tên|referee|reference|recruiter|"
    r"contact person|người tham chiếu|người tuyển dụng|sinh viên|student|advisor|cố vấn|"
    r"email|reference email|phone|điện thoại|sđt|CCCD|CMND|national ID|student ID|MSSV|passport|"
    r"DOB|ngày sinh|date of birth|address|home address|địa chỉ|profile|handle|URL|employment|"
    r"work experience|experience|summary|giới thiệu|literal user text|error|filename)[ \t]*[:=-][ \t]*"
)
_KEEP_CONTEXT = re.compile(
    r"(?i)\b(?:worked at|employed by|làm việc tại|công ty|studied at|graduated from|học tại)[ \t]+([^.;\n|]+)"
)
_KEEP_SUFFIX = re.compile(
    r"(?i)[;|]|(?:,[ \t]*)?\b(?:contact|recruiter|referee|contact person|người tham chiếu|người tuyển dụng|liên hệ)\b"
)
_ESCAPED_OPAQUE = re.compile(r"&#91;&#91;(?:" + "|".join(sorted(KINDS)) + r")_(?:[a-f0-9]{32}_)?[0-9]{1,39}\]\]")
_KEEP_LABEL = re.compile(
    r"(?i)^\s*(?:skills?|kỹ năng|employer|company|công ty|school|university|education|học vấn|trường|project|dự án|location|city|job title|position)\s*:"
)
_NOT_NAME = frozenset(
    "curriculum vitae resume cv jd json api software engineer developer backend frontend full stack data scientist "
    "machine learning deep learning artificial intelligence computer science university college school "
    "institute academy company corporation limited ltd inc bachelor master doctor python java javascript "
    "typescript react nextjs fastapi sql docker kubernetes microsoft amazon google fpt kỹ năng học vấn "
    "kinh nghiệm dự án lập trình kỹ sư thông tin công nghệ tuyển dụng hồ sơ".split()
)


def _fold(text: str) -> tuple[str, list[int]]:
    folded: list[str] = []
    indices: list[int] = []
    for index, char in enumerate(text):
        value = "".join(c for c in unicodedata.normalize("NFD", char) if not unicodedata.combining(c))
        value = value.replace("đ", "d").replace("Đ", "D").casefold()
        folded.extend(value)
        indices.extend([index] * len(value))
    return "".join(folded), indices


def _one_edit_apart(left: str, right: str) -> bool:
    """Bounded Levenshtein distance <= 1, without an unbounded DP matrix."""
    if abs(len(left) - len(right)) > 1:
        return False
    if len(left) > len(right):
        left, right = right, left
    i = j = edits = 0
    while i < len(left) and j < len(right):
        if left[i] == right[j]:
            i += 1
            j += 1
        else:
            edits += 1
            if edits > 1:
                return False
            if len(left) == len(right):
                i += 1
            j += 1
    return edits + (len(right) - j) <= 1


def _fuzzy_name_spans(folded: str, indices: list[int], needle: str) -> list[Span]:
    # Only authenticated multi-word names, never fuzzy emails/phones or short
    # names. One edit across the whole name bounds accidental matches. Restrict
    # windows to word boundaries on one line; never merge separate CV fields.
    words = needle.split()
    if len(words) < 2 or len(needle) < 8:
        return []
    tokens = list(re.finditer(r"\w+", folded))
    result: list[Span] = []
    for first in range(len(tokens) - len(words) + 1):
        window = tokens[first : first + len(words)]
        start, end = window[0].start(), window[-1].end()
        if any(not re.fullmatch(r"[ \t]+", folded[a.end() : b.start()]) for a, b in zip(window, window[1:])):
            continue
        candidate = " ".join(token.group() for token in window)
        if candidate != needle and _one_edit_apart(candidate, needle):
            result.append(Span(indices[start], indices[end - 1] + 1, "PERSON", 1))
    return result


def identity_spans(text: str, identities: Iterable[Identity]) -> list[Span]:
    folded, indices = _fold(text)
    spans: list[Span] = []
    for identity in identities:
        names = {identity.name.strip()}
        words = identity.name.split()
        if words:
            names.update({" ".join(reversed(words)), " ".join(words[1:] + words[:1])})
        for kind, values in (("PERSON", names), ("EMAIL", {identity.email}), ("PHONE", {identity.phone})):
            for value in values:
                if not value:
                    continue
                needle, _ = _fold(value)
                for match in re.finditer(r"(?<!\w)" + re.escape(needle) + r"(?!\w)", folded):
                    spans.append(Span(indices[match.start()], indices[match.end() - 1] + 1, kind, 1))
                if kind == "PERSON":
                    spans.extend(_fuzzy_name_spans(folded, indices, " ".join(needle.split())))
    return sorted(set(spans), key=lambda span: (span.start, span.end))


def regex_spans(text: str) -> list[Span]:
    spans: list[Span] = []
    for kind, pattern in (("EMAIL", _EMAIL), ("URL", _URL), ("HANDLE", _HANDLE), ("ID", _ID)):
        for match in pattern.finditer(text):
            end = match.end()
            if kind == "URL":
                end = match.start() + len(match.group().rstrip(".,;:!?)"))
            spans.append(Span(match.start(), end, kind, 2))
    for match in _PHONE.finditer(text):
        value = match.group()
        digits = re.sub(r"\D", "", value)
        if 8 <= len(digits) <= 15 and not re.fullmatch(r"\d{4}\s*[-.]\s*\d{4}", value):
            spans.append(Span(match.start(), match.end(), "PHONE", 2))
    for kind, pattern in (
        ("ID", _ID_LABEL),
        ("DOB", _DOB),
        ("ADDRESS", _ADDRESS),
        ("ADDRESS", _ADDRESS_LINE),
        ("PERSON", _NAME_LABEL),
    ):
        for match in pattern.finditer(text):
            start, end = match.span(1)
            end -= len(text[start:end]) - len(text[start:end].rstrip(" .,\r\t"))
            if (
                kind == "ADDRESS"
                and pattern is _ADDRESS
                and not re.search(
                    r"(?i)\d|\b(?:street|road|lane|avenue|drive|đường|phố|phường|quận|ward|district)\b", text[start:end]
                )
            ):
                # A city/country-only address field is not a home/street address.
                continue
            spans.append(Span(start, end, kind, 2))
    for match in _STREET.finditer(text):
        spans.append(Span(match.start(), match.end(), "ADDRESS", 2))
    for pattern in (_PERSON_CONTEXT, _REFEREE_CONTEXT):
        for match in pattern.finditer(text):
            name = match.group(1)
            words = list(re.finditer(_WORD, name))
            capitalized = []
            for word in words:
                if not word.group()[0].isupper():
                    break
                capitalized.append(word)
            if len(capitalized) >= 2:
                end = capitalized[-1].end()
                if not set(name[:end].casefold().split()) & _NOT_NAME:
                    spans.append(Span(match.start(1), match.start(1) + end, "PERSON", 2))
    return spans


def header_spans(text: str) -> list[Span]:
    spans: list[Span] = []
    offset = 0
    nonempty = 0
    for line in text.splitlines(keepends=True):
        candidate = line.strip()
        if candidate:
            nonempty += 1
            if nonempty > 3:
                break
            words = candidate.split()
            if (
                re.fullmatch(_NAME, candidate)
                and all(word[0].isupper() for word in words)
                and not set(candidate.casefold().split()) & _NOT_NAME
            ):
                start = offset + len(line) - len(line.lstrip())
                spans.append(Span(start, start + len(candidate), "PERSON", 3))
        offset += len(line)
    return spans


def merge_spans(spans: Iterable[Span], text_length: int) -> list[Span]:
    """Union overlapping detections, retaining the most specific kind/earliest layer."""
    priority = {"EMAIL": 0, "URL": 1, "ID": 2, "PHONE": 3, "DOB": 4, "ADDRESS": 5, "PERSON": 6, "HANDLE": 7}
    result: list[Span] = []
    for span in sorted(spans, key=lambda s: (s.start, s.end)):
        if span.kind not in priority or not 0 <= span.start < span.end <= text_length:
            raise MaskingError("Invalid detector span")
        if result and span.start < result[-1].end:
            previous = result.pop()
            best = min((previous, span), key=lambda s: (s.layer, priority[s.kind]))
            result.append(Span(previous.start, max(previous.end, span.end), best.kind, min(previous.layer, span.layer)))
        else:
            result.append(span)
    return result


def _ner_spans(text: str, ner: Ner) -> list[Span]:
    try:
        found = list(ner.detect(text))
        # Validate even discarded entities so corrupt offsets cannot silently pass.
        merge_spans(found, len(text))
    except Exception:
        raise NerUnavailableError("Local NER inference failed; provider calls are forbidden") from None
    spans: list[Span] = []
    keep_contexts = []
    for match in _KEEP_CONTEXT.finditer(text):
        start, end = match.span(1)
        suffix = _KEEP_SUFFIX.search(text, start, end)
        if suffix is not None and suffix.start() > start:
            end = suffix.start()
        keep_contexts.append((start, end))
    opaque_spans = [match.span() for match in _ESCAPED_OPAQUE.finditer(text)]
    for span in found:
        if any(start <= span.start and span.end <= end for start, end in opaque_spans):
            continue
        line_start = text.rfind("\n", 0, span.start) + 1
        line_end = text.find("\n", span.end)
        line = text[line_start : line_end if line_end >= 0 else len(text)]
        keep_label = _KEEP_LABEL.match(line)
        if keep_label is not None:
            # Preserve the typed employer/school/skill value, while still running
            # PERSON NER on recruiter/referee text later in the same line.
            value_start = line_start + keep_label.end()
            suffix = _KEEP_SUFFIX.search(line, keep_label.end())
            value_end = line_start + (suffix.start() if suffix is not None else len(line))
            if span.end <= value_start or value_start <= span.start and span.end <= value_end:
                continue
            if span.start < value_start and span.end <= value_end:
                continue
        if span.kind == "PERSON" and set(text[span.start : span.end].casefold().split()).issubset(_NOT_NAME):
            continue
        if any(start <= span.start and span.end <= end for start, end in keep_contexts):
            continue
        label = _PII_LABEL.match(line)
        if label is not None:
            value_start = line_start + label.end()
            if span.end <= value_start:
                continue
            if span.start < value_start:
                span = Span(value_start, span.end, span.kind, span.layer)
        if span.kind == "ADDRESS":
            # NER LOCATION does not by itself distinguish a home from a city.
            if not re.search(
                r"(?i)\d|\b(?:street|road|đường|phố|phường|quận|ward|district)\b", text[span.start : span.end]
            ):
                continue
        spans.append(span)
    return spans


class Detector:
    def __init__(self, ner: Ner | None = None) -> None:
        self.ner = ner

    def detect(self, text: str, *, identities: Iterable[Identity] = (), document_type: str = "message") -> list[Span]:
        if self.ner is None:
            raise NerUnavailableError("Local NER was not initialized; provider calls are forbidden")
        try:
            spans = identity_spans(text, identities)
            spans.extend(regex_spans(text))
            if document_type == "cv":
                spans.extend(header_spans(text))
            spans.extend(_ner_spans(text, self.ner))
            return merge_spans(spans, len(text))
        except MaskingError:
            raise
        except Exception:
            raise MaskingError("Local PII detection failed; provider calls are forbidden") from None
