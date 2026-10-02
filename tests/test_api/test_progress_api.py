"""Tổng quan (S1) và Lịch sử & Tiến bộ (S8): dữ liệu tổng hợp từ CV, lượt phân tích và buổi phỏng vấn."""

import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy import delete

from src.api import students as students_api
from src.db.database import SessionLocal, init_db
from src.db.models import CvVersion, Feedback, GapAnalysis, InterviewSession, InterviewTurn, JobDescription
from src.db.seed import DEMO_ADVISOR_ID, DEMO_STUDENT_ID
from src.services.interview import GUIDANCE, QUESTION_SECONDS
from tests.helpers import ADVISOR, STUDENT

NOW = datetime(2026, 9, 30, 3, 0)  # Thứ Tư, 10:00 giờ Việt Nam; tuần bắt đầu 27/09 17:00 UTC
OVERVIEW = "/api/v1/students/me/overview"
PROGRESS = "/api/v1/students/me/progress"


@pytest.fixture(autouse=True)
def clean_data(monkeypatch):
    init_db()
    with SessionLocal() as db:
        for model in (InterviewTurn, InterviewSession, Feedback, GapAnalysis, CvVersion):
            db.execute(delete(model))
        db.execute(delete(JobDescription).where(JobDescription.source == "pasted"))
        db.commit()
    monkeypatch.setattr(students_api, "utcnow", lambda: NOW)


# ---------- Dữ liệu mẫu ----------


def add_cv(version: int, active: bool = False) -> str:
    with SessionLocal() as db:
        cv = CvVersion(
            id=f"cv_{uuid.uuid4().hex[:8]}",
            owner_id=DEMO_STUDENT_ID,
            version=version,
            file_name=f"cv-v{version}.pdf",
            file_type="pdf",
            size_bytes=1000,
            content_text="Nguyễn Minh Anh",
            is_active=active,
            uploaded_at=NOW - timedelta(days=40 - version),
        )
        # Mỗi lần gọi là một CV riêng, nhãn vN.0 khớp nhãn của các lượt phân tích tạo ở add_analysis
        cv.family_id, cv.major, cv.minor = cv.id, version, 0
        db.add(cv)
        db.commit()
        return cv.id


def requirement(skill: str, importance: str, status: str) -> dict:
    return {
        "id": f"r_{skill}",
        "skill": skill,
        "importance": importance,
        "weight": {"required": 3, "preferred": 2, "additional": 1}[importance],
        "match": {"matched": 1, "partial": 0.5, "missing": 0}[status],
        "status": status,
        "evidence": None,
        "note": None,
    }


def add_analysis(
    cv_id: str,
    version: int,
    jd_id: str,
    score: float | None,
    at: datetime,
    status: str = "completed",
    requirements: list[dict] | None = None,
) -> str:
    with SessionLocal() as db:
        analysis = GapAnalysis(
            id=f"ga_{uuid.uuid4().hex[:8]}",
            owner_id=DEMO_STUDENT_ID,
            cv_version_id=cv_id,
            cv_file_name=f"cv-v{version}.pdf",
            cv_label=f"v{version}.0",
            jd_id=jd_id,
            status=status,
            current_step="compare" if status == "processing" else None,
            match_score=score if status == "completed" else None,
            result={"requirements": requirements or []} if status == "completed" else None,
            created_at=at - timedelta(minutes=1),
            completed_at=at if status != "processing" else None,
        )
        db.add(analysis)
        db.commit()
        return analysis.id


