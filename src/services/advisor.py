"""
Các trang Cố vấn (US-ADV-01, 02, 03).

- Phân quyền theo bảng phân công: SV không thuộc danh sách phụ trách → 403, không trả dữ liệu nào (US-ADV-01 AC3).
- Số liệu tổng hợp (điểm từng buổi, chênh lệch, cờ, ngày hoạt động) luôn xem được; nội dung (file CV, câu trả lời
  phỏng vấn, chi tiết kỹ năng trong phân tích) chỉ xem được khi SV bật chia sẻ.
- Điểm phỏng vấn thang 0–5 chỉ so sánh trong cùng vị trí (JD): chênh lệch và cờ tính trên vị trí của buổi gần nhất.
- Các câu nhận xét / gợi ý được ghép từ số liệu theo quy tắc, không gọi LLM.
"""

import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.errors import AppError
from src.db.models import (
    AdvisorAssignment,
    AdvisorNote,
    AdvisorReview,
    CvVersion,
    Feedback,
    GapAnalysis,
    InterviewSession,
    JobDescription,
    ShareGrant,
    User,
)
from src.services import cv_versions, interview, progress, sharing
from src.services.skill_matching import match_label

# Chênh lệch ≥ +0,3 là tiến bộ rõ, ≤ −0,3 là giảm (PRD mục 5.1)
TREND_THRESHOLD = 0.3
INACTIVE_DAYS = 14
MAX_SUGGESTIONS = 4
MAX_COMMENT_CHARS = 2000
MAX_NOTE_CHARS = 2000
# Tổng quan cả nhóm: "hoạt động" = có lượt phân tích hoặc buổi phỏng vấn hoàn thành trong 30 ngày;
# mục tiêu ≥ 60% SV hoạt động và CSAT ≥ 4/5 (PRD mục 9)
ACTIVE_DAYS = 30
ACTIVE_TARGET = 60
CSAT_TARGET = 4.0
WEEKS = 8
TOP_IMPROVERS = 5
RECENT_REVIEWS = 5
CRITERION_LABELS = {"situation": "Bối cảnh", "task": "Nhiệm vụ", "action": "Hành động", "result": "Kết quả"}
LABEL_TEXT = {"weak": "Cần luyện thêm", "basic": "Đạt cơ bản", "fair": "Khá", "good": "Tốt"}


def _fmt(score: float) -> str:
    """3.45 → "3,5"; 4.0 → "4" (giống cách frontend hiển thị điểm)."""
    return f"{round(score, 1):g}".replace(".", ",")


# ---------- Phân quyền ----------


def assigned_students(db: Session, advisor: User) -> list[User]:
    return list(
        db.scalars(
            select(User)
            .join(AdvisorAssignment, AdvisorAssignment.student_id == User.id)
            .where(AdvisorAssignment.advisor_id == advisor.id)
            .order_by(User.full_name)
        )
    )


def require_student(db: Session, advisor: User, student_id: str) -> User:
    """SV thuộc danh sách phụ trách; SV khác (kể cả mã không tồn tại) đều trả 403 để không lộ thông tin."""
    assignment = db.scalar(
        select(AdvisorAssignment).where(
            AdvisorAssignment.advisor_id == advisor.id, AdvisorAssignment.student_id == student_id
        )
    )
    if assignment is None:
        raise AppError(403, "Bạn không có quyền xem hồ sơ sinh viên này.", "forbidden")
    return db.get(User, student_id)


# ---------- Dữ liệu một SV ----------


