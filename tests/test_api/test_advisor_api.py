"""Chia sẻ với cố vấn (phía SV) và các trang Cố vấn (US-ADV-01, 02, 03): phân quyền, số liệu, nội dung đã chia sẻ."""

import uuid
from datetime import timedelta

import pytest
from sqlalchemy import delete, select

from src.db.database import SessionLocal, init_db
from src.db.demo_cohort import seed_demo_cohort
from src.db.models import (
    AdvisorAssignment,
    AdvisorNote,
    AdvisorReview,
    CvVersion,
    Feedback,
    GapAnalysis,
    InterviewSession,
    InterviewTurn,
    Message,
    ShareGrant,
    User,
    utcnow,
)
from src.db.seed import DEMO_ADVISOR_ID, DEMO_STUDENT_ID
from src.services import cv_versions
from tests.helpers import ADVISOR, STUDENT

BA, DA = "jd-ba-intern", "jd-da-intern"
API = "/api/v1"


@pytest.fixture(autouse=True)
def clean_data():
    init_db()
    with SessionLocal() as db:
        for model in (
            AdvisorNote,
            AdvisorReview,
            ShareGrant,
            Feedback,
            Message,
            InterviewTurn,
            InterviewSession,
            GapAnalysis,
            CvVersion,
        ):
            db.execute(delete(model))
        db.execute(delete(AdvisorAssignment).where(AdvisorAssignment.student_id != DEMO_STUDENT_ID))
        db.execute(delete(User).where(User.id.notin_([DEMO_STUDENT_ID, DEMO_ADVISOR_ID])))
        db.commit()


# ---------- Dữ liệu mẫu ----------


def add_student(student_id: str, name: str, assigned: bool = True) -> str:
    with SessionLocal() as db:
        db.add(
            User(
                id=student_id,
                role="student",
                full_name=name,
                subtitle=f"{student_id}@example.com",
                email=f"{student_id}@example.com",
                phone="0900 000 000",
            )
        )
        if assigned:
            db.add(AdvisorAssignment(id=f"as_{student_id}", advisor_id=DEMO_ADVISOR_ID, student_id=student_id))
        db.commit()
    return student_id


def add_cv(owner: str, version: int = 1, days: int = 10) -> str:
    with SessionLocal() as db:
        cv = CvVersion(
            id=f"cv_{uuid.uuid4().hex[:8]}",
            owner_id=owner,
            version=version,
            file_name=f"cv-v{version}.docx",
            file_type="docx",
            size_bytes=100,
            content_text="Nguyễn Văn A\nKINH NGHIỆM\n- Viết truy vấn SQL cho báo cáo tháng.",
            is_active=version == 1,
            uploaded_at=utcnow() - timedelta(days=days),
        )
        cv_versions.start_family(cv)
        db.add(cv)
        db.commit()
        return cv.id


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


def add_analysis(owner: str, cv_id: str, jd_id: str = BA, score: float = 60.0, days: int = 9) -> str:
    requirements = [
        requirement("r1", "SQL", "required", "matched"),
        requirement("r2", "Viết tài liệu BRD/SRS", "required", "missing"),
        requirement("r3", "BPMN", "preferred", "partial"),
        requirement("r4", "Jira", "additional", "missing"),
    ]
    with SessionLocal() as db:
        at = utcnow() - timedelta(days=days)
        analysis = GapAnalysis(
            id=f"ga_{uuid.uuid4().hex[:8]}",
            owner_id=owner,
            cv_version_id=cv_id,
            cv_file_name="cv.docx",
            cv_label="v1.0",
            jd_id=jd_id,
            status="completed",
            current_step=None,
            match_score=score,
            result={"requirements": requirements, "suggestions": [], "llm_used": False},
            created_at=at,
            completed_at=at,
        )
        db.add(analysis)
        db.commit()
        return analysis.id


