"""Trình tối ưu CV (US-SV-03, US-SV-05): gợi ý, Audit Trail, kiểm tra kỹ năng thiếu, tạo phiên bản mới, xuất CV."""

import io
import uuid

import pytest
from docx import Document
from sqlalchemy import delete, select

from src.db.database import SessionLocal, init_db
from src.db.models import CvEditAudit, CvExport, CvOptimization, CvVersion, GapAnalysis
from src.db.seed import DEMO_STUDENT_ID
from src.services.cv_optimizer import _kind, apply_changes
from src.services.gap_analysis import _build_result
from tests.helpers import ADVISOR, STUDENT, make_docx, upload_cv

JD_ID = "jd-ba-intern"
CV_LINES = [
    "Nguyễn Minh Anh",
    "minhanh@example.com | 0900 000 000",
    "KINH NGHIỆM LÀM VIỆC",
    "- Thu thập phản hồi của 150 người dùng thử nghiệm trước khi bảo vệ đồ án.",
    # Dòng liệt kê công cụ trong một mục Kinh nghiệm: không mở mục mới
    "Công cụ: Excel, Draw.io",
    "- Vẽ sơ đồ chức năng hệ thống quản lý thư viện.",
    "DỰ ÁN",
    "Làm việc nhóm theo sprint 2 tuần, hoàn thành dự án đúng hạn.",
    "KỸ NĂNG",
    "SQL, Excel",
]
UAT_LINE = "Thu thập phản hồi của 150 người dùng thử nghiệm trước khi bảo vệ đồ án."
DIAGRAM_LINE = "Vẽ sơ đồ chức năng hệ thống quản lý thư viện."
TEAM_LINE = "Làm việc nhóm theo sprint 2 tuần, hoàn thành dự án đúng hạn."
UAT_REWRITE = "Tổ chức kiểm thử chấp nhận người dùng (UAT) với 150 người dùng thử nghiệm trước khi bảo vệ đồ án."


@pytest.fixture(autouse=True)
def clean_data():
    init_db()
    with SessionLocal() as db:
        for model in (CvEditAudit, CvExport, CvOptimization, GapAnalysis, CvVersion):
            db.execute(delete(model))
        db.commit()


def requirement(rid: str, skill: str, importance: str, status: str) -> dict:
    return {
        "id": rid,
        "skill": skill,
        "importance": importance,
        "weight": {"required": 3, "preferred": 2, "additional": 1}[importance],
        "match": {"matched": 1, "partial": 0.5, "missing": 0}[status],
        "status": status,
        "evidence": None,
        "note": None,
    }


def suggestion(sid: str, skill: str, line_no: int | None, original: str, rewrite: str) -> dict:
    return {
        "id": sid,
        "skill": skill,
        "line_no": line_no,
        "section_label": "Kinh nghiệm",
        "original_text": original,
        "suggested_text": rewrite,
        "reason": f"Nêu rõ {skill} để khớp JD.",
    }


async def setup_analysis(client, status: str = "completed") -> tuple[str, str]:
    res = await upload_cv(client, "CV_MinhAnh.docx", make_docx(CV_LINES))
    cv_id = res.json()["id"]
    with SessionLocal() as db:
        analysis = GapAnalysis(
            id=f"ga_{uuid.uuid4().hex[:8]}",
            owner_id=DEMO_STUDENT_ID,
            cv_version_id=cv_id,
            cv_file_name="CV_MinhAnh.docx",
            cv_label="v1.0",
            jd_id=JD_ID,
            status=status,
            current_step=None if status == "completed" else "compare",
            match_score=62.5 if status == "completed" else None,
            result={
                "requirements": [
                    requirement("r1", "SQL", "required", "matched"),
                    requirement("r2", "UAT", "preferred", "partial"),
                    requirement("r3", "Power BI", "preferred", "missing"),
                    requirement("r4", "JIRA", "required", "missing"),
                ],
                "suggestions": [
                    suggestion("sg_uat", "UAT", 4, UAT_LINE, UAT_REWRITE),
                    # Lượt phân tích cũ chưa lưu số dòng: tìm theo nguyên văn
                    suggestion("sg_bpmn", "BPMN", None, DIAGRAM_LINE, "Mô hình hoá quy trình mượn trả sách bằng BPMN."),
                    suggestion("sg_team", "Agile/Scrum", 8, TEAM_LINE, "Làm việc theo Scrum, sprint 2 tuần, đúng hạn."),
                    # Câu không còn trong CV: bỏ qua
                    suggestion("sg_gone", "Excel", 99, "Câu không có trong CV.", "Câu mới."),
                ],
                "llm_used": True,
                "pending_review_count": 1,
            }
            if status == "completed"
            else None,
        )
        db.add(analysis)
        db.commit()
        return cv_id, analysis.id


