"""Assistant contracts, real Chroma/BM25 retrieval and authenticated API flows.

Tests use temporary indexes/SQLite and deterministic embeddings, never remote LLMs
or model downloads. The existing conftest owns the temporary database.
"""

import json
from collections.abc import Iterator
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from httpx import AsyncClient
from langchain_core.messages import AIMessage, HumanMessage
from pydantic import TypeAdapter, ValidationError
from sqlalchemy import func, select

from src.api import assistant as assistant_api
from src.api.deps import get_current_user
from src.config import get_settings
from src.db.database import SessionLocal
from src.db.models import (
    AgentActionLog,
    AssistantConversation,
    AssistantFeedback,
    AssistantTurn,
    CvVersion,
    GapAnalysis,
    JobDescription,
    User,
)
from src.main import app
from src.models.assistant import AgentAction, ClientPageContext
from src.services.assistant.agent import AssistantAgent, classify_intent, get_assistant_agent
from src.services.assistant.chunker import MarkdownDocChunker
from src.services.assistant.embedding import AssistantEmbeddingService
from src.services.assistant.hybrid_search import AssistantHybridRetriever, corpus_path
from src.services.assistant.indexer import build_assistant_index
from src.services.assistant.vector_store import AssistantVectorStore
from tests.helpers import ADVISOR, STUDENT

API = "/api/v1/assistant"
UPLOAD_SELECTOR = '[data-agent-target="btn-upload-cv"]'


def context(role: str = "student") -> ClientPageContext:
    route = "/student/cv" if role == "student" else "/advisor/dashboard"
    return ClientPageContext(current_url=route, route=route, user_role=role)


def payload(message: str = "chuyển sang trang phân tích", role: str = "student", **extra: Any) -> dict[str, Any]:
    return {"message": message, "context": context(role).model_dump(), **extra}


@pytest.fixture(scope="module")
def knowledge_base(tmp_path_factory: pytest.TempPathFactory) -> Iterator[AssistantHybridRetriever]:
    patch = pytest.MonkeyPatch()
    settings = get_settings()
    patch.setattr(settings, "assistant_chroma_persist_dir", str(tmp_path_factory.mktemp("assistant-index")))
    patch.setattr(settings, "assistant_docs_dir", str(Path("docs/user-guide").resolve()))
    patch.setattr(settings, "assistant_chroma_collection", "assistant_test_knowledge")
    service = object.__new__(AssistantEmbeddingService)
    service._initialized = True
    service._model = None
    service._used_model = False
    service.model_name = settings.assistant_embedding_model
    service.dimension = 384
    patch.setattr(AssistantEmbeddingService, "_instance", service)
    assert build_assistant_index() > 0
    try:
        yield AssistantHybridRetriever()
    finally:
        patch.undo()


@pytest.fixture
def api_agent(knowledge_base: AssistantHybridRetriever) -> Iterator[AssistantAgent]:
    agent = AssistantAgent()
    app.dependency_overrides[get_assistant_agent] = lambda: agent
    try:
        yield agent
    finally:
        app.dependency_overrides.pop(get_assistant_agent, None)


def test_indexer_persists_seven_documents_and_selector(knowledge_base: AssistantHybridRetriever) -> None:
    store = knowledge_base.vector_store
    chunks = store.get_chunks()
    assert len({chunk.source for chunk in chunks}) == 7
    assert all(0 < len(chunk.content) <= 500 for chunk in chunks)
    assert any(chunk.selector == UPLOAD_SELECTOR and chunk.route == "/student/cv" for chunk in chunks)
    saved = json.loads(corpus_path(store).read_text(encoding="utf-8"))
    assert {item["chunk_id"] for item in saved["chunks"]} == {chunk.chunk_id for chunk in chunks}


