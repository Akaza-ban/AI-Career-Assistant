"""Real-SQLite coverage for Assistant v2 navigation resolvers."""

import ast
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import delete

from src.db.database import SessionLocal
from src.db.models import CvVersion, GapAnalysis, InterviewSession, JobDescription, User
from src.services.assistant.resolvers import ResolutionContext, resolve
from src.services.assistant.router.models import NavSlots


@pytest.fixture
def resolver_db():
    suffix = uuid4().hex[:10]
    users = [
        User(id=f"nav-a-{suffix}", role="student", full_name="Test One", email=f"nav-a-{suffix}@example.invalid"),
        User(id=f"nav-b-{suffix}", role="student", full_name="Test Two", email=f"nav-b-{suffix}@example.invalid"),
    ]
    db = SessionLocal()
    db.add_all(users)
    db.flush()
    yield db, users
    for user in users:
        db.execute(delete(GapAnalysis).where(GapAnalysis.owner_id == user.id))
        db.execute(delete(InterviewSession).where(InterviewSession.owner_id == user.id))
        db.execute(delete(CvVersion).where(CvVersion.owner_id == user.id))
        db.execute(delete(JobDescription).where(JobDescription.owner_id == user.id))
        db.delete(user)
    db.commit()
    db.close()


def add_jd(db, user, jd_id: str, title: str, company: str | None = None) -> JobDescription:
    jd = JobDescription(
        id=jd_id,
        source="pasted",
        owner_id=user.id,
        title=title,
        company=company,
        content="PRIVATE JD BODY SENTINEL",
        created_at=datetime(2025, 1, 1),
    )
    db.add(jd)
    return jd


def add_cv(db, user, cv_id: str, file_name: str, uploaded_at: datetime) -> CvVersion:
    cv = CvVersion(
        id=cv_id,
        owner_id=user.id,
        version=1,
        family_id=cv_id,
        major=1,
        minor=0,
        file_name=file_name,
        file_type="pdf",
        size_bytes=1,
        content_text="PRIVATE CV BODY SENTINEL",
        uploaded_at=uploaded_at,
    )
    db.add(cv)
    return cv


def add_analysis(db, user, jd, cv, analysis_id: str, status: str, created_at: datetime) -> GapAnalysis:
    analysis = GapAnalysis(
        id=analysis_id,
        owner_id=user.id,
        cv_version_id=cv.id,
        cv_file_name=cv.file_name,
        cv_label="v1.0",
        jd_id=jd.id,
        status=status,
        result={"body": "PRIVATE ANALYSIS BODY SENTINEL"},
        created_at=created_at,
    )
    db.add(analysis)
    return analysis


def add_interview(db, user, jd, session_id: str, created_at: datetime) -> InterviewSession:
    session = InterviewSession(
        id=session_id,
        owner_id=user.id,
        jd_id=jd.id,
        status="completed",
        created_at=created_at,
        completed_at=created_at,
    )
    db.add(session)
    return session


def public_targets(result) -> list[tuple[str, dict[str, str], str, str | None]]:
    return [(t.route_id, t.params, t.label, t.sublabel) for t in result.targets]


def assert_no_body_fields(result) -> None:
    serialized = str(result.model_dump()).casefold()
    for marker in ("private cv body", "private jd body", "private analysis body", "content_text", "feedback", "transcript"):
        assert marker not in serialized


def test_cv_jd_fuzzy_matches_and_duplicate_jds(resolver_db) -> None:
    db, (user, other) = resolver_db
    add_cv(db, user, "cv-a", "Nguyễn Backend.pdf", datetime(2025, 4, 1))
    add_cv(db, other, "cv-b", "Nguyễn Backend.pdf", datetime(2025, 4, 1))
    first = add_jd(db, user, "jd-a1", "Backend Engineer", "Acme")
    second = add_jd(db, user, "jd-a2", "Backend Engineer", "Acme")
    db.commit()

    cv_result = resolve(ResolutionContext(user, db), NavSlots(target="cv", free_ref="nguyen Backed"))
    jd_result = resolve(ResolutionContext(user, db), NavSlots(target="jd", free_ref="Backend Enginer Acme"))
    assert cv_result.status == "found"
    assert cv_result.targets[0].params == {"cv_id": "cv-a"}
    assert jd_result.status == "multiple"
    assert {target.params["jd_id"] for target in jd_result.targets} == {first.id, second.id}
    assert_no_body_fields(cv_result)
    assert_no_body_fields(jd_result)