def add_session(
    owner: str, score: float, days: float, jd_id: str = BA, weak: str = "result", timed_out: int = 0
) -> str:
    star = {c: score + 0.2 for c in ("situation", "task", "action", "result")}
    star[weak] = round(score - 0.6, 2)
    with SessionLocal() as db:
        at = utcnow() - timedelta(days=days)
        session = InterviewSession(
            id=f"iv_{uuid.uuid4().hex[:8]}",
            owner_id=owner,
            jd_id=jd_id,
            cv_version_id="cv_x",
            cv_file_name="cv.docx",
            status="completed",
            current_index=5,
            overall_score=score,
            star=star,
            created_at=at - timedelta(minutes=15),
            completed_at=at,
        )
        db.add(session)
        for index in range(1, 5):
            db.add(
                InterviewTurn(
                    id=f"it_{uuid.uuid4().hex[:8]}",
                    session_id=session.id,
                    index=index,
                    theme="Chủ đề",
                    question=f"Câu hỏi {index}",
                    answer=f"Câu trả lời {index} của sinh viên.",
                    timed_out=index <= timed_out,
                    score=score,
                    feedback="Nhận xét AI.",
                    answered_at=at,
                    **star,
                )
            )
        db.commit()
        return session.id


def add_csat(owner: str, response_id: str, value: int) -> None:
    with SessionLocal() as db:
        db.add(
            Feedback(
                id=f"fb_{uuid.uuid4().hex[:8]}",
                user_id=owner,
                response_id=response_id,
                kind="csat",
                value=value,
                activity="interview",
            )
        )
        db.commit()


async def share(client, *item_ids: str, shared: bool = True, headers=STUDENT):
    return await client.patch(
        f"{API}/students/me/sharing", json={"item_ids": list(item_ids), "shared": shared}, headers=headers
    )


def students_by_id(body: list[dict]) -> dict[str, dict]:
    return {s["id"]: s for s in body}


# ---------- Chia sẻ (phía SV) ----------


@pytest.mark.asyncio
async def test_sharing_lists_items_private_by_default(client):
    cv = add_cv(DEMO_STUDENT_ID)
    add_analysis(DEMO_STUDENT_ID, cv, score=72.4)
    iv = add_session(DEMO_STUDENT_ID, 3.4, days=1)
    res = await client.get(f"{API}/students/me/sharing", headers=STUDENT)
    assert res.status_code == 200
    body = res.json()
    assert body["advisor"]["id"] == DEMO_ADVISOR_ID
    assert body["advisor"]["office_hours"] and body["advisor"]["title"]
    items = {i["id"]: i for i in body["items"]}
    assert items[cv]["kind"] == "cv" and items[cv]["score"] == 72 and items[cv]["tag"] == "primary"
    assert items[iv]["kind"] == "interview_report" and items[iv]["score"] == 3.4
    assert items[iv]["title"] == "Phỏng vấn Business Analyst Intern"
    assert not any(i["shared"] for i in body["items"])
    assert body["feedback"] == []


@pytest.mark.asyncio
async def test_toggle_sharing(client):
    cv, iv = add_cv(DEMO_STUDENT_ID), add_session(DEMO_STUDENT_ID, 3.0, days=1)
    res = await share(client, cv, iv)
    assert res.status_code == 200 and all(i["shared"] for i in res.json())
    res = await share(client, cv, shared=False)
    assert {i["id"]: i["shared"] for i in res.json()} == {cv: False, iv: True}

    res = await share(client, iv, "cv_cua_nguoi_khac")
    assert res.status_code == 404 and res.json()["code"] == "item_not_found"
    assert (await share(client, cv, headers=ADVISOR)).status_code == 403
    assert (await share(client)).status_code == 422

    # Xoá CV thì bỏ luôn quyền chia sẻ
    await share(client, cv)
    assert (await client.delete(f"{API}/cv/{cv}", headers=STUDENT)).status_code == 204
    with SessionLocal() as db:
        assert db.scalar(select(ShareGrant).where(ShareGrant.item_id == cv)) is None