def test_rebuild_replaces_removed_chunks(
    knowledge_base: AssistantHybridRetriever, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "assistant_chroma_persist_dir", str(tmp_path / "index"))
    docs = tmp_path / "docs"
    docs.mkdir()
    first = docs / "first.md"
    first.write_text(
        "---\nroute: /student/cv\nrole: student\ntitle: CV\ntags: [cv]\n---\n# CV\nTải CV PDF.", encoding="utf-8"
    )
    second = docs / "second.md"
    second.write_text(first.read_text(encoding="utf-8") + "\n\nMột phiên bản khác.", encoding="utf-8")
    initial_count = build_assistant_index(str(docs))
    second.unlink()
    count = build_assistant_index(str(docs))
    assert count < initial_count
    store = AssistantVectorStore()
    assert store.collection.count() == count
    assert {chunk.source for chunk in store.get_chunks()} == {"first.md"}
    assert build_assistant_index(str(docs)) == count
    assert AssistantVectorStore().collection.count() == count


def test_chunker_preserves_hierarchy_faq_and_ui_target() -> None:
    document = """---
route: /student/cv
role: student
title: Hướng dẫn CV
tags: [cv, upload]
---
# Hướng dẫn CV
## Giao diện
### Tải lên
- **Nút tải CV**: Selector `[data-agent-target="btn-upload-cv"]`. Chọn PDF.
## FAQ
**Q: Dùng DOCX được không?**

A: Có, hệ thống nhận PDF và DOCX.
"""
    chunks = MarkdownDocChunker().chunk(document, source="sample.md")
    target = next(chunk for chunk in chunks if chunk.selector)
    assert target.section == "Hướng dẫn CV > Giao diện > Tải lên"
    assert target.selector == UPLOAD_SELECTOR
    assert target.tags == ["cv", "upload"]
    assert any("**Q:" in chunk.content and "A: Có" in chunk.content for chunk in chunks)


def test_embedding_uses_e5_query_and_passage_prefixes() -> None:
    service = object.__new__(AssistantEmbeddingService)
    service._used_model = False
    calls: list[list[str]] = []

    def encode(texts: list[str], **options: Any) -> SimpleNamespace:
        calls.append(texts)
        assert options["normalize_embeddings"] is True
        return SimpleNamespace(tolist=lambda: [[1.0, 0.0] for _ in texts])

    service._model = SimpleNamespace(encode=encode)
    assert service.embed_query("Tải CV") == [1.0, 0.0]
    assert service.embed_documents(["PDF", "DOCX"]) == [[1.0, 0.0], [1.0, 0.0]]
    assert calls == [["query: Tải CV"], ["passage: PDF", "passage: DOCX"]]


def test_hybrid_finds_upload_target_and_computes_rrf(knowledge_base: AssistantHybridRetriever) -> None:
    results = knowledge_base.search("nút tải lên CV PDF DOCX", "student")
    assert any(item["selector"] == UPLOAD_SELECTOR for item in results)
    for item in results:
        expected = sum(1 / (60 + item[key]) for key in ("vector_rank", "bm25_rank") if key in item)
        assert item["score"] == pytest.approx(expected)
        assert item["role"] in ("student", "all")
    advisors = knowledge_base.search("nhận xét sinh viên báo cáo", "advisor")
    assert advisors and all(item["role"] in ("advisor", "all") for item in advisors)
    assert knowledge_base.search("CV", "unknown") == []
    assert knowledge_base.search("", "student") == []
    assert knowledge_base.search("CV", "student", top_k=0) == []


@pytest.mark.parametrize(
    ("message", "intent"),
    [
        ("Match score là gì?", "qa"),
        ("Nút tải CV ở đâu?", "qa"),
        ("Làm sao bắt đầu phân tích CV?", "qa"),
        ("chuyển sang trang phân tích", "action"),
        ("Hãy mở trang CV", "action"),
        ("Làm sao phỏng vấn thử? Mở giúp tôi luôn", "hybrid"),
        ("Hướng dẫn phân tích và mở trang phân tích", "hybrid"),
        ("Đừng mở trang CV", "qa"),
    ],
)
def test_classifies_intent(message: str, intent: str) -> None:
    assert classify_intent(message) == intent