class StudentData:
    """Dữ liệu của một SV dùng chung cho danh sách, dòng mở rộng và hồ sơ."""

    def __init__(self, db: Session, advisor: User, student: User):
        self.student = student
        self.sessions = progress.completed_sessions(db, student)  # mới nhất trước
        self.analyses = [a for a in progress.student_analyses(db, student) if a.status == "completed"]
        self.analyses.sort(key=lambda a: a.completed_at, reverse=True)
        self.cvs = list(
            db.scalars(select(CvVersion).where(CvVersion.owner_id == student.id).order_by(CvVersion.version.desc()))
        )
        self.jds = progress.load_jds(db, {s.jd_id for s in self.sessions} | {a.jd_id for a in self.analyses})
        self.grants = sharing.grants_of(db, student.id)
        self.reviews = {
            r.session_id: r
            for r in db.scalars(
                select(AdvisorReview).where(
                    AdvisorReview.advisor_id == advisor.id, AdvisorReview.student_id == student.id
                )
            )
        }
        self.timed_out = progress.timed_out_counts(db, [s.id for s in self.sessions])
        # Vị trí đang luyện: vị trí của buổi gần nhất; điểm chỉ so sánh trong vị trí này
        self.focus = [s for s in reversed(self.sessions) if s.jd_id == self.sessions[0].jd_id] if self.sessions else []

    def shared(self, item_id: str) -> bool:
        return item_id in self.grants

    def cv_shared(self, cv_version_id: str) -> bool:
        """Chia sẻ CV tính theo cả CV (family_id): mọi phiên bản của CV đã chia sẻ đều xem được."""
        cv = next((c for c in self.cvs if c.id == cv_version_id), None)
        return cv is not None and self.shared(cv_versions.family_of(cv))

    def cv_families(self) -> set[str]:
        return {cv_versions.family_of(cv) for cv in self.cvs}

    @property
    def latest_analysis(self) -> GapAnalysis | None:
        return self.analyses[0] if self.analyses else None

    def missing_required(self) -> list[str]:
        """Kỹ năng bắt buộc còn thiếu trong lần phân tích gần nhất; chỉ khi SV đã chia sẻ CV của lần đó."""
        analysis = self.latest_analysis
        if analysis is None or not self.cv_shared(analysis.cv_version_id):
            return []
        return [
            r["skill"]
            for r in (analysis.result or {}).get("requirements", [])
            if r["status"] == "missing" and r["importance"] == "required"
        ]

    def flag(self) -> dict[str, Any] | None:
        """US-ADV-02: 2 vòng liên tiếp không tăng (buổi N ≤ N−1 ≤ N−2) ở vị trí đang luyện."""
        if len(self.focus) < 3:
            return None
        a, b, c = self.focus[-3:]
        if not (c.overall_score <= b.overall_score <= a.overall_score):
            return None
        n = len(self.focus)
        return {
            "jd": interview.jd_out(self.jds[c.jd_id]),
            "rounds": [n - 2, n - 1, n],
            "scores": [a.overall_score, b.overall_score, c.overall_score],
            "flagged_at": c.completed_at,
        }

    def last_active_at(self) -> datetime | None:
        moments = [cv.uploaded_at for cv in self.cvs]
        moments += [a.created_at for a in self.analyses] + [s.completed_at for s in self.sessions]
        return max(moments, default=None)

    def last_practice_at(self) -> datetime | None:
        """Lần gần nhất hoàn thành phân tích hoặc buổi phỏng vấn (định nghĩa "hoạt động" ở PRD mục 9)."""
        return max([a.completed_at for a in self.analyses] + [s.completed_at for s in self.sessions], default=None)

    def shared_count(self) -> int:
        """Số tài liệu còn tồn tại đang được chia sẻ (mỗi CV tính một, dù có nhiều phiên bản)."""
        return sum(1 for item_id in [*self.cv_families(), *(s.id for s in self.sessions)] if self.shared(item_id))

    def pending_reviews(self) -> int:
        return sum(1 for s in self.sessions if self.shared(s.id) and s.id not in self.reviews)

    def target(self) -> JobDescription | None:
        if self.sessions:
            return self.jds[self.sessions[0].jd_id]
        return self.jds[self.analyses[0].jd_id] if self.analyses else None


def _status(row: dict[str, Any]) -> str:
    """Trạng thái như nhãn ở danh sách SV: cờ "Cần chú ý" trước, sau đó là xu hướng điểm."""
    return "flagged" if row["flag"] else row["trend"]


