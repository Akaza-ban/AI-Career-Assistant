"""
Buổi phỏng vấn thử có chấm điểm STAR (US-SV-04, PRD mục 5.1).

Quy tắc (đã chốt với nhóm):
- Mỗi buổi 4 câu cố định; mỗi câu 5 phút, hạn chót do backend giữ nên tải lại trang không đặt lại đồng hồ.
- Hết giờ: frontend tự nộp phần đang gõ; nếu chưa đủ độ dài thì câu đó 0 điểm. Sau đó chuyển câu tiếp.
- Tạm dừng: 1 lần mỗi buổi, tối đa 1 phút, hết 1 phút tự chạy lại.
- Chỉ buổi hoàn thành đủ 4 câu mới được lưu và tính vào hạn mức (3 buổi / vị trí / tuần).
  Buổi bỏ dở (kết thúc sớm, bắt đầu buổi mới, rời phòng quá lâu) bị xoá hẳn.
- Câu hỏi tạm lấy từ ngân hàng cố định (mock); chấm điểm dùng interview_agent (LLM, dự phòng bằng quy tắc).
"""

import uuid
from collections.abc import Callable
from datetime import UTC, datetime, time, timedelta, timezone
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from src.agents.interview.graph import interview_agent
from src.api.errors import AppError
from src.db.models import CvVersion, InterviewSession, InterviewTurn, JobDescription, User
from src.services import notifications
from src.services.guardrails import check_input_safety

QUESTION_COUNT = 4
QUESTION_SECONDS = 5 * 60
PAUSE_MAX_SECONDS = 60
# Chấp nhận câu nộp trễ vài giây do độ trễ mạng
SUBMIT_GRACE_SECONDS = 15
# Quá hạn chót ngần này mà không có ai nộp → coi như SV đã rời phòng, buổi bị huỷ
ABANDON_AFTER_SECONDS = 120
WEEKLY_LIMIT = 3
MIN_ANSWER_CHARS = 30
MAX_ANSWER_CHARS = 3000
VN_TZ = timezone(timedelta(hours=7))
CRITERIA = ("situation", "task", "action", "result")

# Ngân hàng câu hỏi tạm thời (mock), dùng được cho mọi ngành; sẽ thay bằng câu hỏi do agent sinh sau khi nhóm thống nhất.
QUESTION_BANK = [
    (
        "Nhiệm vụ tiêu biểu",
        "Hãy kể về một dự án hoặc nhiệm vụ bạn tự hào nhất có liên quan đến vị trí {role}. Bối cảnh lúc đó thế nào, "
        "bạn phụ trách phần việc gì, đã làm những gì và kết quả ra sao?",
    ),
    (
        "Xử lý khó khăn",
        "Hãy kể về một lần công việc hoặc dự án của bạn gặp trục trặc ngoài dự kiến. Bạn đã nhận ra vấn đề như thế nào, "
        "xử lý ra sao và kết quả cuối cùng là gì?",
    ),
    (
        "Làm việc nhóm",
        "Hãy chia sẻ một tình huống bạn có ý kiến khác với thành viên trong nhóm hoặc người hướng dẫn. Bạn đã trao đổi "
        "và cùng đi đến thống nhất như thế nào?",
    ),
    (
        "Học hỏi & ưu tiên",
        "Hãy kể về một lần bạn phải học nhanh một kỹ năng hoặc công cụ mới, hoặc xử lý nhiều việc cùng lúc với deadline "
        "gấp. Bạn đã sắp xếp ưu tiên và học như thế nào để hoàn thành?",
    ),
]

# Hướng dẫn cải thiện theo tiêu chí yếu nhất: chỉ đưa khung, không viết sẵn câu trả lời (PRD mục 6)
GUIDANCE = {
    "situation": "Mở đầu bằng bối cảnh: thời điểm, nơi làm việc hoặc dự án, quy mô và vấn đề cần giải quyết.",
    "task": "Nói rõ nhiệm vụ của riêng bạn và mục tiêu cần đạt, tách khỏi phần việc của cả nhóm.",
    "action": "Kể lần lượt các bước bạn trực tiếp làm, công cụ hoặc kỹ năng đã dùng và lý do chọn cách làm đó.",
    "result": "Kết thúc bằng kết quả đo được nếu có (thời gian, tỷ lệ, số lượng) và điều bạn rút ra; chỉ nêu số liệu có thật.",
}
BLOCKED_REASON = "Mình chỉ hỗ trợ nội dung liên quan buổi phỏng vấn. Bạn hãy thử trả lời lại nhé."