def test_analysis_uses_completed_first_and_status_fallback(resolver_db) -> None:
    db, (user, other) = resolver_db
    jd = add_jd(db, user, "jd-analysis", "Backend Engineer", "Acme")
    cv = add_cv(db, user, "cv-analysis", "Backend_v3.pdf", datetime(2025, 4, 1))
    add_analysis(db, user, jd, cv, "analysis-completed", "completed", datetime(2025, 4, 2))
    add_analysis(db, user, jd, cv, "analysis-failed-newer", "failed", datetime(2025, 4, 3))
    foreign_jd = add_jd(db, other, "jd-foreign", "Backend Engineer", "Acme")
    foreign_cv = add_cv(db, other, "cv-foreign", "Backend_v3.pdf", datetime(2025, 4, 1))
    add_analysis(db, other, foreign_jd, foreign_cv, "analysis-foreign", "completed", datetime(2025, 4, 4))
    db.commit()

    result = resolve(ResolutionContext(user, db), NavSlots(target="analysis", jd_ref="Backend Engineer Acme"))
    assert result.status == "found"
    assert result.targets[0].params == {"analysis_id": "analysis-completed"}
    assert_no_body_fields(result)
    latest = resolve(ResolutionContext(user, db), NavSlots(target="analysis", latest=True))
    assert latest.targets[0].params == {"analysis_id": "analysis-completed"}

    pending_jd = add_jd(db, user, "jd-pending", "Data Engineer", "Other")
    pending_cv = add_cv(db, user, "cv-pending", "Data.pdf", datetime(2025, 5, 1))
    pending_cv.version = 2
    add_analysis(db, user, pending_jd, pending_cv, "analysis-pending", "failed", datetime(2025, 5, 2))
    db.commit()
    fallback = resolve(ResolutionContext(user, db), NavSlots(target="analysis", jd_ref="Data Engineer Other"))
    assert fallback.status == "found"
    assert fallback.targets[0].params == {"analysis_id": "analysis-pending"}
    assert fallback.targets[0].sublabel.endswith("failed")

    pair_result = resolve(
        ResolutionContext(user, db),
        NavSlots(target="analysis", jd_ref="Data Engineer Other", cv_ref="Data"),
    )
    assert pair_result.status == "found"
    assert pair_result.targets[0].params == {"analysis_id": "analysis-pending"}


def test_interview_dates_use_local_midnight_and_year_boundary(resolver_db) -> None:
    db, (user, other) = resolver_db
    jd = add_jd(db, user, "jd-interview", "Backend", "Acme")
    foreign_jd = add_jd(db, other, "jd-interview-b", "Backend", "Acme")
    add_interview(db, user, jd, "late-december", datetime(2025, 12, 31, 16, 30))  # 23:30 local
    add_interview(db, user, jd, "early-january", datetime(2025, 12, 31, 17, 30))  # 00:30 local next year
    add_interview(db, other, foreign_jd, "foreign-december", datetime(2025, 12, 31, 16, 30))
    db.commit()
    ctx = ResolutionContext(user, db, datetime(2026, 1, 1, 5, 0, tzinfo=UTC))

    yesterday = resolve(ctx, NavSlots(target="interview", when_expr="yesterday"))
    assert yesterday.status == "found"
    assert yesterday.targets[0].params == {"session_id": "late-december"}

    missing_day = resolve(ctx, NavSlots(target="interview", when_expr="02/01/2026"))
    assert missing_day.status == "none"
    assert missing_day.targets[0].params == {"session_id": "early-january"}
    assert_no_body_fields(yesterday)
    assert_no_body_fields(missing_day)