def _trend(delta: float | None) -> str:
    if delta is None:
        return "insufficient"
    if delta >= TREND_THRESHOLD:
        return "improving"
    if delta <= -TREND_THRESHOLD:
        return "declining"
    return "stable"


def summary(data: StudentData) -> dict[str, Any]:
    """Một dòng trong danh sách SV phụ trách (US-ADV-01 AC1/AC2)."""
    s = data.student
    focus = data.focus
    first = focus[0].overall_score if focus else None
    latest = focus[-1].overall_score if focus else None
    delta = round(latest - first, 2) if len(focus) >= 2 else None
    target = data.target()
    analysis = data.latest_analysis
    return {
        "id": s.id,
        "full_name": s.full_name,
        "subtitle": s.subtitle,
        "email": s.email,
        "phone": s.phone,
        "avatar_url": s.avatar_url,
        "target": interview.jd_out(target) if target else None,
        "interview_count": len(data.sessions),
        "focus_session_count": len(focus),
        "first_score": first,
        "latest_score": latest,
        "score_delta": delta,
        "trend": _trend(delta),
        "flag": data.flag(),
        "latest_match": analysis.match_score if analysis else None,
        "missing_required": data.missing_required(),
        "last_active_at": data.last_active_at(),
        "shared_items": data.shared_count(),
        "total_items": len(data.cv_families()) + len(data.sessions),
        "pending_reviews": data.pending_reviews(),
    }


# ---------- Câu nhận xét ghép theo quy tắc ----------


def session_summary(session: InterviewSession, timed_out_count: int) -> str:
    """ "3,4/5 (Khá) · Mạnh nhất: Bối cảnh 4 · Yếu nhất: Kết quả 2,6 · 1 câu hết giờ"."""
    star = session.star
    best = max(interview.CRITERIA, key=lambda c: star[c])
    worst = min(interview.CRITERIA, key=lambda c: star[c])
    parts = [
        f"{_fmt(session.overall_score)}/5 ({LABEL_TEXT[interview.label_of(session.overall_score)]})",
        f"Mạnh nhất: {CRITERION_LABELS[best]} {_fmt(star[best])}",
        f"Yếu nhất: {CRITERION_LABELS[worst]} {_fmt(star[worst])}",
    ]
    if timed_out_count:
        parts.append(f"{timed_out_count} câu hết giờ")
    return " · ".join(parts)


def _star(data: StudentData) -> dict[str, Any] | None:
    window = data.sessions[: progress.STAR_WINDOW]
    if not window:
        return None
    average = progress.star_average(window)
    return {"average": average, "weakest": progress.weakest_criterion(average), "session_count": len(window)}


def _insight(star: dict[str, Any] | None) -> str | None:
    if star is None:
        return None
    weak = star["weakest"]
    return (
        f"{CRITERION_LABELS[weak]} là tiêu chí thấp nhất ({_fmt(star['average'][weak])}/5) trong "
        f"{star['session_count']} buổi gần nhất. Hướng dẫn cho SV: {interview.GUIDANCE[weak]}"
    )