def url(analysis_id: str, path: str = "") -> str:
    return f"/api/v1/gap-analysis/{analysis_id}/optimizer{path}"


async def decide(client, analysis_id: str, sid: str, decision: str, text: str | None = None):
    body = {"decision": decision, **({"edited_text": text} if text is not None else {})}
    return await client.post(url(analysis_id, f"/suggestions/{sid}"), json=body, headers=STUDENT)


async def answer(client, analysis_id: str, rid: str, **body):
    return await client.post(url(analysis_id, f"/capability-checks/{rid}"), json=body, headers=STUDENT)


def audit_rows(analysis_id: str) -> list[CvEditAudit]:
    with SessionLocal() as db:
        return list(
            db.scalars(
                select(CvEditAudit).where(CvEditAudit.analysis_id == analysis_id).order_by(CvEditAudit.created_at)
            )
        )


# ---------- Mở trình tối ưu ----------


@pytest.mark.asyncio
async def test_session_builds_document_suggestions_and_checks(client):
    cv_id, analysis_id = await setup_analysis(client)
    res = await client.get(url(analysis_id), headers=STUDENT)
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "draft"
    assert body["cv"]["id"] == cv_id and body["result_cv"] is None
    assert body["llm_used"] is True and body["pending_review_count"] == 1
    assert body["match_score"] == 62.5 and body["match_label"] == "medium"

    doc = body["document"]
    assert [line["text"] for line in doc["header"]] == ["Nguyễn Minh Anh", "minhanh@example.com | 0900 000 000"]
    assert [s["title"] for s in doc["sections"]] == ["KINH NGHIỆM LÀM VIỆC", "DỰ ÁN", "KỸ NĂNG"]
    assert [line["id"] for line in doc["sections"][0]["lines"]] == ["l4", "l5", "l6"]
    assert doc["sections"][0]["lines"][0]["text"] == UAT_LINE  # bỏ ký tự đầu dòng
    assert doc["sections"][2]["lines"][0]["text"] == "SQL, Excel"

    suggestions = {s["id"]: s for s in body["suggestions"]}
    assert list(suggestions) == ["sg_uat", "sg_bpmn", "sg_team"]
    assert suggestions["sg_bpmn"]["line_id"] == "l6"
    assert suggestions["sg_uat"]["evidence_span"] == {"text": UAT_LINE, "line_start": 4, "line_end": 4}
    assert suggestions["sg_uat"]["kind"] == "ats_keyword"
    assert suggestions["sg_team"]["kind"] == "rephrase"
    assert all(s["status"] == "pending" and s["final_text"] is None for s in body["suggestions"])

    checks = body["capability_checks"]
    assert [c["id"] for c in checks] == ["r4", "r3"]  # Bắt buộc trước
    assert checks[0]["skill"] == "JIRA" and checks[0]["status"] == "pending"
    assert "JIRA" in checks[0]["jd_requirement"]


@pytest.mark.asyncio
async def test_session_errors(client):
    _, processing_id = await setup_analysis(client, status="processing")
    res = await client.get(url(processing_id), headers=STUDENT)
    assert res.status_code == 409 and res.json()["code"] == "analysis_not_ready"

    res = await client.get(url("ga_unknown"), headers=STUDENT)
    assert res.status_code == 404 and res.json()["code"] == "analysis_not_found"
    assert (await client.get(url(processing_id), headers=ADVISOR)).status_code == 403
    assert (await client.get(url(processing_id))).status_code == 401


@pytest.mark.asyncio
async def test_deleted_cv_cannot_be_optimized(client):
    cv_id, analysis_id = await setup_analysis(client)
    assert (await client.delete(f"/api/v1/cv/{cv_id}", headers=STUDENT)).status_code == 204
    res = await client.get(url(analysis_id), headers=STUDENT)
    assert res.status_code == 409 and res.json()["code"] == "cv_deleted"


# ---------- Quyết định & Audit Trail ----------