@pytest.mark.parametrize(
    ("action_type", "params"),
    [
        ("NAVIGATE_PAGE", {"route": "/student/cv"}),
        ("HIGHLIGHT_ELEMENT", {"selector": UPLOAD_SELECTOR}),
        ("FILL_FILTER", {"filter_name": "status", "value": "flagged"}),
        ("OPEN_MODAL", {"modal_id": "upload-cv-modal"}),
        ("START_ANALYSIS", {"cv_id": "cv-1", "jd_id": "jd-1"}),
        ("SELECT_STUDENT", {"student_id": "sv-1"}),
        ("SCROLL_TO", {"position": "top"}),
        ("RESET_VIEW", {}),
    ],
)
def test_all_eight_action_variants(action_type: str, params: dict[str, Any]) -> None:
    action = TypeAdapter(AgentAction).validate_python(
        {
            "action_type": action_type,
            "params": params,
            "description_vi": "Thao tác giao diện",
        }
    )
    assert action.requires_confirmation == (action_type == "START_ANALYSIS")
    assert action.id


@pytest.mark.parametrize(
    "action",
    [
        {"action_type": "NAVIGATE_PAGE", "params": {"route": "https://evil.example"}},
        {"action_type": "NAVIGATE_PAGE", "params": {"route": "/student/../advisor/dashboard"}},
        {"action_type": "HIGHLIGHT_ELEMENT", "params": {"selector": "script[onclick]"}},
        {"action_type": "START_ANALYSIS", "params": {"cv_id": "cv-1", "jd_id": "jd-1"}, "requires_confirmation": False},
        {"action_type": "START_ANALYSIS", "params": {"cv_id": "cv-1"}},
        {"action_type": "SCROLL_TO", "params": {"position": "top", "selector": UPLOAD_SELECTOR}},
        {"action_type": "RUN_JS", "params": {"script": "alert(1)"}},
        {"action_type": "RESET_VIEW", "params": {"javascript": "alert(1)"}},
    ],
)
def test_rejects_invalid_actions(action: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        TypeAdapter(AgentAction).validate_python({"description_vi": "Thao tác", **action})


def fake_llm(result: Any = None, error: Exception | None = None) -> tuple[MagicMock, AsyncMock]:
    llm = MagicMock()
    structured = AsyncMock()
    llm.with_structured_output.return_value = structured
    structured.ainvoke.return_value = result
    structured.ainvoke.side_effect = error
    return llm, structured


@pytest.mark.asyncio
async def test_llm_receives_history_and_returns_only_grounded_safe_actions(
    knowledge_base: AssistantHybridRetriever,
) -> None:
    llm, structured = fake_llm(
        {
            "message": "Bạn có thể tải CV PDF hoặc DOCX.",
            "intent": "qa",
            "sources": [],
            "actions": [
                {
                    "action_type": "HIGHLIGHT_ELEMENT",
                    "params": {"selector": UPLOAD_SELECTOR},
                    "description_vi": "Chỉ nút tải CV",
                },
                {
                    "action_type": "HIGHLIGHT_ELEMENT",
                    "params": {"selector": '[data-agent-target="not-in-docs"]'},
                    "description_vi": "Nút lạ",
                },
                {
                    "action_type": "NAVIGATE_PAGE",
                    "params": {"route": "/advisor/dashboard"},
                    "description_vi": "Mở cố vấn",
                },
                {"action_type": "SELECT_STUDENT", "params": {"student_id": "sv-1"}, "description_vi": "Chọn sinh viên"},
            ],
        }
    )
    agent = AssistantAgent(retriever=knowledge_base, llm=llm)
    response = await agent.respond(
        "Nút tải lên CV PDF DOCX ở đâu?",
        context(),
        history=[{"role": "user", "content": "Tôi có CV"}, {"role": "assistant", "content": "Bạn có thể tải lên"}],
    )
    assert response.sources
    assert len(response.actions) == 1 and response.actions[0].action_type == "HIGHLIGHT_ELEMENT"
    messages = structured.ainvoke.call_args.args[0]
    assert isinstance(messages[1], HumanMessage) and messages[1].content == "Tôi có CV"
    assert isinstance(messages[2], AIMessage)
    assert json.loads(messages[-1].content)["context"]["current_url"] == "/student/cv"


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", [TimeoutError("LLM timeout"), ValueError("invalid JSON")])
async def test_llm_failure_uses_grounded_fallback(knowledge_base: AssistantHybridRetriever, failure: Exception) -> None:
    llm, _ = fake_llm(error=failure)
    result = await AssistantAgent(knowledge_base, llm).respond("nút tải lên CV PDF DOCX ở đâu?", context())
    assert result.sources and result.message.startswith("Theo tài liệu")


@pytest.mark.asyncio
async def test_low_cosine_does_not_use_rrf_as_similarity() -> None:
    retriever = MagicMock()
    retriever.search.return_value = [
        {
            "role": "student",
            "route": "/student/cv",
            "distance": 0.9,
            "score": 0.99,
            "bm25_score": 0.0,
        }
    ]
    llm, structured = fake_llm()
    result = await AssistantAgent(retriever, llm).respond("Một chủ đề không có trong hướng dẫn", context())
    assert result.sources == []
    assert result.actions[0].action_type == "NAVIGATE_PAGE"
    structured.ainvoke.assert_not_called()


@pytest.mark.asyncio
async def test_start_analysis_requires_selected_ids_and_confirmation(knowledge_base: AssistantHybridRetriever) -> None:
    ctx = context().model_copy(update={"selected_cv_id": "cv-1", "page_state": {"selected_jd_id": "jd-1"}})
    response = await AssistantAgent(knowledge_base).respond("Hãy bắt đầu phân tích CV", ctx)
    start = next(action for action in response.actions if action.action_type == "START_ANALYSIS")
    assert start.requires_confirmation is True and start.confirmation_message
    absent = await AssistantAgent(knowledge_base).respond("Hãy bắt đầu phân tích CV", context())
    assert all(action.action_type != "START_ANALYSIS" for action in absent.actions)


@pytest.mark.asyncio
async def test_open_analysis_and_show_start_button(knowledge_base: AssistantHybridRetriever) -> None:
    ctx = context().model_copy(update={"route": "/student", "current_url": "/student"})
    response = await AssistantAgent(knowledge_base).respond("Mở trang phân tích CV và chỉ tôi nút bắt đầu", ctx)
    assert [action.action_type for action in response.actions] == ["NAVIGATE_PAGE", "HIGHLIGHT_ELEMENT"]
    assert response.actions[0].params.route == "/student/analysis"
    assert response.actions[1].params.selector == '[data-agent-target="btn-start-analysis"]'


@pytest.mark.asyncio
async def test_advisor_can_select_only_assigned_students(knowledge_base: AssistantHybridRetriever) -> None:
    llm, _ = fake_llm(
        {
            "message": "Chọn hồ sơ sinh viên được phân công.",
            "intent": "action",
            "actions": [
                {
                    "action_type": "SELECT_STUDENT",
                    "params": {"student_id": student_id},
                    "description_vi": "Chọn sinh viên",
                }
                for student_id in ("sv-assigned", "sv-other")
            ],
        }
    )
    response = await AssistantAgent(knowledge_base, llm).respond(
        "Chọn sinh viên cần nhận xét báo cáo", context("advisor"), allowed_student_ids=["sv-assigned"]
    )
    assert len(response.actions) == 1 and response.actions[0].params.student_id == "sv-assigned"


@pytest.mark.asyncio
async def test_question_cannot_start_analysis_even_if_llm_requests_it(knowledge_base: AssistantHybridRetriever) -> None:
    llm, _ = fake_llm(
        {
            "message": "Phân tích đối chiếu CV với JD.",
            "intent": "action",
            "actions": [
                {
                    "action_type": "START_ANALYSIS",
                    "params": {"cv_id": "cv-1", "jd_id": "jd-1"},
                    "description_vi": "Phân tích CV",
                }
            ],
        }
    )
    ctx = context().model_copy(update={"selected_cv_id": "cv-1", "page_state": {"selected_jd_id": "jd-1"}})
    response = await AssistantAgent(knowledge_base, llm).respond("Làm sao bắt đầu phân tích CV?", ctx)
    assert response.intent == "qa" and response.actions == []


@pytest.mark.asyncio
async def test_negative_command_cannot_navigate(knowledge_base: AssistantHybridRetriever) -> None:
    llm, _ = fake_llm(
        {
            "message": "Bạn có thể quản lý CV ở trang CV.",
            "intent": "action",
            "actions": [
                {"action_type": "NAVIGATE_PAGE", "params": {"route": "/student/cv"}, "description_vi": "Mở CV"}
            ],
        }
    )
    response = await AssistantAgent(knowledge_base, llm).respond("Đừng mở trang CV", context())
    assert response.actions == []


@pytest.mark.asyncio
async def test_chat_persists_conversation_turn_sources_and_pending_action(
    client: AsyncClient, api_agent: AssistantAgent
) -> None:
    result = await client.post(f"{API}/chat", json=payload(), headers=STUDENT)
    assert result.status_code == 200, result.text
    data = result.json()
    assert data["intent"] == "action"
    assert any(
        action["params"]["route"] == "/student/analysis"
        for action in data["actions"]
        if action["action_type"] == "NAVIGATE_PAGE"
    )
    with SessionLocal() as db:
        conversation = db.get(AssistantConversation, data["conversation_id"])
        turn = db.get(AssistantTurn, data["turn_id"])
        assert conversation.user_id == "sv-0142" and conversation.role == "student"
        assert turn.context_json["user_id"] == "sv-0142"
        assert turn.sources_json == data["sources"]
        assert all(db.get(AgentActionLog, action["id"]).status == "pending" for action in data["actions"])


@pytest.mark.asyncio
async def test_followup_reuses_conversation_and_supplies_history(
    client: AsyncClient, api_agent: AssistantAgent, monkeypatch: pytest.MonkeyPatch
) -> None:
    first = (await client.post(f"{API}/chat", json=payload(), headers=STUDENT)).json()
    spy = AsyncMock(wraps=api_agent.respond)
    monkeypatch.setattr(api_agent, "respond", spy)
    second = await client.post(
        f"{API}/chat", json=payload("Nút tải CV ở đâu?", conversation_id=first["conversation_id"]), headers=STUDENT
    )
    assert second.status_code == 200
    assert second.json()["conversation_id"] == first["conversation_id"]
    assert second.json()["turn_id"] != first["turn_id"]
    assert spy.call_args.kwargs["history"][0]["content"] == "chuyển sang trang phân tích"


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["owned", "foreign_cv", "foreign_jd", "missing_cv", "empty_cv"])
async def test_analysis_actions_require_accessible_cv_and_jd(
    client: AsyncClient, api_agent: AssistantAgent, kind: str
) -> None:
    with SessionLocal() as db:
        foreign_id = f"sv-{uuid4().hex[:12]}"
        db.add(User(id=foreign_id, role="student", full_name="Other", email=f"{foreign_id}@example.test"))
        owner_id = foreign_id if kind == "foreign_cv" else "sv-0142"
        version = (db.scalar(select(func.max(CvVersion.version)).where(CvVersion.owner_id == owner_id)) or 0) + 1
        cv = CvVersion(
            id=f"cv-{uuid4().hex[:12]}",
            owner_id=owner_id,
            version=version,
            file_name="CV.docx",
            file_type="docx",
            size_bytes=100,
            content_text="" if kind == "empty_cv" else "Python SQL projects",
        )
        db.add(cv)
        jd = db.scalar(select(JobDescription).where(JobDescription.source == "library"))
        if kind == "foreign_jd":
            jd = JobDescription(
                id=f"jd-{uuid4().hex[:12]}",
                source="pasted",
                owner_id=foreign_id,
                title="Private JD",
                content="Python development",
            )
            db.add(jd)
        db.commit()
        cv_id = "missing-cv" if kind == "missing_cv" else cv.id
        jd_id = jd.id
        analyses_before = db.scalar(select(func.count()).select_from(GapAnalysis))
    body = payload("Hãy bắt đầu phân tích CV")
    body["context"].update(selected_cv_id=cv_id, page_state={"selected_jd_id": jd_id})
    response = await client.post(f"{API}/chat", json=body, headers=STUDENT)
    assert response.status_code == 200, response.text
    starts = [action for action in response.json()["actions"] if action["action_type"] == "START_ANALYSIS"]
    assert bool(starts) == (kind == "owned")
    if starts:
        assert starts[0]["requires_confirmation"] is True
        assert starts[0]["confirmation_message"]
        with SessionLocal() as db:
            assert db.get(AgentActionLog, starts[0]["id"]).status == "pending"
    else:
        assert "chọn lại" in response.json()["message"]
    with SessionLocal() as db:
        # This API proposes a client action; it must not start a background job.
        assert db.scalar(select(func.count()).select_from(GapAnalysis)) == analyses_before


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "overrides",
    [
        {"user_role": "advisor"},
        {"user_id": "someone-else"},
        {"route": "/advisor/dashboard"},
        {"current_url": "/advisor/dashboard"},
    ],
)
async def test_chat_rejects_forged_context(
    client: AsyncClient, api_agent: AssistantAgent, overrides: dict[str, str]
) -> None:
    body = payload()
    body["context"].update(overrides)
    assert (await client.post(f"{API}/chat", json=body, headers=STUDENT)).status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("endpoint", "body"),
    [
        ("chat", payload()),
        ("action/confirm", {"action_id": "missing", "status": "executed"}),
        ("feedback", {"turn_id": "missing", "rating": 1}),
        ("reindex", None),
    ],
)
async def test_assistant_endpoints_require_auth(client: AsyncClient, endpoint: str, body: Any) -> None:
    assert (await client.post(f"{API}/{endpoint}", json=body)).status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["executed", "rejected", "failed"])