def add_session(jd_id: str, star: dict[str, float], at: datetime, timed_out: int = 0) -> str:
    """Buổi đã hoàn thành: 4 câu cùng điểm S/T/A/R, `timed_out` câu đầu bị hết giờ."""
    with SessionLocal() as db:
        overall = round(sum(star.values()) / 4, 2)
        session = InterviewSession(
            id=f"iv_{uuid.uuid4().hex[:8]}",
            owner_id=DEMO_STUDENT_ID,
            jd_id=jd_id,
            cv_version_id="cv_x",
            cv_file_name="cv.pdf",
            status="completed",
            current_index=4,
            overall_score=overall,
            star=star,
            created_at=at - timedelta(minutes=15),
            completed_at=at,
        )
        db.add(session)
        for index in range(1, 5):
            db.add(
                InterviewTurn(
                    id=f"it_{uuid.uuid4().hex[:8]}",
                    session_id=session.id,
                    index=index,
                    theme="Chủ đề",
                    question="Câu hỏi",
                    answer="Trả lời",
                    timed_out=index <= timed_out,
                    score=overall,
                    answered_at=at,
                    **star,
                )
            )
        db.commit()
        return session.id


def star(s: float, t: float, a: float, r: float) -> dict[str, float]:
    return {"situation": s, "task": t, "action": a, "result": r}


def add_live_session(jd_id: str, deadline: datetime, paused_at: datetime | None = None) -> str:
    with SessionLocal() as db:
        session = InterviewSession(
            id=f"iv_{uuid.uuid4().hex[:8]}",
            owner_id=DEMO_STUDENT_ID,
            jd_id=jd_id,
            cv_version_id="cv_x",
            cv_file_name="cv.pdf",
            status="in_progress",
            current_index=2,
            question_deadline=deadline,
            paused_at=paused_at,
            pause_used=paused_at is not None,
            created_at=deadline - timedelta(seconds=QUESTION_SECONDS * 2),
        )
        db.add(session)
        db.commit()
        return session.id


# ---------- Tổng quan ----------


@pytest.mark.asyncio
async def test_overview_empty_student_suggests_uploading_cv(client):
    response = await client.get(OVERVIEW, headers=STUDENT)
    assert response.status_code == 200
    data = response.json()
    assert data["cv_count"] == 0
    assert data["interview_count"] == 0
    assert data["latest_match"] is None
    assert data["latest_interview"] is None
    assert data["star"] is None
    assert data["skills_to_learn"] is None
    assert data["in_progress"] == {"analyses": [], "interview": None}
    assert data["next_step"]["kind"] == "upload_cv"
    assert data["recent_analyses"] == []
    assert data["recent_interviews"] == []


@pytest.mark.asyncio
async def test_overview_with_cv_only_suggests_analysis_of_active_cv(client):
    add_cv(1)
    active = add_cv(2, active=True)
    add_cv(3)
    data = (await client.get(OVERVIEW, headers=STUDENT)).json()
    assert data["cv_count"] == 3
    assert data["next_step"] == {**data["next_step"], "kind": "analyze", "cv_version_id": active, "cv_label": "v2.0"}


@pytest.mark.asyncio
async def test_overview_after_analysis_suggests_interview_and_missing_skills(client):
    cv = add_cv(1, active=True)
    add_analysis(cv, 1, "jd-ba-intern", 40.0, NOW - timedelta(days=3))
    requirements = [
        requirement("SQL", "required", "matched"),
        requirement("Tableau", "additional", "missing"),
        requirement("Power BI", "preferred", "missing"),
        requirement("Python", "required", "missing"),
        requirement("Excel", "required", "partial"),
    ]
    latest = add_analysis(cv, 1, "jd-da-intern", 62.5, NOW - timedelta(hours=2), requirements=requirements)
    running = add_analysis(cv, 1, "jd-be-intern", None, NOW, status="processing")

    data = (await client.get(OVERVIEW, headers=STUDENT)).json()
    assert data["latest_match"]["analysis_id"] == latest
    assert data["latest_match"]["score"] == 62.5
    assert data["latest_match"]["label"] == "medium"
    assert data["latest_match"]["jd"]["title"] == "Data Analyst Intern"

    step = data["next_step"]
    assert step["kind"] == "interview"
    assert step["jd"]["id"] == "jd-da-intern"
    assert step["analysis_id"] == latest
    assert step["quota_remaining"] == 3

    skills = data["skills_to_learn"]
    assert skills["analysis_id"] == latest
    assert [s["name"] for s in skills["skills"]] == ["Python", "Power BI", "Tableau"]
    assert skills["total_missing"] == 3

    assert [a["id"] for a in data["in_progress"]["analyses"]] == [running]
    assert data["recent_analyses"][0]["id"] == running
    assert data["recent_analyses"][0]["status"] == "processing"
    assert len(data["recent_analyses"]) == 3


