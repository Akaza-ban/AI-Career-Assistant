"""Trang Quản trị: thống kê, tài khoản cố vấn (mật khẩu tạm, tạm khoá) và phân công sinh viên."""

import uuid

import pytest
from sqlalchemy import delete, select

from src.db.database import SessionLocal
from src.db.models import AuthSession, Feedback, Notification, ShareGrant, User
from src.db.seed import DEMO_ADMIN_ID, DEMO_ADVISOR_ID, DEMO_STUDENT_ID
from tests.helpers import ADMIN, ADVISOR, STUDENT
from tests.test_api.test_advisor_api import (  # noqa: F401  (clean_data: dọn dữ liệu trước mỗi test)
    add_analysis,
    add_cv,
    add_session,
    add_student,
    clean_data,
)

API = "/api/v1"
TEMP_PASSWORD = "Careerx-7Q4M2"
NEW_ADVISOR = {
    "full_name": "  Nguyễn  Bảo Châu ",
    "email": "Chau.Nguyen@careerx.vn",
    "title": "Cố vấn hướng nghiệp",
    "temporary_password": TEMP_PASSWORD,
}


@pytest.fixture(autouse=True)
def clean_accounts(clean_data):  # noqa: F811
    with SessionLocal() as db:
        db.execute(delete(AuthSession))
        db.execute(delete(Notification))
        db.commit()


def add_csat(owner: str, value: int, comment: str | None = None, activity: str = "interview", tags=None) -> None:
    with SessionLocal() as db:
        db.add(
            Feedback(
                id=f"fb_{uuid.uuid4().hex[:8]}",
                user_id=owner,
                response_id=f"iv_{uuid.uuid4().hex[:6]}",
                kind="csat",
                value=value,
                activity=activity,
                comment=comment,
                tags=tags,
            )
        )
        db.commit()


def notifications_of(user_id: str) -> list[Notification]:
    with SessionLocal() as db:
        return list(db.scalars(select(Notification).where(Notification.user_id == user_id)))


async def create_advisor(client, **overrides) -> dict:
    res = await client.post(f"{API}/admin/advisors", json={**NEW_ADVISOR, **overrides}, headers=ADMIN)
    assert res.status_code == 201, res.text
    return res.json()


async def login(client, email: str, password: str):
    client.cookies.clear()
    return await client.post(f"{API}/auth/login", json={"email": email, "password": password})


# ---------- Phân quyền ----------


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/admin/stats", "/admin/advisors", "/admin/students"])
async def test_admin_pages_require_admin(client, path):
    assert (await client.get(f"{API}{path}", headers=STUDENT)).status_code == 403
    assert (await client.get(f"{API}{path}", headers=ADVISOR)).status_code == 403
    assert (await client.get(f"{API}{path}")).status_code == 401
    assert (await client.get(f"{API}{path}", headers=ADMIN)).status_code == 200


@pytest.mark.asyncio
async def test_demo_admin_logs_in(client):
    res = await login(client, "admin@careerx.vn", "careerx123")
    assert res.status_code == 200
    body = res.json()
    assert (body["role"], body["must_change_password"], body["profile"]["id"]) == ("admin", False, DEMO_ADMIN_ID)
    client.cookies.clear()


# ---------- Thống kê ----------