async def test_action_status_is_persisted_and_idempotent(
    client: AsyncClient, api_agent: AssistantAgent, status: str
) -> None:
    chat = (await client.post(f"{API}/chat", json=payload(), headers=STUDENT)).json()
    action_id = chat["actions"][0]["id"]
    body = {"action_id": action_id, "status": status, "error_message": "Selector absent"}
    response = await client.post(f"{API}/action/confirm", json=body, headers=STUDENT)
    assert response.status_code == 200
    with SessionLocal() as db:
        action = db.get(AgentActionLog, action_id)
        assert action.status == status
        assert (action.client_executed_at is not None) == (status == "executed")
        assert action.error_message == ("Selector absent" if status == "failed" else None)
        timestamp = action.client_executed_at
    assert (await client.post(f"{API}/action/confirm", json=body, headers=STUDENT)).status_code == 200
    with SessionLocal() as db:
        assert db.get(AgentActionLog, action_id).client_executed_at == timestamp
    body["status"] = "failed" if status != "failed" else "executed"
    assert (await client.post(f"{API}/action/confirm", json=body, headers=STUDENT)).status_code == 409


@pytest.mark.asyncio
@pytest.mark.parametrize("final_status", ["executed", "rejected", "failed"])
async def test_action_confirmation_precedes_terminal_status(
    client: AsyncClient, api_agent: AssistantAgent, final_status: str
) -> None:
    chat = (await client.post(f"{API}/chat", json=payload(), headers=STUDENT)).json()
    action_id = chat["actions"][0]["id"]
    body = {"action_id": action_id, "status": "confirmed"}
    for _ in range(2):
        response = await client.post(f"{API}/action/confirm", json=body, headers=STUDENT)
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "confirmed"
    with SessionLocal() as db:
        action = db.get(AgentActionLog, action_id)
        assert action.status == "confirmed"
        assert action.client_executed_at is None
    body["status"] = final_status
    assert (await client.post(f"{API}/action/confirm", json=body, headers=STUDENT)).status_code == 200
    body["status"] = "confirmed"
    assert (await client.post(f"{API}/action/confirm", json=body, headers=STUDENT)).status_code == 409


