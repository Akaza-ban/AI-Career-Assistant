"""LangGraph Assistant: intent -> role-aware retrieval -> validated response."""

import json
import logging
import re
from functools import lru_cache
from html import escape
from threading import RLock
from typing import Any, Literal, TypedDict
from urllib.parse import urlsplit
from uuid import uuid4

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from src.config import get_settings
from src.models.assistant import (
    ROUTES,
    AgentAction,
    AnalysisAction,
    AssistantLlmOutput,
    AssistantResponse,
    ClientPageContext,
    HighlightAction,
    Intent,
    NavigateAction,
    ResetAction,
    SourceCitation,
    clean_citation_snippet,
    route_allowed,
    validate_llm_actions,
)
from src.prompts.assistant_prompts import ASSISTANT_SYSTEM_PROMPT, HOWTO_SYSTEM_PROMPT
from src.services.assistant.chunker import DocChunk
from src.services.assistant.guardrails import (
    has_careerx_topic,
    is_chitchat,
    is_out_of_scope,
    is_refusal_response,
    is_role_forbidden,
    sanitize_and_inspect_prompt,
)
from src.services.assistant.howto import (
    AnswerCache,
    AttachmentMetadata,
    GuideAnswer,
    answer_cache_key,
    answer_language,
    attached_actions,
    capability_menu,
    corpus_version,
    safe_guide_output,
)
from src.services.assistant.hybrid_search import AssistantHybridRetriever, select_citation_chunks
from src.services.assistant.locate import locate_actions
from src.services.assistant.router import LocalRouter
from src.services.assistant.router.rules import decide_rules
from src.services.assistant.text import fold_diacritics as normalized
from src.services.llm import assistant_llm_configured as llm_configured
from src.services.llm import get_assistant_llm
from src.services.privacy.types import MaskingError
from src.services.providers.gateway import GatewayError, provider_scope, wrap_chat
from src.services.providers.llm_client import ContentDelta, Done, LlmClient

logger = logging.getLogger(__name__)
ASSISTANT_INDEX_LOCK = RLock()


def classify_intent(message: str) -> Intent:
    """An imperative is distinct from asking how to perform an action."""
    text = normalized(message)
    command = bool(
        re.search(
            r"(?:^|[.!?;\n]\s*|\bva\s+)(?:hay\s+|vui long\s+)?"
            r"(?:mo\b|chuyen\b|dieu huong\b|loc\b|tim\b|dien\b|chon\b|cuon\b|dat lai\b|"
            r"khoi phuc\b|bat dau\b|phan tich\b|highlight\b|reset\b)",
            text,
        )
        or re.search(r"\b(?:mo|chuyen|loc|dien|chon|cuon)\s+giup\b", text)
    )
    if re.search(r"(?:^|[.!?;\n]\s*)(?:dung|khong duoc|khong can)\b", text):
        command = False
    question = bool(re.search(r"\b(?:lam sao|cach nao|huong dan|o dau|la gi|y nghia|tai sao|the nao)\b", text))
    return "hybrid" if command and question else "action" if command else "qa"


def _selector_key(selector: str) -> str:
    match = re.fullmatch(r"\[data-agent-target=['\"]([\w-]+)['\"]\]", selector)
    return match.group(1) if match else selector


class AssistantState(TypedDict, total=False):
    message: str
    locate_fallback: bool
    input_allowed: bool
    context: ClientPageContext
    history: list[dict[str, str]]
    allowed_student_ids: list[str]
    intent: Intent
    sources: list[SourceCitation]
    confidence: Literal["low", "high"]
    response: AssistantResponse
    retrieved_chunks: list[dict[str, Any]]
    masked_query: str
    docs_version: str
    howto: bool


