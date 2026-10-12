"""
Trang Quản trị: thống kê toàn hệ thống, tài khoản cố vấn và phân công sinh viên.

- SV tự đăng ký thì ở trạng thái "Chưa phân công" cho tới khi quản trị viên gán cố vấn.
- Tài khoản cố vấn do quản trị viên tạo bằng mật khẩu tạm; cố vấn phải đổi mật khẩu ở lần đăng nhập đầu tiên.
- Đổi cố vấn: tài liệu SV đã chia sẻ chuyển về riêng tư, để SV tự quyết định chia sẻ gì với cố vấn mới.
- CSAT và nhận xét chỉ hiện số liệu tổng hợp, không kèm tên SV.
"""

import uuid
from collections import Counter
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from src.api.errors import AppError
from src.db.models import (
    AdvisorAssignment,
    AdvisorReview,
    CvVersion,
    Feedback,
    GapAnalysis,
    InterviewSession,
    ShareGrant,
    User,
)
from src.services import auth, notifications
from src.services import feedback as feedback_service
from src.services.sharing import KIND_INTERVIEW

PERIODS = (7, 30, 90)
WEEKS = 7
CSAT_TARGET = 4.0
RECENT_COMMENTS = 4
MAX_TITLE_CHARS = 120


def _percent_change(current: int, previous: int) -> float | None:
    return round((current - previous) / previous * 100, 1) if previous else None


def _week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


# ---------- Thống kê ----------


def _activity(db: Session, since: datetime) -> list[tuple[str, datetime, str]]:
    """(mã SV, thời điểm, loại) của các lượt phân tích và buổi phỏng vấn hoàn thành từ `since`."""
    analyses = db.execute(
        select(GapAnalysis.owner_id, GapAnalysis.completed_at).where(
            GapAnalysis.status == "completed", GapAnalysis.completed_at >= since
        )
    )
    interviews = db.execute(
        select(InterviewSession.owner_id, InterviewSession.completed_at).where(
            InterviewSession.status == "completed", InterviewSession.completed_at >= since
        )
    )
    return [(o, at, "analysis") for o, at in analyses] + [(o, at, "interview") for o, at in interviews]


def stats(db: Session, now: datetime, days: int) -> dict[str, Any]:
    if days not in PERIODS:
        raise AppError(422, "Kỳ thống kê chỉ nhận 7, 30 hoặc 90 ngày.", "validation_error")
    since = now - timedelta(days=days)
    previous_since = since - timedelta(days=days)
    week_starts = [_week_start(now.date()) - timedelta(weeks=WEEKS - 1 - i) for i in range(WEEKS)]
    week_ends = [datetime.combine(w + timedelta(days=7), datetime.min.time()) for w in week_starts]
    week_ends[-1] = now
    first_week = datetime.combine(week_starts[0], datetime.min.time())
    activity = _activity(db, min(previous_since, first_week - timedelta(days=days)))

    students = list(db.execute(select(User.id, User.created_at).where(User.role == "student")))
    student_ids = {sid for sid, _ in students}
    assigned = set(db.scalars(select(AdvisorAssignment.student_id))) & student_ids
    advisor_count = db.scalar(
        select(func.count()).select_from(User).where(User.role == "advisor", User.disabled_at.is_(None))
    )

    def active_between(start: datetime, end: datetime) -> int:
        return len({owner for owner, at, _ in activity if start <= at <= end and owner in student_ids})

    def count(kind: str, start: datetime, end: datetime) -> int:
        return sum(1 for _, at, k in activity if k == kind and start <= at < end)

    analyses = count("analysis", since, now + timedelta(seconds=1))
    interviews = count("interview", since, now + timedelta(seconds=1))
    weekly = [
        {
            "week_start": start,
            "analyses": count("analysis", datetime.combine(start, datetime.min.time()), end + timedelta(seconds=1)),
            "interviews": count("interview", datetime.combine(start, datetime.min.time()), end + timedelta(seconds=1)),
        }
        for start, end in zip(week_starts, week_ends, strict=True)
    ]

    csat = list(
        db.execute(
            select(Feedback.value, Feedback.activity, Feedback.tags)
            .join(User, User.id == Feedback.user_id)
            .where(Feedback.kind == "csat", Feedback.created_at >= since, User.role == "student")
        ).all()
    )
    csat_rows = [value for value, _, _ in csat]
    distribution = Counter(csat_rows)
    comments = db.scalars(_comments_query().order_by(Feedback.created_at.desc()).limit(RECENT_COMMENTS))
    return {
        "days": days,
        "users": {
            "student_count": len(students),
            "new_students_week": sum(1 for _, at in students if at and at >= now - timedelta(days=7)),
            "student_series": [sum(1 for _, at in students if at and at <= end) for end in week_ends],
            "active_count": active_between(since, now),
            "active_series": [active_between(end - timedelta(days=days), end) for end in week_ends],
            "advisor_count": advisor_count,
            "assigned_count": len(assigned),
            "unassigned_count": len(student_ids - assigned),
        },
        "usage": {
            "weekly": weekly,
            "analyses": analyses,
            "analyses_change": _percent_change(analyses, count("analysis", previous_since, since)),
            "interviews": interviews,
            "interviews_change": _percent_change(interviews, count("interview", previous_since, since)),
            "optimized_cvs": db.scalar(
                select(func.count())
                .select_from(CvVersion)
                .where(CvVersion.origin == "optimized", CvVersion.uploaded_at >= since)
            ),
        },
        "satisfaction": {
            "csat": round(sum(csat_rows) / len(csat_rows), 2) if csat_rows else None,
            "count": len(csat_rows),
            "target": CSAT_TARGET,
            "distribution": {str(star): distribution.get(star, 0) for star in range(1, 6)},
            "low_count": sum(1 for v in csat_rows if v <= feedback_service.LOW_SCORE),
            "reasons": _reason_counts(csat),
            "helpful": _helpfulness(db, since),
        },
        "recent_comments": [_comment_out(f) for f in comments],
    }


