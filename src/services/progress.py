"""
Tổng quan (S1) và Lịch sử & Tiến bộ (S8) của sinh viên.

Chỉ tổng hợp từ dữ liệu đã có (phiên bản CV, lượt phân tích, buổi phỏng vấn đã hoàn thành), không lưu thêm gì.
Điểm phỏng vấn thang 0–5 (PRD mục 5.1) chỉ được so sánh trong cùng một vị trí (JD);
độ khớp CV–JD thang 0–100 (PRD mục 5.2) được so sánh giữa các phiên bản CV với cùng một JD.
"""

import re
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.api.errors import AppError
from src.db.models import CvVersion, GapAnalysis, InterviewSession, InterviewTurn, JobDescription, User
from src.services import cv_versions, interview
from src.services.roadmap import get_roadmap_info
from src.services.skill_matching import match_label

RECENT_LIMIT = 5
# Số buổi gần nhất dùng cho điểm trung bình S/T/A/R và biểu đồ nhỏ ở Tổng quan
STAR_WINDOW = 5
SKILLS_LIMIT = 6
RANGE_DAYS = {"30d": 30, "90d": 90, "all": None}
IMPORTANCE_ORDER = {"required": 0, "preferred": 1, "additional": 2}


# ---------- Truy vấn chung ----------


def completed_sessions(db: Session, user: User) -> list[InterviewSession]:
    """Buổi đã hoàn thành, mới nhất trước."""
    return list(
        db.scalars(
            select(InterviewSession)
            .where(InterviewSession.owner_id == user.id, InterviewSession.status == "completed")
            .order_by(InterviewSession.completed_at.desc())
        )
    )


def student_analyses(db: Session, user: User) -> list[GapAnalysis]:
    """Mọi lượt phân tích (kể cả đang chạy, lỗi), mới nhất trước."""
    return list(
        db.scalars(select(GapAnalysis).where(GapAnalysis.owner_id == user.id).order_by(GapAnalysis.created_at.desc()))
    )


def load_jds(db: Session, ids: set[str]) -> dict[str, JobDescription]:
    if not ids:
        return {}
    return {jd.id: jd for jd in db.scalars(select(JobDescription).where(JobDescription.id.in_(ids)))}


def timed_out_counts(db: Session, session_ids: list[str]) -> dict[str, int]:
    if not session_ids:
        return {}
    rows = db.execute(
        select(InterviewTurn.session_id, func.count())
        .where(InterviewTurn.session_id.in_(session_ids), InterviewTurn.timed_out.is_(True))
        .group_by(InterviewTurn.session_id)
    )
    return {session_id: count for session_id, count in rows}


def _version_of(analysis: GapAnalysis) -> tuple[int, int]:
    """(Số chính, số phụ) từ nhãn "v1.2" (CV có thể đã bị xoá nên không tra bảng cv_versions)."""
    found = re.match(r"v(\d+)(?:\.(\d+))?", analysis.cv_label)
    return (int(found.group(1)), int(found.group(2) or 0)) if found else (0, 0)


def _delta(after: float | None, before: float | None) -> float | None:
    if after is None or before is None:
        return None
    return round(after - before, 2)


# ---------- Chuyển sang dữ liệu trả về ----------


def analysis_row(analysis: GapAnalysis, jd: JobDescription) -> dict[str, Any]:
    return {
        "id": analysis.id,
        "jd": interview.jd_out(jd),
        "cv_version_id": analysis.cv_version_id,
        "cv_label": analysis.cv_label,
        "cv_file_name": analysis.cv_file_name,
        "status": analysis.status,
        "current_step": analysis.current_step,
        "match_score": analysis.match_score,
        "match_label": match_label(analysis.match_score),
        "created_at": analysis.created_at,
        "completed_at": analysis.completed_at,
    }


def interview_row(session: InterviewSession, jd: JobDescription, timed_out_count: int) -> dict[str, Any]:
    return {
        "id": session.id,
        "jd": interview.jd_out(jd),
        "completed_at": session.completed_at,
        "duration_seconds": int((session.completed_at - session.created_at).total_seconds()),
        "overall_score": session.overall_score,
        "label": interview.label_of(session.overall_score),
        "star": session.star,
        "timed_out_count": timed_out_count,
    }


def _point(session: InterviewSession) -> dict[str, Any]:
    return {"id": session.id, "completed_at": session.completed_at, "score": session.overall_score}