@pytest.mark.asyncio
async def test_feedback_persists_and_updates_without_duplicate(client: AsyncClient, api_agent: AssistantAgent) -> None:
    chat = (await client.post(f"{API}/chat", json=payload(), headers=STUDENT)).json()
    body = {"turn_id": chat["turn_id"], "rating": 1, "comment": "Hữu ích"}
    first = await client.post(f"{API}/feedback", json=body, headers=STUDENT)
    assert first.status_code == 200
    body.update(rating=-1, comment="Cần rõ hơn")
    second = await client.post(f"{API}/feedback", json=body, headers=STUDENT)
    assert second.status_code == 200 and first.json()["id"] == second.json()["id"]
    with SessionLocal() as db:
        assert (
            db.scalar(
                select(func.count()).select_from(AssistantFeedback).where(AssistantFeedback.turn_id == chat["turn_id"])
            )
            == 1
        )
        assert db.get(AssistantFeedback, second.json()["id"]).comment == "Cần rõ hơn"


@pytest.mark.asyncio
@pytest.mark.parametrize("rating", [0, 2, True, "1"])
async def test_feedback_rejects_invalid_ratings(client: AsyncClient, rating: Any) -> None:
    assert (
        await client.post(f"{API}/feedback", json={"turn_id": "missing", "rating": rating}, headers=STUDENT)
    ).status_code == 422