# ---------- Thời gian ----------


def _settle_pause(session: InterviewSession, now: datetime) -> None:
    """Hết 1 phút tạm dừng thì tự chạy lại: dời hạn chót thêm đúng thời gian đã dừng."""
    if session.paused_at and now - session.paused_at >= timedelta(seconds=PAUSE_MAX_SECONDS):
        _resume(session, now)


def _resume(session: InterviewSession, now: datetime) -> None:
    if session.paused_at and session.question_deadline:
        paused_for = min(now - session.paused_at, timedelta(seconds=PAUSE_MAX_SECONDS))
        session.question_deadline += paused_for
    session.paused_at = None


def seconds_left(session: InterviewSession, now: datetime) -> int | None:
    if session.status != "in_progress" or session.question_deadline is None:
        return None
    reference = session.paused_at or now
    return max(0, int((session.question_deadline - reference).total_seconds()))


def _pause_seconds_left(session: InterviewSession, now: datetime) -> int | None:
    if not session.paused_at:
        return None
    return max(0, PAUSE_MAX_SECONDS - int((now - session.paused_at).total_seconds()))


def week_start(now: datetime) -> datetime:
    """Đầu tuần (thứ Hai 00:00 giờ Việt Nam), trả về UTC dạng naive như dữ liệu trong DB."""
    local = now.replace(tzinfo=UTC).astimezone(VN_TZ)
    monday = datetime.combine(local.date() - timedelta(days=local.weekday()), time.min, tzinfo=VN_TZ)
    return monday.astimezone(UTC).replace(tzinfo=None)


# ---------- Truy vấn ----------


def _visible_jd(db: Session, user: User, jd_id: str) -> JobDescription:
    jd = db.get(JobDescription, jd_id)
    if jd is None or (jd.source == "pasted" and jd.owner_id != user.id):
        raise AppError(404, "Không tìm thấy vị trí ứng tuyển.", "jd_not_found")
    return jd


def quota(db: Session, user: User, jd_id: str, now: datetime) -> dict[str, Any]:
    start = week_start(now)
    used = db.scalar(
        select(func.count())
        .select_from(InterviewSession)
        .where(
            InterviewSession.owner_id == user.id,
            InterviewSession.jd_id == jd_id,
            InterviewSession.status == "completed",
            InterviewSession.completed_at >= start,
        )
    )
    return {
        "jd_id": jd_id,
        "used": used,
        "limit": WEEKLY_LIMIT,
        "remaining": max(0, WEEKLY_LIMIT - used),
        "resets_at": start + timedelta(days=7),
    }


def _delete_session(db: Session, session: InterviewSession) -> None:
    db.execute(delete(InterviewTurn).where(InterviewTurn.session_id == session.id))
    db.delete(session)


def load_session(db: Session, user: User, session_id: str, now: datetime) -> InterviewSession:
    """Buổi của chính SV. Buổi đang dở mà SV rời phòng quá lâu thì bị huỷ (lỗi 410)."""
    session = db.get(InterviewSession, session_id)
    if session is None or session.owner_id != user.id:
        raise AppError(404, "Không tìm thấy buổi phỏng vấn.", "interview_not_found")
    if session.status == "in_progress":
        _settle_pause(session, now)
        abandoned = (
            session.paused_at is None
            and session.question_deadline is not None
            and now > session.question_deadline + timedelta(seconds=ABANDON_AFTER_SECONDS)
        )
        if abandoned:
            _delete_session(db, session)
            db.commit()
            raise AppError(
                410,
                "Buổi phỏng vấn đã kết thúc vì bạn rời phòng quá lâu. Buổi này không bị tính lượt, hãy bắt đầu lại.",
                "interview_expired",
            )
    return session


def turns_of(db: Session, session_id: str) -> list[InterviewTurn]:
    return list(
        db.scalars(select(InterviewTurn).where(InterviewTurn.session_id == session_id).order_by(InterviewTurn.index))
    )


# ---------- Tạo buổi ----------