@pytest.mark.asyncio
async def test_sharing_a_cv_covers_all_its_versions(client):
    """Chia sẻ theo cả CV: cố vấn xem bản mới nhất và các bản trước (US-ADV AC2); trang chia sẻ của SV một dòng/CV."""
    first = add_cv(DEMO_STUDENT_ID)
    with SessionLocal() as db:
        newer = CvVersion(
            id=f"cv_{uuid.uuid4().hex[:8]}",
            owner_id=DEMO_STUDENT_ID,
            file_name="cv-v1.1.docx",
            file_type="docx",
            size_bytes=100,
            content_text="Nguyễn Văn A\nKINH NGHIỆM\n- Viết truy vấn SQL cho báo cáo tháng (12 báo cáo).",
            origin="optimized",
            uploaded_at=utcnow(),
        )
        cv_versions.append(db, db.get(CvVersion, first), newer, new_major=False)
        db.add(newer)
        db.commit()
        newer_id = newer.id

    def text_url(cv_id: str) -> str:
        return f"{API}/advisor/students/{DEMO_STUDENT_ID}/cvs/{cv_id}/text"

    assert (await client.get(text_url(newer_id), headers=ADVISOR)).status_code == 403
    items = (await client.get(f"{API}/students/me/sharing", headers=STUDENT)).json()["items"]
    cv_items = [i for i in items if i["kind"] == "cv"]
    assert [(i["id"], i["subtitle"]) for i in cv_items] == [(first, "Phiên bản v1.1 · 2 phiên bản")]

    await share(client, first)
    for cv_id in (first, newer_id):
        assert (await client.get(text_url(cv_id), headers=ADVISOR)).status_code == 200
    detail = (await client.get(f"{API}/advisor/students/{DEMO_STUDENT_ID}", headers=ADVISOR)).json()
    assert [(c["id"], c["label"], c["shared"]) for c in detail["cvs"]] == [
        (newer_id, "v1.1", True),
        (first, "v1.0", True),
    ]


@pytest.mark.asyncio
async def test_review_flow_between_advisor_and_student(client):
    iv = add_session(DEMO_STUDENT_ID, 3.2, days=2)
    report_url = f"{API}/advisor/students/{DEMO_STUDENT_ID}/interviews/{iv}"
    res = await client.get(report_url, headers=ADVISOR)
    assert res.status_code == 403 and res.json()["code"] == "not_shared"

    await share(client, iv)
    res = await client.get(report_url, headers=ADVISOR)
    assert res.status_code == 200
    body = res.json()
    assert [t["answer"] for t in body["turns"]][0] == "Câu trả lời 1 của sinh viên."
    assert body["review"] is None
    viewed = {i["id"]: i for i in (await client.get(f"{API}/students/me/sharing", headers=STUDENT)).json()["items"]}
    assert viewed[iv]["advisor_viewed_at"] is not None

    res = await client.put(f"{report_url}/review", json={"comment": "  "}, headers=ADVISOR)
    assert res.status_code == 422 and res.json()["code"] == "comment_required"
    res = await client.put(f"{report_url}/review", json={"comment": "x" * 2001}, headers=ADVISOR)
    assert res.status_code == 422 and res.json()["code"] == "comment_too_long"
    first = (await client.put(f"{report_url}/review", json={"comment": "Nêu rõ kết quả."}, headers=ADVISOR)).json()
    assert first["seen_at"] is None

    sharing = (await client.get(f"{API}/students/me/sharing", headers=STUDENT)).json()
    [feedback] = sharing["feedback"]
    assert feedback["comment"] == "Nêu rõ kết quả." and feedback["read"] is False
    assert feedback["advisor_name"] == "ThS. Trần Hoàng Nam" and feedback["target"]["id"] == iv
    assert {i["id"]: i for i in sharing["items"]}[iv]["has_advisor_comment"] is True
    report = (await client.get(f"{API}/interviews/{iv}/report", headers=STUDENT)).json()
    assert report["advisor_review"]["comment"] == "Nêu rõ kết quả." and report["advisor_review"]["read"] is False

    res = await client.post(f"{API}/students/me/advisor-feedback/{feedback['id']}/read", headers=STUDENT)
    assert res.status_code == 204
    detail = (await client.get(f"{API}/advisor/students/{DEMO_STUDENT_ID}", headers=ADVISOR)).json()
    assert detail["interviews"][0]["review"]["seen_at"] is not None

    # Sửa nhận xét: vẫn một bản ghi, SV thấy là chưa đọc
    second = (await client.put(f"{report_url}/review", json={"comment": "Nêu rõ số liệu."}, headers=ADVISOR)).json()
    assert second["id"] == first["id"] and second["seen_at"] is None
    assert (await client.get(f"{API}/students/me/sharing", headers=STUDENT)).json()["feedback"][0]["read"] is False

    # Tắt chia sẻ: cố vấn không mở được nữa, nhận xét vẫn còn cho SV
    await share(client, iv, shared=False)
    assert (await client.get(report_url, headers=ADVISOR)).status_code == 403
    assert len((await client.get(f"{API}/students/me/sharing", headers=STUDENT)).json()["feedback"]) == 1
    res = await client.post(f"{API}/students/me/advisor-feedback/rv_khong_co/read", headers=STUDENT)
    assert res.status_code == 404


