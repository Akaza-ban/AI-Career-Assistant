"""
Chia sẻ tài liệu với cố vấn phụ trách (phía SV) và nhận xét của cố vấn.

Mặc định mọi tài liệu là riêng tư. Không chia sẻ thì cố vấn chỉ thấy số liệu tổng hợp (điểm từng buổi, chênh lệch,
cờ "Cần chú ý", ngày hoạt động); nội dung CV, câu trả lời phỏng vấn và chi tiết phân tích cần SV bật chia sẻ.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from src.api.errors import AppError
from src.db.models import AdvisorAssignment, AdvisorReview, CvVersion, GapAnalysis, JobDescription, ShareGrant, User
from src.services import progress

KIND_CV = "cv"
KIND_INTERVIEW = "interview"


def advisor_of(db: Session, student: User) -> User | None:
    assignment = db.scalar(select(AdvisorAssignment).where(AdvisorAssignment.student_id == student.id))
    return db.get(User, assignment.advisor_id) if assignment else None


def grants_of(db: Session, owner_id: str) -> dict[str, ShareGrant]:
    """Tài liệu đang chia sẻ của SV theo mã tài liệu (mã CV và mã buổi phỏng vấn không trùng nhau)."""
    return {g.item_id: g for g in db.scalars(select(ShareGrant).where(ShareGrant.owner_id == owner_id))}


def grant_for(db: Session, kind: str, item_id: str) -> ShareGrant | None:
    return db.scalar(select(ShareGrant).where(ShareGrant.kind == kind, ShareGrant.item_id == item_id))


def latest_match_by_cv(db: Session, owner_id: str) -> dict[str, float | None]:
    """Độ khớp của lần phân tích hoàn tất gần nhất cho từng phiên bản CV."""
    rows = db.scalars(
        select(GapAnalysis)
        .where(GapAnalysis.owner_id == owner_id, GapAnalysis.status == "completed")
        .order_by(GapAnalysis.completed_at)
    )
    return {a.cv_version_id: a.match_score for a in rows}


def _date_label(at: datetime) -> str:
    return at.strftime("%d/%m/%Y")


def interview_title(jd: JobDescription) -> str:
    return f"Phỏng vấn {jd.title}"


def advisor_contact(advisor: User) -> dict[str, Any]:
    return {
        "id": advisor.id,
        "full_name": advisor.full_name,
        "title": advisor.title or advisor.subtitle,
        "email": advisor.email,
        "office": advisor.office,
        "office_hours": advisor.office_hours,
        "avatar_url": advisor.avatar_url,
    }


def items(db: Session, student: User) -> list[dict[str, Any]]:
    """Mọi phiên bản CV (mới nhất trước) rồi mọi báo cáo phỏng vấn đã hoàn thành (mới nhất trước)."""
    grants = grants_of(db, student.id)
    cvs = db.scalars(select(CvVersion).where(CvVersion.owner_id == student.id).order_by(CvVersion.version.desc()))
    matches = latest_match_by_cv(db, student.id)
    sessions = progress.completed_sessions(db, student)
    jds = progress.load_jds(db, {s.jd_id for s in sessions})
    reviewed = set(db.scalars(select(AdvisorReview.session_id).where(AdvisorReview.student_id == student.id)))

    result = []
    for cv in cvs:
        grant = grants.get(cv.id)
        score = matches.get(cv.id)
        result.append(
            {
                "id": cv.id,
                "kind": "cv",
                "title": cv.file_name,
                "subtitle": f"Phiên bản v{cv.version}.0",
                "tag": "primary" if cv.is_active else "draft" if cv.is_draft else None,
                "created_at": cv.uploaded_at,
                "score": round(score) if score is not None else None,
                "shared": grant is not None,
                "advisor_viewed_at": grant.advisor_viewed_at if grant else None,
                "has_advisor_comment": False,
            }
        )
    for s in sessions:
        grant = grants.get(s.id)
        jd = jds[s.jd_id]
        result.append(
            {
                "id": s.id,
                "kind": "interview_report",
                "title": interview_title(jd),
                "subtitle": jd.company,
                "tag": None,
                "created_at": s.completed_at,
                "score": s.overall_score,
                "shared": grant is not None,
                "advisor_viewed_at": grant.advisor_viewed_at if grant else None,
                "has_advisor_comment": s.id in reviewed,
            }
        )
    return result


def update(db: Session, student: User, item_ids: list[str], shared: bool, now: datetime) -> None:
    """Bật / tắt chia sẻ nhiều tài liệu cùng lúc; mã không thuộc SV thì báo 404 và không đổi gì."""
    kinds = {cv_id: KIND_CV for cv_id in db.scalars(select(CvVersion.id).where(CvVersion.owner_id == student.id))}
    kinds.update({s.id: KIND_INTERVIEW for s in progress.completed_sessions(db, student)})
    unknown = [item_id for item_id in item_ids if item_id not in kinds]
    if unknown:
        raise AppError(404, "Không tìm thấy tài liệu cần chia sẻ.", "item_not_found")

    grants = grants_of(db, student.id)
    if shared:
        for item_id in dict.fromkeys(item_ids):
            if item_id not in grants:
                db.add(
                    ShareGrant(
                        id=f"sh_{uuid.uuid4().hex[:12]}",
                        owner_id=student.id,
                        kind=kinds[item_id],
                        item_id=item_id,
                        shared_at=now,
                    )
                )
    else:
        db.execute(delete(ShareGrant).where(ShareGrant.owner_id == student.id, ShareGrant.item_id.in_(item_ids)))
    db.commit()


def unshare_deleted(db: Session, item_id: str) -> None:
    """Tài liệu đã xoá thì bỏ luôn quyền chia sẻ."""
    db.execute(delete(ShareGrant).where(ShareGrant.item_id == item_id))


def _review_read(review: AdvisorReview) -> bool:
    return review.seen_at is not None and review.seen_at >= review.updated_at


def feedback(db: Session, student: User) -> list[dict[str, Any]]:
    """Nhận xét của cố vấn cho các báo cáo của SV, mới cập nhật trước (vẫn giữ khi SV đã tắt chia sẻ)."""
    reviews = list(
        db.scalars(
            select(AdvisorReview)
            .where(AdvisorReview.student_id == student.id)
            .order_by(AdvisorReview.updated_at.desc())
        )
    )
    sessions = {s.id: s for s in progress.completed_sessions(db, student)}
    jds = progress.load_jds(db, {s.jd_id for s in sessions.values()})
    advisors = {a.id: a for a in db.scalars(select(User).where(User.id.in_({r.advisor_id for r in reviews})))}
    result = []
    for r in reviews:
        session = sessions.get(r.session_id)
        if session is None:
            continue
        result.append(
            {
                "id": r.id,
                "advisor_name": advisors[r.advisor_id].full_name,
                "comment": r.comment,
                "created_at": r.updated_at,
                "read": _review_read(r),
                "target": {
                    "kind": "interview_report",
                    "id": session.id,
                    "label": f"{interview_title(jds[session.jd_id])} · {_date_label(session.completed_at)}",
                },
            }
        )
    return result


def mark_read(db: Session, student: User, review_id: str, now: datetime) -> None:
    review = db.get(AdvisorReview, review_id)
    if review is None or review.student_id != student.id:
        raise AppError(404, "Không tìm thấy nhận xét.", "feedback_not_found")
    review.seen_at = now
    db.commit()


def review_for_student(db: Session, session_id: str) -> dict[str, Any] | None:
    """Nhận xét của cố vấn hiện trên trang báo cáo phỏng vấn của SV."""
    review = db.scalar(
        select(AdvisorReview).where(AdvisorReview.session_id == session_id).order_by(AdvisorReview.updated_at.desc())
    )
    if review is None:
        return None
    return {
        "id": review.id,
        "advisor_name": db.get(User, review.advisor_id).full_name,
        "comment": review.comment,
        "updated_at": review.updated_at,
        "read": _review_read(review),
    }


def overview(db: Session, student: User) -> dict[str, Any]:
    advisor = advisor_of(db, student)
    return {
        "advisor": advisor_contact(advisor) if advisor else None,
        "items": items(db, student),
        "feedback": feedback(db, student),
    }