def test_cross_user_and_missing_interviews_have_identical_results(resolver_db) -> None:
    db, (user, other) = resolver_db
    add_jd(db, user, "jd-own", "Backend", "Acme")
    foreign_jd = add_jd(db, other, "jd-foreign-only", "Backend", "Acme")
    add_interview(db, other, foreign_jd, "foreign-session", datetime(2025, 10, 12, 10, 0))
    db.commit()
    ctx = ResolutionContext(user, db, datetime(2026, 10, 16, 12, 0, tzinfo=UTC))

    foreign_probe = resolve(ctx, NavSlots(target="interview", when_expr="12/10/2025"))
    missing_probe = resolve(ctx, NavSlots(target="interview", when_expr="12/10/2024"))
    assert foreign_probe.status == missing_probe.status == "none"
    assert public_targets(foreign_probe) == public_targets(missing_probe)


def test_foreign_jd_and_analysis_match_missing_wording(resolver_db) -> None:
    db, (user, other) = resolver_db
    foreign_jd = add_jd(db, other, "jd-foreign-name", "Confidential Role", "Elsewhere")
    foreign_cv = add_cv(db, other, "cv-foreign-name", "Private.pdf", datetime(2025, 10, 1))
    add_analysis(db, other, foreign_jd, foreign_cv, "analysis-private", "completed", datetime(2025, 10, 2))
    db.commit()
    ctx = ResolutionContext(user, db)

    foreign_jd_probe = resolve(ctx, NavSlots(target="jd", free_ref="Confidential Role Elsewhere"))
    missing_jd_probe = resolve(ctx, NavSlots(target="jd", free_ref="No Such Position"))
    foreign_analysis_probe = resolve(ctx, NavSlots(target="analysis", jd_ref="Confidential Role Elsewhere"))
    missing_analysis_probe = resolve(ctx, NavSlots(target="analysis", jd_ref="No Such Position"))
    assert foreign_jd_probe.status == missing_jd_probe.status == "none"
    assert foreign_analysis_probe.status == missing_analysis_probe.status == "none"
    assert public_targets(foreign_jd_probe) == public_targets(missing_jd_probe)
    assert public_targets(foreign_analysis_probe) == public_targets(missing_analysis_probe)


def test_no_year_dates_and_nearest_interview_suggestions(resolver_db) -> None:
    db, (user, _) = resolver_db
    jd = add_jd(db, user, "jd-nearest", "Platform Engineer", "Acme")
    add_interview(db, user, jd, "near-2026", datetime(2026, 10, 12, 10, 0))
    add_interview(db, user, jd, "explicit-2025", datetime(2025, 10, 12, 10, 0))
    db.commit()
    ctx = ResolutionContext(user, db, datetime(2026, 10, 16, 12, 0, tzinfo=UTC))

    current_year = resolve(ctx, NavSlots(target="interview", when_expr="12/10"))
    explicit_year = resolve(ctx, NavSlots(target="interview", when_expr="12/10/2025"))
    future_rollover = resolve(ctx, NavSlots(target="interview", when_expr="20/10"))
    assert current_year.targets[0].params == {"session_id": "near-2026"}
    assert explicit_year.targets[0].params == {"session_id": "explicit-2025"}
    assert future_rollover.status == "none"
    assert [target.params["session_id"] for target in future_rollover.targets[:2]] == ["explicit-2025", "near-2026"]


def test_resolver_source_never_calls_side_effecting_services() -> None:
    source = Path("src/services/assistant/resolvers.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    forbidden = {"session", "shared_cv", "interview_report", "build_report"}
    called = {
        node.func.attr
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
    }
    imported = {
        alias.name
        for node in ast.walk(tree)
        if isinstance(node, ast.ImportFrom)
        for alias in node.names
    }
    assert not (called & forbidden)
    assert not (imported & {"cv_optimizer", "advisor", "interview"})