@pytest.mark.asyncio
async def test_decisions_stay_in_draft_and_are_audited(client):
    _, analysis_id = await setup_analysis(client)
    res = await decide(client, analysis_id, "sg_uat", "accept")
    assert res.status_code == 200
    by_id = {s["id"]: s for s in res.json()["suggestions"]}
    assert by_id["sg_uat"]["status"] == "accepted" and by_id["sg_uat"]["final_text"] == UAT_REWRITE

    res = await decide(client, analysis_id, "sg_bpmn", "edit", "  Vẽ sơ đồ BPMN\n cho hệ thống thư viện.  ")
    by_id = {s["id"]: s for s in res.json()["suggestions"]}
    assert by_id["sg_bpmn"]["status"] == "edited"
    assert by_id["sg_bpmn"]["final_text"] == "Vẽ sơ đồ BPMN cho hệ thống thư viện."

    res = await decide(client, analysis_id, "sg_team", "reject")
    by_id = {s["id"]: s for s in res.json()["suggestions"]}
    assert by_id["sg_team"]["status"] == "rejected" and by_id["sg_team"]["final_text"] is None

    res = await decide(client, analysis_id, "sg_team", "undo")
    by_id = {s["id"]: s for s in res.json()["suggestions"]}
    assert by_id["sg_team"]["status"] == "pending"

    # Quyết định chỉ nằm trong bản nháp: chưa tạo phiên bản CV mới (AC1 theo phương án gom thay đổi, AC3)
    assert len((await client.get("/api/v1/cv", headers=STUDENT)).json()) == 1

    rows = audit_rows(analysis_id)
    assert [r.action for r in rows] == ["accept", "edit", "reject", "undo"]
    first = rows[0]
    assert first.original_content == UAT_LINE and first.ai_suggestion == UAT_REWRITE
    assert first.evidence_line_no == 4 and first.evidence_text == UAT_LINE
    assert first.reason == "Nêu rõ UAT để khớp JD." and first.final_content == UAT_REWRITE
    assert rows[1].final_content == "Vẽ sơ đồ BPMN cho hệ thống thư viện."
    assert rows[2].final_content == TEAM_LINE


@pytest.mark.asyncio
async def test_decision_validation(client):
    _, analysis_id = await setup_analysis(client)
    res = await decide(client, analysis_id, "sg_bpmn", "edit", "   ")
    assert res.status_code == 422 and res.json()["code"] == "edited_text_required"
    res = await decide(client, analysis_id, "sg_bpmn", "edit", DIAGRAM_LINE)
    assert res.status_code == 422 and res.json()["code"] == "edit_unchanged"
    res = await decide(client, analysis_id, "sg_bpmn", "edit", "x" * 601)
    assert res.status_code == 422 and res.json()["code"] == "edited_text_too_long"
    res = await decide(client, analysis_id, "sg_gone", "accept")
    assert res.status_code == 404 and res.json()["code"] == "suggestion_not_found"
    res = await decide(client, analysis_id, "sg_uat", "maybe")
    assert res.status_code == 422

    # Hoàn tác gợi ý chưa quyết định: không đổi gì, không ghi Audit Trail
    assert (await decide(client, analysis_id, "sg_uat", "undo")).status_code == 200
    assert audit_rows(analysis_id) == []


# ---------- Kiểm tra kỹ năng thiếu ----------


@pytest.mark.asyncio
async def test_capability_checks(client):
    _, analysis_id = await setup_analysis(client)
    res = await answer(client, analysis_id, "r4", has_experience=True)
    assert res.status_code == 422 and res.json()["code"] == "context_required"
    res = await answer(client, analysis_id, "r1", has_experience=False)
    assert res.status_code == 404 and res.json()["code"] == "check_not_found"
    res = await answer(client, analysis_id, "r3", has_experience=False, learning_note="x" * 121)
    assert res.status_code == 422 and res.json()["code"] == "learning_note_too_long"

    res = await answer(client, analysis_id, "r4", has_experience=True, context="Dùng JIRA quản lý backlog đồ án.")
    checks = {c["id"]: c for c in res.json()["capability_checks"]}
    assert checks["r4"]["status"] == "has_experience" and checks["r4"]["context"] == "Dùng JIRA quản lý backlog đồ án."

    res = await answer(client, analysis_id, "r3", has_experience=False, learning_note="  Đang học khoá Power BI ")
    checks = {c["id"]: c for c in res.json()["capability_checks"]}
    assert checks["r3"]["status"] == "no_experience" and checks["r3"]["learning_note"] == "Đang học khoá Power BI"

    # Đổi câu trả lời trước khi hoàn tất
    res = await answer(client, analysis_id, "r4", has_experience=False)
    checks = {c["id"]: c for c in res.json()["capability_checks"]}
    assert checks["r4"]["status"] == "no_experience" and checks["r4"]["context"] is None


# ---------- Hoàn tất ----------


@pytest.mark.asyncio
async def test_finalize_requires_a_change(client):
    _, analysis_id = await setup_analysis(client)
    res = await client.post(url(analysis_id, "/finalize"), headers=STUDENT)
    assert res.status_code == 422 and res.json()["code"] == "no_changes"
    await decide(client, analysis_id, "sg_team", "reject")
    await answer(client, analysis_id, "r3", has_experience=False)  # không ghi chú đang học
    res = await client.post(url(analysis_id, "/finalize"), headers=STUDENT)
    assert res.status_code == 422 and res.json()["code"] == "no_changes"


