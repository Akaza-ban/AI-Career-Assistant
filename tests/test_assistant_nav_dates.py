from datetime import UTC, date, datetime

from src.services.assistant.date_parser import LocalDateRange, local_range_to_utc_naive, parse_local_date_range


def test_local_date_forms_and_year_rollover() -> None:
    now = datetime(2026, 10, 16, 12, tzinfo=UTC)
    assert parse_local_date_range("12/10", now=now) == LocalDateRange(date(2026, 10, 12), date(2026, 10, 13))
    assert parse_local_date_range("12/10/2025", now=now) == LocalDateRange(date(2025, 10, 12), date(2025, 10, 13))
    assert parse_local_date_range("12-10-2025", now=now) == LocalDateRange(date(2025, 10, 12), date(2025, 10, 13))
    assert parse_local_date_range("12 tháng 10", now=now) == LocalDateRange(date(2026, 10, 12), date(2026, 10, 13))
    assert parse_local_date_range("12th October", now=now) == LocalDateRange(date(2026, 10, 12), date(2026, 10, 13))
    assert parse_local_date_range("12/10", now=datetime(2026, 10, 1, tzinfo=UTC)) == LocalDateRange(
        date(2025, 10, 12), date(2025, 10, 13)
    )


def test_relative_ranges_are_based_on_resolution_date() -> None:
    now = datetime(2026, 1, 1, 0, 30, tzinfo=UTC)
    assert parse_local_date_range("today", now=now) == LocalDateRange(date(2026, 1, 1), date(2026, 1, 2))
    assert parse_local_date_range("hôm qua", now=now) == LocalDateRange(date(2025, 12, 31), date(2026, 1, 1))
    assert parse_local_date_range("yesterday", now=now) == LocalDateRange(date(2025, 12, 31), date(2026, 1, 1))
    assert parse_local_date_range("last week", now=now) == LocalDateRange(date(2025, 12, 22), date(2025, 12, 29))
    assert parse_local_date_range("tháng trước", now=now) == LocalDateRange(date(2025, 12, 1), date(2026, 1, 1))


def test_local_day_converts_to_utc_storage_boundaries() -> None:
    span = LocalDateRange(date(2026, 10, 12), date(2026, 10, 13))
    assert local_range_to_utc_naive(span) == (
        datetime(2026, 10, 11, 17),
        datetime(2026, 10, 12, 17),
    )


def test_only_documented_date_grammar_is_accepted() -> None:
    now = datetime(2026, 10, 16, tzinfo=UTC)
    assert parse_local_date_range("October 12", now=now) is None
    assert parse_local_date_range("12-10", now=now) is None
    assert parse_local_date_range("ngày 12", now=now) is None
    assert parse_local_date_range("31/02/2026", now=now) is None