@pytest.mark.asyncio
async def test_stats_aggregate_whole_system(client):
    assigned = add_student("sv-9101", "Lê Quang Huy")
    unassigned = add_student("sv-9102", "Hoàng Minh Thu", assigned=False)
    add_session(assigned, 3.0, 3)
    add_session(assigned, 3.2, 40)
    add_analysis(unassigned, add_cv(unassigned), days=5)
    add_csat(assigned, 5, "Câu hỏi sát với vị trí.")
    add_csat(unassigned, 3)
    add_csat(DEMO_ADVISOR_ID, 1)  # chỉ tính đánh giá của sinh viên

    body = (await client.get(f"{API}/admin/stats", headers=ADMIN)).json()
    users = body["users"]
    assert (users["student_count"], users["assigned_count"], users["unassigned_count"]) == (3, 2, 1)
    assert (users["advisor_count"], users["new_students_week"], users["active_count"]) == (1, 3, 2)
    assert len(users["student_series"]) == 7 and users["student_series"][-1] == 3

    usage = body["usage"]
    assert (usage["interviews"], usage["interviews_change"]) == (1, 0.0)
    assert (usage["analyses"], usage["analyses_change"]) == (1, None)
    assert len(usage["weekly"]) == 7 and sum(w["interviews"] for w in usage["weekly"]) == 2

    satisfaction = body["satisfaction"]
    assert (satisfaction["csat"], satisfaction["count"], satisfaction["target"]) == (4.0, 2, 4.0)
    assert satisfaction["distribution"] == {"1": 0, "2": 0, "3": 1, "4": 0, "5": 1}
    [comment] = body["recent_comments"]
    assert (comment["value"], comment["comment"], comment["activity"]) == (5, "Câu hỏi sát với vị trí.", "interview")
    assert "student_name" not in comment and "user_id" not in comment

    add_csat(unassigned, 2, "Mong có thêm vị trí ngành Marketing.")
    page = (await client.get(f"{API}/admin/comments?limit=1", headers=ADMIN)).json()
    assert page["total"] == 2 and len(page["items"]) == 1
    low = (await client.get(f"{API}/admin/comments?stars=2", headers=ADMIN)).json()
    assert (low["total"], low["items"][0]["comment"]) == (1, "Mong có thêm vị trí ngành Marketing.")
    assert (await client.get(f"{API}/admin/comments?stars=6", headers=ADMIN)).status_code == 422
    assert (await client.get(f"{API}/admin/comments", headers=ADVISOR)).status_code == 403

    week = (await client.get(f"{API}/admin/stats?days=7", headers=ADMIN)).json()
    assert (week["days"], week["usage"]["interviews"], week["usage"]["analyses"]) == (7, 1, 1)
    assert (await client.get(f"{API}/admin/stats?days=15", headers=ADMIN)).status_code == 422


# ---------- Tài khoản cố vấn ----------


@pytest.mark.asyncio
async def test_create_advisor_requires_password_change(client):
    advisor = await create_advisor(client)
    assert (advisor["full_name"], advisor["email"], advisor["status"]) == (
        "Nguyễn Bảo Châu",
        "chau.nguyen@careerx.vn",
        "password_pending",
    )
    assert advisor["student_count"] == 0 and advisor["last_active_at"] is None
    taken = await client.post(f"{API}/admin/advisors", json=NEW_ADVISOR, headers=ADMIN)
    assert (taken.status_code, taken.json()["code"]) == (409, "email_taken")
    weak = await client.post(
        f"{API}/admin/advisors",
        json={**NEW_ADVISOR, "email": "x@careerx.vn", "temporary_password": "abc"},
        headers=ADMIN,
    )
    assert weak.status_code == 422

    res = await login(client, "chau.nguyen@careerx.vn", TEMP_PASSWORD)
    assert (res.status_code, res.json()["must_change_password"]) == (200, True)
    blocked = await client.get(f"{API}/advisor/overview")
    assert (blocked.status_code, blocked.json()["code"]) == (403, "password_change_required")
    assert (await client.get(f"{API}/me")).json()["must_change_password"] is True
    changed = await client.post(
        f"{API}/auth/change-password", json={"current_password": TEMP_PASSWORD, "new_password": "matkhau123"}
    )
    assert changed.status_code == 200
    assert (await client.get(f"{API}/me")).json()["must_change_password"] is False
    assert (await client.get(f"{API}/advisor/overview")).json()["student_count"] == 0
    client.cookies.clear()

    [row] = [a for a in (await client.get(f"{API}/admin/advisors", headers=ADMIN)).json() if a["id"] == advisor["id"]]
    assert row["status"] == "active" and row["last_active_at"] is not None


