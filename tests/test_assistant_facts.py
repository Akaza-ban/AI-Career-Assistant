"""Real SQLite coverage for allowlisted result facts and the result fast path."""

import ast
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import delete, select

from src.db.database import SessionLocal
from src.db.models import GapAnalysis, InterviewSession, InterviewTurn, JobDescription, User
from src.models.assistant import ClientPageContext
from src.services.assistant.agent import AssistantAgent
from src.services.assistant.facts import build_analysis_facts, build_interview_facts, facts_allowlist
from src.services.assistant.numeric_guard import numeric_claims_are_grounded
from src.services.assistant.resolvers import ResolutionContext, resolve
from src.services.assistant.router.models import NavSlots, RouterDecision


@pytest.fixture
def result_db():
    suffix = uuid4().hex[:10]
    users = [
        User(id=f"facts-a-{suffix}", role="student", full_name="Facts One", email=f"facts-a-{suffix}@example.invalid"),
        User(id=f"facts-b-{suffix}", role="student", full_name="Facts Two", email=f"facts-b-{suffix}@example.invalid"),
    ]
    db = SessionLocal()
    db.add_all(users)
    db.flush()
    jds = [
        JobDescription(
            id=f"facts-jd-{i}-{suffix}",
            source="pasted",
            owner_id=user.id,
            title="Backend Role" if i == 0 else "Quantum Xenon Secret Position",
            company="Acme",
            content="PRIVATE JD BODY SENTINEL",
        )
        for i, user in enumerate(users)
    ]
    db.add_all(jds)
    db.flush()
    analysis_ids: list[str] = []
    interview_ids: list[str] = []
    start = datetime(2025, 1, 1)
    for i in range(64):
        analysis_id = f"facts-analysis-{i}-{suffix}"
        analysis_ids.append(analysis_id)
        db.add(
            GapAnalysis(
                id=analysis_id,
                owner_id=users[0].id,
                cv_version_id=f"cv-{i}",
                cv_file_name=f"private-cv-{i}.pdf",
                cv_label=f"v{i + 1}.0",
                jd_id=jds[0].id,
                status="completed",
                match_score=float(i) + 0.5,
                created_at=start + timedelta(days=i),
                result={
                    "breakdown": [
                        {
                            "importance": "required",
                            "total": 3,
                            "matched": i % 3,
                            "partial": 1,
                            "missing": 2,
                            "earned": float(i) / 10,
                            "possible": 3.0,
                        }
                    ],
                    "requirements": [
                        {"importance": "required", "status": "missing", "skill": "Python"},
                        {"importance": "required", "status": "matched", "skill": "SQL"},
                        {"importance": "preferred", "status": "partial", "skill": "Docker"},
                    ],
                    "summary": "PRIVATE ANALYSIS BODY SENTINEL",
                    "suggestions": [{"feedback": "PRIVATE FEEDBACK SENTINEL"}],
                },
            )
        )
        session_id = f"facts-session-{i}-{suffix}"
        interview_ids.append(session_id)
        created = start + timedelta(minutes=i)
        db.add(
            InterviewSession(
                id=session_id,
                owner_id=users[0].id,
                jd_id=jds[0].id,
                status="completed",
                created_at=created,
                completed_at=created + timedelta(seconds=30),
                overall_score=float(i % 6),
                star={"situation": 1.0, "task": 2.0, "action": 3.0, "result": 4.0},
            )
        )
        for q in range(2):
            db.add(
                InterviewTurn(
                    id=f"facts-turn-{i}-{q}-{suffix}",
                    session_id=session_id,
                    index=q + 1,
                    theme="work",
                    question="PRIVATE QUESTION",
                    asked_at=created,
                )
            )
    # A foreign result exists, so probes must be indistinguishable from a miss.
    foreign = "facts-foreign-analysis-" + suffix
    db.add(
        GapAnalysis(
            id=foreign,
            owner_id=users[1].id,
            cv_version_id="foreign-cv",
            cv_file_name="x.pdf",
            cv_label="v1.0",
            jd_id=jds[1].id,
            status="completed",
            match_score=99,
            created_at=start,
            result={"breakdown": [], "requirements": []},
        )
    )
    db.commit()
    yield db, users, jds, analysis_ids, interview_ids, foreign
    db.execute(delete(InterviewTurn).where(InterviewTurn.session_id.in_(interview_ids)))
    db.execute(delete(InterviewSession).where(InterviewSession.owner_id.in_([user.id for user in users])))
    db.execute(delete(GapAnalysis).where(GapAnalysis.owner_id.in_([user.id for user in users])))
    db.execute(delete(JobDescription).where(JobDescription.owner_id.in_([user.id for user in users])))
    for user in users:
        db.delete(user)
    db.commit()
    db.close()