# ---------- Danh sách SV phụ trách (US-ADV-01, 02) ----------


@pytest.mark.asyncio
async def test_student_list_scores_trend_and_flags(client):
    flagged = add_student("sv-9001", "Phạm Thu Trang")
    for score, days in ((3.2, 30), (3.1, 20), (2.9, 9), (2.9, 2)):
        add_session(flagged, score, days)
    improving = add_student("sv-9002", "Lê Quang Huy")
    add_session(improving, 2.0, 40, jd_id=DA)  # vị trí cũ: không tính
    for score, days in ((2.6, 20), (3.0, 10), (3.5, 1)):
        add_session(improving, score, days)
    single = add_student("sv-9003", "Võ Ngọc Lan")
    add_session(single, 2.7, 3)
    add_student("sv-9004", "Không phụ trách", assigned=False)

    res = await client.get(f"{API}/advisor/students", headers=ADVISOR)
    assert res.status_code == 200
    rows = students_by_id(res.json())
    assert set(rows) == {DEMO_STUDENT_ID, flagged, improving, single}

    f = rows[flagged]
    assert (f["first_score"], f["latest_score"], f["score_delta"], f["trend"]) == (3.2, 2.9, -0.3, "declining")
    assert f["flag"]["rounds"] == [2, 3, 4] and f["flag"]["scores"] == [3.1, 2.9, 2.9]
    assert f["flag"]["jd"]["id"] == BA and f["flag"]["flagged_at"]

    i = rows[improving]
    assert i["focus_session_count"] == 3 and i["interview_count"] == 4
    assert (i["first_score"], i["score_delta"], i["trend"], i["flag"]) == (2.6, 0.9, "improving", None)

    s = rows[single]
    assert (s["score_delta"], s["trend"], s["flag"]) == (None, "insufficient", None)
    assert rows[DEMO_STUDENT_ID]["interview_count"] == 0 and rows[DEMO_STUDENT_ID]["trend"] == "insufficient"

    # Buổi mới cao hơn buổi liền trước thì gỡ cờ (US-ADV-02 AC2)
    add_session(flagged, 3.3, 0.5)
    rows = students_by_id((await client.get(f"{API}/advisor/students", headers=ADVISOR)).json())
    assert rows[flagged]["flag"] is None


@pytest.mark.asyncio
async def test_student_list_sharing_counts_and_content_gate(client):
    student = add_student("sv-9001", "Phạm Thu Trang")
    cv = add_cv(student)
    add_analysis(student, cv, score=55.0)
    sessions = [add_session(student, 3.0, 5), add_session(student, 3.2, 1)]
    rows = students_by_id((await client.get(f"{API}/advisor/students", headers=ADVISOR)).json())
    row = rows[student]
    assert (row["shared_items"], row["total_items"], row["pending_reviews"]) == (0, 3, 0)
    # Số liệu luôn thấy; chi tiết kỹ năng cần SV chia sẻ CV
    assert row["latest_match"] == 55.0 and row["missing_required"] == []

    with SessionLocal() as db:
        for kind, item_id in (("cv", cv), ("interview", sessions[1])):
            db.add(ShareGrant(id=f"sh_{item_id}", owner_id=student, kind=kind, item_id=item_id))
        db.commit()
    row = students_by_id((await client.get(f"{API}/advisor/students", headers=ADVISOR)).json())[student]
    assert (row["shared_items"], row["pending_reviews"]) == (2, 1)
    assert row["missing_required"] == ["Viết tài liệu BRD/SRS"]