# ---------- Nhận xét ----------


TOP_REASONS = 5


def _reason_counts(csat: list[tuple[int, str | None, list[str] | None]]) -> list[dict[str, Any]]:
    """Lý do của các lượt 1–3 sao, gộp theo lý do (kèm các hoạt động có lý do đó), nhiều nhất trước."""
    counts: Counter = Counter()
    activities: dict[str, list[str]] = {}
    for value, activity, tags in csat:
        if value > feedback_service.LOW_SCORE:
            continue
        for tag in tags or []:
            counts[tag] += 1
            seen = activities.setdefault(tag, [])
            if activity and activity not in seen:
                seen.append(activity)
    return [
        {
            "reason": tag,
            "label": feedback_service.REASON_LABELS.get(tag, tag),
            "activities": activities[tag],
            "count": n,
        }
        for tag, n in counts.most_common(TOP_REASONS)
    ]


def _helpfulness(db: Session, since: datetime) -> list[dict[str, Any]]:
    """Like / dislike trong kỳ theo từng phần (bỏ qua phản hồi cũ chưa có loại)."""
    rows = db.execute(
        select(Feedback.activity, Feedback.value)
        .join(User, User.id == Feedback.user_id)
        .where(Feedback.kind == "thumb", Feedback.created_at >= since, User.role == "student")
    ).all()
    return [
        {
            "activity": activity,
            "label": feedback_service.ACTIVITY_LABELS[activity],
            "likes": sum(1 for a, v in rows if a == activity and v > 0),
            "total": sum(1 for a, _ in rows if a == activity),
        }
        for activity in feedback_service.THUMB_ACTIVITIES
    ]


def _comments_query():
    """Đánh giá CSAT có nhận xét bằng chữ hoặc lý do của sinh viên (không lấy tên SV)."""
    return (
        select(Feedback)
        .join(User, User.id == Feedback.user_id)
        .where(
            Feedback.kind == "csat",
            (Feedback.comment.is_not(None)) | (Feedback.tags.is_not(None)),
            User.role == "student",
        )
    )


def _comment_out(f: Feedback) -> dict[str, Any]:
    return {
        "id": f.id,
        "value": f.value,
        "activity": f.activity,
        "comment": f.comment,
        "tags": [{"reason": t, "label": feedback_service.REASON_LABELS.get(t, t)} for t in f.tags or []],
        "created_at": f.created_at,
    }


def list_comments(
    db: Session,
    now: datetime,
    *,
    days: int | None,
    stars: int | None,
    activity: str | None,
    reason: str | None = None,
    offset: int,
    limit: int,
) -> dict[str, Any]:
    """Mọi nhận xét, mới nhất trước; lọc theo kỳ (7 / 30 / 90 ngày, None = mọi lúc), số sao, hoạt động, lý do."""
    if days is not None and days not in PERIODS:
        raise AppError(422, "Kỳ thống kê chỉ nhận 7, 30 hoặc 90 ngày.", "validation_error")
    query = _comments_query()
    if days is not None:
        query = query.where(Feedback.created_at >= now - timedelta(days=days))
    if stars is not None:
        query = query.where(Feedback.value == stars)
    if activity is not None:
        query = query.where(Feedback.activity == activity)
    query = query.order_by(Feedback.created_at.desc(), Feedback.id)
    if reason is not None:
        # Lý do lưu trong cột JSON: lọc ở Python (số nhận xét nhỏ)
        matched = [f for f in db.scalars(query) if reason in (f.tags or [])]
        return {"total": len(matched), "items": [_comment_out(f) for f in matched[offset : offset + limit]]}
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.offset(offset).limit(limit))
    return {"total": total, "items": [_comment_out(f) for f in rows]}


