"""Tin nhắn giữa SV và cố vấn phụ trách: gửi / đọc hai chiều, số tin chưa đọc, phân quyền theo bảng phân công."""

import pytest
from sqlalchemy import delete

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
)
from src.db.seed import DEMO_ADVISOR_ID, DEMO_STUDENT_ID, assign
from tests.helpers import ADVISOR, STUDENT

API = "/api/v1/conversations"


def _reset() -> None:
    with SessionLocal() as db:
        # Cùng tập bảng với test cố vấn: dữ liệu cohort demo seed ở test khác không còn sót lại
        for model in (
            Message,
            AdvisorNote,
            AdvisorReview,
            ShareGrant,
            Feedback,
            InterviewTurn,
            InterviewSession,
            GapAnalysis,
            CvVersion,
        ):
            db.execute(delete(model))
        db.execute(delete(AdvisorAssignment).where(AdvisorAssignment.student_id != DEMO_STUDENT_ID))
        db.execute(delete(User).where(User.id.notin_([DEMO_STUDENT_ID, DEMO_ADVISOR_ID])))
        assign(db, DEMO_ADVISOR_ID, DEMO_STUDENT_ID)
        db.commit()


@pytest.fixture(autouse=True)
def clean_data():
    init_db()
    _reset()
    yield
    _reset()  # trả lại phân công SV demo cho các test khác


def add_student(student_id: str, assigned: bool = True) -> str:
    with SessionLocal() as db:
        db.add(
            User(
                id=student_id,
                role="student",
                full_name=f"Sinh viên {student_id}",
                subtitle="HTTT - K2022",
                email=f"{student_id}@example.edu.vn",
            )
        )
        if assigned:
            db.add(AdvisorAssignment(id=f"as_{student_id}", advisor_id=DEMO_ADVISOR_ID, student_id=student_id))
        db.commit()
    return student_id


async def unread(client, headers) -> int:
    return (await client.get(f"{API}/unread-count", headers=headers)).json()["count"]


@pytest.mark.asyncio
async def test_student_and_advisor_exchange_messages(client):
    [conv] = (await client.get(API, headers=STUDENT)).json()
    assert conv["student_id"] == DEMO_STUDENT_ID and conv["last_message"] is None and conv["unread_count"] == 0
    assert conv["counterpart"]["id"] == DEMO_ADVISOR_ID and conv["counterpart"]["role"] == "advisor"
    assert conv["counterpart"]["office_hours"] and conv["counterpart"]["subtitle"].startswith("Cố vấn")

    res = await client.post(
        f"{API}/{DEMO_STUDENT_ID}/messages", json={"body": "  Em chào cố vấn ạ.  "}, headers=STUDENT
    )
    assert res.status_code == 201
    sent = res.json()
    assert sent["body"] == "Em chào cố vấn ạ." and sent["mine"] is True and sent["read_at"] is None
    assert await unread(client, ADVISOR) == 1 and await unread(client, STUDENT) == 0

    # Cố vấn: hội thoại có tin mới lên đầu danh sách
    other = add_student("sv-9001")
    rows = (await client.get(API, headers=ADVISOR)).json()
    assert [r["student_id"] for r in rows] == [DEMO_STUDENT_ID, other]
    assert rows[0]["unread_count"] == 1 and rows[0]["last_message"]["mine"] is False
    assert rows[0]["counterpart"]["role"] == "student" and rows[0]["counterpart"]["office_hours"] is None

    thread = (await client.get(f"{API}/{DEMO_STUDENT_ID}", headers=ADVISOR)).json()
    assert [(m["body"], m["mine"]) for m in thread["messages"]] == [("Em chào cố vấn ạ.", False)]
    assert (await client.post(f"{API}/{DEMO_STUDENT_ID}/read", headers=ADVISOR)).status_code == 204
    assert await unread(client, ADVISOR) == 0

    # SV thấy "Đã xem"; cố vấn trả lời thì SV có 1 tin chưa đọc
    thread = (await client.get(f"{API}/{DEMO_STUDENT_ID}", headers=STUDENT)).json()
    assert thread["messages"][0]["read_at"] is not None
    await client.post(f"{API}/{DEMO_STUDENT_ID}/messages", json={"body": "Chào em, hẹn em thứ 5."}, headers=ADVISOR)
    assert await unread(client, STUDENT) == 1
    thread = (await client.get(f"{API}/{DEMO_STUDENT_ID}", headers=STUDENT)).json()
    assert [m["mine"] for m in thread["messages"]] == [True, False]
    await client.post(f"{API}/{DEMO_STUDENT_ID}/read", headers=STUDENT)
    assert await unread(client, STUDENT) == 0