@pytest.mark.asyncio
async def test_other_student_cannot_access_conversation_action_or_feedback(
    client: AsyncClient, api_agent: AssistantAgent
) -> None:
    first = (await client.post(f"{API}/chat", json=payload(), headers=STUDENT)).json()
    other = User(
        id=f"sv-{uuid4().hex[:12]}", role="student", full_name="Other student", email=f"{uuid4().hex}@example.test"
    )
    with SessionLocal() as db:
        db.add(other)
        db.commit()
    app.dependency_overrides[get_current_user] = lambda: other
    try:
        cases = [
            ("chat", payload(conversation_id=first["conversation_id"])),
            ("action/confirm", {"action_id": first["actions"][0]["id"], "status": "executed"}),
            ("feedback", {"turn_id": first["turn_id"], "rating": 1}),
        ]
        for endpoint, body in cases:
            assert (await client.post(f"{API}/{endpoint}", json=body, headers=STUDENT)).status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_reindex_requires_advisor_and_refreshes_retrieval(client: AsyncClient, api_agent: AssistantAgent) -> None:
    assert (await client.post(f"{API}/reindex", headers=STUDENT)).status_code == 403
    response = await client.post(f"{API}/reindex", headers=ADVISOR)
    assert response.status_code == 200 and response.json()["chunks_indexed"] > 0
    chat = await client.post(f"{API}/chat", json=payload("Nút tải lên CV PDF DOCX ở đâu?"), headers=STUDENT)
    assert chat.status_code == 200
    assert any(source["selector"] == UPLOAD_SELECTOR for source in chat.json()["sources"])


@pytest.mark.asyncio
async def test_reindex_failure_is_sanitized(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(assistant_api, "build_assistant_index", MagicMock(side_effect=RuntimeError("internal details")))
    response = await client.post(f"{API}/reindex", headers=ADVISOR)
    assert response.status_code == 503 and response.json()["code"] == "assistant_index_unavailable"
    assert "internal details" not in response.text
