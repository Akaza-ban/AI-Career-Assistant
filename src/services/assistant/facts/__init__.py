"""Owner-scoped, allowlisted result facts for Assistant v2."""

from __future__ import annotations

import json
import math
import re
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.config import get_settings
from src.db.models import GapAnalysis, JobDescription
from src.services import interview

_ALLOWLIST_PATH = Path(__file__).resolve().parents[1] / "data" / "facts_allowlist.json"
_NAME = re.compile(r"^[\w+#./ -]+$", re.UNICODE)
_STATUS = {"processing", "completed", "failed", "in_progress"}
_IMPORTANCE = {"required", "preferred", "additional"}
_REQ_STATUS = {"matched", "partial", "missing"}


@lru_cache(maxsize=1)
def facts_allowlist() -> dict[str, list[str]]:
    """Load the explicit facts schema; output builders only emit listed keys."""
    payload = json.loads(_ALLOWLIST_PATH.read_text(encoding="utf-8"))
    return {key: list(value) for key, value in payload.items()}


def _bounded_label(value: Any, *, skill: bool = False) -> str | None:
    if not isinstance(value, str):
        return None
    value = " ".join(value.split())
    maximum = get_settings().result_facts_max_field_chars
    if not value or len(value) > maximum or not _NAME.fullmatch(value):
        return None
    if skill and len(value.split()) > 6:
        return None
    return value


def _finite_number(value: Any, low: float, high: float) -> int | float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return None
    return value if low <= value <= high else None


def _date(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.isoformat(timespec="seconds")


def build_analysis_facts(db: Session, user_id: str, analysis_id: str) -> dict[str, Any] | None:
    """Read stored analysis scores for the owner; never invoke analysis/scoring services."""
    row = db.execute(
        select(GapAnalysis, JobDescription)
        .join(JobDescription, JobDescription.id == GapAnalysis.jd_id)
        .where(GapAnalysis.id == analysis_id, GapAnalysis.owner_id == user_id)
    ).first()
    if row is None:
        return None
    analysis, jd = row
    source: dict[str, Any] = {
        "status": analysis.status if analysis.status in _STATUS else None,
        "created_at": _date(analysis.created_at),
        "cv_label": _bounded_label(analysis.cv_label or analysis.cv_file_name),
        "jd_label": _bounded_label(" ".join(filter(None, (jd.title, jd.company)))),
        "overall_match_score": _finite_number(analysis.match_score, 0, 100),
        "category_scores": [],
        "required_matched_count": 0,
        "required_partial_count": 0,
        "required_missing_count": 0,
        "preferred_matched_count": 0,
        "preferred_partial_count": 0,
        "preferred_missing_count": 0,
        "missing_skills": [],
    }
    result = analysis.result if isinstance(analysis.result, dict) else {}
    for category in result.get("breakdown", []) if isinstance(result.get("breakdown"), list) else []:
        if not isinstance(category, dict) or category.get("importance") not in _IMPORTANCE:
            continue
        item = {
            "importance": category["importance"],
            "total": _finite_number(category.get("total"), 0, 1000),
            "matched": _finite_number(category.get("matched"), 0, 1000),
            "partial": _finite_number(category.get("partial"), 0, 1000),
            "missing": _finite_number(category.get("missing"), 0, 1000),
            "earned": _finite_number(category.get("earned"), 0, 1000),
            "possible": _finite_number(category.get("possible"), 0, 1000),
        }
        source["category_scores"].append(
            {key: item[key] for key in facts_allowlist()["analysis_category"]}
        )
    requirements = result.get("requirements", []) if isinstance(result.get("requirements"), list) else []
    missing_skills: list[str] = []
    for requirement in requirements:
        if not isinstance(requirement, dict):
            continue
        importance = requirement.get("importance")
        status = requirement.get("status")
        if importance not in {"required", "preferred"} or status not in _REQ_STATUS:
            continue
        source[f"{importance}_{status}_count"] += 1
        if status == "missing":
            skill = _bounded_label(requirement.get("skill"), skill=True)
            if skill and skill not in missing_skills:
                missing_skills.append(skill)
    source["missing_skills"] = missing_skills[:5]
    return {key: source[key] for key in facts_allowlist()["analysis"]}


def build_interview_facts(db: Session, user_id: str, session_id: str) -> dict[str, Any] | None:
    """Read stored session aggregates with owner filtering; no report/prose generation."""
    row = interview.read_result_facts_source(db, user_id, session_id)
    if row is None:
        return None
    session, jd, question_count, previous = row
    star = session.star if isinstance(session.star, dict) else {}
    source: dict[str, Any] = {
        "status": session.status if session.status in _STATUS else None,
        "started_at": _date(session.created_at),
        "position_label": _bounded_label(" ".join(filter(None, (jd.title, jd.company)))),
        "question_count": int(question_count),
        "overall_star_score": _finite_number(session.overall_score, 0, 5),
        "situation_average": _finite_number(star.get("situation"), 0, 5),
        "task_average": _finite_number(star.get("task"), 0, 5),
        "action_average": _finite_number(star.get("action"), 0, 5),
        "result_average": _finite_number(star.get("result"), 0, 5),
        "previous_session_score": _finite_number(previous.overall_score, 0, 5) if previous else None,
        "previous_session_date": _date(previous.completed_at) if previous else None,
    }
    return {key: source[key] for key in facts_allowlist()["interview"]}


def get_result_facts(db: Session, user_id: str, record_type: str, record_id: str) -> dict[str, Any] | None:
    """Dispatch only the two allowlisted owner-scoped facts readers."""
    if record_type == "analysis":
        return build_analysis_facts(db, user_id, record_id)
    if record_type == "interview":
        return build_interview_facts(db, user_id, record_id)
    return None