@pytest.mark.asyncio
async def test_advisor_rbac(client):
    other = add_student("sv-9004", "Không phụ trách", assigned=False)
    iv = add_session(other, 3.0, 1)
    urls = [
        f"{API}/advisor/students/{other}",
        f"{API}/advisor/students/{other}/progress",
        f"{API}/advisor/students/{other}/interviews/{iv}",
        f"{API}/advisor/students/sv-khong-ton-tai",
    ]
    for url in urls:
        res = await client.get(url, headers=ADVISOR)
        assert res.status_code == 403 and res.json()["code"] == "forbidden", url
    res = await client.post(f"{API}/advisor/students/{other}/notes", json={"body": "x"}, headers=ADVISOR)
    assert res.status_code == 403
    assert (await client.get(f"{API}/advisor/students", headers=STUDENT)).status_code == 403
    assert (await client.get(f"{API}/advisor/students")).status_code == 401


# ---------- Hồ sơ SV (US-ADV-03) ----------


@pytest.mark.asyncio
async def test_student_detail(client):
    student = add_student("sv-9001", "Phạm Thu Trang")
    old_cv, new_cv = add_cv(student, 1, days=20), add_cv(student, 2, days=5)
    add_analysis(student, new_cv, score=64.0, days=4)
    iv = add_session(student, 3.1, 2, timed_out=1)
    with SessionLocal() as db:
        db.add(ShareGrant(id="sh_1", owner_id=student, kind="cv", item_id=new_cv))
        db.commit()

    res = await client.get(f"{API}/advisor/students/{student}", headers=ADVISOR)
    assert res.status_code == 200
    body = res.json()
    assert [(c["id"], c["shared"]) for c in body["cvs"]] == [(new_cv, True), (old_cv, False)]
    assert body["target_jd"]["id"] == BA and body["target_jd"]["content"]
    gap = body["latest_gap"]
    assert gap["shared"] is True and gap["missing"] == ["Viết tài liệu BRD/SRS", "Jira"] and gap["partial"] == ["BPMN"]
    [row] = body["interviews"]
    assert row["id"] == iv and row["shared"] is False and row["timed_out_count"] == 1
    assert row["summary"] == "3,1/5 (Khá) · Mạnh nhất: Bối cảnh 3,3 · Yếu nhất: Kết quả 2,5 · 1 câu hết giờ"
    assert "Kết quả là tiêu chí thấp nhất" in body["insight"]
    assert any("Viết tài liệu BRD/SRS" in s for s in body["suggestions"])

    # CV đã chia sẻ mở được; bản chưa chia sẻ thì không
    assert (await client.get(f"{API}/advisor/students/{student}/cvs/{new_cv}/text", headers=ADVISOR)).status_code == 200
    res = await client.get(f"{API}/advisor/students/{student}/cvs/{old_cv}/text", headers=ADVISOR)
    assert res.status_code == 403 and res.json()["code"] == "not_shared"


@pytest.mark.asyncio
async def test_student_without_target_position(client):
    student = add_student("sv-9001", "Phạm Thu Trang")
    add_cv(student)
    body = (await client.get(f"{API}/advisor/students/{student}", headers=ADVISOR)).json()
    assert body["target_jd"] is None and body["latest_gap"] is None and body["interviews"] == []
    assert any("chưa luyện phỏng vấn" in s for s in body["suggestions"])


@pytest.mark.asyncio
async def test_progress_row_suggestions(client):
    student = add_student("sv-9001", "Phạm Thu Trang")
    for score, days in ((3.2, 30), (3.1, 20), (2.9, 16)):
        add_session(student, score, days, weak="action")
    body = (await client.get(f"{API}/advisor/students/{student}/progress", headers=ADVISOR)).json()
    assert [p["latest_score"] for p in body["interview_progress"]] == [2.9]
    assert body["star"]["weakest"] == "action"
    assert body["suggestions"][0].startswith("Điểm vị trí Business Analyst Intern không tăng qua các buổi 1, 2, 3")
    assert any("chưa có hoạt động 16 ngày" in s for s in body["suggestions"])


