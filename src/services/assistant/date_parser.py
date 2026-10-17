"""Small local-date grammar for assistant navigation; all ranges are half-open."""

import re
import unicodedata
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from src.config import get_settings
from src.services.assistant.text import fold_diacritics

_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}
_DATE = re.compile(r"^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$")
_VI_DATE = re.compile(r"^(?:ngay )?(\d{1,2}) thang (\d{1,2})$")
_EN_DATE = re.compile(r"^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)$")


@dataclass(frozen=True)
class LocalDateRange:
    start: date
    end: date  # exclusive


def assistant_timezone() -> tzinfo:
    name = get_settings().assistant_tz
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError:
        if name == "Asia/Ho_Chi_Minh":
            # Windows Python installations may lack the optional IANA database.
            return timezone(timedelta(hours=7), name)
        raise


def _fold(value: str) -> str:
    value = unicodedata.normalize("NFC", value).casefold().strip()
    return " ".join(fold_diacritics(value).split())


def _valid_date(year: int, month: int, day: int) -> date:
    return date(year, month, day)


def parse_local_date_range(expression: str, *, now: datetime | None = None) -> LocalDateRange | None:
    """Parse exactly the expressions documented in architecture 7.3.

    `now` defaults to current time and is evaluated on every call, never cached.
    Dates without an explicit year roll back one year when the candidate is future.
    """
    tz = assistant_timezone()
    instant = now or datetime.now(UTC)
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=UTC)
    today = instant.astimezone(tz).date()
    text = _fold(expression)
    if text in {"hom nay", "today"}:
        return LocalDateRange(today, today + timedelta(days=1))
    if text in {"hom qua", "yesterday"}:
        day = today - timedelta(days=1)
        return LocalDateRange(day, day + timedelta(days=1))
    if text == "hom kia":
        day = today - timedelta(days=2)
        return LocalDateRange(day, day + timedelta(days=1))
    if text in {"tuan truoc", "last week"}:
        this_monday = today - timedelta(days=today.weekday())
        start = this_monday - timedelta(days=7)
        return LocalDateRange(start, this_monday)
    if text in {"thang truoc", "last month"}:
        first_this_month = today.replace(day=1)
        end = first_this_month
        start = (date(end.year - 1, 12, 1) if end.month == 1 else date(end.year, end.month - 1, 1))
        return LocalDateRange(start, end)

    year: int | None = None
    month: int | None = None
    day: int | None = None
    match = _DATE.fullmatch(text)
    if match:
        first, second, year_text = match.groups()
        # Only dd/mm has an optional year; the hyphen form requires yyyy.
        if "/" not in text and year_text is None:
            return None
        day, month = int(first), int(second)
        year = int(year_text) if year_text else None
    else:
        match = _VI_DATE.fullmatch(text)
        if match:
            day = int(match.group(1))
            month = int(match.group(2)) if match.group(2) else today.month
        else:
            match = _EN_DATE.fullmatch(text)
            if match and match.group(2) in _MONTHS:
                day, month = int(match.group(1)), _MONTHS[match.group(2)]
    if day is None or month is None or not 1 <= month <= 12:
        return None
    candidate_year = year or today.year
    try:
        candidate = _valid_date(candidate_year, month, day)
    except ValueError:
        return None
    if year is None and candidate > today:
        try:
            candidate = _valid_date(candidate_year - 1, month, day)
        except ValueError:
            return None
    return LocalDateRange(candidate, candidate + timedelta(days=1))


def local_range_to_utc_naive(value: LocalDateRange, *, tz: tzinfo | None = None) -> tuple[datetime, datetime]:
    """Convert local calendar boundaries to the naive UTC convention used by ORM rows."""
    zone = tz or assistant_timezone()
    start = datetime.combine(value.start, time.min, zone).astimezone(UTC).replace(tzinfo=None)
    end = datetime.combine(value.end, time.min, zone).astimezone(UTC).replace(tzinfo=None)
    return start, end