def suggestions(data: StudentData, row: dict[str, Any], star: dict[str, Any] | None, now: datetime) -> list[str]:
    """Gợi ý cho buổi tư vấn tới, sinh từ tình trạng thật của SV (ưu tiên việc cần làm ngay)."""
    result = []
    flag = row["flag"]
    if flag:
        rounds = ", ".join(str(n) for n in flag["rounds"])
        scores = " → ".join(_fmt(x) for x in flag["scores"])
        result.append(
            f"Điểm vị trí {flag['jd']['title']} không tăng qua các buổi {rounds} ({scores}): xem lại buổi gần nhất cùng SV."
        )
    elif row["trend"] == "declining":
        result.append(
            f"Điểm vị trí {row['target']['title']} giảm {_fmt(abs(row['score_delta']))} so với buổi đầu: tìm hiểu nguyên nhân."
        )
    if row["pending_reviews"]:
        result.append(f"Còn {row['pending_reviews']} báo cáo SV đã chia sẻ đang chờ bạn nhận xét.")
    last = row["last_active_at"]
    if last is not None and (now - last).days >= INACTIVE_DAYS:
        result.append(f"SV chưa có hoạt động {(now - last).days} ngày: hỏi về kế hoạch luyện tập tuần tới.")
    if not data.sessions:
        result.append("SV chưa luyện phỏng vấn: gợi ý chọn vị trí đã phân tích và làm buổi đầu tiên.")
    if row["missing_required"]:
        jd = data.jds[data.latest_analysis.jd_id].title
        result.append(
            f"CV còn thiếu kỹ năng bắt buộc cho vị trí {jd}: {', '.join(row['missing_required'])}. "
            "Trao đổi kế hoạch học, hoặc bổ sung bằng chứng nếu SV đã có."
        )
    if star:
        weak = star["weakest"]
        result.append(
            f"Luyện tiêu chí {CRITERION_LABELS[weak]} ({_fmt(star['average'][weak])}/5): chọn một câu trả lời để cùng "
            "SV viết lại theo STAR."
        )
    if row["shared_items"] == 0 and row["total_items"] > 0:
        result.append("SV chưa chia sẻ tài liệu nào: có thể đề nghị SV bật chia sẻ báo cáo cần góp ý.")
    return result[:MAX_SUGGESTIONS]


# ---------- Danh sách, dòng mở rộng, hồ sơ ----------


def student_list(db: Session, advisor: User) -> list[dict[str, Any]]:
    return [summary(StudentData(db, advisor, s)) for s in assigned_students(db, advisor)]


def _progress_block(data: StudentData, row: dict[str, Any], now: datetime) -> dict[str, Any]:
    star = _star(data)
    return {
        "interview_progress": progress.interview_progress(data.sessions, data.jds),
        "cv_progress": progress.cv_progress(data.analyses, data.jds),
        "star": star,
        "insight": _insight(star),
        "suggestions": suggestions(data, row, star, now),
    }


def student_progress(db: Session, advisor: User, student_id: str, now: datetime) -> dict[str, Any]:
    """Nội dung dòng mở rộng ở danh sách SV phụ trách (chỉ số liệu, xem được khi chưa chia sẻ)."""
    data = StudentData(db, advisor, require_student(db, advisor, student_id))
    return _progress_block(data, summary(data), now)


def _review_out(review: AdvisorReview | None) -> dict[str, Any] | None:
    if review is None:
        return None
    return {
        "id": review.id,
        "comment": review.comment,
        "created_at": review.created_at,
        "updated_at": review.updated_at,
        "seen_at": review.seen_at if review.seen_at and review.seen_at >= review.updated_at else None,
    }


def _note_out(note: AdvisorNote) -> dict[str, Any]:
    return {
        "id": note.id,
        "body": note.body,
        "tags": note.tags,
        "pinned": note.pinned,
        "created_at": note.created_at,
        "updated_at": note.updated_at,
    }


def _gap(data: StudentData) -> dict[str, Any] | None:
    """Kết quả phân tích gần nhất (US-ADV-03 AC1); danh sách kỹ năng chỉ có khi SV chia sẻ CV của lần đó."""
    analysis = data.latest_analysis
    if analysis is None:
        return None
    shared = data.cv_shared(analysis.cv_version_id)
    requirements = (analysis.result or {}).get("requirements", []) if shared else []
    return {
        "analysis_id": analysis.id,
        "created_at": analysis.created_at,
        "cv_version_id": analysis.cv_version_id,
        "cv_label": analysis.cv_label,
        "jd": interview.jd_out(data.jds[analysis.jd_id]),
        "match_score": analysis.match_score,
        "match_label": match_label(analysis.match_score),
        "shared": shared,
        **{
            status: [r["skill"] for r in requirements if r["status"] == status]
            for status in ("matched", "partial", "missing")
        },
    }