@pytest.mark.asyncio
async def test_disable_and_reset_advisor(client):
    advisor = await create_advisor(client)
    url = f"{API}/admin/advisors/{advisor['id']}"
    await login(client, advisor["email"], TEMP_PASSWORD)
    session = dict(client.cookies)
    client.cookies.clear()

    edited = await client.patch(url, json={"title": "Cố vấn ngành CNTT", "disabled": True}, headers=ADMIN)
    assert (edited.json()["status"], edited.json()["title"]) == ("disabled", "Cố vấn ngành CNTT")
    # Tạm khoá: phiên đang mở bị kết thúc, không đăng nhập lại được
    client.cookies.update(session)
    assert (await client.get(f"{API}/me")).status_code == 401
    refused = await login(client, advisor["email"], TEMP_PASSWORD)
    assert (refused.status_code, refused.json()["code"]) == (403, "account_disabled")
    client.cookies.clear()

    assert (await client.patch(url, json={"disabled": False}, headers=ADMIN)).json()["status"] == "password_pending"
    reset = await client.post(f"{url}/reset-password", json={"temporary_password": "Tam-mat-khau9"}, headers=ADMIN)
    assert reset.json()["status"] == "password_pending"
    assert (await login(client, advisor["email"], TEMP_PASSWORD)).status_code == 401
    res = await login(client, advisor["email"], "Tam-mat-khau9")
    assert (res.status_code, res.json()["must_change_password"]) == (200, True)
    client.cookies.clear()
    missing = await client.patch(f"{API}/admin/advisors/{DEMO_STUDENT_ID}", json={"title": "x"}, headers=ADMIN)
    assert missing.status_code == 404


# ---------- Sinh viên & phân công ----------


@pytest.mark.asyncio
async def test_assign_and_reassign_students(client):
    advisor = await create_advisor(client)
    new_student = add_student("sv-9102", "Hoàng Minh Thu", assigned=False)
    moved = add_student("sv-9101", "Lê Quang Huy")
    with SessionLocal() as db:
        db.add(ShareGrant(id="sh_x", owner_id=moved, kind="interview", item_id="iv_x"))
        db.commit()

    rows = {s["id"]: s for s in (await client.get(f"{API}/admin/students", headers=ADMIN)).json()}
    assert rows[new_student]["advisor"] is None
    assert rows[moved]["advisor"] == {"id": DEMO_ADVISOR_ID, "full_name": "ThS. Trần Hoàng Nam", "disabled": False}
    assert rows[new_student]["phone"] == "0900 000 000"

    body = {"student_ids": [new_student, moved, moved], "advisor_id": advisor["id"]}
    res = await client.post(f"{API}/admin/assignments", json=body, headers=ADMIN)
    assert res.json() == {"assigned": 2, "unchanged": 0}
    again = await client.post(f"{API}/admin/assignments", json=body, headers=ADMIN)
    assert again.json() == {"assigned": 0, "unchanged": 2}

    rows = {s["id"]: s for s in (await client.get(f"{API}/admin/students", headers=ADMIN)).json()}
    assert rows[new_student]["advisor"]["id"] == rows[moved]["advisor"]["id"] == advisor["id"]
    # Đổi cố vấn: tài liệu đã chia sẻ chuyển về riêng tư
    with SessionLocal() as db:
        assert db.get(ShareGrant, "sh_x") is None
    [note] = notifications_of(moved)
    assert note.kind == "advisor_assigned" and "riêng tư" in note.body
    [advisor_note] = notifications_of(advisor["id"])
    assert advisor_note.title == "Bạn được phân công thêm 2 sinh viên"
    [row] = [a for a in (await client.get(f"{API}/admin/advisors", headers=ADMIN)).json() if a["id"] == advisor["id"]]
    assert row["student_count"] == 2

    await client.patch(f"{API}/admin/advisors/{advisor['id']}", json={"disabled": True}, headers=ADMIN)
    disabled = await client.post(f"{API}/admin/assignments", json=body, headers=ADMIN)
    assert (disabled.status_code, disabled.json()["code"]) == (409, "advisor_disabled")
    unknown = await client.post(
        f"{API}/admin/assignments", json={"student_ids": ["sv-x"], "advisor_id": DEMO_ADVISOR_ID}, headers=ADMIN
    )
    assert unknown.status_code == 404