# ---------- Cố vấn ----------


def _advisor_status(user: User) -> str:
    if user.disabled_at is not None:
        return "disabled"
    return "password_pending" if user.must_change_password else "active"


def _pending_reviews(db: Session) -> Counter:
    """Số buổi SV đã chia sẻ mà cố vấn phụ trách chưa nhận xét, theo cố vấn."""
    shared = db.execute(
        select(AdvisorAssignment.advisor_id, ShareGrant.item_id)
        .join(ShareGrant, ShareGrant.owner_id == AdvisorAssignment.student_id)
        .where(ShareGrant.kind == KIND_INTERVIEW)
    )
    reviewed = {tuple(r) for r in db.execute(select(AdvisorReview.advisor_id, AdvisorReview.session_id))}
    return Counter(advisor_id for advisor_id, session_id in shared if (advisor_id, session_id) not in reviewed)


def _advisor_out(user: User, student_count: int, pending: int) -> dict[str, Any]:
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "title": user.title or user.subtitle,
        "avatar_url": user.avatar_url,
        "student_count": student_count,
        "pending_reviews": pending,
        "status": _advisor_status(user),
        "last_active_at": user.last_seen_at,
        "created_at": user.created_at,
    }


def list_advisors(db: Session) -> list[dict[str, Any]]:
    counts = dict(
        db.execute(select(AdvisorAssignment.advisor_id, func.count()).group_by(AdvisorAssignment.advisor_id)).all()
    )
    pending = _pending_reviews(db)
    advisors = db.scalars(select(User).where(User.role == "advisor").order_by(User.full_name))
    return [_advisor_out(a, counts.get(a.id, 0), pending.get(a.id, 0)) for a in advisors]


def _advisor(db: Session, advisor_id: str) -> User:
    user = db.get(User, advisor_id)
    if user is None or user.role != "advisor":
        raise AppError(404, "Không tìm thấy cố vấn.", "advisor_not_found")
    return user


def _advisor_by_id(db: Session, advisor_id: str) -> dict[str, Any]:
    return next(a for a in list_advisors(db) if a["id"] == advisor_id)


def _check_title(title: str) -> str:
    value = " ".join(title.split())
    if not value or len(value) > MAX_TITLE_CHARS:
        raise AppError(422, f"Hãy nhập chức danh (tối đa {MAX_TITLE_CHARS} ký tự).", "invalid_title")
    return value


def _check_email_free(db: Session, email: str, user_id: str | None = None) -> str:
    value = auth.check_email(email)
    existing = auth.find_by_email(db, value)
    if existing is not None and existing.id != user_id:
        raise AppError(409, "Email này đã có tài khoản.", "email_taken")
    return value


def create_advisor(db: Session, full_name: str, email: str, title: str, temporary_password: str) -> dict[str, Any]:
    name = auth.check_full_name(full_name)
    email_value = _check_email_free(db, email)
    title_value = _check_title(title)
    auth.check_password_rules(temporary_password)
    user = User(
        id=f"cv-{uuid.uuid4().hex[:10]}",
        role="advisor",
        full_name=name,
        subtitle=title_value,
        title=title_value,
        email=email_value,
        password_hash=auth.hash_password(temporary_password),
        must_change_password=True,
    )
    db.add(user)
    db.commit()
    return _advisor_by_id(db, user.id)


def update_advisor(
    db: Session,
    advisor_id: str,
    *,
    full_name: str | None,
    email: str | None,
    title: str | None,
    disabled: bool | None,
    now: datetime,
) -> dict[str, Any]:
    user = _advisor(db, advisor_id)
    if full_name is not None:
        user.full_name = auth.check_full_name(full_name)
    if email is not None:
        user.email = _check_email_free(db, email, user.id)
    if title is not None:
        user.title = user.subtitle = _check_title(title)
    if disabled is True and user.disabled_at is None:
        user.disabled_at = now
        auth.end_all_sessions(db, user)
    elif disabled is False:
        user.disabled_at = None
    db.commit()
    return _advisor_by_id(db, user.id)