def student_detail(db: Session, advisor: User, student_id: str, now: datetime) -> dict[str, Any]:
    """Hồ sơ SV. Các phiên bản CV trả về dạng ORM kèm cờ chia sẻ để router chuyển sang CvVersionResponse."""
    data = StudentData(db, advisor, require_student(db, advisor, student_id))
    row = summary(data)
    target = data.jds[data.latest_analysis.jd_id] if data.latest_analysis else data.target()
    notes = db.scalars(
        select(AdvisorNote)
        .where(AdvisorNote.advisor_id == advisor.id, AdvisorNote.student_id == student_id)
        .order_by(AdvisorNote.pinned.desc(), AdvisorNote.updated_at.desc())
    )
    return {
        "student": row,
        "cvs": [(cv, data.cv_shared(cv.id)) for cv in data.cvs],
        "target_jd": target,
        "latest_gap": _gap(data),
        "interviews": [
            {
                **progress.interview_row(s, data.jds[s.jd_id], data.timed_out.get(s.id, 0)),
                "shared": data.shared(s.id),
                "summary": session_summary(s, data.timed_out.get(s.id, 0)),
                "review": _review_out(data.reviews.get(s.id)),
            }
            for s in data.sessions
        ],
        "notes": [_note_out(n) for n in notes],
        **_progress_block(data, row, now),
    }


# ---------- Tổng quan cả nhóm ----------


def _mean(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 2) if values else None


def _weekly_scores(data: list[StudentData], now: datetime) -> list[dict[str, Any]]:
    """Điểm TB theo tuần: mỗi SV lấy điểm buổi gần nhất tính đến cuối tuần; bỏ các tuần chưa SV nào có điểm."""
    this_week = interview.week_start(now)
    result = []
    for back in range(WEEKS - 1, -1, -1):
        start = this_week - timedelta(weeks=back)
        end = start + timedelta(weeks=1)
        scores = [
            score
            for d in data
            if (score := next((s.overall_score for s in d.sessions if s.completed_at < end), None)) is not None
        ]
        if scores:
            result.append({"week_start": start, "average": _mean(scores), "student_count": len(scores)})
    return result


def _cohort_star(data: list[StudentData]) -> dict[str, Any] | None:
    """S/T/A/R trung bình của nhóm: mỗi SV lấy trung bình tối đa 5 buổi gần nhất, rồi lấy trung bình các SV."""
    per_student = [progress.star_average(d.sessions[: progress.STAR_WINDOW]) for d in data if d.sessions]
    if not per_student:
        return None
    average = {c: _mean([p[c] for p in per_student]) for c in interview.CRITERIA}
    weakest = progress.weakest_criterion(average)
    return {
        "average": average,
        "weakest": weakest,
        "weakest_count": sum(1 for p in per_student if progress.weakest_criterion(p) == weakest),
        "student_count": len(per_student),
    }


def _cohort_insight(star: dict[str, Any] | None) -> str | None:
    if star is None:
        return None
    weak = star["weakest"]
    return (
        f"{CRITERION_LABELS[weak]} là tiêu chí thấp nhất của nhóm ({_fmt(star['average'][weak])}/5) và là tiêu chí "
        f"yếu nhất của {star['weakest_count']}/{star['student_count']} sinh viên. Hướng dẫn chung: "
        f"{interview.GUIDANCE[weak]}"
    )


def _recent_reviews(db: Session, advisor: User, data: list[StudentData]) -> list[dict[str, Any]]:
    """Nhận xét bạn gửi gần đây (bản mới nhất trước), kèm trạng thái SV đã xem."""
    sessions = {s.id: (d, s) for d in data for s in d.sessions}
    reviews = db.scalars(
        select(AdvisorReview)
        .where(AdvisorReview.advisor_id == advisor.id, AdvisorReview.session_id.in_(list(sessions)))
        .order_by(AdvisorReview.updated_at.desc())
        .limit(RECENT_REVIEWS)
    )
    result = []
    for review in reviews:
        d, session = sessions[review.session_id]
        result.append(
            {
                **_review_out(review),
                "student_id": d.student.id,
                "student_name": d.student.full_name,
                "avatar_url": d.student.avatar_url,
                "session_id": session.id,
                "jd": interview.jd_out(d.jds[session.jd_id]),
            }
        )
    return result