def _new_turn(session: InterviewSession, index: int, role: str, now: datetime) -> InterviewTurn:
    theme, template = QUESTION_BANK[index - 1]
    return InterviewTurn(
        id=f"it_{uuid.uuid4().hex[:12]}",
        session_id=session.id,
        index=index,
        theme=theme,
        question=template.format(role=role),
        asked_at=now,
    )


def create_session(db: Session, user: User, jd_id: str, cv_version_id: str, now: datetime) -> InterviewSession:
    jd = _visible_jd(db, user, jd_id)
    cv = db.get(CvVersion, cv_version_id)
    if cv is None or cv.owner_id != user.id:
        raise AppError(404, "Không tìm thấy phiên bản CV đã chọn.", "cv_not_found")

    limit = quota(db, user, jd.id, now)
    if limit["remaining"] == 0:
        resets = limit["resets_at"].replace(tzinfo=UTC).astimezone(VN_TZ).strftime("%d/%m")
        raise AppError(
            429,
            f"Bạn đã dùng hết {WEEKLY_LIMIT} buổi phỏng vấn cho vị trí này trong tuần. Lượt mới mở lại từ ngày {resets}.",
            "quota_exceeded",
        )

    # Mỗi SV chỉ có một buổi đang dở: buổi cũ bị huỷ, không tính lượt
    for old in db.scalars(
        select(InterviewSession).where(InterviewSession.owner_id == user.id, InterviewSession.status == "in_progress")
    ):
        _delete_session(db, old)

    session = InterviewSession(
        id=f"iv_{uuid.uuid4().hex[:12]}",
        owner_id=user.id,
        jd_id=jd.id,
        cv_version_id=cv.id,
        cv_file_name=cv.file_name,
        status="in_progress",
        current_index=1,
        question_deadline=now + timedelta(seconds=QUESTION_SECONDS),
        created_at=now,
    )
    db.add(session)
    db.add(_new_turn(session, 1, jd.title, now))
    db.commit()
    return session


# ---------- Trả lời ----------


def _blocked_reason(text: str) -> str | None:
    """Guardrail đầu vào (tạm dùng quy tắc; kiểm tra lạc đề bằng LLM sẽ thêm khi hoàn thiện agent)."""
    if len(text) < MIN_ANSWER_CHARS:
        return f"Câu trả lời quá ngắn. Hãy trả lời ít nhất {MIN_ANSWER_CHARS} ký tự theo khung STAR."
    if len(text) > MAX_ANSWER_CHARS:
        return f"Câu trả lời quá dài. Hãy rút gọn trong {MAX_ANSWER_CHARS} ký tự."
    safe, _ = check_input_safety(text)
    if not safe:
        return BLOCKED_REASON
    return None


async def _score(role: str, question: str, answer: str, index: int) -> dict[str, Any]:
    """Chấm câu trả lời theo rubric STAR 0–5 bằng interview_agent (LLM, dự phòng bằng quy tắc)."""
    result = await interview_agent.ainvoke(
        {
            "job_role": role,
            "user_answer": answer,
            "current_question": question,
            "current_round": index,
            "total_rounds": QUESTION_COUNT,
        }
    )
    star = {c: round(float(result.get(f"{c}_score", 0.0)), 2) for c in CRITERIA}
    return {"star": star, "feedback": str(result.get("feedback_text") or "").strip()}