@pytest.mark.asyncio
async def test_overview_interview_stats_compare_with_first_session_of_same_position(client):
    cv = add_cv(1, active=True)
    add_analysis(cv, 1, "jd-da-intern", 60.0, NOW - timedelta(days=20))
    first = add_session("jd-da-intern", star(2, 2, 3, 1), NOW - timedelta(days=10), timed_out=1)
    add_session("jd-ba-intern", star(4, 4, 4, 4), NOW - timedelta(days=5))
    second = add_session("jd-da-intern", star(3, 3, 3, 2), NOW - timedelta(days=2))
    last = add_session("jd-da-intern", star(4, 3.5, 4, 2.5), NOW - timedelta(hours=1), timed_out=2)

    data = (await client.get(OVERVIEW, headers=STUDENT)).json()
    assert data["interview_count"] == 4
    # Tuần bắt đầu thứ Hai 28/09 (giờ Việt Nam): chỉ buổi 1 giờ trước và 2 ngày trước
    assert data["interview_week_count"] == 2

    latest = data["latest_interview"]
    assert latest["id"] == last
    assert latest["score"] == 3.5
    assert latest["label"] == "fair"
    assert latest["first_score"] == 2.0
    assert latest["delta"] == 1.5
    assert latest["session_count"] == 3
    assert [p["id"] for p in latest["trend"]] == [first, second, last]

    # Trung bình các buổi gần nhất (mọi vị trí), yếu nhất là Kết quả
    assert data["star"]["session_count"] == 4
    assert data["star"]["average"]["situation"] == 3.25
    assert data["star"]["weakest"] == "result"

    step = data["next_step"]
    assert step["kind"] == "improve"
    assert step["session_id"] == last
    assert step["criterion"] == "result"
    assert step["criterion_score"] == 2.5
    assert step["guidance"] == GUIDANCE["result"]
    assert step["quota_remaining"] == 1  # đã có 2 buổi Data Analyst trong tuần

    rows = data["recent_interviews"]
    assert [r["id"] for r in rows][:2] == [last, second]
    assert rows[0]["timed_out_count"] == 2
    assert rows[0]["duration_seconds"] == 15 * 60


@pytest.mark.asyncio
async def test_overview_first_session_has_no_delta(client):
    only = add_session("jd-da-intern", star(3, 3, 3, 3), NOW - timedelta(days=1))
    latest = (await client.get(OVERVIEW, headers=STUDENT)).json()["latest_interview"]
    assert latest["id"] == only
    assert latest["first_score"] is None
    assert latest["delta"] is None
    assert [p["id"] for p in latest["trend"]] == [only]


@pytest.mark.asyncio
async def test_overview_trend_keeps_five_latest_sessions_of_position(client):
    ids = [add_session("jd-da-intern", star(1 + i * 0.5, 2, 2, 2), NOW - timedelta(days=30 - i)) for i in range(7)]
    latest = (await client.get(OVERVIEW, headers=STUDENT)).json()["latest_interview"]
    assert [p["id"] for p in latest["trend"]] == ids[2:]
    assert latest["session_count"] == 7
    assert latest["first_score"] == 1.75