def overview(db: Session, advisor: User, now: datetime) -> dict[str, Any]:
    """
    Tổng quan cả nhóm SV phụ trách: số liệu chính (PRD mục 9), điểm TB theo tuần, phân bố trạng thái,
    S/T/A/R của nhóm, SV cần chú ý, SV tiến bộ nhiều nhất và nhận xét đã gửi. Chỉ dùng số liệu tổng hợp.
    """
    data = [StudentData(db, advisor, s) for s in assigned_students(db, advisor)]
    rows = [summary(d) for d in data]
    since = now - timedelta(days=ACTIVE_DAYS)
    latest = [r["latest_score"] for r in rows if r["latest_score"] is not None]
    deltas = [r["score_delta"] for r in rows if r["score_delta"] is not None]
    ids = [d.student.id for d in data]
    csat = list(db.scalars(select(Feedback.value).where(Feedback.user_id.in_(ids), Feedback.kind == "csat")))
    star = _cohort_star(data)
    flagged = sorted((r for r in rows if r["flag"]), key=lambda r: r["flag"]["flagged_at"], reverse=True)
    improvers = sorted((r for r in rows if (r["score_delta"] or 0) > 0), key=lambda r: r["score_delta"], reverse=True)
    return {
        "advisor_name": advisor.full_name,
        "student_count": len(rows),
        "sharing_count": sum(1 for r in rows if r["shared_items"]),
        "pending_reviews": sum(r["pending_reviews"] for r in rows),
        "active_count": sum(1 for d in data if (at := d.last_practice_at()) is not None and at >= since),
        "active_days": ACTIVE_DAYS,
        "active_target": ACTIVE_TARGET,
        "average_score": _mean(latest),
        "scored_count": len(latest),
        "average_delta": _mean(deltas),
        "delta_count": len(deltas),
        "csat": _mean(csat),
        "csat_count": len(csat),
        "csat_target": CSAT_TARGET,
        "weekly_scores": _weekly_scores(data, now),
        "status_counts": {
            status: sum(1 for r in rows if _status(r) == status)
            for status in ("flagged", "declining", "insufficient", "stable", "improving")
        },
        "star": star,
        "insight": _cohort_insight(star),
        "flagged_students": flagged,
        "top_improvers": improvers[:TOP_IMPROVERS],
        "recent_reviews": _recent_reviews(db, advisor, data),
    }


# ---------- Nội dung SV đã chia sẻ ----------


def _shared_session(db: Session, advisor: User, student_id: str, session_id: str) -> tuple[User, ShareGrant]:
    student = require_student(db, advisor, student_id)
    session = db.get(InterviewSession, session_id)
    if session is None or session.owner_id != student.id or session.status != "completed":
        raise AppError(404, "Không tìm thấy buổi phỏng vấn.", "interview_not_found")
    grant = sharing.grant_for(db, sharing.KIND_INTERVIEW, session_id)
    if grant is None:
        raise AppError(403, "Sinh viên chưa chia sẻ báo cáo này.", "not_shared")
    return student, grant


def interview_report(db: Session, advisor: User, student_id: str, session_id: str, now: datetime) -> dict[str, Any]:
    """Báo cáo đầy đủ (câu hỏi, câu trả lời, nhận xét AI) của buổi SV đã chia sẻ; ghi nhận cố vấn đã xem."""
    student, grant = _shared_session(db, advisor, student_id, session_id)
    report = interview.build_report(db, student, session_id, now)
    review = db.scalar(
        select(AdvisorReview).where(AdvisorReview.advisor_id == advisor.id, AdvisorReview.session_id == session_id)
    )
    grant.advisor_viewed_at = now
    db.commit()
    return {**report, "review": _review_out(review)}