async def submit_answer(
    db: Session,
    user: User,
    session_id: str,
    question_index: int,
    text: str,
    timed_out: bool,
    clock: Callable[[], datetime],
) -> dict[str, Any]:
    now = clock()
    session = load_session(db, user, session_id, now)
    if session.status != "in_progress":
        raise AppError(409, "Buổi phỏng vấn đã kết thúc.", "interview_not_active")
    if question_index != session.current_index:
        raise AppError(409, "Câu hỏi này đã được trả lời. Hãy tải lại trang.", "question_mismatch")

    # Trả lời trong lúc tạm dừng thì tiếp tục đồng hồ luôn
    _resume(session, now)
    text = text.strip()
    late = now > session.question_deadline + timedelta(seconds=SUBMIT_GRACE_SECONDS)

    if not timed_out and not late:
        reason = _blocked_reason(text)
        if reason:
            # Không tính câu, đồng hồ vẫn chạy như người phỏng vấn vẫn chờ câu trả lời
            db.commit()
            return {"allowed": False, "reason": reason, "seconds_left": seconds_left(session, now)}

    turn = db.scalar(
        select(InterviewTurn).where(InterviewTurn.session_id == session.id, InterviewTurn.index == question_index)
    )
    jd = db.get(JobDescription, session.jd_id)
    # Hết giờ: phần đang gõ vẫn được chấm nếu đủ độ dài và hợp lệ; nộp quá hạn thì không nhận nội dung
    usable = not late and _blocked_reason(text) is None
    turn.timed_out = timed_out or late
    turn.answered_at = now
    if usable:
        scored = await _score(jd.title, turn.question, text, question_index)
        turn.answer = text
        for criterion in CRITERIA:
            setattr(turn, criterion, scored["star"][criterion])
        turn.feedback = scored["feedback"] or None
    else:
        turn.answer = text or None
        for criterion in CRITERIA:
            setattr(turn, criterion, 0.0)
        turn.feedback = "Hết giờ khi chưa có câu trả lời hoàn chỉnh, câu này được 0 điểm."
    turn.score = round(sum(getattr(turn, c) for c in CRITERIA) / len(CRITERIA), 2)

    # Chấm bằng LLM có thể mất vài chục giây: đồng hồ câu tiếp theo chỉ bắt đầu khi đã chấm xong
    scored_at = clock()
    next_turn = None
    if question_index < QUESTION_COUNT:
        next_turn = _new_turn(session, question_index + 1, jd.title, scored_at)
        db.add(next_turn)
        session.current_index = question_index + 1
        session.question_deadline = scored_at + timedelta(seconds=QUESTION_SECONDS)
    else:
        _complete(db, session, scored_at)
    db.commit()
    return {
        "allowed": True,
        "turn": turn_out(turn),
        "next_question": question_out(next_turn) if next_turn else None,
        "seconds_left": seconds_left(session, scored_at),
        "finished": session.status == "completed",
    }


def _complete(db: Session, session: InterviewSession, now: datetime) -> None:
    db.flush()
    turns = turns_of(db, session.id)
    session.star = {c: round(sum(getattr(t, c) for t in turns) / len(turns), 2) for c in CRITERIA}
    session.overall_score = round(sum(t.score for t in turns) / len(turns), 2)
    session.status = "completed"
    session.completed_at = now
    session.question_deadline = None
    session.paused_at = None
    owner = db.get(User, session.owner_id)
    jd = db.get(JobDescription, session.jd_id)
    if owner is not None and jd is not None:
        notifications.notify(
            db,
            owner,
            "interview_report",
            f"Báo cáo phỏng vấn {jd.title} đã sẵn sàng",
            f"Điểm AI {notifications.score_text(session.overall_score)}. Xem điểm từng tiêu chí STAR và phần nên luyện thêm.",
            action_label="Xem báo cáo",
            action_href=f"/student/interview/{session.id}/report",
        )


# ---------- Tạm dừng / kết thúc sớm ----------


def pause(db: Session, user: User, session_id: str, now: datetime) -> InterviewSession:
    session = load_session(db, user, session_id, now)
    if session.status != "in_progress":
        raise AppError(409, "Buổi phỏng vấn đã kết thúc.", "interview_not_active")
    if session.pause_used:
        raise AppError(409, "Bạn đã dùng lượt tạm dừng của buổi này.", "pause_used")
    session.paused_at = now
    session.pause_used = True
    db.commit()
    return session


def resume(db: Session, user: User, session_id: str, now: datetime) -> InterviewSession:
    session = load_session(db, user, session_id, now)
    _resume(session, now)
    db.commit()
    return session


def abandon(db: Session, user: User, session_id: str, now: datetime) -> None:
    """Kết thúc sớm: buổi bị xoá hẳn, không tính lượt."""
    session = load_session(db, user, session_id, now)
    if session.status != "in_progress":
        raise AppError(409, "Buổi phỏng vấn đã hoàn thành, không thể huỷ.", "interview_not_active")
    _delete_session(db, session)
    db.commit()


# ---------- Kết quả ----------


def label_of(score: float) -> str:
    return "good" if score >= 4 else "fair" if score >= 3 else "basic" if score >= 2 else "weak"