def star_average(sessions: list[InterviewSession]) -> dict[str, float]:
    return {c: round(sum(s.star[c] for s in sessions) / len(sessions), 2) for c in interview.CRITERIA}


def weakest_criterion(star: dict[str, float]) -> str:
    return min(interview.CRITERIA, key=lambda c: star[c])


# ---------- Tổng quan (S1) ----------


def _active_interview(db: Session, user: User, now: datetime) -> dict[str, Any] | None:
    """Buổi phỏng vấn đang dở và còn quay lại được (buổi đã bị bỏ quá lâu sẽ bị huỷ như khi mở phòng)."""
    session_id = db.scalar(
        select(InterviewSession.id).where(
            InterviewSession.owner_id == user.id, InterviewSession.status == "in_progress"
        )
    )
    if session_id is None:
        return None
    try:
        session = interview.load_session(db, user, session_id, now)
    except AppError:
        return None
    return {
        "id": session.id,
        "jd": interview.jd_out(db.get(JobDescription, session.jd_id)),
        "current_index": session.current_index,
        "question_count": interview.QUESTION_COUNT,
        "seconds_left": interview.seconds_left(session, now),
        "paused": session.paused_at is not None,
    }


def _next_step(
    db: Session,
    user: User,
    now: datetime,
    cvs: list[CvVersion],
    completed: list[GapAnalysis],
    sessions: list[InterviewSession],
    jds: dict[str, JobDescription],
) -> dict[str, Any]:
    """
    Một việc nên làm tiếp theo, theo thứ tự: tải CV → phân tích với một JD → luyện phỏng vấn vị trí vừa phân tích
    → luyện tiếp để cải thiện tiêu chí STAR yếu nhất của buổi gần nhất.
    """
    if not cvs:
        return {"kind": "upload_cv"}
    if not completed:
        cv = next((c for c in cvs if c.is_active), cvs[0])
        return {"kind": "analyze", "cv_version_id": cv.id, "cv_label": cv_versions.label(cv)}

    latest = completed[0]
    if latest.jd_id not in {s.jd_id for s in sessions}:
        limit = interview.quota(db, user, latest.jd_id, now)
        return {
            "kind": "interview",
            "jd": interview.jd_out(jds[latest.jd_id]),
            "analysis_id": latest.id,
            "match_score": latest.match_score,
            "quota_remaining": limit["remaining"],
            "quota_resets_at": limit["resets_at"],
        }

    last = sessions[0]
    criterion = weakest_criterion(last.star)
    limit = interview.quota(db, user, last.jd_id, now)
    return {
        "kind": "improve",
        "jd": interview.jd_out(jds[last.jd_id]),
        "session_id": last.id,
        "criterion": criterion,
        "criterion_score": last.star[criterion],
        "guidance": interview.GUIDANCE[criterion],
        "quota_remaining": limit["remaining"],
        "quota_resets_at": limit["resets_at"],
    }


def _roadmap_url(skill: str) -> str | None:
    """Link roadmap.sh khi kỹ năng có lộ trình riêng (kỹ năng CNTT); kỹ năng khác không có link."""
    info = get_roadmap_info(skill)
    return info["roadmap_url"] if info["is_it_supported"] else None


def _skills_to_learn(analysis: GapAnalysis | None, jds: dict[str, JobDescription]) -> dict[str, Any] | None:
    """Kỹ năng "Thiếu" trong lần phân tích gần nhất, ưu tiên nhóm Bắt buộc."""
    if analysis is None:
        return None
    missing = [r for r in (analysis.result or {}).get("requirements", []) if r["status"] == "missing"]
    missing.sort(key=lambda r: IMPORTANCE_ORDER.get(r["importance"], 3))
    return {
        "analysis_id": analysis.id,
        "jd": interview.jd_out(jds[analysis.jd_id]),
        "skills": [
            {"name": r["skill"], "importance": r["importance"], "roadmap_url": _roadmap_url(r["skill"])}
            for r in missing[:SKILLS_LIMIT]
        ],
        "total_missing": len(missing),
    }


