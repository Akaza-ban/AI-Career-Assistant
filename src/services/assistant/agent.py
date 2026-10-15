"""LangGraph Assistant: intent -> role-aware retrieval -> validated response."""

import json
import logging
import re
import unicodedata
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
from src.prompts.assistant_prompts import ASSISTANT_SYSTEM_PROMPT
from src.services.assistant.guardrails import (
    has_careerx_topic,
    is_chitchat,
    is_out_of_scope,
    is_refusal_response,
    sanitize_and_inspect_prompt,
)
from src.services.assistant.hybrid_search import AssistantHybridRetriever, select_citation_chunks
from src.services.llm import assistant_llm_configured as llm_configured
from src.services.llm import get_assistant_llm
from src.services.privacy.types import MaskingError
from src.services.providers.gateway import GatewayError, provider_scope, wrap_chat
from src.services.providers.llm_client import LlmClient

logger = logging.getLogger(__name__)
ASSISTANT_INDEX_LOCK = RLock()


def normalized(text: str) -> str:
    text = unicodedata.normalize("NFD", text.casefold()).replace("đ", "d")
    return "".join(char for char in text if not unicodedata.combining(char))


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
    input_allowed: bool
    context: ClientPageContext
    history: list[dict[str, str]]
    allowed_student_ids: list[str]
    intent: Intent
    sources: list[SourceCitation]
    confidence: Literal["low", "high"]
    response: AssistantResponse


class AssistantAgent:
    def __init__(self, retriever: AssistantHybridRetriever | None = None, llm: Any = None) -> None:
        self._retriever = retriever
        self._llm = llm
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
        return {"input_allowed": True, "message": message}

    def _classify(self, state: AssistantState) -> dict[str, Any]:
        return {"intent": classify_intent(state["message"])}

    def _retrieve(self, state: AssistantState) -> dict[str, Any]:
        context = state["context"]
        try:
            # A fresh retriever observes rebuilt collections and BM25 corpora.
            with ASSISTANT_INDEX_LOCK:
                retriever = self._retriever or AssistantHybridRetriever()
                chunks = retriever.search(state["message"], context.user_role, route=context.route)
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
        sources = [
            SourceCitation(
                chunk_id=chunk["chunk_id"],
                title=chunk["title"],
                route=chunk["route"],
                section=chunk["section"],
                snippet=clean_citation_snippet(chunk["content"])[:500],
                selector=chunk.get("selector"),
            )
            for chunk in select_citation_chunks(usable)
        ]
        return {"sources": sources, "confidence": "high" if sources else "low"}

    def _target_route(self, state: AssistantState) -> str | None:
        text = normalized(state["message"])
        role = state["context"].user_role
        explicit = re.search(r"/(?:student|advisor)(?:/[\w-]+)*", text)
        if explicit:
            route = explicit.group(0)
            return route if route_allowed(route, role) else None
        if role == "student":
            if "advisor" in text or "dashboard" in text or "co van" in text and "chia se" not in text:
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

    async def _generate(self, state: AssistantState) -> dict[str, Any]:
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
