"""Service gợi ý JD phù hợp từ CV (Task A3: Two-Stage Retrieval & Scoring Pipeline)."""

import asyncio
import json
import re
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db.models import JobDescription
from src.services.fit_summary import compose_summary
from src.services.jd_requirements import requirements_for
from src.services.jd_store import get_jd_store
from src.services.skill_matching import (
    assess_by_rules,
    compute_score,
    lift_parents,
    match_label,
    normalize_requirements,
    split_cv_lines,
    strip_bullet,
)

_FIXTURE_PATH = Path("src/db/fixtures/jd_library.json")
_FIXTURE_CACHE: dict[str, dict[str, Any]] | None = None


def _get_fixture_jds() -> dict[str, dict[str, Any]]:
    """Bộ nhớ đệm đọc các JD từ file fixtures/jd_library.json để hỗ trợ fallback khi không có DB."""
    global _FIXTURE_CACHE
    if _FIXTURE_CACHE is None:
        if _FIXTURE_PATH.exists():
            with open(_FIXTURE_PATH, encoding="utf-8") as f:
                items = json.load(f)
                _FIXTURE_CACHE = {item["id"]: item for item in items}
        else:
            _FIXTURE_CACHE = {}
    return _FIXTURE_CACHE


def extract_cv_query(cv_text: str, max_lines: int = 50) -> str:
    """
    Trích xuất truy vấn ngắn gọn từ CV:
    Chỉ lấy các dòng nội dung thuộc phần Kỹ năng (skills), Kinh nghiệm (experience), Dự án (projects)
    để tránh loãng vector ngữ nghĩa bởi các thông tin ngoài lề (sở thích, thông tin liên hệ...).
    """
    excluded_headers = (
        "sở thích",
        "hobby",
        "hobbies",
        "người tham chiếu",
        "tham khảo",
        "reference",
        "references",
        "liên hệ",
        "contact",
        "thông tin cá nhân",
    )

    relevant_lines = []
    current_ignored = False

    for raw in cv_text.splitlines():
        trimmed = raw.strip()
        if not trimmed:
            continue

        lower = trimmed.lower()
        clean_head = re.sub(r"^[#*\-•●▪+\s]+", "", lower).strip().rstrip(":")

        # Nhận diện dòng tiêu đề mục
        if trimmed.startswith("#") or (len(trimmed) <= 30 and (":" in trimmed or trimmed.isupper())):
            current_ignored = any(kw in clean_head for kw in excluded_headers)
            if current_ignored:
                continue

        if current_ignored:
            continue

        if trimmed.startswith("#"):
            continue

        clean_text = strip_bullet(trimmed)
        if clean_text:
            relevant_lines.append(clean_text)

    query_text = " ".join(relevant_lines[:max_lines]).strip()
    if not query_text:
        query_text = cv_text[:500].strip()
    return query_text


# Thư viện tới mức này thì chấm theo quy tắc cho mọi JD (vài mili-giây mỗi JD), không lọc trước bằng vector:
# lọc top-6 trên 8 JD từng loại mất vị trí hợp nhất vì mô hình embedding chưa hiểu tốt tiếng Việt
SCORE_ALL_LIBRARY_MAX = 200


def _published_library(db: Session) -> list[JobDescription]:
    return list(
        db.scalars(
            select(JobDescription).where(
                JobDescription.source == "library",
                (JobDescription.status.is_(None)) | (JobDescription.status == "published"),
            )
        )
    )


def _known_result(known: dict[str, Any]) -> dict[str, Any]:
    """Kết quả gợi ý lấy từ lượt phân tích đã có của đúng CV và JD đó (khớp điểm sinh viên đã thấy)."""
    requirements = known.get("requirements") or []
    score = known.get("match_score")
    return {
        "match_score": score,
        "match_label": match_label(score),
        "matched_skills": [r["skill"] for r in requirements if r.get("status") == "matched"],
        "partial_skills": [r["skill"] for r in requirements if r.get("status") == "partial"],
        "missing_skills": [r["skill"] for r in requirements if r.get("status") == "missing"],
        "breakdown": known.get("breakdown") or [],
        "score_source": "analysis",
        "analysis_id": known.get("analysis_id"),
    }