@pytest.mark.asyncio
async def test_finalize_creates_one_new_version(client):
    cv_id, analysis_id = await setup_analysis(client)
    await decide(client, analysis_id, "sg_uat", "accept")
    await decide(client, analysis_id, "sg_bpmn", "edit", "Vẽ sơ đồ BPMN cho hệ thống thư viện.")
    await decide(client, analysis_id, "sg_team", "reject")
    await answer(client, analysis_id, "r3", has_experience=False, learning_note="Đang học khoá Power BI")
    await answer(client, analysis_id, "r4", has_experience=True, context="Dùng JIRA quản lý backlog đồ án.")

    res = await client.post(url(analysis_id, "/finalize"), headers=STUDENT)
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "finalized" and body["finalized_at"]
    new = body["result_cv"]
    # Bản mới nằm trong cùng CV (số phụ +1); CV đang dùng nên bản mới tự thành bản đang dùng
    assert new["version"] == 2 and new["label"] == "v1.1" and new["origin"] == "optimized"
    assert new["family_id"] == cv_id and new["is_active"] is True and new["file_type"] == "docx"
    assert new["file_name"] == "CV_MinhAnh_v1.1.docx" and new["source_analysis_id"] == analysis_id
    result_lines = body["result_document"]["sections"][0]["lines"]
    assert [line["text"] for line in result_lines] == [
        UAT_REWRITE,
        "Công cụ: Excel, Draw.io",
        "Vẽ sơ đồ BPMN cho hệ thống thư viện.",
    ]
    assert body["result_document"]["developing_skills"] == [{"name": "Power BI", "note": "Đang học khoá Power BI"}]

    with SessionLocal() as db:
        old = db.get(CvVersion, cv_id)
        created = db.get(CvVersion, new["id"])
    # Bản cũ giữ nguyên; bản mới giữ ký tự đầu dòng và các dòng không đổi
    assert UAT_LINE in old.content_text and UAT_REWRITE not in old.content_text
    assert f"- {UAT_REWRITE}" in created.content_text and TEAM_LINE in created.content_text
    # Kỹ năng đang học không nằm trong nội dung được chấm khi phân tích lại; JIRA không bị tự thêm
    assert "Power BI" not in created.content_text and "JIRA" not in created.content_text

    # "CV của tôi" vẫn chỉ có một CV, hiển thị bản mới nhất; bản cũ nằm trong lịch sử phiên bản
    cvs = (await client.get("/api/v1/cv", headers=STUDENT)).json()
    assert [(c["id"], c["label"], c["version_count"]) for c in cvs] == [(new["id"], "v1.1", 2)]
    history = (await client.get(f"/api/v1/cv/{cv_id}/versions", headers=STUDENT)).json()
    assert [(v["label"], v["is_active"]) for v in history] == [("v1.1", True), ("v1.0", False)]
    assert history[0]["source_jd_title"] == "Business Analyst Intern"

    file = await client.get(f"/api/v1/cv/{new['id']}/file", headers=STUDENT)
    assert file.status_code == 200
    docx_paragraphs = Document(io.BytesIO(file.content)).paragraphs
    paragraphs = [p.text for p in docx_paragraphs]
    assert paragraphs[0] == "Nguyễn Minh Anh"
    # Tiêu đề mục giữ chữ gốc, in hoa bằng định dạng (mẫu CV gọn kiểu Harvard)
    assert UAT_REWRITE in paragraphs and "Kỹ năng đang phát triển" in paragraphs
    heading = next(p for p in docx_paragraphs if p.text == "Kỹ năng đang phát triển")
    assert heading.runs[0].bold and heading.runs[0].font.all_caps
    assert "Power BI: Đang học khoá Power BI" in paragraphs
    text = (await client.get(f"/api/v1/cv/{new['id']}/text", headers=STUDENT)).json()["text"]
    assert "Kỹ năng đang phát triển" in text and "Power BI: Đang học khoá Power BI" in text

    # Phiên đã khoá
    res = await decide(client, analysis_id, "sg_team", "accept")
    assert res.status_code == 409 and res.json()["code"] == "optimization_finalized"
    assert (await client.post(url(analysis_id, "/finalize"), headers=STUDENT)).status_code == 409
    assert (await answer(client, analysis_id, "r4", has_experience=False)).status_code == 409
    reopened = (await client.get(url(analysis_id), headers=STUDENT)).json()
    assert reopened["status"] == "finalized" and reopened["result_cv"]["id"] == new["id"]


# ---------- Xuất CV ----------


@pytest.mark.asyncio
async def test_export_requires_integrity_confirmation(client):
    cv_id, _ = await setup_analysis(client)
    export = f"/api/v1/cv/{cv_id}/export"
    res = await client.post(export, json={"format": "docx", "integrity_confirmed": False}, headers=STUDENT)
    assert res.status_code == 422 and res.json()["code"] == "integrity_required"
    res = await client.post(export, json={"format": "text", "integrity_confirmed": True}, headers=STUDENT)
    assert res.status_code == 200
    body = res.json()
    assert body["format"] == "text" and body["confirmed_at"].endswith("+00:00")
    with SessionLocal() as db:
        row = db.get(CvExport, body["id"])
    assert row.cv_version_id == cv_id and row.owner_id == DEMO_STUDENT_ID

    res = await client.post(
        "/api/v1/cv/cv_unknown/export", json={"format": "docx", "integrity_confirmed": True}, headers=STUDENT
    )
    assert res.status_code == 404
    res = await client.post(export, json={"format": "pdf", "integrity_confirmed": True}, headers=STUDENT)
    assert res.status_code == 422