class AssistantAgent:
    def __init__(self, retriever: AssistantHybridRetriever | None = None, llm: Any = None) -> None:
        self._retriever = retriever
        self._llm = llm
        self._ui_router: LocalRouter | None = None
        settings = get_settings()
        self.answer_cache = AnswerCache(
            maxsize=settings.rag_answer_cache_maxsize, ttl_s=settings.rag_answer_cache_ttl_s
        )
        builder = StateGraph(AssistantState)
        builder.add_node("inspect", self._inspect)
        builder.add_node("classify", self._classify)
        builder.add_node("retrieve", self._retrieve)
        builder.add_node("generate", self._generate)
        builder.add_edge(START, "inspect")
        builder.add_conditional_edges("inspect", lambda state: state["input_allowed"], {True: "classify", False: END})
        builder.add_edge("classify", "retrieve")
        builder.add_edge("retrieve", "generate")
        builder.add_edge("generate", END)
        self.graph = builder.compile()

    def _inspect(self, state: AssistantState) -> dict[str, Any]:
        allowed, message = sanitize_and_inspect_prompt(state["message"])
        if allowed:
            out_of_scope, refusal = is_out_of_scope(message)
            if out_of_scope:
                allowed, message = False, refusal
            else:
                chitchat, reply = is_chitchat(message)
                if chitchat:
                    # End before classification/retrieval; keep the public QA contract.
                    allowed, message = False, reply
        if not allowed:
            return {
                "input_allowed": False,
                "sources": [],
                "confidence": "low",
                "response": AssistantResponse(message=message, intent="qa", actions=[], sources=[]),
            }
        if self._ui_router is None:
            self._ui_router = LocalRouter()
        decision = self._ui_router.decide(message, role=state["context"].user_role)
        # During legacy migration, a classifier-only locate label must not
        # intercept an imperative that carries no locate evidence.
        rules = decide_rules(message, role=state["context"].user_role, language=decision.language)
        if decision.route == "locate" and (rules.route == "locate" or classify_intent(message) != "action"):
            context = state["context"]
            actions = locate_actions(message, context.user_role, context.route)
            if actions:
                return {
                    "input_allowed": False,
                    "response": AssistantResponse(
                        message="Here is the control you are looking for."
                        if decision.language == "en"
                        else "Đây là nút bạn cần tìm.",
                        intent="action",
                        ui_actions=actions,
                    ),
                }
            return {"input_allowed": True, "message": message, "locate_fallback": True, "howto": True}
        return {"input_allowed": True, "message": message, "howto": decision.route == "howto"}

    def _classify(self, state: AssistantState) -> dict[str, Any]:
        return {"intent": "qa" if state.get("locate_fallback") else classify_intent(state["message"])}

    def _retrieve(self, state: AssistantState) -> dict[str, Any]:
        context = state["context"]
        try:
            # A fresh retriever observes rebuilt collections and BM25 corpora.
            with ASSISTANT_INDEX_LOCK:
                retriever = self._retriever or AssistantHybridRetriever()
                with provider_scope(mask_only=True) as scope:
                    # The masker escapes ampersands for wire/XML safety. Search
                    # keeps their original meaning, without restoring any PII.
                    query = scope.mask_text(state["message"]).replace("&amp;", "&")
                chunks = retriever.search(query, context.user_role, route=context.route)
        except (MaskingError, GatewayError):
            return {
                "sources": [],
                "confidence": "low",
                "response": AssistantResponse(
                    message="Trợ lý tạm thời chưa thể xử lý an toàn. Bạn vui lòng thử lại sau.",
                    intent=state["intent"],
                    actions=[],
                    sources=[],
                ),
            }
        except Exception as exc:
            logger.warning("Assistant retrieval unavailable (%s)", type(exc).__name__)
            return {"sources": [], "confidence": "low"}
        usable = [
            chunk
            for chunk in chunks
            if chunk.get("role") in (context.user_role, "all")
            and route_allowed(chunk.get("route", ""), context.user_role)
        ]
        selected = select_citation_chunks(usable)
        embedding = getattr(getattr(retriever, "vector_store", None), "embedding_service", None)
        embedding_id = getattr(embedding, "embedding_id", "")
        # E5 cosine confidence and the hashing fallback have different scales.
        # Gate only the top result here; leave citation ranking/cutoffs intact.
        if (
            isinstance(embedding_id, str)
            and embedding_id.startswith("e5:")
            and selected
            and selected[0].get("abstain_score", selected[0]["score"]) < get_settings().rag_semantic_abstain_threshold
        ):
            selected = []
        sources = [
            SourceCitation(
                chunk_id=chunk["chunk_id"],
                title=chunk["title"],
                route=chunk["route"],
                section=chunk["section"],
                snippet=clean_citation_snippet(chunk["content"])[:500],
                selector=chunk.get("selector"),
            )
            for chunk in selected
        ]
        corpus = getattr(retriever, "chunks", None)
        if not isinstance(corpus, list):
            corpus = [DocChunk.model_validate(chunk) for chunk in selected]
        return {
            "sources": sources,
            "confidence": "high" if sources else "low",
            "retrieved_chunks": selected,
            "masked_query": query,
            "docs_version": corpus_version(corpus),
        }

    def _target_route(self, state: AssistantState) -> str | None:
        text = normalized(state["message"])
        role = state["context"].user_role
        explicit = re.search(r"/(?:student|advisor)(?:/[\w-]+)*", text)
        if explicit:
            route = explicit.group(0)
            return route if route_allowed(route, role) else None
        if role == "student":
            if is_role_forbidden(text, role):
                return None
            choices = [
                (("lich su", "history", "tien bo"), "/student/history"),
                (("chia se", "sharing", "share"), "/student/share"),
                (("thu vien", "library", "them jd", "jd cua ban"), "/student/library"),
                (("phan tich", "analysis", "match score", "match-score", "khoang cach", "jd"), "/student/analysis"),
                (("phong van", "interview", "star"), "/student/interview"),
                (("cv", "ho so"), "/student/cv"),
                (("cai dat", "settings"), "/student/settings"),
            ]
        else:
            choices = [
                (("sinh vien", "students", "nguy co", "at-risk", "can chu y"), "/advisor/students"),
                (("nhan xet", "reviews"), "/advisor/reviews"),
                (("thong ke", "analytics"), "/advisor/analytics"),
                (("tong quan", "dashboard"), "/advisor/dashboard"),
                (("cai dat", "settings"), "/advisor/settings"),
            ]
        return next((route for words, route in choices if any(word in text for word in words)), None)

    def _fallback(self, state: AssistantState) -> AssistantResponse:
        context = state["context"]
        sources = state["sources"]
        chitchat, reply = is_chitchat(state["message"])
        if chitchat:
            return AssistantResponse(message=reply, intent="qa", actions=[], sources=[])
        if state["confidence"] != "high" or not sources or not has_careerx_topic(state["message"]):
            return AssistantResponse(
                message="Xin lỗi, tôi chưa tìm thấy tài liệu phù hợp để trả lời câu hỏi này trong hệ thống CareerV.",
                intent=state["intent"],
                actions=[],
                sources=[],
            )
        text = normalized(state["message"])
        route = self._target_route(state)
        actions: list[AgentAction] = []
        if state["intent"] != "qa" and route is not None:
            actions.append(NavigateAction(params={"route": route}, description_vi=f"Mở trang {route}"))
        if state["intent"] != "qa" and re.search(r"\b(?:dat lai|khoi phuc|reset)\b", text):
            actions.append(ResetAction(description_vi="Khôi phục bộ lọc và đóng các hộp thoại"))
        if state["intent"] != "qa" and "bat dau phan tich" in text and context.user_role == "student":
            jd_id = context.page_state.get("selected_jd_id") or context.page_state.get("jd_id")
            if context.selected_cv_id and isinstance(jd_id, str):
                actions.append(
                    AnalysisAction(
                        params={"cv_id": context.selected_cv_id, "jd_id": jd_id},
                        description_vi="Bắt đầu phân tích CV với JD đã chọn",
                    )
                )
        target_sources = [source for source in sources if source.selector and (route is None or source.route == route)]
        if target_sources and re.search(r"\b(?:nut|o dau|chi toi|highlight)\b", text):
            source = target_sources[0]
            if source.route != context.route and not any(a.action_type == "NAVIGATE_PAGE" for a in actions):
                actions.append(NavigateAction(params={"route": source.route}, description_vi="Mở trang có nút cần tìm"))
            actions.append(
                HighlightAction(params={"selector": source.selector}, description_vi="Chỉ vị trí nút trong hướng dẫn")
            )
        # Nguồn đã hiện riêng dưới câu trả lời ("Theo hướng dẫn: …"), nên chỉ trích hai đoạn sát nhất.
        message = "Theo tài liệu hướng dẫn:\n\n" + "\n\n".join(source.snippet for source in sources[:2])
        if any(action.action_type == "START_ANALYSIS" for action in actions):
            message += "\n\nVui lòng xác nhận trước khi bắt đầu phân tích."
        return AssistantResponse(message=message, intent=state["intent"], actions=actions, sources=sources)

    def _guard(self, response: AssistantResponse, state: AssistantState) -> AssistantResponse:
        if state.get("locate_fallback"):
            return response.model_copy(update={"actions": [], "ui_actions": [], "intent": "qa"})
        if is_refusal_response(response.message):
            return AssistantResponse(message=response.message, intent=state["intent"], actions=[], sources=[])
        context = state["context"]
        selectors = {_selector_key(source.selector) for source in state["sources"] if source.selector}
        filters = {
            "student": {"keyword", "type", "position", "date_range", "status", "active_tab"},
            "advisor": {"keyword", "status", "major", "cohort", "readiness", "score_max"},
        }
        modals = {
            "student": {"upload-cv-modal", "feedback-modal"},
            "advisor": {"feedback-modal", "student-review-modal"},
        }
        safe: list[AgentAction] = []
        for action in response.actions:
            if re.search(r"(?:^|[.!?;\n]\s*)(?:dung|khong duoc|khong can)\b", normalized(state["message"])):
                continue
            if action.action_type == "NAVIGATE_PAGE" and not route_allowed(action.params.route, context.user_role):
                continue
            if action.action_type in ("HIGHLIGHT_ELEMENT", "SCROLL_TO"):
                selector = action.params.selector
                if selector is not None and _selector_key(selector) not in selectors:
                    continue
            if action.action_type == "FILL_FILTER" and action.params.filter_name not in filters[context.user_role]:
                continue
            if action.action_type == "OPEN_MODAL" and action.params.modal_id not in modals[context.user_role]:
                continue
            if action.action_type == "SELECT_STUDENT":
                if context.user_role != "advisor" or action.params.student_id not in state["allowed_student_ids"]:
                    continue
            if action.action_type == "START_ANALYSIS":
                jd_id = context.page_state.get("selected_jd_id") or context.page_state.get("jd_id")
                if (
                    context.user_role != "student"
                    or state["intent"] == "qa"
                    or action.params.cv_id != context.selected_cv_id
                    or action.params.jd_id != jd_id
                ):
                    continue
            # IDs are generated by the server, never taken from model output/history.
            safe.append(action.model_copy(update={"id": str(uuid4())}))
        return AssistantResponse(
            message=response.message, intent=state["intent"], actions=safe, sources=response.sources
        )

    async def _generate_howto(self, state: AssistantState) -> AssistantResponse:
        context = state["context"]
        language = answer_language(state["message"])
        fallback = AssistantResponse(message=capability_menu(language, context.user_role), intent="qa")
        if state.get("response"):
            return state["response"]
        if not state["sources"]:
            return fallback
        key = answer_cache_key(state["masked_query"], context.user_role, language, state["docs_version"])
        cached = self.answer_cache.get(key)
        if cached is not None:
            return AssistantResponse(
                message=cached.message,
                intent="qa",
                sources=cached.sources,
                ui_actions=attached_actions(cached.attachment, context.user_role, context.route),
            )
        if self._llm is None and not llm_configured():
            # Keep the existing offline excerpt fallback, with no legacy actions.
            return self._fallback(state).model_copy(update={"intent": "qa", "actions": [], "ui_actions": []})
        client = self._llm if self._llm is not None else get_assistant_llm()
        stream = None
        try:
            with provider_scope(mask_only=True) as scope:
                data = scope.mask_payload(
                    {
                        "question": state["message"],
                        "history": json.dumps(state["history"][-4:], ensure_ascii=False),
                        "documents": [clean_citation_snippet(chunk["content"]) for chunk in state["retrieved_chunks"]],
                    }
                )
                prompt = (
                    f"<untrusted_user_query>{escape(data['question'], quote=False)}</untrusted_user_query>\n"
                    f"<untrusted_chat_history>{escape(data['history'], quote=False)}</untrusted_chat_history>\n"
                    + "\n".join(
                        f"<untrusted_document>{escape(doc, quote=False)}</untrusted_document>"
                        for doc in data["documents"]
                    )
                )
                messages = [
                    {
                        "role": "system",
                        "content": scope.mask_text(
                            HOWTO_SYSTEM_PROMPT.format(language="English" if language == "en" else "Vietnamese"),
                            wire=True,
                            detect_names=False,
                        ),
                    },
                    {"role": "user", "content": prompt},
                ]
                text, done = "", False
                stream = client.chat_stream(
                    scope.prepared(messages), thinking=False, model=get_settings().llm_model_agent, temperature=0
                )
                async for event in stream:
                    if isinstance(event, ContentDelta):
                        text += event.text
                    elif isinstance(event, Done):
                        if event.message.get("tool_calls"):
                            raise GatewayError("Unexpected how-to tool call")
                        done = True
                if not done:
                    raise GatewayError("Incomplete how-to response")
                text = scope.sanitize_output(text)
                if not safe_guide_output(text):
                    return fallback
                if is_refusal_response(text):
                    return AssistantResponse(message=text, intent="qa")
                top = state["retrieved_chunks"][0]
                answer = GuideAnswer(
                    message=text,
                    sources=state["sources"],
                    attachment=AttachmentMetadata.model_validate(top),
                )
                self.answer_cache.put(key, answer)
                return AssistantResponse(
                    message=answer.message,
                    intent="qa",
                    sources=answer.sources,
                    ui_actions=attached_actions(answer.attachment, context.user_role, context.route),
                )
        except (MaskingError, GatewayError) as error:
            if isinstance(error, MaskingError) or error.stage in {"mask", "egress", "response_mask"}:
                return AssistantResponse(
                    message="Trợ lý tạm thời chưa thể xử lý an toàn. Bạn vui lòng thử lại sau.", intent="qa"
                )
            return fallback
        except Exception:
            logger.warning("Assistant how-to generation unavailable")
            return fallback
        finally:
            if stream is not None:
                await stream.aclose()
            if self._llm is None:
                await client.aclose()

    async def _generate(self, state: AssistantState) -> dict[str, Any]:
        if (state["intent"] == "qa" or state.get("howto")) and (self._llm is None or isinstance(self._llm, LlmClient)):
            return {"response": await self._generate_howto(state)}
        if not state.get("response") and not state["sources"] and state["intent"] == "qa":
            return {
                "response": AssistantResponse(
                    message=capability_menu(answer_language(state["message"]), state["context"].user_role),
                    intent="qa",
                )
            }
        response = state.get("response") or self._fallback(state)
        if not response.sources:
            return {"response": response}
        if state["confidence"] == "high" and state["sources"] and (self._llm is not None or llm_configured()):
            context = state["context"]
            system = SystemMessage(
                content=ASSISTANT_SYSTEM_PROMPT.format(
                    user_role=context.user_role,
                    allowed_routes=sorted(ROUTES[context.user_role]),
                    intent=state["intent"],
                )
            )
            # History remains quoted data, never replayed as privileged model roles.
            # Escape every value so embedded closing tags cannot break isolation.
            # Browser page_state is arbitrary input and can include CV/JD bodies
            # or transcripts. Only the validated page/role hint goes outbound.
            outbound_context = context.model_copy(
                update={
                    "user_id": None,
                    "selected_cv_id": None,
                    "page_state": {},
                    "current_url": urlsplit(context.current_url).path,
                }
            )
            prompt_data = {
                "untrusted_user_query": state["message"],
                "untrusted_chat_history": json.dumps(state["history"][-4:], ensure_ascii=False),
                "untrusted_page_context": json.dumps(outbound_context.model_dump(), ensure_ascii=False),
                "allowed_student_ids": json.dumps(state["allowed_student_ids"], ensure_ascii=False),
                "retrieved_documents": json.dumps(
                    [source.model_dump() for source in state["sources"]], ensure_ascii=False
                ),
            }
            try:
                with provider_scope(mask_only=True) as scope:
                    # Escape/render only after privacy masking, preserving XML's
                    # single encoding layer and literal-placeholder protection.
                    masked_data = scope.mask_payload(prompt_data)
                    messages = [
                        system,
                        HumanMessage(
                            content="\n".join(
                                f"<{tag}>{escape(value.replace('&amp;', '&'), quote=False)}</{tag}>"
                                for tag, value in masked_data.items()
                            )
                        ),
                    ]
                    if self._llm is None or isinstance(self._llm, LlmClient):
                        client = self._llm if self._llm is not None else get_assistant_llm()
                        try:
                            raw = await client.chat(
                                scope.prepared(
                                    [
                                        {
                                            "role": "system",
                                            "content": scope.mask_text(system.content, wire=True, detect_names=False)
                                            + "\nReturn your response using assistant_response.",
                                        },
                                        {"role": "user", "content": messages[1].content},
                                    ]
                                ),
                                tools=[
                                    {
                                        "type": "function",
                                        "function": {
                                            "name": "assistant_response",
                                            "description": "Return the grounded assistant response.",
                                            "parameters": AssistantLlmOutput.model_json_schema(),
                                        },
                                    }
                                ],
                                thinking=False,
                                temperature=0,
                            )
                            calls = raw.get("tool_calls", [])
                            if calls:
                                if len(calls) != 1 or calls[0]["function"]["name"] != "assistant_response":
                                    raise GatewayError("Unexpected assistant response tool")
                                result = client.parse_tool_arguments(raw)[calls[0]["id"]]
                            else:
                                result = json.loads(raw.get("content", ""))
                        finally:
                            if self._llm is None:
                                await client.aclose()
                    else:
                        # Preserve the existing injected recording-backend seam;
                        # production assistant generation uses LlmClient above.
                        structured = wrap_chat(
                            self._llm, timeout=get_settings().assistant_llm_timeout_seconds
                        ).with_structured_output(AssistantLlmOutput, method="function_calling")
                        result = await structured.ainvoke(scope.prepared(messages))
                    result = (
                        result if isinstance(result, AssistantLlmOutput) else AssistantLlmOutput.model_validate(result)
                    )
                    result = scope.sanitize_output(result)
                    response = AssistantResponse(
                        message=result.message,
                        intent=result.intent,
                        actions=[] if result.is_refusal else validate_llm_actions(result.actions),
                        sources=[] if result.is_refusal else state["sources"],
                    )
            except (MaskingError, GatewayError) as error:
                if isinstance(error, MaskingError) or error.stage in {"mask", "egress", "response_mask"}:
                    response = AssistantResponse(
                        message="Trợ lý tạm thời chưa thể xử lý an toàn. Bạn vui lòng thử lại sau.",
                        intent=state["intent"],
                        actions=[],
                        sources=[],
                    )
                else:
                    logger.warning("Assistant generation unavailable; using grounded fallback")
            except Exception:
                logger.warning("Assistant generation unavailable; using grounded fallback")
        return {"response": self._guard(response, state)}

    async def respond(
        self,
        message: str,
        context: ClientPageContext,
        history: list[dict[str, str]] | None = None,
        allowed_student_ids: list[str] | None = None,
    ) -> AssistantResponse:
        with provider_scope(mask_only=True):
            result = await self.graph.ainvoke(
                {
                    "message": message,
                    "context": context,
                    "history": history or [],
                    "allowed_student_ids": allowed_student_ids or [],
                },
                config={"callbacks": []},
            )
        return result["response"]


@lru_cache(maxsize=1)
def get_assistant_agent() -> AssistantAgent:
    return AssistantAgent()