@pytest.mark.asyncio
async def test_notes_crud(client):
    student = add_student("sv-9001", "Phạm Thu Trang")
    url = f"{API}/advisor/students/{student}/notes"
    res = await client.post(url, json={"body": " Hẹn gặp tuần sau ", "tags": ["watch", "watch"]}, headers=ADVISOR)
    assert res.status_code == 201
    note = res.json()
    assert note["body"] == "Hẹn gặp tuần sau" and note["tags"] == ["watch"] and note["pinned"] is False
    assert (await client.post(url, json={"body": " "}, headers=ADVISOR)).json()["code"] == "note_required"
    assert (await client.post(url, json={"body": "x", "tags": ["khac"]}, headers=ADVISOR)).status_code == 422

    pinned = (await client.patch(f"{url}/{note['id']}", json={"pinned": True}, headers=ADVISOR)).json()
    assert pinned["pinned"] is True and pinned["updated_at"] == note["updated_at"]
    edited = (await client.patch(f"{url}/{note['id']}", json={"body": "Đã gặp", "tags": []}, headers=ADVISOR)).json()
    assert edited["body"] == "Đã gặp" and edited["tags"] == []
    detail = (await client.get(f"{API}/advisor/students/{student}", headers=ADVISOR)).json()
    assert [n["id"] for n in detail["notes"]] == [note["id"]]

    other = add_student("sv-9002", "Lê Quang Huy")
    res = await client.patch(
        f"{API}/advisor/students/{other}/notes/{note['id']}", json={"pinned": False}, headers=ADVISOR
    )
    assert res.status_code == 404 and res.json()["code"] == "note_not_found"
    assert (await client.delete(f"{url}/{note['id']}", headers=ADVISOR)).status_code == 204
    assert (await client.get(f"{API}/advisor/students/{student}", headers=ADVISOR)).json()["notes"] == []


# ---------- Tổng quan cả nhóm ----------


@pytest.mark.asyncio
async def test_overview_without_scores(client):
    res = await client.get(f"{API}/advisor/overview", headers=ADVISOR)
    assert res.status_code == 200
    body = res.json()
    assert (body["student_count"], body["active_count"], body["pending_reviews"]) == (1, 0, 0)
    assert body["average_score"] is None and body["average_delta"] is None and body["csat"] is None
    assert body["weekly_scores"] == [] and body["star"] is None and body["insight"] is None
    assert body["status_counts"]["insufficient"] == 1
    assert body["flagged_students"] == [] and body["top_improvers"] == [] and body["recent_reviews"] == []
    assert (body["active_target"], body["csat_target"], body["active_days"]) == (60, 4.0, 30)