# ---------- Hàm dùng chung ----------


def test_build_result_keeps_suggestion_line():
    result = _build_result(
        {
            "suggestions": [
                {
                    "id": "sg_1",
                    "skill": "SQL",
                    "line_no": 4,
                    "section_label": "Kinh nghiệm",
                    "original_text": "a",
                    "suggested_revision": "b",
                    "rationale": "c",
                }
            ]
        }
    )
    assert result["suggestions"][0]["line_no"] == 4


def test_keyword_kind_matches_whole_words():
    # "SQL" trong "MySQL" không phải là đã nhắc tới SQL
    assert _kind("SQL", "Dùng MySQL lưu dữ liệu.", "Dùng MySQL (SQL) lưu dữ liệu.") == "ats_keyword"
    assert _kind("SQL", "Viết truy vấn SQL.", "Viết truy vấn SQL tổng hợp báo cáo.") == "rephrase"


def test_apply_changes_keeps_layout():
    text = "Tên\n\nKINH NGHIỆM\n  • Dòng một\n- Dòng hai\nDòng ba"
    assert apply_changes(text, {3: "Dòng một mới", 5: "Dòng ba mới"}) == (
        "Tên\n\nKINH NGHIỆM\n  • Dòng một mới\n- Dòng hai\nDòng ba mới"
    )


@pytest.mark.asyncio
async def test_suggestion_with_placeholder_asks_for_context(client):
    _, analysis_id = await setup_analysis(client)
    with SessionLocal() as db:
        analysis = db.get(GapAnalysis, analysis_id)
        result = dict(analysis.result)
        result["suggestions"] = [
            suggestion("sg_num", "Agile/Scrum", 8, TEAM_LINE, "Làm việc theo Scrum với [số] thành viên, sprint 2 tuần.")
        ]
        analysis.result = result
        db.commit()
    [s] = (await client.get(url(analysis_id), headers=STUDENT)).json()["suggestions"]
    assert s["needs_context"] is True and s["context_question"]

    empty = await client.post(url(analysis_id, "/suggestions/sg_num/context"), json={"answer": " "}, headers=STUDENT)
    assert empty.json()["code"] == "context_required"
    res = await client.post(
        url(analysis_id, "/suggestions/sg_num/context"), json={"answer": "Nhóm có 5 người"}, headers=STUDENT
    )
    [s] = res.json()["suggestions"]
    # Không có LLM (test): điền theo quy tắc bằng đúng số SV đưa ra
    assert (s["needs_context"], s["proposed_text"]) == (False, "Làm việc theo Scrum với 5 thành viên, sprint 2 tuần.")
    assert (await decide(client, analysis_id, "sg_num", "accept")).status_code == 200
    [s] = (await client.get(url(analysis_id), headers=STUDENT)).json()["suggestions"]
    assert s["final_text"] == "Làm việc theo Scrum với 5 thành viên, sprint 2 tuần."


# ---------- Kỹ năng còn thiếu: "Có, đã dùng" → câu cho CV để SV duyệt ----------


def test_cv_entries_and_insertions():
    from src.services.cv_optimizer import cv_entries
    from src.services.skill_matching import split_cv_lines

    lines = split_cv_lines(
        "DỰ ÁN\nMaintenance Platform 07/2023 - 11/2023\nTechnologies: Python, Redis\n- Cache trạng thái bằng Redis.\n"
        "Smart Factory 03/2023 - 06/2023\n- Giám sát thiết bị.\nKINH NGHIỆM\n- Thực tập tại công ty ABC.\nKỸ NĂNG\nGit"
    )
    entries = cv_entries(lines)
    assert [(e["label"], e["after_line_no"]) for e in entries] == [
        ("Dự án · Maintenance Platform", 4),
        ("Dự án · Smart Factory", 6),
        ("Kinh nghiệm (cuối mục)", 8),
    ]
    text = "DỰ ÁN\nMaintenance Platform 07/2023 - 11/2023\n• Cache trạng thái bằng Redis.\nKỸ NĂNG\nGit"
    assert (
        apply_changes(text, {}, {3: ["Quản lý mã nguồn bằng Git."]}).splitlines()[3] == "• Quản lý mã nguồn bằng Git."
    )
    # Dòng không có gạch đầu dòng: câu mới cũng không có
    assert apply_changes("A\nB", {}, {2: ["C"]}) == "A\nB\nC"