@pytest.mark.asyncio
async def test_overview_shows_live_interview_and_drops_abandoned_one(client):
    live = add_live_session("jd-da-intern", deadline=NOW + timedelta(seconds=200))
    live_out = (await client.get(OVERVIEW, headers=STUDENT)).json()["in_progress"]["interview"]
    assert live_out["id"] == live
    assert live_out["jd"]["id"] == "jd-da-intern"
    assert (live_out["current_index"], live_out["question_count"]) == (2, 4)
    assert live_out["seconds_left"] == 200
    assert live_out["paused"] is False

    with SessionLocal() as db:
        db.execute(delete(InterviewSession))
        db.commit()
    add_live_session("jd-da-intern", deadline=NOW - timedelta(minutes=10))
    data = (await client.get(OVERVIEW, headers=STUDENT)).json()
    assert data["in_progress"]["interview"] is None
    with SessionLocal() as db:
        assert db.query(InterviewSession).count() == 0


@pytest.mark.asyncio
async def test_overview_is_student_only(client):
    assert (await client.get(OVERVIEW, headers=ADVISOR)).status_code == 403
    assert (await client.get(OVERVIEW)).status_code == 401


# ---------- Lịch sử & Tiến bộ ----------


@pytest.mark.asyncio
async def test_progress_empty(client):
    data = (await client.get(PROGRESS, headers=STUDENT)).json()
    assert data["range"] == "all"
    assert data["jd_id"] is None
    assert data["last_activity_at"] is None
    for key in ("positions", "interview_progress", "cv_progress", "interviews", "analyses"):
        assert data[key] == []


@pytest.mark.asyncio
async def test_progress_interview_layers_per_position(client):
    first = add_session("jd-da-intern", star(2, 2, 2, 2), NOW - timedelta(days=12))
    add_session("jd-ba-intern", star(3, 3, 3, 3), NOW - timedelta(days=11))
    previous = add_session("jd-da-intern", star(3, 2, 3, 2), NOW - timedelta(days=6))
    latest = add_session("jd-da-intern", star(3, 3, 4, 2.4), NOW - timedelta(days=1), timed_out=1)

    data = (await client.get(PROGRESS, headers=STUDENT)).json()
    assert [g["jd"]["id"] for g in data["interview_progress"]] == ["jd-da-intern", "jd-ba-intern"]

    da = data["interview_progress"][0]
    assert da["session_count"] == 3
    assert [p["id"] for p in da["points"]] == [first, previous, latest]
    assert da["first_score"] == 2.0
    assert da["latest_score"] == 3.1
    assert da["delta_from_first"] == 1.1
    assert da["delta_from_previous"] == 0.6
    assert da["latest_session_id"] == latest
    assert da["previous_session_id"] == previous
    assert da["star_previous"] == star(3, 2, 3, 2)
    assert da["star_latest"] == star(3, 3, 4, 2.4)

    ba = data["interview_progress"][1]
    assert ba["session_count"] == 1
    assert ba["delta_from_first"] is None
    assert ba["delta_from_previous"] is None
    assert ba["star_previous"] is None

    assert [r["id"] for r in data["interviews"]][0] == latest
    assert data["interviews"][0]["timed_out_count"] == 1
    assert data["interviews"][0]["label"] == "fair"


@pytest.mark.asyncio
async def test_progress_cv_uses_latest_analysis_per_version(client):
    v1, v2, v3 = add_cv(1), add_cv(2), add_cv(3)
    add_analysis(v1, 1, "jd-da-intern", 50.0, NOW - timedelta(days=20))
    # Phân tích lại v1 sau khi đã có v2: vẫn đứng trước v2 (sắp theo số phiên bản), lấy lần gần nhất
    add_analysis(v2, 2, "jd-da-intern", 64.0, NOW - timedelta(days=10))
    recheck = add_analysis(v1, 1, "jd-da-intern", 52.0, NOW - timedelta(days=5))
    add_analysis(v3, 3, "jd-da-intern", None, NOW - timedelta(days=4), status="failed")
    add_analysis(v3, 3, "jd-ba-intern", 70.0, NOW - timedelta(days=30))

    data = (await client.get(PROGRESS, headers=STUDENT)).json()
    assert [g["jd"]["id"] for g in data["cv_progress"]] == ["jd-da-intern", "jd-ba-intern"]
    da = data["cv_progress"][0]
    assert [(p["cv_label"], p["match_score"]) for p in da["points"]] == [("v1.0", 52.0), ("v2.0", 64.0)]
    assert da["points"][0]["analysis_id"] == recheck
    assert da["delta"] == 12.0
    assert data["cv_progress"][1]["delta"] is None

    # Bảng phân tích có cả lượt lỗi, mới nhất trước
    assert [a["status"] for a in data["analyses"]][:2] == ["failed", "completed"]
    assert len(data["analyses"]) == 5