@pytest.mark.asyncio
async def test_overview_aggregates_assigned_students(client):
    flagged = add_student("sv-9001", "Phạm Thu Trang")
    flagged_sessions = [add_session(flagged, score, days) for score, days in ((3.2, 30), (3.1, 20), (2.9, 9), (2.9, 2))]
    improving = add_student("sv-9002", "Lê Quang Huy")
    improving_sessions = [
        add_session(improving, score, days, weak="action") for score, days in ((2.6, 20), (3.0, 10), (3.5, 1))
    ]
    single = add_student("sv-9003", "Võ Ngọc Lan")
    add_session(single, 2.7, 3)
    idle = add_student("sv-9005", "Đặng Minh Khoa")
    add_analysis(idle, add_cv(idle, days=41), days=40)
    other = add_student("sv-9004", "Không phụ trách", assigned=False)
    add_session(other, 1.0, 1)
    add_csat(improving, improving_sessions[-1], 5)
    add_csat(single, "iv_x", 4)
    add_csat(other, "iv_y", 1)
    with SessionLocal() as db:
        for item_id in flagged_sessions[-2:]:
            db.add(ShareGrant(id=f"sh_{item_id}", owner_id=flagged, kind="interview", item_id=item_id))
        db.commit()
    url = f"{API}/advisor/students/{flagged}/interviews/{flagged_sessions[-1]}/review"
    assert (await client.put(url, json={"comment": "Nhận xét buổi gần nhất."}, headers=ADVISOR)).status_code == 200

    body = (await client.get(f"{API}/advisor/overview", headers=ADVISOR)).json()
    assert (body["student_count"], body["sharing_count"], body["pending_reviews"]) == (5, 1, 1)
    # Hoạt động 30 ngày: có lượt phân tích / buổi phỏng vấn hoàn thành (SV chỉ phân tích 40 ngày trước thì không)
    assert body["active_count"] == 3
    assert (body["average_score"], body["scored_count"]) == (3.03, 3)
    assert (body["average_delta"], body["delta_count"]) == (0.3, 2)
    # CSAT chỉ tính SV thuộc danh sách phụ trách
    assert (body["csat"], body["csat_count"]) == (4.5, 2)
    assert body["status_counts"] == {"flagged": 1, "declining": 0, "insufficient": 3, "stable": 0, "improving": 1}
    assert [s["id"] for s in body["flagged_students"]] == [flagged]
    assert [s["id"] for s in body["top_improvers"]] == [improving]

    weeks = body["weekly_scores"]
    assert len(weeks) >= 4 and weeks[-1]["average"] == 3.03 and weeks[-1]["student_count"] == 3
    assert [w["student_count"] for w in weeks] == sorted(w["student_count"] for w in weeks)

    star = body["star"]
    assert (star["weakest"], star["weakest_count"], star["student_count"]) == ("result", 2, 3)
    assert body["insight"].startswith("Kết quả là tiêu chí thấp nhất của nhóm (2,6/5)")
    assert "2/3 sinh viên" in body["insight"]

    [review] = body["recent_reviews"]
    assert (review["student_id"], review["session_id"], review["seen_at"]) == (flagged, flagged_sessions[-1], None)
    assert review["comment"] == "Nhận xét buổi gần nhất." and review["jd"]["id"] == BA
    # Buổi đã chia sẻ còn chờ nhận xét: nút "Nhận xét" ở Tổng quan mở thẳng đúng buổi
    [pending] = body["pending_sessions"]
    assert (pending["student_id"], pending["session_id"], pending["jd"]["id"]) == (flagged, flagged_sessions[-2], BA)


@pytest.mark.asyncio
async def test_overview_requires_advisor(client):
    assert (await client.get(f"{API}/advisor/overview", headers=STUDENT)).status_code == 403
    assert (await client.get(f"{API}/advisor/overview")).status_code == 401


# ---------- Dữ liệu demo ----------


@pytest.mark.asyncio
async def test_demo_cohort_covers_advisor_scenarios(client):
    with SessionLocal() as db:
        seed_demo_cohort(db)
        seed_demo_cohort(db)  # chạy lại không tạo trùng
    rows = students_by_id((await client.get(f"{API}/advisor/students", headers=ADVISOR)).json())
    assert len(rows) == 9
    assert rows["sv-0152"]["flag"]["rounds"] == [2, 3, 4]
    assert rows["sv-0151"]["trend"] == "improving" and rows["sv-0157"]["trend"] == "declining"
    assert rows["sv-0155"]["trend"] == "insufficient" and rows["sv-0156"]["interview_count"] == 0
    assert rows["sv-0154"]["shared_items"] == 0
    detail = (await client.get(f"{API}/advisor/students/sv-0151", headers=ADVISOR)).json()
    shared_iv = next(i for i in detail["interviews"] if i["shared"])
    report = await client.get(f"{API}/advisor/students/sv-0151/interviews/{shared_iv['id']}", headers=ADVISOR)
    assert report.status_code == 200 and len(report.json()["turns"]) == 4
    cv = detail["cvs"][0]
    assert (await client.get(f"{API}/advisor/students/sv-0151/cvs/{cv['id']}/file", headers=ADVISOR)).status_code == 200

    overview = (await client.get(f"{API}/advisor/overview", headers=ADVISOR)).json()
    assert (overview["csat"], overview["csat_count"]) == (4.33, 18)
    assert overview["status_counts"]["flagged"] == 1 and overview["flagged_students"][0]["id"] == "sv-0152"
    # DB tạo trước khi có CSAT demo: khởi động lại thì được bổ sung, không trùng
    with SessionLocal() as db:
        db.execute(delete(Feedback))
        db.commit()
        seed_demo_cohort(db)
    assert (await client.get(f"{API}/advisor/overview", headers=ADVISOR)).json()["csat_count"] == 18
