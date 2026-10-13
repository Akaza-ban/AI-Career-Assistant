"""Four ordered detection layers. All offsets refer to the input string."""

import re
import unicodedata
from collections.abc import Iterable

from src.services.privacy.types import Identity, MaskingError, Ner, NerUnavailableError, Span

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
_ADDRESS = re.compile(r"(?im)^\s*(?:home\s+address|address|địa chỉ|nơi ở|residence)\s*[:=-]\s*(\S[^\n;|]*)")
_STREET = re.compile(
    r"(?im)(?<!\w)\d+[A-Za-z]?(?:[/.-]\d+)?[ \t]+(?:(?:đường|street|phố)[ \t]+)?"
    r"[^\n;|]{1,100}?(?:\b(?:Street|St\.?|Road|Rd\.?|Lane|Ln\.?|Avenue|Ave\.?|Drive|Dr\.?)\b|"
    r",\s*(?:phường|quận|ward|district)\s+[^\n;|]+)"
)
_NAME_LABEL = re.compile(
    rf"(?im)\b(?:full name|candidate|name|họ và tên|họ tên|tên|referee|reference|recruiter|contact person|"
    rf"người tham chiếu|người tuyển dụng|sinh viên|student|advisor|cố vấn)\s*[:=-]\s*({_NAME})"
)
_KEEP_LABEL = re.compile(
    r"(?i)^\s*(?:skills?|kỹ năng|employer|company|công ty|school|university|education|học vấn|trường|project|dự án|location|city|job title|position)\s*:"
)
_NOT_NAME = frozenset(
    "curriculum vitae resume cv software engineer developer backend frontend full stack data scientist "
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
    return sorted(spans, key=lambda span: (span.start, span.end))


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
    for kind, pattern in (("ID", _ID_LABEL), ("DOB", _DOB), ("ADDRESS", _ADDRESS), ("PERSON", _NAME_LABEL)):
        for match in pattern.finditer(text):
            start, end = match.span(1)
            end -= len(text[start:end]) - len(text[start:end].rstrip(" .,"))
            spans.append(Span(start, end, kind, 2))
    for match in _STREET.finditer(text):
        spans.append(Span(match.start(), match.end(), "ADDRESS", 2))
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
            best = min((previous, span), key=lambda s: (priority[s.kind], s.layer))
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
    for span in found:
        line_start = text.rfind("\n", 0, span.start) + 1
        line_end = text.find("\n", span.end)
        line = text[line_start : line_end if line_end >= 0 else len(text)]
        if _KEEP_LABEL.match(line):
            continue
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
