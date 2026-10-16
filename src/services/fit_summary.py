"""Nhận xét mức phù hợp CV–JD, ghép từ bảng kết quả cuối (sau khi kết hợp AI và quy tắc) nên luôn khớp với bảng."""

import re
from typing import Any

from src.services.skill_matching import EVIDENCE_SECTIONS

_DATE = re.compile(r"\b\d{1,2}/\d{4}\b|\b(?:19|20)\d{2}\b")
# "Maintenance Management Platform 07/2023 - 11/2023" → bỏ phần ngày ở cuối dòng tiêu đề
_TRAILING_DATES = re.compile(
    r"[\s|,–-]*\(?\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|tháng)[a-z]*\.?\s*)?"
    r"(?:\d{1,2}/)?(?:19|20)\d{2}.*$",
    re.IGNORECASE,
)


def entry_title(text: str) -> str | None:
    """Dòng tiêu đề một mục Dự án / Kinh nghiệm ("Maintenance Platform 07/2023 - 11/2023") → tên, bỏ phần ngày."""
    if not _DATE.search(text):
        return None
    return _TRAILING_DATES.sub("", text).strip(" |,-–") or None


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
            title = entry_title(above["text"])
            if not title:
                return None
            return f"dự án {title}" if line["block"] == "projects" else f"phần kinh nghiệm tại {title}"
    return None


def compose_summary(assessments: list[dict[str, Any]], lines: list[dict[str, Any]]) -> str | None:
    """
    Đáp ứng tốt → mới liệt kê (kèm việc cần làm) → còn thiếu (nên học, không khuyên ghi vào CV).
    Thiếu yêu cầu Bắt buộc thì câu đó đứng đầu, kèm rủi ro bị loại ở vòng lọc hồ sơ.
    """
    if not assessments:
        return None

    def skills(status: str, importance: str | None = None) -> list[str]:
        return [a["skill"] for a in assessments if a["status"] == status and importance in (None, a["importance"])]

    matched, listed = skills("matched"), [a for a in assessments if a["status"] == "partial"]
    missing_required, missing_preferred = skills("missing", "required"), skills("missing", "preferred")
    missing_additional = skills("missing", "additional")

    strengths = f"Đáp ứng tốt: {_join(matched)}." if matched else None
    no_metric = [a["skill"] for a in assessments if a["status"] == "matched" and a["match"] < 1]
    if no_metric:
        strengths += f" Với {_join(no_metric)}, thêm kết quả đo được (thời gian, %, số người dùng) nếu bạn có số thật."
    gaps = []
    if missing_required:
        gaps.append(f"Còn thiếu {len(missing_required)} yêu cầu Bắt buộc: {_join(missing_required)}.")
        gaps.append("Thiếu yêu cầu Bắt buộc là lý do phổ biến khiến CV bị loại ở vòng lọc hồ sơ.")
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

    outlook = None
    if matched and not gaps and not listed:
        outlook = (
            "CV đã có bằng chứng cho các yêu cầu chính; ở vòng phỏng vấn, nhà tuyển dụng thường hỏi sâu cách bạn đã "
            "làm, nên chuẩn bị kể cụ thể vài việc tiêu biểu."
        )
    elif len(missing_required) >= 3 and not matched and not listed:
        outlook = (
            "Khoảng cách với vị trí này còn lớn, nhưng có thể thu hẹp dần: bắt đầu từ một yêu cầu Bắt buộc, làm một "
            "dự án nhỏ dùng kỹ năng đó rồi cập nhật vào CV."
        )

    order = [*gaps, listing, strengths, extra] if missing_required else [strengths, listing, *gaps, extra]
    return " ".join(s for s in [*order, outlook] if s) or None