def _latest_interview(sessions: list[InterviewSession], jds: dict[str, JobDescription]) -> dict[str, Any] | None:
    """Buổi gần nhất, so với buổi đầu tiên của cùng vị trí, kèm điểm các buổi gần nhất của vị trí đó."""
    if not sessions:
        return None
    last = sessions[0]
    same_jd = [s for s in sessions if s.jd_id == last.jd_id]
    first = same_jd[-1]
    return {
        "id": last.id,
        "jd": interview.jd_out(jds[last.jd_id]),
        "completed_at": last.completed_at,
        "score": last.overall_score,
        "label": interview.label_of(last.overall_score),
        "first_score": first.overall_score if first.id != last.id else None,
        "delta": _delta(last.overall_score, first.overall_score) if first.id != last.id else None,
        "session_count": len(same_jd),
        "trend": [_point(s) for s in reversed(same_jd[:STAR_WINDOW])],
    }


def overview(db: Session, user: User, now: datetime) -> dict[str, Any]:
    cvs = list(db.scalars(select(CvVersion).where(CvVersion.owner_id == user.id).order_by(CvVersion.version.desc())))
    analyses = student_analyses(db, user)
    sessions = completed_sessions(db, user)
    jds = load_jds(db, {a.jd_id for a in analyses} | {s.jd_id for s in sessions})
    completed = sorted((a for a in analyses if a.status == "completed"), key=lambda a: a.completed_at, reverse=True)
    latest_analysis = completed[0] if completed else None
    recent_sessions = sessions[:RECENT_LIMIT]
    timed_out = timed_out_counts(db, [s.id for s in recent_sessions])
    week_start = interview.week_start(now)

    latest_match = None
    if latest_analysis:
        latest_match = {
            "analysis_id": latest_analysis.id,
            "jd": interview.jd_out(jds[latest_analysis.jd_id]),
            "cv_label": latest_analysis.cv_label,
            "score": latest_analysis.match_score,
            "label": match_label(latest_analysis.match_score),
            "completed_at": latest_analysis.completed_at,
        }
    star = None
    if sessions:
        average = star_average(sessions[:STAR_WINDOW])
        star = {"average": average, "weakest": weakest_criterion(average), "session_count": len(sessions[:STAR_WINDOW])}

    return {
        "cv_count": len(cvs),
        "cv_latest_at": max((c.uploaded_at for c in cvs), default=None),
        "interview_count": len(sessions),
        "interview_week_count": sum(1 for s in sessions if s.completed_at >= week_start),
        "latest_match": latest_match,
        "latest_interview": _latest_interview(sessions, jds),
        "star": star,
        "in_progress": {
            "analyses": [analysis_row(a, jds[a.jd_id]) for a in analyses if a.status == "processing"],
            "interview": _active_interview(db, user, now),
        },
        "next_step": _next_step(db, user, now, cvs, completed, sessions, jds),
        "skills_to_learn": _skills_to_learn(latest_analysis, jds),
        "recent_analyses": [analysis_row(a, jds[a.jd_id]) for a in analyses[:RECENT_LIMIT]],
        "recent_interviews": [interview_row(s, jds[s.jd_id], timed_out.get(s.id, 0)) for s in recent_sessions],
    }


# ---------- Lịch sử & Tiến bộ (S8) ----------


def _positions(
    sessions: list[InterviewSession], analyses: list[GapAnalysis], jds: dict[str, JobDescription]
) -> list[dict[str, Any]]:
    """Các vị trí SV đã luyện hoặc phân tích (không phụ thuộc khoảng thời gian), hoạt động gần nhất trước."""
    stats: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"interview_count": 0, "analysis_count": 0, "last_activity_at": datetime.min}
    )
    for s in sessions:
        stats[s.jd_id]["interview_count"] += 1
        stats[s.jd_id]["last_activity_at"] = max(stats[s.jd_id]["last_activity_at"], s.completed_at)
    for a in analyses:
        if a.status != "completed":
            continue
        stats[a.jd_id]["analysis_count"] += 1
        stats[a.jd_id]["last_activity_at"] = max(stats[a.jd_id]["last_activity_at"], a.completed_at)
    ranked = sorted(stats.items(), key=lambda item: item[1]["last_activity_at"], reverse=True)
    return [{"jd": interview.jd_out(jds[jd_id]), **values} for jd_id, values in ranked]


