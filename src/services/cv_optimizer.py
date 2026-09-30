"""
Trình tối ưu CV (US-SV-03, US-SV-05, PRD mục 6).

- Gợi ý lấy từ kết quả phân tích (đã qua guardrail grounding). SV chấp nhận / sửa tay / bỏ qua từng gợi ý; mọi quyết
  định được gom vào bản nháp và ghi Audit Trail (PRD 6.5). Gợi ý đã bỏ qua không được đề xuất lại (AC3).
- Kỹ năng JD yêu cầu mà CV chưa có: SV tự xác nhận; AI không tự thêm vào CV. Kỹ năng SV ghi là đang học chỉ vào mục
  "Kỹ năng đang phát triển", không nằm trong nội dung được chấm khi phân tích lại.
- "Hoàn tất" tạo đúng một phiên bản CV mới (không ghi đè bản cũ) kèm file DOCX, sau đó phiên tối ưu bị khoá.
"""

import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.api.errors import AppError
from src.db.models import CvEditAudit, CvExport, CvOptimization, CvVersion, GapAnalysis, JobDescription, User
from src.services import cv_files
from src.services.skill_matching import (
    BULLET_PREFIX,
    IMPORTANCE_LABELS,
    SECTION_LABELS,
    contains_term,
    match_label,
    split_cv_lines,
    strip_bullet,
)

MAX_EDIT_CHARS = 600
MAX_CONTEXT_CHARS = 500
MAX_LEARNING_NOTE_CHARS = 120
IMPORTANCE_ORDER = {"required": 0, "preferred": 1, "additional": 2}
STATUS_OF_ACTION = {"accept": "accepted", "edit": "edited", "reject": "rejected"}
DEVELOPING_TITLE = "Kỹ năng đang phát triển"


# ---------- Nội dung CV ----------


def cv_document(cv: CvVersion) -> dict[str, Any]:
    """Tách văn bản CV thành phần đầu (họ tên, liên hệ) và các mục; mỗi dòng giữ số dòng như lúc phân tích."""
    header: list[dict[str, Any]] = []
    sections: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    current_key = "header"
    for line in split_cv_lines(cv.content_text):
        item = {"id": f"l{line['line_no']}", "line_no": line["line_no"], "text": line["text"]}
        if line["is_heading"]:
            current = {"id": f"s{line['line_no']}", "title": line["text"], "lines": []}
            sections.append(current)
            current_key = line["block"]
        elif line["block"] == "header":
            header.append(item)
        else:
            # Mục viết cùng dòng với nội dung ("Kỹ năng: Python, SQL") không có dòng tiêu đề riêng
            if current is None or line["block"] != current_key:
                title = SECTION_LABELS.get(line["block"], line["block"])
                current = {"id": f"s{line['line_no']}", "title": title, "lines": []}
                sections.append(current)
                current_key = line["block"]
            current["lines"].append(item)
    return {"header": header, "sections": sections, "developing_skills": cv.developing_skills or []}


def apply_changes(text: str, replacements: dict[int, str]) -> str:
    """Thay các dòng theo số dòng (đếm như split_cv_lines), giữ nguyên ký tự đầu dòng và các dòng còn lại."""
    out: list[str] = []
    line_no = 0
    for raw in text.splitlines():
        if strip_bullet(raw):
            line_no += 1
            if line_no in replacements:
                prefix = BULLET_PREFIX.match(raw)
                out.append((prefix.group(0) if prefix else "") + replacements[line_no])
                continue
        out.append(raw)
    return "\n".join(out)


def _optimized_file_name(file_name: str, version: int) -> str:
    stem = re.sub(r"_v\d+$", "", Path(file_name).stem) or "CV"
    return f"{stem}_v{version}.docx"


# ---------- Gợi ý & kiểm tra kỹ năng ----------


