"""Database-backed navigation resolution with owner-scoped, read-only queries."""

import unicodedata
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from difflib import SequenceMatcher
from pathlib import PurePath
from typing import Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from src.db.models import CvVersion, GapAnalysis, InterviewSession, JobDescription, User
from src.services.assistant.date_parser import (
    LocalDateRange,
    assistant_timezone,
    local_range_to_utc_naive,
    parse_local_date_range,
)
from src.services.assistant.nav_queries import (
    analyses_for_jds,
    analyses_with_jds_for_user,
    cv_families,
    interview_history,
    visible_jds,
)
from src.services.assistant.router.models import NavSlots
from src.services.assistant.text import fold_diacritics
from src.services.assistant.ui_registry import load_routes
from src.services.cv_versions import family_of
from src.services.cv_versions import label as cv_version_label

ResolveStatus = Literal["found", "multiple", "none", "needs_info"]
T = TypeVar("T")


class Target(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    ref: str = Field(min_length=1)
    route_id: str = Field(min_length=1)
    params: dict[str, str]
    label: str = Field(min_length=1)
    sublabel: str | None = None


class ResolveResult(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    status: ResolveStatus
    targets: list[Target] = Field(max_length=5)


@dataclass(frozen=True)
class ResolutionContext:
    user: User
    db: Session
    now: datetime | None = None

    @property
    def user_id(self) -> str:
        return self.user.id


def _fold(value: str) -> str:
    value = unicodedata.normalize("NFC", value.casefold())
    return " ".join(fold_diacritics(value).replace("\u0111", "d").split())


def _target(route_id: str, params: dict[str, str], label: str, sublabel: str | None = None) -> Target:
    return Target(ref=uuid.uuid4().hex, route_id=route_id, params=params, label=label, sublabel=sublabel)


def _page_target(route_id: str, role: str) -> Target | None:
    entry = load_routes().get(route_id)
    if entry is None or role not in entry.roles or entry.params:
        return None
    label = entry.labels_en[0] if entry.labels_en else entry.path_template
    return _target(route_id, {}, label)


def _list_target(target: str, role: str) -> Target | None:
    route_id = {"cv": "cv_list", "jd": "jd_list", "analysis": "analysis_new", "interview": "interview_history"}.get(target)
    return _page_target(route_id, role) if route_id else None


def _score(query: str, names: list[str]) -> float:
    folded_query = _fold(query)
    query_words = set(folded_query.split())
    best = 0.0
    for name in names:
        folded_name = _fold(name)
        if not folded_name:
            continue
        ratio = SequenceMatcher(None, folded_query, folded_name).ratio()
        name_words = set(folded_name.split())
        token = len(query_words & name_words) / max(len(query_words), len(name_words), 1)
        if folded_query in folded_name or folded_name in folded_query:
            ratio = max(ratio, 0.88)
        best = max(best, ratio, token)
    return best


def _ranked(
    query: str,
    values: list[T],
    names: Callable[[T], list[str]],
    *,
    threshold: float = 0.52,
    margin: float = 0.12,
) -> tuple[list[T], bool]:
    ranked = sorted(((value, _score(query, names(value))) for value in values), key=lambda row: row[1], reverse=True)
    if not ranked or ranked[0][1] < threshold:
        return [], False
    top = ranked[0][1]
    qualified = [(value, score) for value, score in ranked if score >= threshold]
    matches = [value for value, score in qualified if top - score < margin]
    ambiguous = len(matches) > 1
    if ambiguous:
        # Keep every tied top candidate (up to the contract limit), not merely five rows
        # selected by an unstable database order.
        return matches[:5], True
    return [ranked[0][0]], False


def _local_date_label(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(assistant_timezone()).strftime("%d/%m %H:%M")


def resolve_page(ctx: ResolutionContext, hint: str | None) -> ResolveResult:
    if not hint:
        return ResolveResult(status="needs_info", targets=[])
    entries = [
        (route_id, entry)
        for route_id, entry in load_routes().items()
        if ctx.user.role in entry.roles and not entry.params
    ]
    candidates = []
    for route_id, entry in entries:
        labels = [*entry.labels_vi, *entry.labels_en, *entry.aliases, entry.path_template]
        candidates.append((route_id, entry, labels))
    ranked, ambiguous = _ranked(hint, candidates, lambda item: item[2], threshold=0.4, margin=0.1)
    if not ranked:
        return ResolveResult(status="none", targets=[])
    targets = [
        _target(route_id, {}, (entry.labels_en or entry.labels_vi or [route_id])[0])
        for route_id, entry, _ in ranked
    ]
    return ResolveResult(status="multiple" if ambiguous else "found", targets=targets)


def _cv_rows(db: Session, user_id: str) -> list[tuple[CvVersion, list[CvVersion]]]:
    rows = []
    for family in cv_families(db, user_id):
        if family:
            rows.append((family[0], family))
    return rows


def _cv_names(row: tuple[CvVersion, list[CvVersion]]) -> list[str]:
    head, versions = row
    return [PurePath(version.file_name).stem for version in versions] + [head.file_name]


def _cv_target(row: tuple[CvVersion, list[CvVersion]]) -> Target:
    head, versions = row
    family = family_of(head)
    return _target(
        "cv_detail",
        {"cv_id": family},
        head.file_name,
        f"{cv_version_label(head)} · {len(versions)} version(s)",
    )


def _jd_names(jd: JobDescription) -> list[str]:
    return [f"{jd.title} {jd.company or ''}".strip(), jd.title, jd.company or ""]


def _jd_target(jd: JobDescription) -> Target:
    company = f" · {jd.company}" if jd.company else ""
    return _target("jd_detail", {"jd_id": jd.id}, f"{jd.title}{company}", jd.level or jd.source)


def _analysis_target(analysis: GapAnalysis, jd: JobDescription) -> Target:
    cv = analysis.cv_label or analysis.cv_file_name
    title = f"{cv} vs {jd.title}"
    sublabel = f"{_local_date_label(analysis.created_at)} · {analysis.status}"
    return _target("analysis_detail", {"analysis_id": analysis.id}, title, sublabel)


def _interview_target(session: InterviewSession, jd: JobDescription, *, report: bool = False) -> Target:
    route = "interview_report" if report else "interview_session"
    label = f"{jd.title} interview"
    sublabel = f"{_local_date_label(session.created_at)} · {session.status}"
    return _target(route, {"session_id": session.id}, label, sublabel)


def _cv_resolution(ctx: ResolutionContext, db: Session, slots: NavSlots) -> ResolveResult:
    candidates = _cv_rows(db, ctx.user_id)
    if slots.latest:
        chosen = sorted(candidates, key=lambda row: row[0].uploaded_at, reverse=True)[:1]
        return ResolveResult(status="found", targets=[_cv_target(row) for row in chosen]) if chosen else _none("cv", ctx.user.role)
    if not slots.free_ref:
        return ResolveResult(status="needs_info", targets=[])
    matches, ambiguous = _ranked(slots.free_ref, candidates, _cv_names)
    if not matches:
        recent = sorted(candidates, key=lambda row: row[0].uploaded_at, reverse=True)[:3]
        return ResolveResult(status="none", targets=[*[_cv_target(row) for row in recent], *_list_targets("cv", ctx.user.role)][:5])
    return ResolveResult(status="multiple" if ambiguous else "found", targets=[_cv_target(row) for row in matches])


def _jd_resolution(ctx: ResolutionContext, db: Session, slots: NavSlots) -> ResolveResult:
    candidates = visible_jds(db, ctx.user)
    if slots.latest:
        newest = sorted(candidates, key=lambda jd: jd.created_at, reverse=True)[:1]
        return ResolveResult(status="found", targets=[_jd_target(jd) for jd in newest]) if newest else _none("jd", ctx.user.role)
    if not slots.free_ref:
        return ResolveResult(status="needs_info", targets=[])
    matches, ambiguous = _ranked(slots.free_ref, candidates, _jd_names)
    if not matches:
        recent = sorted(candidates, key=lambda jd: jd.created_at, reverse=True)[:3]
        return ResolveResult(status="none", targets=[*[_jd_target(jd) for jd in recent], *_list_targets("jd", ctx.user.role)][:5])
    return ResolveResult(status="multiple" if ambiguous else "found", targets=[_jd_target(jd) for jd in matches])


def _analyses_for_candidates(
    db: Session,
    user_id: str,
    jds: list[JobDescription],
    cv_families_found: list[tuple[CvVersion, list[CvVersion]]] | None = None,
) -> list[tuple[GapAnalysis, JobDescription]]:
    cv_ids = {cv.id for _, versions in cv_families_found for cv in versions} if cv_families_found is not None else None
    analyses = analyses_for_jds(db, user_id, [jd.id for jd in jds], cv_version_ids=cv_ids)
    by_jd: dict[str, list[GapAnalysis]] = {}
    for analysis in analyses:
        by_jd.setdefault(analysis.jd_id, []).append(analysis)
    result = []
    for jd in jds:
        matching = by_jd.get(jd.id, [])
        if not matching:
            continue
        completed = next((analysis for analysis in matching if analysis.status == "completed"), None)
        result.append((completed or matching[0], jd))
    return result


def _analysis_resolution(ctx: ResolutionContext, db: Session, slots: NavSlots) -> ResolveResult:
    visible = visible_jds(db, ctx.user)
    if not slots.jd_ref and slots.latest:
        cv_matches = None
        if slots.cv_ref:
            cv_matches, _ = _ranked(slots.cv_ref, _cv_rows(db, ctx.user_id), _cv_names)
            if not cv_matches:
                return _none("analysis", ctx.user.role, db=db, user_id=ctx.user_id)
        cv_ids = {cv.id for _, versions in cv_matches for cv in versions} if cv_matches is not None else None
        candidates = analyses_with_jds_for_user(db, ctx.user_id)
        if cv_ids is not None:
            candidates = [(analysis, jd) for analysis, jd in candidates if analysis.cv_version_id in cv_ids]
        selected = next(
            (row for row in candidates if row[0].status == "completed"),
            candidates[0] if candidates else None,
        )
        if selected:
            return ResolveResult(status="found", targets=[_analysis_target(*selected)])
        return _none("analysis", ctx.user.role, db=db, user_id=ctx.user_id)
    if slots.jd_ref:
        jds_found, jd_ambiguous = _ranked(slots.jd_ref, visible, _jd_names)
        if not jds_found:
            return _none("analysis", ctx.user.role, db=db, user_id=ctx.user_id)
    else:
        return ResolveResult(status="needs_info", targets=[])

    cv_matches = None
    cv_ambiguous = False
    if slots.cv_ref:
        cvs = _cv_rows(db, ctx.user_id)
        cv_matches, cv_ambiguous = _ranked(slots.cv_ref, cvs, _cv_names)
        if not cv_matches:
            return _none("analysis", ctx.user.role, db=db, user_id=ctx.user_id)

    rows = _analyses_for_candidates(db, ctx.user_id, jds_found, cv_matches)
    if not rows:
        return _none("analysis", ctx.user.role, db=db, user_id=ctx.user_id)
    rows.sort(key=lambda pair: (pair[0].created_at, pair[0].id), reverse=True)
    if jd_ambiguous or cv_ambiguous:
        # Return one newest eligible analysis per ambiguous resource candidate.
        keyed: dict[tuple[str, str], tuple[GapAnalysis, JobDescription]] = {}
        for row in rows:
            key = (row[1].id, row[0].cv_version_id if cv_matches is not None else "")
            keyed.setdefault(key, row)
        rows = list(keyed.values())
    else:
        rows = rows[:1]
    return ResolveResult(
        status="multiple" if len(rows) > 1 else "found",
        targets=[_analysis_target(analysis, jd) for analysis, jd in rows[:5]],
    )


def _interview_resolution(ctx: ResolutionContext, db: Session, slots: NavSlots, *, report: bool = False) -> ResolveResult:
    span = parse_local_date_range(slots.when_expr, now=ctx.now) if slots.when_expr else None
    if slots.when_expr and span is None:
        return ResolveResult(status="needs_info", targets=[])
    bounds = local_range_to_utc_naive(span) if span else (None, None)
    rows = interview_history(db, ctx.user_id, *bounds)
    if report:
        rows = [row for row in rows if row[0].status == "completed"]
    if slots.latest:
        rows = rows[:1]
    if rows:
        return ResolveResult(
            status="multiple" if len(rows) > 1 else "found",
            targets=[_interview_target(session, jd, report=report) for session, jd in rows[:5]],
        )
    return _none("interview", ctx.user.role, db=db, user_id=ctx.user_id, requested=span)


def _list_targets(target: str, role: str) -> list[Target]:
    target = _list_target(target, role)
    return [target] if target else []


def _none(
    target: str,
    role: str,
    *,
    db: Session | None = None,
    user_id: str | None = None,
    requested: LocalDateRange | None = None,
) -> ResolveResult:
    suggestions: list[Target] = []
    if db is not None and user_id is not None:
        if target == "interview":
            rows = interview_history(db, user_id)
            if requested and rows:
                tz = assistant_timezone()
                last_requested_day = requested.end - timedelta(days=1)

                def distance(pair: tuple[InterviewSession, JobDescription]) -> int:
                    local_day = pair[0].created_at.replace(tzinfo=UTC).astimezone(tz).date()
                    if local_day < requested.start:
                        return (requested.start - local_day).days
                    if local_day > last_requested_day:
                        return (local_day - last_requested_day).days
                    return 0

                rows.sort(key=lambda pair: pair[0].created_at, reverse=True)
                rows.sort(key=distance)
                rows = rows[:2]
            else:
                rows = rows[:3]
            suggestions = [_interview_target(session, jd) for session, jd in rows]
        elif target == "analysis":
            rows = analyses_with_jds_for_user(db, user_id)
            suggestions = [_analysis_target(analysis, jd) for analysis, jd in rows[:3]]
    return ResolveResult(status="none", targets=[*suggestions, *_list_targets(target, role)][:5])


def resolve(ctx: ResolutionContext, slots: NavSlots) -> ResolveResult:
    """Resolve a navigation request; all record reads are owner-scoped in SQL."""
    db = ctx.db
    if slots.target == "page":
        return resolve_page(ctx, slots.page_hint)
    if slots.target == "cv":
        return _cv_resolution(ctx, db, slots)
    if slots.target == "jd":
        return _jd_resolution(ctx, db, slots)
    if slots.target == "analysis":
        return _analysis_resolution(ctx, db, slots)
    if slots.target in {"interview", "report"}:
        return _interview_resolution(ctx, db, slots, report=slots.target == "report")
    return ResolveResult(status="needs_info", targets=[])