def reset_advisor_password(db: Session, advisor_id: str, temporary_password: str) -> dict[str, Any]:
    """Đặt mật khẩu tạm mới (cố vấn quên mật khẩu): các phiên cũ bị đăng xuất, lần đăng nhập tới phải đổi mật khẩu."""
    user = _advisor(db, advisor_id)
    auth.check_password_rules(temporary_password)
    user.password_hash = auth.hash_password(temporary_password)
    user.must_change_password = True
    user.failed_logins = 0
    user.locked_until = None
    auth.end_all_sessions(db, user)
    db.commit()
    return _advisor_by_id(db, user.id)


# ---------- Sinh viên & phân công ----------


def list_students(db: Session) -> list[dict[str, Any]]:
    advisors = {a.id: a for a in db.scalars(select(User).where(User.role == "advisor"))}
    advisor_of = dict(db.execute(select(AdvisorAssignment.student_id, AdvisorAssignment.advisor_id)).all())
    last_analysis = dict(
        db.execute(
            select(GapAnalysis.owner_id, func.max(GapAnalysis.completed_at)).group_by(GapAnalysis.owner_id)
        ).all()
    )
    last_interview = dict(
        db.execute(
            select(InterviewSession.owner_id, func.max(InterviewSession.completed_at)).group_by(
                InterviewSession.owner_id
            )
        ).all()
    )
    rows = []
    for student in db.scalars(select(User).where(User.role == "student").order_by(User.created_at.desc())):
        advisor = advisors.get(advisor_of.get(student.id, ""))
        seen = [
            at for at in (student.last_seen_at, last_analysis.get(student.id), last_interview.get(student.id)) if at
        ]
        rows.append(
            {
                "id": student.id,
                "full_name": student.full_name,
                "email": student.email,
                "phone": student.phone,
                "avatar_url": student.avatar_url,
                "advisor": (
                    {"id": advisor.id, "full_name": advisor.full_name, "disabled": advisor.disabled_at is not None}
                    if advisor
                    else None
                ),
                "created_at": student.created_at,
                "last_active_at": max(seen) if seen else None,
            }
        )
    return rows


def assign(db: Session, student_ids: list[str], advisor_id: str, now: datetime) -> dict[str, int]:
    """Gán (hoặc đổi) cố vấn cho các SV. SV và cố vấn mới nhận thông báo."""
    advisor = _advisor(db, advisor_id)
    if advisor.disabled_at is not None:
        raise AppError(409, "Cố vấn này đang bị tạm khoá.", "advisor_disabled")
    students = []
    for student_id in dict.fromkeys(student_ids):
        student = db.get(User, student_id)
        if student is None or student.role != "student":
            raise AppError(404, "Không tìm thấy sinh viên.", "student_not_found")
        students.append(student)

    changed: list[str] = []
    for student in students:
        assignment = db.scalar(select(AdvisorAssignment).where(AdvisorAssignment.student_id == student.id))
        if assignment is not None and assignment.advisor_id == advisor.id:
            continue
        body = "Bạn có thể nhắn tin và chia sẻ CV, báo cáo phỏng vấn để nhận góp ý."
        if assignment is None:
            db.add(
                AdvisorAssignment(id=f"as_{student.id}", advisor_id=advisor.id, student_id=student.id, assigned_at=now)
            )
            body += " Tài liệu vẫn riêng tư cho tới khi bạn bật chia sẻ."
        else:
            assignment.advisor_id = advisor.id
            assignment.assigned_at = now
            # Chia sẻ trước đây dành cho cố vấn cũ: chuyển về riêng tư để SV tự chọn lại
            revoked = db.execute(delete(ShareGrant).where(ShareGrant.owner_id == student.id)).rowcount
            if revoked:
                body += " Các tài liệu đã chia sẻ trước đây đã chuyển về riêng tư, bạn có thể bật lại."
        notifications.notify(
            db,
            student,
            "advisor_assigned",
            f"{advisor.full_name} là cố vấn của bạn",
            body,
            action_label="Chia sẻ với cố vấn",
            action_href="/student/share",
        )
        changed.append(student.full_name)

    if changed:
        notifications.notify(
            db,
            advisor,
            "advisor_assigned",
            f"Bạn được phân công thêm {len(changed)} sinh viên",
            ", ".join(changed[:3]) + ("…" if len(changed) > 3 else ""),
            action_label="Xem danh sách",
            action_href="/advisor/students",
        )
    db.commit()
    return {"assigned": len(changed), "unchanged": len(students) - len(changed)}