def _suggestions(analysis: GapAnalysis, lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Gợi ý của lượt phân tích kèm dòng CV được thay; bỏ gợi ý không còn khớp nguyên văn dòng nào trong CV."""
    by_no = {line["line_no"]: line for line in lines}
    result = []
    for s in (analysis.result or {}).get("suggestions", []):
        line = by_no.get(s.get("line_no"))
        if line is None or line["text"] != s["original_text"]:
            # Lượt phân tích cũ chưa lưu số dòng: tìm theo nguyên văn
            line = next((x for x in lines if not x["is_heading"] and x["text"] == s["original_text"]), None)
        if line is not None:
            result.append({**s, "line_no": line["line_no"]})
    return result


def _kind(skill: str, original: str, proposed: str) -> str:
    """ats_keyword: câu mới dùng đúng tên kỹ năng trong JD mà câu gốc chưa có; còn lại là diễn đạt lại."""
    return "ats_keyword" if contains_term(skill, proposed) and not contains_term(skill, original) else "rephrase"


def _suggestion_out(s: dict[str, Any], decision: dict[str, Any] | None) -> dict[str, Any]:
    status = STATUS_OF_ACTION.get(decision["action"], "pending") if decision else "pending"
    return {
        "id": s["id"],
        "kind": _kind(s["skill"], s["original_text"], s["suggested_text"]),
        "skill": s["skill"],
        "line_id": f"l{s['line_no']}",
        "original_text": s["original_text"],
        "proposed_text": s["suggested_text"],
        "final_text": decision["final_text"] if status in ("accepted", "edited") else None,
        "rationale": s.get("reason", ""),
        "evidence_span": {"text": s["original_text"], "line_start": s["line_no"], "line_end": s["line_no"]},
        "status": status,
    }


def _missing(analysis: GapAnalysis) -> list[dict[str, Any]]:
    """Yêu cầu JD mà CV chưa có (Match = 0), nhóm Bắt buộc trước."""
    missing = [r for r in (analysis.result or {}).get("requirements", []) if r["status"] == "missing"]
    return sorted(missing, key=lambda r: IMPORTANCE_ORDER.get(r["importance"], 3))


def _check_out(requirement: dict[str, Any], jd: JobDescription, answer: dict[str, Any] | None) -> dict[str, Any]:
    status = "pending"
    if answer:
        status = "has_experience" if answer["has_experience"] else "no_experience"
    level = IMPORTANCE_LABELS.get(requirement["importance"], "").lower()
    return {
        "id": requirement["id"],
        "skill": requirement["skill"],
        "importance": requirement["importance"],
        "jd_requirement": f"Vị trí {jd.title} yêu cầu {requirement['skill']} (mức {level}), "
        "nhưng CV chưa thể hiện kỹ năng này.",
        "status": status,
        "context": answer.get("context") if answer else None,
        "learning_note": answer.get("learning_note") if answer else None,
    }


# ---------- Phiên tối ưu ----------


def _load(db: Session, user: User, analysis_id: str) -> tuple[GapAnalysis, CvVersion, CvOptimization]:
    analysis = db.get(GapAnalysis, analysis_id)
    if analysis is None or analysis.owner_id != user.id:
        raise AppError(404, "Không tìm thấy kết quả phân tích.", "analysis_not_found")
    if analysis.status != "completed":
        raise AppError(409, "Lượt phân tích chưa hoàn tất nên chưa mở được trình tối ưu.", "analysis_not_ready")
    cv = db.get(CvVersion, analysis.cv_version_id)
    if cv is None:
        raise AppError(
            409, "Phiên bản CV của lượt phân tích này đã bị xoá nên không mở được trình tối ưu.", "cv_deleted"
        )
    optimization = db.scalar(select(CvOptimization).where(CvOptimization.analysis_id == analysis.id))
    if optimization is None:
        optimization = CvOptimization(
            id=f"op_{uuid.uuid4().hex[:12]}",
            analysis_id=analysis.id,
            owner_id=user.id,
            decisions={},
            capability_answers={},
        )
        db.add(optimization)
        db.commit()
    return analysis, cv, optimization


def _require_draft(optimization: CvOptimization) -> None:
    if optimization.status != "draft":
        raise AppError(
            409,
            "Bạn đã hoàn tất phiên tối ưu này. Hãy phân tích lại phiên bản mới để tiếp tục tối ưu.",
            "optimization_finalized",
        )


def session(db: Session, user: User, analysis_id: str) -> dict[str, Any]:
    """Trạng thái Trình tối ưu; phiên bản CV trả về dạng ORM để router chuyển sang CvVersionResponse."""
    analysis, cv, optimization = _load(db, user, analysis_id)
    jd = db.get(JobDescription, analysis.jd_id)
    result = analysis.result or {}
    lines = split_cv_lines(cv.content_text)
    result_cv = db.get(CvVersion, optimization.result_cv_version_id) if optimization.result_cv_version_id else None
    answers = optimization.capability_answers or {}
    return {
        "analysis_id": analysis.id,
        "status": optimization.status,
        "jd": {
            "id": jd.id,
            "title": jd.title,
            "company": jd.company,
            "industry": jd.industry,
            "level": jd.level,
            "source": jd.source,
        },
        "match_score": analysis.match_score,
        "match_label": match_label(analysis.match_score),
        "llm_used": bool(result.get("llm_used")),
        "pending_review_count": result.get("pending_review_count", 0),
        "cv": cv,
        "result_cv": result_cv,
        "document": cv_document(cv),
        "result_document": cv_document(result_cv) if result_cv else None,
        "suggestions": [
            _suggestion_out(s, (optimization.decisions or {}).get(s["id"])) for s in _suggestions(analysis, lines)
        ],
        "capability_checks": [_check_out(r, jd, answers.get(r["id"])) for r in _missing(analysis)],
        "finalized_at": optimization.finalized_at,
    }


def decide(
    db: Session,
    user: User,
    analysis_id: str,
    suggestion_id: str,
    decision: str,
    edited_text: str | None,
    now: datetime,
) -> None:
    """Ghi quyết định của SV vào bản nháp và Audit Trail. undo đưa gợi ý về chờ duyệt."""
    analysis, cv, optimization = _load(db, user, analysis_id)
    _require_draft(optimization)
    suggestion = next(
        (s for s in _suggestions(analysis, split_cv_lines(cv.content_text)) if s["id"] == suggestion_id), None
    )
    if suggestion is None:
        raise AppError(404, "Không tìm thấy gợi ý.", "suggestion_not_found")

    decisions = dict(optimization.decisions or {})
    if decision == "undo":
        if suggestion_id not in decisions:
            return
        del decisions[suggestion_id]
        final = suggestion["original_text"]
    elif decision == "edit":
        # Mỗi gợi ý thay một dòng CV nên nội dung sửa được gộp thành một dòng
        final = " ".join((edited_text or "").split())
        if not final:
            raise AppError(422, "Hãy nhập nội dung chỉnh sửa.", "edited_text_required")
        if len(final) > MAX_EDIT_CHARS:
            raise AppError(422, f"Nội dung chỉnh sửa tối đa {MAX_EDIT_CHARS} ký tự.", "edited_text_too_long")
        if final == suggestion["original_text"]:
            raise AppError(
                422,
                "Nội dung chỉnh sửa đang giống câu gốc. Nếu không muốn thay đổi, hãy chọn Bỏ qua.",
                "edit_unchanged",
            )
    else:
        final = suggestion["suggested_text"] if decision == "accept" else suggestion["original_text"]
    if decision != "undo":
        decisions[suggestion_id] = {"action": decision, "final_text": final}

    optimization.decisions = decisions
    db.add(
        CvEditAudit(
            id=f"au_{uuid.uuid4().hex[:12]}",
            owner_id=user.id,
            analysis_id=analysis.id,
            suggestion_id=suggestion_id,
            cv_version_id=cv.id,
            original_content=suggestion["original_text"],
            ai_suggestion=suggestion["suggested_text"],
            evidence_line_no=suggestion["line_no"],
            evidence_text=suggestion["original_text"],
            reason=suggestion.get("reason", ""),
            action=decision,
            final_content=final,
            created_at=now,
        )
    )
    db.commit()


def answer_check(
    db: Session,
    user: User,
    analysis_id: str,
    requirement_id: str,
    has_experience: bool,
    context: str | None,
    learning_note: str | None,
    now: datetime,
) -> None:
    """Ghi câu trả lời kiểm tra kỹ năng thiếu (được đổi lại cho tới khi "Hoàn tất")."""
    analysis, _, optimization = _load(db, user, analysis_id)
    _require_draft(optimization)
    if requirement_id not in {r["id"] for r in _missing(analysis)}:
        raise AppError(404, "Không tìm thấy kỹ năng cần xác nhận.", "check_not_found")

    if has_experience:
        text = (context or "").strip()
        if not text:
            raise AppError(422, "Hãy mô tả ngắn kinh nghiệm của bạn với kỹ năng này.", "context_required")
        if len(text) > MAX_CONTEXT_CHARS:
            raise AppError(422, f"Mô tả kinh nghiệm tối đa {MAX_CONTEXT_CHARS} ký tự.", "context_too_long")
        answer = {"has_experience": True, "context": text, "learning_note": None}
    else:
        note = " ".join((learning_note or "").split()) or None
        if note and len(note) > MAX_LEARNING_NOTE_CHARS:
            raise AppError(422, f"Ghi chú đang học tối đa {MAX_LEARNING_NOTE_CHARS} ký tự.", "learning_note_too_long")
        answer = {"has_experience": False, "context": None, "learning_note": note}
    answer["answered_at"] = now.isoformat()
    optimization.capability_answers = {**(optimization.capability_answers or {}), requirement_id: answer}
    db.commit()


def finalize(db: Session, user: User, analysis_id: str, now: datetime) -> None:
    """Tạo một phiên bản CV mới từ bản nháp (câu đã chấp nhận / sửa tay, kỹ năng đang học) rồi khoá phiên."""
    analysis, cv, optimization = _load(db, user, analysis_id)
    _require_draft(optimization)

    suggestions = {s["id"]: s for s in _suggestions(analysis, split_cv_lines(cv.content_text))}
    replacements = {
        suggestions[sid]["line_no"]: d["final_text"]
        for sid, d in (optimization.decisions or {}).items()
        if d["action"] in ("accept", "edit") and sid in suggestions
    }
    missing = {r["id"]: r for r in _missing(analysis)}
    learning = [
        {"name": missing[rid]["skill"], "note": a["learning_note"]}
        for rid, a in (optimization.capability_answers or {}).items()
        if rid in missing and not a["has_experience"] and a.get("learning_note")
    ]
    if not replacements and not learning:
        raise AppError(
            422,
            "Chưa có thay đổi nào để lưu. Hãy áp dụng ít nhất một gợi ý hoặc ghi một kỹ năng bạn đang học.",
            "no_changes",
        )

    developing = {s["name"].lower(): s for s in cv.developing_skills or []}
    developing.update({s["name"].lower(): s for s in learning})
    version = (db.scalar(select(func.max(CvVersion.version)).where(CvVersion.owner_id == user.id)) or 0) + 1
    new_cv = CvVersion(
        id=f"cv_{uuid.uuid4().hex[:12]}",
        owner_id=user.id,
        version=version,
        file_name=_optimized_file_name(cv.file_name, version),
        file_type="docx",
        size_bytes=0,
        page_count=None,
        content_text=apply_changes(cv.content_text, replacements),
        origin="optimized",
        is_active=False,
        is_draft=False,
        uploaded_at=now,
        developing_skills=list(developing.values()) or None,
        source_analysis_id=analysis.id,
    )
    data = cv_files.build_docx(cv_document(new_cv), DEVELOPING_TITLE)
    new_cv.size_bytes = len(data)
    cv_files.save_file(user.id, new_cv.id, "docx", data)
    db.add(new_cv)
    optimization.status = "finalized"
    optimization.result_cv_version_id = new_cv.id
    optimization.finalized_at = now
    try:
        db.commit()
    except Exception:
        cv_files.delete_file(user.id, new_cv.id, "docx")
        raise


# ---------- Xuất CV ----------


def record_export(db: Session, user: User, cv: CvVersion, format_: str, integrity_confirmed: bool) -> CvExport:
    """Ghi nhận một lần xuất CV; bắt buộc SV đã xác nhận cam kết liêm chính."""
    if not integrity_confirmed:
        raise AppError(422, "Hãy xác nhận cam kết liêm chính trước khi xuất CV.", "integrity_required")
    export = CvExport(id=f"ex_{uuid.uuid4().hex[:12]}", owner_id=user.id, cv_version_id=cv.id, format=format_)
    db.add(export)
    db.commit()
    return export


def display_text(cv: CvVersion) -> str:
    """Văn bản CV để xem nhanh, kèm mục kỹ năng đang phát triển (không thuộc nội dung được chấm)."""
    if not cv.developing_skills:
        return cv.content_text
    skills = "\n".join(f"- {s['name']}: {s['note']}" for s in cv.developing_skills)
    return f"{cv.content_text}\n\n{DEVELOPING_TITLE}\n{skills}"