async def draft(client, analysis_id: str, rid: str, **body):
    return await client.post(url(analysis_id, f"/capability-checks/{rid}/draft"), json=body, headers=STUDENT)


async def decide_line(client, analysis_id: str, rid: str, decision: str, text: str | None = None):
    body = {"decision": decision, **({"edited_text": text} if text is not None else {})}
    return await client.post(url(analysis_id, f"/capability-checks/{rid}/decision"), json=body, headers=STUDENT)


@pytest.mark.asyncio
async def test_capability_line_draft_decide_and_finalize(client):
    cv_id, analysis_id = await setup_analysis(client)
    session = (await client.get(url(analysis_id), headers=STUDENT)).json()
    entries = {e["label"]: e["id"] for e in session["entries"]}
    assert set(entries) == {"Kinh nghiệm (cuối mục)", "Dự án (cuối mục)"}

    # Test không có LLM: dùng chính câu SV kể (làm gọn), chờ SV duyệt
    res = await draft(
        client, analysis_id, "r4", context="  dùng JIRA quản lý backlog đồ án  ", entry_id=entries["Dự án (cuối mục)"]
    )
    check = {c["id"]: c for c in res.json()["capability_checks"]}["r4"]
    assert (check["status"], check["line_status"]) == ("has_experience", "pending")
    assert check["draft_text"] == "Dùng JIRA quản lý backlog đồ án." and check["final_text"] is None

    res = await decide_line(client, analysis_id, "r4", "edit", "Quản lý backlog đồ án bằng JIRA.")
    check = {c["id"]: c for c in res.json()["capability_checks"]}["r4"]
    assert (check["line_status"], check["final_text"]) == ("edited", "Quản lý backlog đồ án bằng JIRA.")
    res = await decide_line(client, analysis_id, "r4", "undo")
    assert {c["id"]: c for c in res.json()["capability_checks"]}["r4"]["line_status"] == "pending"
    await decide_line(client, analysis_id, "r4", "accept")
    assert [a.suggestion_id for a in audit_rows(analysis_id)] == ["cap:r4"] * 3

    # Chỉ riêng câu kinh nghiệm cũng đủ để Hoàn tất; câu vào đúng cuối mục Dự án
    res = await client.post(url(analysis_id, "/finalize"), headers=STUDENT)
    assert res.status_code == 200
    with SessionLocal() as db:
        new = db.get(CvVersion, res.json()["result_cv"]["id"])
        lines = new.content_text.splitlines()
    assert lines[lines.index(TEAM_LINE) + 1] == "Dùng JIRA quản lý backlog đồ án."


@pytest.mark.asyncio
async def test_capability_line_validation(client):
    _, analysis_id = await setup_analysis(client)
    entry = (await client.get(url(analysis_id), headers=STUDENT)).json()["entries"][0]["id"]
    res = await draft(client, analysis_id, "r4", context=" ", entry_id=entry)
    assert res.json()["code"] == "context_required"
    res = await draft(client, analysis_id, "r4", context="Dùng JIRA.", entry_id="l999")
    assert res.json()["code"] == "entry_required"
    res = await draft(client, analysis_id, "r1", context="Dùng SQL.", entry_id=entry)
    assert res.json()["code"] == "check_not_found"
    res = await decide_line(client, analysis_id, "r3", "accept")
    assert res.json()["code"] == "draft_not_found"
    # Đổi sang "Đang học" thì bỏ câu đề xuất
    await draft(client, analysis_id, "r4", context="Dùng JIRA.", entry_id=entry)
    res = await answer(client, analysis_id, "r4", has_experience=False, learning_note="Đang học JIRA")
    check = {c["id"]: c for c in res.json()["capability_checks"]}["r4"]
    assert check["draft_text"] is None and check["status"] == "no_experience"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("ai_text", "expected"),
    [
        ("Quản lý backlog đồ án bằng JIRA cùng nhóm.", "Quản lý backlog đồ án bằng JIRA cùng nhóm."),
        # Thêm số không có trong lời kể → dùng câu của SV
        ("Quản lý 120 đầu việc bằng JIRA.", "Dùng JIRA quản lý backlog đồ án cùng nhóm."),
        # Không nhắc tới kỹ năng → dùng câu của SV
        ("Quản lý backlog đồ án cùng nhóm.", "Dùng JIRA quản lý backlog đồ án cùng nhóm."),
    ],
)
async def test_capability_line_ai_is_grounded(client, ai_text, expected):
    from unittest.mock import AsyncMock, patch

    _, analysis_id = await setup_analysis(client)
    entry = (await client.get(url(analysis_id), headers=STUDENT)).json()["entries"][0]["id"]
    with (
        patch("src.services.llm.llm_configured", return_value=True),
        patch("src.services.llm.invoke_json", new=AsyncMock(return_value={"text": ai_text})),
    ):
        res = await draft(
            client, analysis_id, "r4", context="Dùng JIRA quản lý backlog đồ án cùng nhóm", entry_id=entry
        )
    assert {c["id"]: c for c in res.json()["capability_checks"]}["r4"]["draft_text"] == expected