def save_review(
    db: Session, advisor: User, student_id: str, session_id: str, comment: str, now: datetime
) -> dict[str, Any]:
    """Nhận xét cho báo cáo đã chia sẻ (mỗi cố vấn một nhận xét / buổi, sửa được). Không đổi điểm AI."""
    student, grant = _shared_session(db, advisor, student_id, session_id)
    text = comment.strip()
    if not text:
        raise AppError(422, "Hãy nhập nội dung nhận xét.", "comment_required")
    if len(text) > MAX_COMMENT_CHARS:
        raise AppError(422, f"Nhận xét tối đa {MAX_COMMENT_CHARS} ký tự.", "comment_too_long")
    review = db.scalar(
        select(AdvisorReview).where(AdvisorReview.advisor_id == advisor.id, AdvisorReview.session_id == session_id)
    )
    if review is None:
        review = AdvisorReview(
            id=f"rv_{uuid.uuid4().hex[:12]}",
            advisor_id=advisor.id,
            student_id=student.id,
            session_id=session_id,
            comment=text,
            created_at=now,
            updated_at=now,
        )
        db.add(review)
    else:
        review.comment = text
        review.updated_at = now
    grant.advisor_viewed_at = now
    db.commit()
    return _review_out(review)


def shared_cv(db: Session, advisor: User, student_id: str, cv_id: str, now: datetime) -> CvVersion:
    """Phiên bản CV SV đã chia sẻ; ghi nhận cố vấn đã xem."""
    student = require_student(db, advisor, student_id)
    cv = db.get(CvVersion, cv_id)
    if cv is None or cv.owner_id != student.id:
        raise AppError(404, "Không tìm thấy phiên bản CV.", "cv_not_found")
    # Chia sẻ theo cả CV: mở được mọi phiên bản của CV SV đã chia sẻ (PRD US-ADV AC2: xem lại các bản trước)
    grant = sharing.grant_for(db, sharing.KIND_CV, cv_versions.family_of(cv))
    if grant is None:
        raise AppError(403, "Sinh viên chưa chia sẻ CV này.", "not_shared")
    grant.advisor_viewed_at = now
    db.commit()
    return cv


# ---------- Ghi chú nội bộ ----------


def _note_body(body: str) -> str:
    text = body.strip()
    if not text:
        raise AppError(422, "Hãy nhập nội dung ghi chú.", "note_required")
    if len(text) > MAX_NOTE_CHARS:
        raise AppError(422, f"Ghi chú tối đa {MAX_NOTE_CHARS} ký tự.", "note_too_long")
    return text


def create_note(db: Session, advisor: User, student_id: str, body: str, tags: list[str], now: datetime) -> dict:
    require_student(db, advisor, student_id)
    note = AdvisorNote(
        id=f"nt_{uuid.uuid4().hex[:12]}",
        advisor_id=advisor.id,
        student_id=student_id,
        body=_note_body(body),
        tags=list(dict.fromkeys(tags)),
        created_at=now,
        updated_at=now,
    )
    db.add(note)
    db.commit()
    return _note_out(note)


def _own_note(db: Session, advisor: User, student_id: str, note_id: str) -> AdvisorNote:
    require_student(db, advisor, student_id)
    note = db.get(AdvisorNote, note_id)
    if note is None or note.advisor_id != advisor.id or note.student_id != student_id:
        raise AppError(404, "Không tìm thấy ghi chú.", "note_not_found")
    return note


def update_note(
    db: Session,
    advisor: User,
    student_id: str,
    note_id: str,
    body: str | None,
    tags: list[str] | None,
    pinned: bool | None,
    now: datetime,
) -> dict:
    note = _own_note(db, advisor, student_id, note_id)
    if body is not None:
        note.body = _note_body(body)
    if tags is not None:
        note.tags = list(dict.fromkeys(tags))
    if pinned is not None:
        note.pinned = pinned
    if body is not None or tags is not None:
        note.updated_at = now
    db.commit()
    return _note_out(note)


def delete_note(db: Session, advisor: User, student_id: str, note_id: str) -> None:
    db.delete(_own_note(db, advisor, student_id, note_id))
    db.commit()