@pytest.mark.asyncio
async def test_message_validation(client):
    url = f"{API}/{DEMO_STUDENT_ID}/messages"
    res = await client.post(url, json={"body": "   "}, headers=STUDENT)
    assert res.status_code == 422 and res.json()["code"] == "message_required"
    res = await client.post(url, json={"body": "a" * 2001}, headers=STUDENT)
    assert res.status_code == 422 and res.json()["code"] == "message_too_long"
    assert (await client.post(url, json={"body": "a" * 2000}, headers=STUDENT)).status_code == 201


@pytest.mark.asyncio
async def test_conversation_rbac(client):
    other = add_student("sv-9004", assigned=False)
    for method, path in (("get", ""), ("post", "/read")):
        res = await getattr(client, method)(f"{API}/{other}{path}", headers=ADVISOR)
        assert res.status_code == 403 and res.json()["code"] == "forbidden"
    res = await client.post(f"{API}/{other}/messages", json={"body": "Xin chào"}, headers=ADVISOR)
    assert res.status_code == 403
    # SV chỉ mở được hội thoại của chính mình
    res = await client.get(f"{API}/{other}", headers=STUDENT)
    assert res.status_code == 403 and res.json()["code"] == "forbidden"
    assert (await client.get(API)).status_code == 401

    # Tin với SV đã chuyển cho cố vấn khác không còn tính vào số chưa đọc
    add_student("sv-9005")
    await client.post(f"{API}/sv-9005/messages", json={"body": "Chào em"}, headers=ADVISOR)
    with SessionLocal() as db:
        db.add(Message(id="msg_x", advisor_id=DEMO_ADVISOR_ID, student_id="sv-9005", sender_id="sv-9005", body="Dạ"))
        db.execute(delete(AdvisorAssignment).where(AdvisorAssignment.student_id == "sv-9005"))
        db.commit()
    assert await unread(client, ADVISOR) == 0
    assert (await client.get(f"{API}/sv-9005", headers=ADVISOR)).status_code == 403


@pytest.mark.asyncio
async def test_student_without_advisor(client):
    with SessionLocal() as db:
        db.execute(delete(AdvisorAssignment).where(AdvisorAssignment.student_id == DEMO_STUDENT_ID))
        db.commit()
    assert (await client.get(API, headers=STUDENT)).json() == []
    assert await unread(client, STUDENT) == 0
    res = await client.get(f"{API}/{DEMO_STUDENT_ID}", headers=STUDENT)
    assert res.status_code == 404 and res.json()["code"] == "no_advisor"


@pytest.mark.asyncio
async def test_demo_cohort_messages(client):
    with SessionLocal() as db:
        seed_demo_cohort(db)
        seed_demo_cohort(db)  # chạy lại không tạo trùng
    assert await unread(client, ADVISOR) == 2
    rows = (await client.get(API, headers=ADVISOR)).json()
    assert [r["student_id"] for r in rows[:3]] == ["sv-0158", "sv-0152", "sv-0151"]
    assert rows[1]["unread_count"] == 1 and rows[1]["last_message"]["body"].startswith("Em chào cố vấn")
    thread = (await client.get(f"{API}/sv-0151", headers=ADVISOR)).json()
    assert [m["mine"] for m in thread["messages"]] == [True, False]
    assert all(m["read_at"] for m in thread["messages"])