@pytest.mark.asyncio
async def test_progress_range_filter_keeps_positions_list(client):
    cv = add_cv(1)
    add_analysis(cv, 1, "jd-ba-intern", 55.0, NOW - timedelta(days=100))
    old = add_session("jd-da-intern", star(2, 2, 2, 2), NOW - timedelta(days=45))
    recent = add_session("jd-da-intern", star(3, 3, 3, 3), NOW - timedelta(days=3))

    data = (await client.get(PROGRESS, params={"range": "30d"}, headers=STUDENT)).json()
    assert data["range"] == "30d"
    assert [r["id"] for r in data["interviews"]] == [recent]
    assert data["interview_progress"][0]["session_count"] == 1
    assert data["analyses"] == []
    assert data["cv_progress"] == []
    # Bộ lọc vị trí luôn có đủ các vị trí đã từng hoạt động
    positions = {p["jd"]["id"]: p for p in data["positions"]}
    assert positions["jd-da-intern"]["interview_count"] == 2
    assert positions["jd-ba-intern"]["analysis_count"] == 1
    assert data["positions"][0]["jd"]["id"] == "jd-da-intern"

    data = (await client.get(PROGRESS, params={"range": "90d"}, headers=STUDENT)).json()
    assert [r["id"] for r in data["interviews"]] == [recent, old]
    assert data["analyses"] == []


@pytest.mark.asyncio
async def test_progress_position_filter(client):
    cv = add_cv(1)
    add_analysis(cv, 1, "jd-ba-intern", 55.0, NOW - timedelta(days=2))
    add_analysis(cv, 1, "jd-da-intern", 60.0, NOW - timedelta(days=2))
    add_session("jd-ba-intern", star(2, 2, 2, 2), NOW - timedelta(days=1))
    da = add_session("jd-da-intern", star(3, 3, 3, 3), NOW - timedelta(days=1))

    data = (await client.get(PROGRESS, params={"jd_id": "jd-da-intern"}, headers=STUDENT)).json()
    assert data["jd_id"] == "jd-da-intern"
    assert [r["id"] for r in data["interviews"]] == [da]
    assert [g["jd"]["id"] for g in data["interview_progress"]] == ["jd-da-intern"]
    assert [a["jd"]["id"] for a in data["analyses"]] == ["jd-da-intern"]
    assert len(data["positions"]) == 2


@pytest.mark.asyncio
async def test_progress_rejects_unknown_or_foreign_position(client):
    assert (await client.get(PROGRESS, params={"jd_id": "jd-khong-co"}, headers=STUDENT)).status_code == 404
    with SessionLocal() as db:
        db.add(
            JobDescription(
                id="jd_foreign", source="pasted", owner_id=DEMO_ADVISOR_ID, title="Riêng", content="...", skills=[]
            )
        )
        db.commit()
    response = await client.get(PROGRESS, params={"jd_id": "jd_foreign"}, headers=STUDENT)
    assert response.status_code == 404
    assert response.json()["code"] == "jd_not_found"


@pytest.mark.asyncio
async def test_progress_validates_range(client):
    assert (await client.get(PROGRESS, params={"range": "7d"}, headers=STUDENT)).status_code == 422
    assert (await client.get(PROGRESS, headers=ADVISOR)).status_code == 403