# ---------- Gợi ý soạn riêng khi mở Trình tối ưu ----------


def line_numbers(cv_id: str) -> dict[str, int]:
    from src.services.skill_matching import split_cv_lines

    with SessionLocal() as db:
        text = db.get(CvVersion, cv_id).content_text
    return {line["text"]: line["line_no"] for line in split_cv_lines(text)}


def drafted(no: dict[str, int]) -> dict:
    return {
        "rewrites": [
            # Công cụ Draw.io nằm trong cùng mục Kinh nghiệm → giữ; chỗ trống đúng mẫu → hỏi số liệu
            {
                "line": no[DIAGRAM_LINE],
                "skill": "UAT",
                "rewrite": "Vẽ sơ đồ chức năng hệ thống quản lý thư viện bằng Draw.io, đạt [kết quả đo được].",
                "reason": "Nêu rõ công cụ đã dùng.",
            },
            # JIRA không có trong mục này (kỹ năng CV chưa có) → bỏ
            {"line": no[TEAM_LINE], "skill": "JIRA", "rewrite": "Quản lý sprint 2 tuần bằng JIRA, đúng hạn."},
            # Làm mất số thật 150 → bỏ
            {"line": no[UAT_LINE], "skill": "UAT", "rewrite": "Thu thập phản hồi người dùng thử nghiệm."},
            # Dòng liệt kê kỹ năng → bỏ
            {"line": no["SQL, Excel"], "skill": "SQL", "rewrite": "Viết truy vấn SQL và báo cáo bằng Excel."},
        ],
        "kept": [no[UAT_LINE]],
    }


@pytest.mark.asyncio
async def test_optimizer_drafts_its_own_suggestions_once(client):
    from unittest.mock import AsyncMock, patch

    cv_id, analysis_id = await setup_analysis(client)
    no = line_numbers(cv_id)
    ai = AsyncMock(return_value=drafted(no))
    with patch("src.services.llm.llm_configured", return_value=True), patch("src.services.llm.invoke_json", new=ai):
        first = (await client.get(url(analysis_id), headers=STUDENT)).json()
        assert first["suggestions_state"] == "pending" and first["suggestions"] == []
        res = await client.post(url(analysis_id, "/prepare"), headers=STUDENT)
        assert res.status_code == 200
        body = res.json()
        # Mở lại / bấm lại không gọi LLM thêm
        await client.post(url(analysis_id, "/prepare"), headers=STUDENT)
        again = (await client.get(url(analysis_id), headers=STUDENT)).json()
    assert ai.await_count == 1
    assert body["suggestions_state"] == "ready" and body["kept_count"] == 1 and body["suggestions_attempted_at"]
    [only] = body["suggestions"]
    assert only["id"].startswith("rw_") and only["line_id"] == f"l{no[DIAGRAM_LINE]}"
    assert only["skill"] == "UAT" and only["needs_context"] is True
    assert [s["id"] for s in again["suggestions"]] == [only["id"]]

    # Gợi ý soạn riêng được duyệt và đưa vào phiên bản mới như gợi ý thường
    with patch("src.services.llm.llm_configured", return_value=True):
        await decide(client, analysis_id, only["id"], "edit", "Vẽ sơ đồ chức năng hệ thống thư viện bằng Draw.io.")
        res = await client.post(url(analysis_id, "/finalize"), headers=STUDENT)
    assert res.status_code == 200
    doc = res.json()["result_document"]
    lines = [line["text"] for section in doc["sections"] for line in section["lines"]]
    assert "Vẽ sơ đồ chức năng hệ thống thư viện bằng Draw.io." in lines


@pytest.mark.asyncio
async def test_optimizer_draft_failure_can_be_retried(client):
    from unittest.mock import AsyncMock, patch

    cv_id, analysis_id = await setup_analysis(client)
    with (
        patch("src.services.llm.llm_configured", return_value=True),
        patch("src.services.llm.invoke_json", new=AsyncMock(side_effect=RuntimeError("429 rate limit"))),
    ):
        body = (await client.post(url(analysis_id, "/prepare"), headers=STUDENT)).json()
    assert body["suggestions_state"] == "failed" and body["suggestions"] == []
    # Phần kỹ năng còn thiếu vẫn dùng được
    assert {c["id"] for c in body["capability_checks"]} == {"r3", "r4"}

    ai = AsyncMock(return_value=drafted(line_numbers(cv_id)))
    with patch("src.services.llm.llm_configured", return_value=True), patch("src.services.llm.invoke_json", new=ai):
        body = (await client.post(url(analysis_id, "/prepare"), headers=STUDENT)).json()
    assert body["suggestions_state"] == "ready" and len(body["suggestions"]) == 1