def recommend_top_jds_from_cv(
    cv_text: str,
    db: Session | None = None,
    top_n: int = 3,
    candidate_pool_size: int = 6,
    known_scores: dict[str, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """
    Gợi ý JD từ CV:
    1. Ứng viên: có DB thì mọi JD đang hiển thị trong thư viện (thư viện nhỏ); không có DB thì candidate_pool_size JD
       gần nhất qua Chroma Vector Store.
    2. Chấm CV–JD Matching Score theo PRD 5.2 (trọng số w=3,2,1) bằng quy tắc. JD đã có lượt phân tích của đúng CV
       này (known_scores) thì dùng điểm của lượt phân tích để gợi ý khớp với kết quả sinh viên đã xem.
    3. Sắp theo Matching Score giảm dần, bằng điểm thì theo độ tương đồng ngữ nghĩa; trả về Top-N.
    """
    if not cv_text or not cv_text.strip():
        return []

    cv_lines = split_cv_lines(cv_text)
    query_text = extract_cv_query(cv_text)
    known_scores = known_scores or {}
    jd_store = get_jd_store()

    library = _published_library(db) if db is not None else []
    db_jds: dict[str, Any] = {}
    metadata: dict[str, dict[str, Any]] = {}
    if library and len(library) <= SCORE_ALL_LIBRARY_MAX:
        db_jds = {jd.id: jd for jd in library}
        sims = {
            doc.metadata.get("jd_id"): float(sim)
            for doc, sim in jd_store.search_candidates(query_text=query_text, top_k=len(library))
        }
        pool = [(jd.id, sims.get(jd.id, 0.0)) for jd in library]
    else:
        # Stage 1: Dense Retrieval qua Vector Store
        candidates = jd_store.search_candidates(query_text=query_text, top_k=candidate_pool_size)
        if not candidates:
            return []
        pool = [(doc.metadata.get("jd_id"), sim) for doc, sim in candidates]
        metadata = {doc.metadata.get("jd_id"): doc.metadata for doc, _ in candidates}
        jd_ids = [jd_id for jd_id, _ in pool if jd_id]
        if db is not None and jd_ids:
            db_records = db.scalars(select(JobDescription).where(JobDescription.id.in_(jd_ids))).all()
            db_jds = {jd.id: jd for jd in db_records}

    fixtures = _get_fixture_jds()

    scored_jds: list[dict[str, Any]] = []
    for jd_id, sim_score in pool:
        if not jd_id:
            continue
        doc_meta = metadata.get(jd_id, {})

        # Lấy thông tin chi tiết của JD
        jd_obj = db_jds.get(jd_id)
        # JD đã ẩn khỏi thư viện (kho vector có thể chưa kịp cập nhật) không được gợi ý
        if jd_obj is not None and (jd_obj.source != "library" or jd_obj.status == "hidden"):
            continue
        if jd_obj:
            title = jd_obj.title
            company = jd_obj.company or ""
            industry = jd_obj.industry or ""
            level = jd_obj.level or ""
            raw_skills = jd_obj.skills or []
        elif jd_id in fixtures:
            fix_item = fixtures[jd_id]
            title = fix_item.get("title", "")
            company = fix_item.get("company", "")
            industry = fix_item.get("industry", "")
            level = fix_item.get("level", "")
            raw_skills = fix_item.get("skills", [])
        else:
            title = doc_meta.get("title", "")
            company = doc_meta.get("company", "")
            industry = doc_meta.get("industry", "")
            level = doc_meta.get("level", "")
            raw_skills = []

        base = {
            "jd_id": jd_id,
            "title": title,
            "company": company,
            "industry": industry,
            "level": level,
            "semantic_score": round(float(sim_score), 4),
        }
        if jd_id in known_scores:
            scored_jds.append({**base, **_known_result(known_scores[jd_id])})
            continue

        # Stage 2: Tính Matching Score theo rubric PRD 5.2 (ước tính bằng quy tắc, chưa gọi AI)
        requirements = normalize_requirements(raw_skills)
        assessments = [assess_by_rules(req, cv_lines) for req in requirements]
        match_score, breakdown = compute_score(assessments)

        scored_jds.append(
            {
                **base,
                "match_score": match_score,
                "match_label": match_label(match_score),
                "matched_skills": [a["skill"] for a in assessments if a["status"] == "matched"],
                "partial_skills": [a["skill"] for a in assessments if a["status"] == "partial"],
                "missing_skills": [a["skill"] for a in assessments if a["status"] == "missing"],
                "breakdown": breakdown,
                "assessments": assessments,
                "score_source": "estimate",
                "analysis_id": None,
            }
        )

    # Sắp xếp theo: Match Score (%) giảm dần, nếu bằng nhau thì so sánh semantic_score
    scored_jds.sort(
        key=lambda x: (
            x["match_score"] if x["match_score"] is not None else -1,
            x["semantic_score"],
        ),
        reverse=True,
    )

    return scored_jds[:top_n]


async def generate_career_advice_with_llm(
    cv_summary: str,
    recommendations: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    RAG Generation Step: Sử dụng LLM để phân tích kết quả đối sánh và sinh lời khuyên nghề nghiệp cá nhân hóa.
    Có cơ chế fallback quy tắc tự động nếu không có kết nối LLM hoặc đang chạy offline.
    """
    if not recommendations:
        return {
            "summary": "Chưa đủ dữ liệu để đưa ra tư vấn nghề nghiệp.",
            "top_position_advice": "Vui lòng cung cấp nội dung CV chi tiết hơn.",
            "action_plan": ["Cập nhật thêm kỹ năng chuyên môn và kinh nghiệm dự án."],
        }

    top_jd = recommendations[0]
    top_title = top_jd.get("title", "Vị trí tuyển dụng")
    top_score = top_jd.get("match_score", 0)
    matched = ", ".join(top_jd.get("matched_skills", [])) or "kỹ năng cơ bản"
    missing = ", ".join(top_jd.get("missing_skills", [])) or "không có"

    # Fallback mặc định theo quy tắc (Rule-based Fallback)
    fallback_advice = {
        "summary": f"Hồ sơ của bạn phù hợp nhất với vị trí {top_title} với độ tương thích {top_score}%.",
        "top_position_advice": (
            f"Bạn đã có thế mạnh ở các kỹ năng: {matched}. Đây là nền tảng rất tốt để ứng tuyển vị trí {top_title}."
        ),
        "action_plan": [
            f"Bổ sung và trau dồi các kỹ năng còn thiếu: {missing}."
            if missing != "không có"
            else "Tiếp tục hoàn thiện các dự án thực tế.",
            "Lượng hóa kết quả công việc trong CV theo phương pháp STAR.",
            "Tham gia luyện phỏng vấn thử trên hệ thống cho vị trí này.",
        ],
    }

    try:
        from src.services.llm import invoke_json, llm_configured

        if not llm_configured():
            return fallback_advice

        prompt = (
            "Bạn là Chuyên gia Cố vấn Nghề nghiệp AI (AI Career Advisor). Dưới đây là kết quả đối sánh hồ sơ sinh viên "
            "với vị trí công việc phù hợp nhất được truy xuất từ hệ thống RAG:\n\n"
            f"--- HỒ SƠ ỨNG VIÊN TÓM TẮT ---\n{cv_summary[:800]}\n\n"
            f"--- VỊ TRÍ PHÙ HỢP HÀNG ĐẦU ---\n"
            f"- Vị trí: {top_title} (Doanh nghiệp: {top_jd.get('company', 'N/A')})\n"
            f"- Điểm phù hợp CV–JD: {top_score}%\n"
            f"- Kỹ năng đã đáp ứng: {matched}\n"
            f"- Kỹ năng còn thiếu theo yêu cầu: {missing}\n\n"
            "Hãy đưa ra nhận xét súc tích và lời khuyên mang tính hành động. "
            "CHỈ trả về JSON hợp lệ với cấu trúc sau, không giải thích gì thêm:\n"
            "{\n"
            '  "summary": "Nhận xét tổng quan về thế mạnh và độ phù hợp thị trường của sinh viên (2-3 câu ngắn gọn)",\n'
            '  "top_position_advice": "Lời khuyên riêng cho vị trí số 1: lý do tại sao hợp và cần phát huy điều gì",\n'
            '  "action_plan": [\n'
            '    "Hành động 1: Cần học thêm kỹ năng gì còn thiếu",\n'
            '    "Hành động 2: Cải thiện cách trình bày dự án",\n'
            '    "Hành động 3: Bước tiếp theo để chuẩn bị phỏng vấn"\n'
            "  ]\n"
            "}"
        )

        data = await invoke_json(prompt, temperature=0.3, timeout=15.0)
        return {
            "summary": str(data.get("summary") or fallback_advice["summary"]),
            "top_position_advice": str(data.get("top_position_advice") or fallback_advice["top_position_advice"]),
            "action_plan": list(data.get("action_plan") or fallback_advice["action_plan"]),
        }
    except Exception:
        import logging

        logging.getLogger(__name__).warning("Không thể gọi LLM sinh Career Advice. Dùng fallback.")
        return fallback_advice


async def compare_single_jd_with_llm(
    cv_lines: list[dict[str, Any]],
    jd_info: dict[str, Any],
) -> dict[str, Any]:
    """
    So khớp CV với một JD bằng LLM (sử dụng score_with_llm từ node compare_gap).
    - Gọi LLM phân tích ngữ nghĩa sâu từng yêu cầu kỹ năng của JD đối chiếu với CV.
    - Có kiểm tra chéo và fallback an toàn theo bộ quy tắc nếu LLM không cấu hình hoặc timeout.
    """
    raw_skills = jd_info.get("skills") or []
    requirements = normalize_requirements(raw_skills)
    requirements_source = jd_info.get("requirements_source", "given")
    rule_results = {r["id"]: assess_by_rules(r, cv_lines) for r in requirements}

    llm_data: dict[str, Any] | None = None
    from src.services.llm import llm_configured

    if requirements and llm_configured():
        try:
            from src.agents.gap_analysis.nodes.compare_gap import score_with_llm

            llm_data = await score_with_llm(cv_lines, requirements, [])
        except Exception:
            import logging

            logging.getLogger(__name__).warning(
                "Gọi LLM so khớp JD thất bại. Dùng fallback quy tắc.",
            )

    from src.agents.gap_analysis.nodes.compare_gap import _merge

    lines_by_no = {line["line_no"]: line for line in cv_lines}
    llm_items = {}
    if llm_data:
        for item in llm_data.get("requirements") or []:
            if isinstance(item, dict) and item.get("id"):
                llm_items[str(item["id"])] = item

    assessments = [_merge(r, rule_results[r["id"]], llm_items.get(r["id"]), lines_by_no) for r in requirements]
    assessments = lift_parents(requirements, assessments, lines_by_no)
    match_score, breakdown = compute_score(assessments)

    return {
        "jd_id": jd_info["jd_id"],
        "title": jd_info["title"],
        "company": jd_info.get("company"),
        "industry": jd_info.get("industry"),
        "level": jd_info.get("level"),
        "match_score": match_score,
        "match_label": match_label(match_score),
        "matched_skills": [a["skill"] for a in assessments if a["status"] == "matched"],
        "partial_skills": [a["skill"] for a in assessments if a["status"] == "partial"],
        "missing_skills": [a["skill"] for a in assessments if a["status"] == "missing"],
        "breakdown": breakdown,
        # Ghép từ bảng cuối (không dùng lời của LLM) để nhận xét luôn khớp với các chấm trong bảng kỹ năng
        "llm_summary": compose_summary(assessments, cv_lines),
        "llm_used": llm_data is not None,
        "requirement_count": len(requirements),
        "requirements_source": requirements_source,
    }


async def compare_selected_jds_with_llm(
    cv_text: str,
    jd_ids: list[str],
    db: Session | None = None,
) -> dict[str, Any]:
    """
    So sánh một CV với 2–3 JD bằng LLM (Multi-JD LLM Matching Pipeline):
    1. Lấy thông tin chi tiết từng JD từ DB hoặc fixture.
    2. Chạy so khớp ngữ nghĩa sâu qua LLM song song cho từng JD bằng asyncio.gather.
    3. Sắp xếp danh sách kết quả theo match_score giảm dần.
    4. Gán thứ hạng rank (1, 2, 3...) sau khi sắp xếp.
    5. Tổng hợp common_missing_skills (kỹ năng mà tất cả các JD được chọn đều yêu cầu nhưng CV còn thiếu).
    """
    if not cv_text or not cv_text.strip():
        return {
            "comparisons": [],
            "common_missing_skills": [],
        }

    cv_lines = split_cv_lines(cv_text)

    # 1. Lấy thông tin JD từ DB hoặc fixtures
    db_jds: dict[str, Any] = {}
    if db is not None and jd_ids:
        db_records = db.scalars(select(JobDescription).where(JobDescription.id.in_(jd_ids))).all()
        db_jds = {jd.id: jd for jd in db_records}

    fixtures = _get_fixture_jds()
    jd_items: list[dict[str, Any]] = []

    for jd_id in jd_ids:
        jd_obj = db_jds.get(jd_id)
        # So sánh nhận JD thư viện đang hiển thị và JD sinh viên tự dán (API đã kiểm tra quyền sở hữu);
        # bỏ JD thư viện đã ẩn và JD tự dán đã xoá.
        if jd_obj is not None and (
            (jd_obj.source == "library" and jd_obj.status == "hidden")
            or (jd_obj.source == "pasted" and jd_obj.status == "deleted")
        ):
            continue
        if jd_obj:
            jd_items.append(
                {
                    "jd_id": jd_id,
                    "title": jd_obj.title,
                    "company": jd_obj.company or "",
                    "industry": jd_obj.industry or "",
                    "level": jd_obj.level or "",
                    "skills": jd_obj.skills or [],
                    "jd_obj": jd_obj,
                }
            )
        elif jd_id in fixtures:
            fix_item = fixtures[jd_id]
            jd_items.append(
                {
                    "jd_id": jd_id,
                    "title": fix_item.get("title", ""),
                    "company": fix_item.get("company", ""),
                    "industry": fix_item.get("industry", ""),
                    "level": fix_item.get("level", ""),
                    "skills": fix_item.get("skills", []),
                }
            )

    if not jd_items:
        return {
            "comparisons": [],
            "common_missing_skills": [],
        }

    # JD tự dán chỉ có kỹ năng theo từ điển (thường thiếu nhiều yêu cầu): trích lại bằng AI như ở Phân tích.
    # Chạy lần lượt vì cùng dùng một phiên DB để lưu kết quả trích.
    if db is not None:
        for jd_info in jd_items:
            jd_obj = jd_info.pop("jd_obj", None)
            if jd_obj is not None:
                jd_info["skills"], jd_info["requirements_source"] = await requirements_for(db, jd_obj)

    # 2. Chạy LLM đối soát song song cho tất cả các JD được chọn
    tasks = [compare_single_jd_with_llm(cv_lines, jd_info) for jd_info in jd_items]
    scored_items = await asyncio.gather(*tasks)
    scored_items = list(scored_items)

    # 3. Sắp xếp theo Match Score (%) giảm dần
    scored_items.sort(
        key=lambda x: x["match_score"] if x["match_score"] is not None else -1,
        reverse=True,
    )

    # 4. Gán rank 1, 2, 3...
    for rank, item in enumerate(scored_items, start=1):
        item["rank"] = rank

    # 5. Tìm common_missing_skills
    common_missing_skills: list[str] = []
    if scored_items:
        first_missing = scored_items[0]["missing_skills"]
        for skill in first_missing:
            skill_lower = skill.strip().lower()
            if all(
                any(other.strip().lower() == skill_lower for other in item["missing_skills"])
                for item in scored_items[1:]
            ):
                if skill not in common_missing_skills:
                    common_missing_skills.append(skill)

    return {
        "comparisons": scored_items,
        "common_missing_skills": common_missing_skills,
    }
