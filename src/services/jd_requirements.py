"""Yêu cầu kỹ năng của một JD để chấm điểm, dùng chung cho Phân tích và So sánh (PRD 5.2)."""

import logging
from typing import Any, Literal

from sqlalchemy.orm import Session

from src.db.models import JobDescription

logger = logging.getLogger(__name__)

# Nguồn kỹ năng đáng tin, dùng thẳng không trích lại: AI tách khi dán, lượt phân tích trước, quản trị viên nhập
TRUSTED_SKILLS = ("ai", "analysis", "admin")

# given: yêu cầu có sẵn đáng tin (JD thư viện, JD tự dán đã trích bằng AI)
# llm: vừa trích bằng AI; dictionary: AI lỗi hoặc chưa cấu hình, chỉ còn kỹ năng nhận ra theo từ điển
RequirementsSource = Literal["given", "llm", "dictionary"]


def has_trusted_skills(jd: JobDescription) -> bool:
    return jd.source == "library" or jd.skills_source in TRUSTED_SKILLS


async def requirements_for(db: Session, jd: JobDescription) -> tuple[list[dict[str, Any]], RequirementsSource]:
    """
    Yêu cầu của JD kèm nguồn. JD tự dán chưa có kỹ năng đáng tin thì trích bằng AI (cùng prompt với bước
    Retrieve của Phân tích) và lưu lại; chỉ đánh dấu "analysis" khi AI trích được, để lần sau không trích lại.
    """
    if has_trusted_skills(jd):
        return list(jd.skills or []), "given"

    from src.agents.gap_analysis.nodes.retrieve_context import extract_requirements_with_llm
    from src.services.llm import llm_configured
    from src.services.skill_matching import normalize_requirements

    if llm_configured():
        try:
            extracted = normalize_requirements(await extract_requirements_with_llm(jd.content))
        except Exception as e:
            logger.warning("Trích yêu cầu JD %s bằng AI thất bại: %s. Dùng kỹ năng theo từ điển.", jd.id, e)
            extracted = []
        if extracted:
            jd.skills = [{"name": r["name"], "importance": r["importance"], "aliases": r["aliases"]} for r in extracted]
            jd.skills_source = "analysis"
            db.commit()
            return list(jd.skills), "llm"
    return list(jd.skills or []), "dictionary"