@pytest.mark.asyncio
async def test_session_with_earlier_decisions_keeps_analysis_suggestions(client):
    from unittest.mock import AsyncMock, patch

    _, analysis_id = await setup_analysis(client)
    # Phiên tạo trước khi có bước soạn riêng (không có LLM): SV đã duyệt gợi ý của lượt phân tích
    await decide(client, analysis_id, "sg_uat", "accept")
    ai = AsyncMock()
    with patch("src.services.llm.llm_configured", return_value=True), patch("src.services.llm.invoke_json", new=ai):
        body = (await client.post(url(analysis_id, "/prepare"), headers=STUDENT)).json()
    assert ai.await_count == 0
    assert body["suggestions_state"] == "ready"
    assert {s["id"]: s["status"] for s in body["suggestions"]}["sg_uat"] == "accepted"


@pytest.mark.asyncio
async def test_wrapped_bullet_is_replaced_as_a_whole(client):
    from unittest.mock import AsyncMock, patch

    wrapped = [
        "Nguyễn Minh Anh",
        "KINH NGHIỆM LÀM VIỆC",
        "Công ty ABC 06/2024 - 08/2024",
        "• Thu thập phản hồi của 150 người dùng thử nghiệm và tổng hợp thành báo cáo cho",
        "nhóm phát triển sản phẩm.",
        "• Vẽ sơ đồ chức năng hệ thống quản lý thư viện.",
    ]
    res = await upload_cv(client, "CV_Wrapped.docx", make_docx(wrapped))
    cv_id = res.json()["id"]
    with SessionLocal() as db:
        analysis = GapAnalysis(
            id=f"ga_{uuid.uuid4().hex[:8]}",
            owner_id=DEMO_STUDENT_ID,
            cv_version_id=cv_id,
            cv_file_name="CV_Wrapped.docx",
            cv_label="v1.0",
            jd_id=JD_ID,
            status="completed",
            match_score=50,
            result={"requirements": [requirement("r1", "UAT", "preferred", "partial")], "suggestions": []},
        )
        db.add(analysis)
        db.commit()
        analysis_id = analysis.id
    no = line_numbers(cv_id)
    first = no["Thu thập phản hồi của 150 người dùng thử nghiệm và tổng hợp thành báo cáo cho"]
    rewrite = "Tổ chức thu thập phản hồi của 150 người dùng thử nghiệm và tổng hợp thành báo cáo cho nhóm phát triển sản phẩm."
    ai = AsyncMock(
        return_value={"rewrites": [{"line": first, "skill": "UAT", "rewrite": rewrite, "reason": "Rõ hơn."}]}
    )
    with patch("src.services.llm.llm_configured", return_value=True), patch("src.services.llm.invoke_json", new=ai):
        body = (await client.post(url(analysis_id, "/prepare"), headers=STUDENT)).json()
        [only] = body["suggestions"]
        # AI nhận cả gạch ý (hai dòng gộp lại), không phải từng mẩu
        assert "tổng hợp thành báo cáo cho nhóm phát triển sản phẩm." in ai.await_args.args[0]
        assert only["original_text"].endswith("cho nhóm phát triển sản phẩm.")
        assert only["extra_line_ids"] == [f"l{no['nhóm phát triển sản phẩm.']}"]
        await decide(client, analysis_id, only["id"], "accept")
        res = await client.post(url(analysis_id, "/finalize"), headers=STUDENT)
    doc = res.json()["result_document"]
    texts = [line["text"] for section in doc["sections"] for line in section["lines"]]
    assert rewrite in texts and "nhóm phát triển sản phẩm." not in texts


@pytest.mark.asyncio
async def test_prepare_in_two_tabs_keeps_the_first_result(client):
    """Tab khác soạn xong trước (SV có thể đã duyệt gợi ý): lần soạn về sau không ghi đè."""
    from unittest.mock import AsyncMock, patch

    cv_id, analysis_id = await setup_analysis(client)
    await client.get(url(analysis_id), headers=STUDENT)
    first = {"status": "ready", "items": [], "kept": 3, "attempted_at": "2026-10-17T08:00:00"}

    async def slow_ai(*args, **kwargs):
        with SessionLocal() as db:
            db.scalar(select(CvOptimization).where(CvOptimization.analysis_id == analysis_id)).rewrites = first
            db.commit()
        return drafted(line_numbers(cv_id))

    with (
        patch("src.services.llm.llm_configured", return_value=True),
        patch("src.services.llm.invoke_json", new=AsyncMock(side_effect=slow_ai)),
    ):
        body = (await client.post(url(analysis_id, "/prepare"), headers=STUDENT)).json()
    assert body["kept_count"] == 3 and body["suggestions"] == []