def _walk_strings(value):
    if isinstance(value, dict):
        for child in value.values():
            yield from _walk_strings(child)
    elif isinstance(value, (list, tuple)):
        for child in value:
            yield from _walk_strings(child)
    elif isinstance(value, str):
        yield value


def test_allowlisted_facts_equal_database_for_128_seeded_records(result_db):
    db, users, _, analysis_ids, interview_ids, _ = result_db
    for index, record_id in enumerate(analysis_ids):
        facts = build_analysis_facts(db, users[0].id, record_id)
        row = db.scalar(select(GapAnalysis).where(GapAnalysis.id == record_id))
        assert facts["overall_match_score"] == row.match_score
        assert facts["category_scores"][0]["earned"] == row.result["breakdown"][0]["earned"]
        assert facts["required_missing_count"] == 1
        assert facts["required_matched_count"] == 1
        assert facts["preferred_partial_count"] == 1
        assert facts["missing_skills"] == ["Python"]
        assert index < 64
    for record_id in interview_ids:
        facts = build_interview_facts(db, users[0].id, record_id)
        session = db.scalar(select(InterviewSession).where(InterviewSession.id == record_id))
        assert facts["overall_star_score"] == session.overall_score
        assert facts["situation_average"] == session.star["situation"]
        assert facts["question_count"] == 2


def test_fact_outputs_are_bounded_and_allowlisted(result_db):
    db, users, _, analysis_ids, interview_ids, _ = result_db
    forbidden = {"transcript", "answer", "feedback", "body", "text", "evidence"}
    for record_id, builder in [
        *((record_id, build_analysis_facts) for record_id in analysis_ids),
        *((record_id, build_interview_facts) for record_id in interview_ids),
    ]:
        facts = builder(db, users[0].id, record_id)
        allowed = set(
            facts_allowlist()["analysis"] if builder is build_analysis_facts else facts_allowlist()["interview"]
        )
        assert set(facts) == allowed
        assert all(not any(word in key.casefold() for word in forbidden) for key in facts)
        assert all(len(value) <= 80 for value in _walk_strings(facts))
        assert "PRIVATE" not in str(facts)


def test_cross_user_facts_and_fast_path_have_identical_missing_wording(result_db):
    db, users, _, _, _, foreign_id = result_db
    assert build_analysis_facts(db, users[0].id, foreign_id) is None
    assert build_analysis_facts(db, users[0].id, "not-a-real-analysis") is None
    agent = AssistantAgent()
    decision = RouterDecision(
        route="result",
        source="rules",
        confidence=1,
        language="en",
        slots=NavSlots(target="analysis", latest=True),
        nav_mode="fast",
    )
    state = {"nav_user": users[0], "nav_db": db, "message": "what is the score of my latest analysis"}
    foreign_result = agent._resolve_result(
        {**state, "message": "what is the score for Quantum Xenon Secret Position"},
        decision.model_copy(update={"slots": NavSlots(target="analysis", jd_ref="Quantum Xenon Secret Position")}),
        "en",
    )
    missing_result = agent._resolve_result(
        {**state, "message": "what is the score for no such job title"},
        decision.model_copy(update={"slots": NavSlots(target="analysis", jd_ref="no such job title")}),
        "en",
    )
    assert foreign_result.message == missing_result.message
    assert foreign_result.cards == missing_result.cards == []


def test_result_fast_path_returns_exact_facts_and_link_without_navigation(result_db):
    db, users, _, analysis_ids, _, _ = result_db
    agent = AssistantAgent()
    latest = analysis_ids[-1]
    target = resolve(ResolutionContext(users[0], db), NavSlots(target="analysis", latest=True))
    assert target.targets[0].params["analysis_id"] == latest
    decision = RouterDecision(
        route="result",
        source="rules",
        confidence=1,
        language="en",
        slots=NavSlots(target="analysis", latest=True),
        nav_mode="fast",
    )
    state = {"nav_user": users[0], "nav_db": db, "message": "what is the score of my latest analysis"}
    response = agent._resolve_result(state, decision, "en")
    facts = build_analysis_facts(db, users[0].id, latest)
    assert "63.5%" in response.message
    assert response.ui_actions == []
    assert [card.kind for card in response.cards] == ["facts", "link"]
    assert response.cards[0].facts["overall_match_score_percent"] == facts["overall_match_score"]
    assert response.cards[1].params["analysis_id"] == latest


