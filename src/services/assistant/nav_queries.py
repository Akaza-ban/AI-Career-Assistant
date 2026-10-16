"""Read-only queries needed by assistant navigation resolvers."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db.models import CvVersion, GapAnalysis, InterviewSession, JobDescription, User
from src.services import cv_versions, jds


def cv_families(db: Session, user_id: str) -> list[list[CvVersion]]:
    """Reuse the product's owner-scoped CV family/version query."""
    return cv_versions.families(db, user_id)


def visible_jds(db: Session, user: User) -> list[JobDescription]:
    """Reuse the product's published-library and owner-scoped pasted-JD queries."""
    return [*jds.published_library(db), *jds.list_pasted(db, user)]


def analyses_for_jd(
    db: Session,
    user_id: str,
    jd_id: str,
    *,
    cv_version_id: str | None = None,
) -> list[GapAnalysis]:
    """Read analysis rows for an owner and JD, newest first with a stable tie-break."""
    statement = select(GapAnalysis).where(GapAnalysis.owner_id == user_id, GapAnalysis.jd_id == jd_id)
    if cv_version_id is not None:
        statement = statement.where(GapAnalysis.cv_version_id == cv_version_id)
    statement = statement.order_by(GapAnalysis.created_at.desc(), GapAnalysis.id.desc())
    return list(db.scalars(statement))


def interview_history(
    db: Session,
    user_id: str,
    start_utc: datetime | None = None,
    end_utc: datetime | None = None,
) -> list[tuple[InterviewSession, JobDescription]]:
    """Return the owner's sessions, optionally in a half-open UTC range."""
    statement = (
        select(InterviewSession, JobDescription)
        .join(JobDescription, JobDescription.id == InterviewSession.jd_id)
        .where(InterviewSession.owner_id == user_id)
    )
    if start_utc is not None:
        statement = statement.where(InterviewSession.created_at >= start_utc)
    if end_utc is not None:
        statement = statement.where(InterviewSession.created_at < end_utc)
    statement = statement.order_by(InterviewSession.created_at.desc(), InterviewSession.id.desc())
    return list(db.execute(statement))
