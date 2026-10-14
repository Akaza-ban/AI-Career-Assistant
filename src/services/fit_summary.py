"""Nhận xét mức phù hợp CV–JD, ghép từ bảng kết quả cuối (sau khi kết hợp AI và quy tắc) nên luôn khớp với bảng."""

import re
from typing import Any

from src.services.skill_matching import EVIDENCE_SECTIONS

_DATE = re.compile(r"\b\d{1,2}/\d{4}\b|\b(?:19|20)\d{2}\b")
# "Maintenance Management Platform 07/2023 - 11/2023" → bỏ phần ngày ở cuối dòng tiêu đề
_TRAILING_DATES = re.compile(r"[\s|,–-]*\(?\s*(?:\d{1,2}/)?(?:19|20)\d{2}.*$")


def _join(items: list[str]) -> str:
    return ", ".join(items)


def _entry_of(line_no: int, lines: list[dict[str, Any]]) -> str | None:
    """Tên dự án / nơi làm việc chứa dòng bằng chứng: dòng có ngày tháng gần nhất phía trên, cùng mục."""
    by_no = {line["line_no"]: line for line in lines}
    line = by_no.get(line_no)
    if line is None or line.get("block") not in EVIDENCE_SECTIONS:
        return None
    for no in range(line_no - 1, max(0, line_no - 6), -1):
        above = by_no.get(no)
        if above is None or above.get("is_heading") or above.get("block") != line["block"]:
            return None
        if _DATE.search(above["text"]):
            title = _TRAILING_DATES.sub("", above["text"]).strip(" |,-–")
            if not title:
                return None
            return f"dự án {title}" if line["block"] == "projects" else f"phần kinh nghiệm tại {title}"
    return None


def compose_summary(assessments: list[dict[str, Any]], lines: list[dict[str, Any]]) -> str | None:
    """
    Đáp ứng tốt → mới liệt kê (kèm việc cần làm) → còn thiếu (nên học, không khuyên ghi vào CV).
    Thiếu yêu cầu Bắt buộc thì câu đó đứng đầu.
    """
    if not assessments:
        return None

    def skills(status: str, importance: str | None = None) -> list[str]:
        return [a["skill"] for a in assessments if a["status"] == status and importance in (None, a["importance"])]

    matched, listed = skills("matched"), [a for a in assessments if a["status"] == "partial"]
    missing_required, missing_preferred = skills("missing", "required"), skills("missing", "preferred")
    missing_additional = skills("missing", "additional")

    strengths = f"Đáp ứng tốt: {_join(matched)}." if matched else None
    gaps = []
    if missing_required:
        gaps.append(f"Còn thiếu {len(missing_required)} yêu cầu Bắt buộc: {_join(missing_required)}.")
    if missing_preferred:
        gaps.append(f"Còn thiếu yêu cầu Ưu tiên: {_join(missing_preferred)}.")
    if gaps:
        gaps.append("Nên học và thực hành các kỹ năng này, ví dụ qua một dự án nhỏ, trước khi ứng tuyển.")

    listing = None
    if listed:
        names = [a["skill"] for a in listed]
        where = next(
            (e for a in listed if a.get("evidence") and (e := _entry_of(a["evidence"]["line_no"], lines))),
            None,
        )
        subject = "kỹ năng này" if len(names) == 1 else "các kỹ năng này"
        listing = f"{_join(names)} mới được liệt kê: thêm một câu mô tả bạn đã dùng {subject} làm gì" + (
            f", ví dụ trong {where}." if where else "."
        )
    extra = (
        f"Còn thiếu {_join(missing_additional)} (Bổ trợ): nên học thêm để tăng mức phù hợp."
        if missing_additional
        else None
    )

    order = [*gaps, listing, strengths, extra] if missing_required else [strengths, listing, *gaps, extra]
    return " ".join(s for s in order if s) or None