def test_interview_result_fast_path_uses_stored_star_aggregates(result_db):
    db, users, _, _, interview_ids, _ = result_db
    latest = interview_ids[-1]
    agent = AssistantAgent()
    response = agent._resolve_result(
        {"nav_user": users[0], "nav_db": db, "message": "what is the score of my latest interview report"},
        RouterDecision(
            route="result",
            source="rules",
            confidence=1,
            language="en",
            slots=NavSlots(target="report", latest=True),
            nav_mode="fast",
        ),
        "en",
    )
    facts = build_interview_facts(db, users[0].id, latest)
    assert "STAR score 3.0" in response.message
    assert response.ui_actions == []
    assert [card.kind for card in response.cards] == ["facts", "link"]
    assert response.cards[0].facts["overall_star_score"] == facts["overall_star_score"]
    assert response.cards[0].facts["question_count"] == facts["question_count"]
    assert response.cards[1].params["session_id"] == latest


def test_multiple_results_have_only_chips_and_none_keeps_nearest_suggestions(result_db):
    db, users, jds, _, _, _ = result_db
    duplicate_jd = JobDescription(
        id="facts-duplicate-" + uuid4().hex[:8],
        source="pasted",
        owner_id=users[0].id,
        title=jds[0].title,
        company=jds[0].company,
        content="PRIVATE JD BODY SENTINEL",
    )
    db.add(duplicate_jd)
    db.flush()
    db.add(
        GapAnalysis(
            id="facts-duplicate-analysis-" + uuid4().hex[:8],
            owner_id=users[0].id,
            cv_version_id="duplicate-cv",
            cv_file_name="private-cv.pdf",
            cv_label="v1.0",
            jd_id=duplicate_jd.id,
            status="completed",
            match_score=77,
            created_at=datetime(2026, 1, 1),
            result={"breakdown": [], "requirements": []},
        )
    )
    db.commit()
    agent = AssistantAgent()
    decision = RouterDecision(
        route="result",
        source="rules",
        confidence=1,
        language="en",
        slots=NavSlots(target="analysis", jd_ref="Backend Role Acme"),
        nav_mode="fast",
    )
    multiple = agent._resolve_result(
        {"nav_user": users[0], "nav_db": db, "message": "what is the score for Backend Role Acme"},
        decision,
        "en",
    )
    assert multiple.cards == []
    assert multiple.ui_actions == []
    assert len(multiple.chips) >= 2

    none = agent._resolve_result(
        {"nav_user": users[0], "nav_db": db, "message": "what is the score for Missing Quantum Role"},
        decision.model_copy(update={"slots": NavSlots(target="analysis", jd_ref="Missing Quantum Role")}),
        "en",
    )
    assert "couldn’t find" in none.message
    assert none.cards == []
    assert none.chips


def test_fast_result_path_does_not_invoke_recording_provider(result_db):
    class RecordingProvider:
        requests = 0

        async def ainvoke(self, *_args, **_kwargs):
            self.requests += 1
            raise AssertionError("fast result path called provider")

    db, users, _, _, _, _ = result_db
    provider = RecordingProvider()
    agent = AssistantAgent(llm=provider)
    context = ClientPageContext(
        current_url="/student/analysis",
        route="analysis_new",
        user_role="student",
        user_id=users[0].id,
    )
    result = asyncio.run(
        agent.respond(
            "what is the score of my latest analysis",
            context,
            nav_db=db,
            nav_user=users[0],
        )
    )
    assert result.cards
    assert provider.requests == 0


def test_non_student_role_cannot_read_record_facts(result_db):
    db, users, _, _, _, _ = result_db
    user = users[0]
    user.role = "advisor"
    result = AssistantAgent()._resolve_result(
        {"nav_user": user, "nav_db": db, "message": "what is the score of my latest analysis"},
        RouterDecision(
            route="result",
            source="rules",
            confidence=1,
            language="en",
            slots=NavSlots(target="analysis", latest=True),
            nav_mode="fast",
        ),
        "en",
    )
    assert result.message == "Result records are available only to student accounts."
    assert result.cards == []
    assert result.chips == []
    user.role = "student"


@pytest.mark.parametrize(
    ("prose", "facts", "expected"),
    [
        ("Score is 72%.", {"score": 72.0}, True),
        ("Score is 72.1%.", {"score": 72.0}, False),
        ("There are 3 missing skills.", {"missing": 2}, False),
        ("Date is 2025-10-12.", {"date": "2025-10-12"}, True),
        ("Score is 99.", {"score": 98}, False),
    ],
)
def test_numeric_grounding(prose, facts, expected):
    assert numeric_claims_are_grounded(prose, facts) is expected


def test_numeric_guard_catches_every_planted_wrong_value():
    for stored in range(60, 160):
        for planted in (stored + 0.1, stored + 1, stored - 1):
            assert not numeric_claims_are_grounded(f"The score is {planted}%.", {"score": stored})


def test_static_side_effecting_service_guard():
    root = Path("src/services/assistant")
    forbidden_calls = {"build_report", "load_session", "shared_cv", "interview_report", "session"}
    for path in root.rglob("*.py"):
        if "router" in path.parts:
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                assert node.func.attr not in forbidden_calls, f"side-effecting service call in {path}: {node.func.attr}"