@pytest.mark.asyncio
async def test_new_student_waits_for_assignment(client):
    res = await client.post(
        f"{API}/auth/register",
        json={
            "full_name": "Phan Văn Long",
            "date_of_birth": "2003-05-14",
            "phone": "0938 112 907",
            "email": "longphan.dev@gmail.com",
            "password": "matkhau12",
            "consent": True,
            "integrity_pledge": True,
        },
    )
    assert res.status_code == 201
    student_id = res.json()["profile"]["id"]
    client.cookies.clear()
    rows = {s["id"]: s for s in (await client.get(f"{API}/admin/students", headers=ADMIN)).json()}
    assert rows[student_id]["advisor"] is None
    [note] = notifications_of(DEMO_ADMIN_ID)
    assert (note.kind, note.title) == ("student_registered", "Phan Văn Long vừa tạo tài khoản")
    with SessionLocal() as db:
        db.execute(delete(User).where(User.id == student_id))
        db.commit()


# ---------- Đánh giá: lý do, like / dislike ----------


@pytest.mark.asyncio
async def test_feedback_reasons_and_helpfulness(client):
    send = lambda body: client.post(f"{API}/feedback", json=body, headers=STUDENT)  # noqa: E731
    low = {"response_id": "ga_x", "kind": "csat", "value": 2, "activity": "gap_analysis"}
    assert (await send({**low, "tags": ["off_target", "generic", "off_target"]})).status_code == 200
    assert (await send({**low, "response_id": "ga_y", "value": 5, "tags": ["generic"]})).status_code == 422
    assert (await send({**low, "response_id": "ga_z", "tags": ["too_short"]})).status_code == 422
    assert (await send({**low, "response_id": "ga_w", "comment": "x" * 501})).status_code == 422
    opt = {"response_id": "opt_1", "kind": "csat", "value": 3, "activity": "optimizer", "tags": ["generic"]}
    assert (await send(opt)).status_code == 200
    for rid, value in (("rec_1", 1), ("rec_2", -1), ("rec_3", 1)):
        body = {"response_id": rid, "kind": "thumb", "value": value, "activity": "job_recommendation"}
        assert (await send(body)).status_code == 200
    assert (await send({"response_id": "t", "kind": "thumb", "value": 1, "activity": "optimizer"})).status_code == 422

    s = (await client.get(f"{API}/admin/stats", headers=ADMIN)).json()["satisfaction"]
    assert s["low_count"] == 2
    generic = next(r for r in s["reasons"] if r["reason"] == "generic")
    assert (generic["label"], generic["count"], generic["activities"]) == (
        "Gợi ý chung chung",
        2,
        ["gap_analysis", "optimizer"],
    )
    rec = next(h for h in s["helpful"] if h["activity"] == "job_recommendation")
    assert (rec["label"], rec["likes"], rec["total"]) == ("Gợi ý vị trí", 2, 3)

    # Đánh giá chỉ có lý do (không viết chữ) vẫn nằm trong danh sách nhận xét; lọc được theo lý do
    page = (await client.get(f"{API}/admin/comments", headers=ADMIN)).json()
    assert page["total"] == 2 and page["items"][0]["comment"] is None
    tagged = (await client.get(f"{API}/admin/comments?reason=off_target", headers=ADMIN)).json()
    assert tagged["total"] == 1
    assert tagged["items"][0]["tags"] == [
        {"reason": "off_target", "label": "Chưa sát JD"},
        {"reason": "generic", "label": "Gợi ý chung chung"},
    ]
    only_opt = (await client.get(f"{API}/admin/comments?activity=optimizer", headers=ADMIN)).json()
    assert only_opt["total"] == 1