def build_report(db: Session, user: User, session_id: str, now: datetime) -> dict[str, Any]:
    session = load_session(db, user, session_id, now)
    if session.status != "completed":
        raise AppError(409, "Buổi phỏng vấn chưa hoàn thành.", "report_not_ready")
    turns = turns_of(db, session.id)
    ranked = sorted(CRITERIA, key=lambda c: session.star[c])
    weakest = ranked[0]
    timed_out_count = sum(1 for t in turns if t.timed_out)

    guidance = [GUIDANCE[weakest], GUIDANCE[ranked[1]]]
    if timed_out_count:
        guidance.append(
            f"Bạn có {timed_out_count} câu hết giờ. Hãy luyện trả lời gọn theo 4 ý S – T – A – R trong khoảng 3–4 phút."
        )

    first = db.scalar(
        select(InterviewSession)
        .where(
            InterviewSession.owner_id == user.id,
            InterviewSession.jd_id == session.jd_id,
            InterviewSession.status == "completed",
        )
        .order_by(InterviewSession.completed_at)
        .limit(1)
    )
    comparison = None
    if first and first.id != session.id:
        comparison = {
            "first_session_id": first.id,
            "first_score": first.overall_score,
            "first_completed_at": first.completed_at,
            "delta": round(session.overall_score - first.overall_score, 2),
        }

    return {
        "id": session.id,
        "response_id": session.id,
        "jd": jd_out(db.get(JobDescription, session.jd_id)),
        "cv_file_name": session.cv_file_name,
        "created_at": session.created_at,
        "completed_at": session.completed_at,
        "duration_seconds": int((session.completed_at - session.created_at).total_seconds()),
        "overall_score": session.overall_score,
        "label": label_of(session.overall_score),
        "star": session.star,
        "weakest": weakest,
        "turns": [turn_out(t) for t in turns],
        "timed_out_count": timed_out_count,
        "guidance": guidance,
        "comparison": comparison,
    }


def recent(db: Session, user: User, limit: int) -> list[dict[str, Any]]:
    sessions = db.scalars(
        select(InterviewSession)
        .where(InterviewSession.owner_id == user.id, InterviewSession.status == "completed")
        .order_by(InterviewSession.completed_at.desc())
        .limit(limit)
    )
    return [
        {
            "id": s.id,
            "jd": jd_out(db.get(JobDescription, s.jd_id)),
            "completed_at": s.completed_at,
            "overall_score": s.overall_score,
            "star": s.star,
        }
        for s in sessions
    ]


# ---------- Chuyển sang dữ liệu trả về ----------


def jd_out(jd: JobDescription) -> dict[str, Any]:
    return {"id": jd.id, "title": jd.title, "company": jd.company, "source": jd.source}


def question_out(turn: InterviewTurn) -> dict[str, Any]:
    return {"index": turn.index, "theme": turn.theme, "text": turn.question}


def turn_out(turn: InterviewTurn) -> dict[str, Any]:
    scored = turn.answered_at is not None
    return {
        "id": turn.id,
        "index": turn.index,
        "theme": turn.theme,
        "question": turn.question,
        "answer": turn.answer,
        "timed_out": turn.timed_out,
        "star": {c: getattr(turn, c) for c in CRITERIA} if scored else None,
        "score": turn.score if scored else None,
        "feedback": turn.feedback,
    }


def session_out(db: Session, session: InterviewSession, now: datetime) -> dict[str, Any]:
    turns = turns_of(db, session.id)
    current = next((t for t in turns if t.index == session.current_index and t.answered_at is None), None)
    return {
        "id": session.id,
        "status": session.status,
        "jd": jd_out(db.get(JobDescription, session.jd_id)),
        "cv_version_id": session.cv_version_id,
        "cv_file_name": session.cv_file_name,
        "question_count": QUESTION_COUNT,
        "seconds_per_question": QUESTION_SECONDS,
        "current_question": question_out(current) if current and session.status == "in_progress" else None,
        "seconds_left": seconds_left(session, now),
        "paused": session.paused_at is not None,
        "pause_used": session.pause_used,
        "pause_seconds_left": _pause_seconds_left(session, now),
        "turns": [turn_out(t) for t in turns if t.answered_at is not None],
        "created_at": session.created_at,
    }