def interview_progress(sessions: list[InterviewSession], jds: dict[str, JobDescription]) -> list[dict[str, Any]]:
    """
    Tiến bộ phỏng vấn theo từng vị trí (PRD mục 5.1, 2 lớp):
    lớp 1 là điểm tổng qua các buổi, lớp 2 là S/T/A/R của buổi trước so với buổi gần nhất.
    """
    groups: dict[str, list[InterviewSession]] = defaultdict(list)
    for s in sorted(sessions, key=lambda s: s.completed_at):
        groups[s.jd_id].append(s)
    result = []
    for jd_id, group in groups.items():
        first, latest = group[0], group[-1]
        previous = group[-2] if len(group) > 1 else None
        result.append(
            {
                "jd": interview.jd_out(jds[jd_id]),
                "session_count": len(group),
                "points": [_point(s) for s in group],
                "first_score": first.overall_score,
                "latest_score": latest.overall_score,
                "delta_from_first": _delta(latest.overall_score, first.overall_score) if previous else None,
                "delta_from_previous": _delta(latest.overall_score, previous.overall_score) if previous else None,
                "latest_session_id": latest.id,
                "previous_session_id": previous.id if previous else None,
                "star_latest": latest.star,
                "star_previous": previous.star if previous else None,
            }
        )
    return sorted(result, key=lambda g: g["points"][-1]["completed_at"], reverse=True)


def cv_progress(analyses: list[GapAnalysis], jds: dict[str, JobDescription]) -> list[dict[str, Any]]:
    """Độ khớp CV–JD qua các phiên bản CV với cùng một JD (mỗi phiên bản lấy lần phân tích gần nhất)."""
    latest_per_cv: dict[tuple[str, str], GapAnalysis] = {}
    for a in analyses:
        if a.status != "completed" or a.match_score is None:
            continue
        key = (a.jd_id, a.cv_version_id)
        if key not in latest_per_cv or a.completed_at > latest_per_cv[key].completed_at:
            latest_per_cv[key] = a
    groups: dict[str, list[GapAnalysis]] = defaultdict(list)
    for (jd_id, _), a in latest_per_cv.items():
        groups[jd_id].append(a)

    result = []
    for jd_id, group in groups.items():
        group.sort(key=lambda a: (_version_of(a), a.completed_at))
        result.append(
            {
                "jd": interview.jd_out(jds[jd_id]),
                "points": [
                    {
                        "analysis_id": a.id,
                        "cv_version_id": a.cv_version_id,
                        "cv_label": a.cv_label,
                        "match_score": a.match_score,
                        "completed_at": a.completed_at,
                    }
                    for a in group
                ],
                "delta": _delta(group[-1].match_score, group[0].match_score) if len(group) > 1 else None,
                "last_activity_at": max(a.completed_at for a in group),
            }
        )
    result.sort(key=lambda g: g["last_activity_at"], reverse=True)
    for group in result:
        del group["last_activity_at"]
    return result


def progress(db: Session, user: User, range_: str, jd_id: str | None, now: datetime) -> dict[str, Any]:
    if jd_id is not None:
        jd = db.get(JobDescription, jd_id)
        if jd is None or (jd.source == "pasted" and jd.owner_id != user.id):
            raise AppError(404, "Không tìm thấy vị trí ứng tuyển.", "jd_not_found")

    all_sessions = completed_sessions(db, user)
    all_analyses = student_analyses(db, user)
    jds = load_jds(db, {a.jd_id for a in all_analyses} | {s.jd_id for s in all_sessions})

    days = RANGE_DAYS[range_]
    since = now - timedelta(days=days) if days else None

    def keep(at: datetime, item_jd: str) -> bool:
        return (since is None or at >= since) and (jd_id is None or item_jd == jd_id)

    sessions = [s for s in all_sessions if keep(s.completed_at, s.jd_id)]
    analyses = [a for a in all_analyses if keep(a.created_at, a.jd_id)]
    timed_out = timed_out_counts(db, [s.id for s in sessions])
    activity = [s.completed_at for s in sessions] + [a.completed_at or a.created_at for a in analyses]

    return {
        "range": range_,
        "jd_id": jd_id,
        "last_activity_at": max(activity, default=None),
        "positions": _positions(all_sessions, all_analyses, jds),
        "interview_progress": interview_progress(sessions, jds),
        "cv_progress": cv_progress(analyses, jds),
        "interviews": [interview_row(s, jds[s.jd_id], timed_out.get(s.id, 0)) for s in sessions],
        "analyses": [analysis_row(a, jds[a.jd_id]) for a in analyses],
    }
