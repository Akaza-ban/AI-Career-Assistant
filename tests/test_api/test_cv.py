import pytest
from sqlalchemy import delete

from src.db.database import SessionLocal, init_db
from src.db.models import CvVersion
from src.services.cv_files import CV_MAX_BYTES, _split_diacritics
from tests.helpers import ADVISOR, STUDENT, make_docx, make_pdf, upload_cv

CV_TEXT = "Nguyen Minh Anh - Python FastAPI Docker SQL developer with REST API and data pipeline experience"


def upload(client, name: str, data: bytes, headers=STUDENT):
    return upload_cv(client, name, data, headers)


@pytest.fixture(autouse=True)
def clean_cvs():
    init_db()
    with SessionLocal() as db:
        db.execute(delete(CvVersion))
        db.commit()


@pytest.mark.asyncio
async def test_upload_creates_incrementing_versions_first_is_active(client):
    first = await upload(client, "cv_goc.pdf", make_pdf(CV_TEXT))
    assert first.status_code == 201
    data = first.json()
    assert data["version"] == 1
    assert data["label"] == "v1.0"
    assert data["file_type"] == "pdf"
    assert data["page_count"] == 1
    assert data["is_active"] is True
    assert data["status"] == "ready"
    assert data["uploaded_at"].endswith("+00:00")

    second = await upload(client, "cv_moi.docx", make_docx(CV_TEXT.split(" - ")))
    assert second.status_code == 201
    assert second.json()["version"] == 2
    assert second.json()["is_active"] is False
    assert second.json()["page_count"] is None

    listed = (await client.get("/api/v1/cv", headers=STUDENT)).json()
    assert [cv["version"] for cv in listed] == [2, 1]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("name", "data", "status", "code"),
    [
        ("cv.txt", b"plain text", 415, "unsupported_file_type"),
        ("cv.pdf", b"x" * (CV_MAX_BYTES + 1), 413, "file_too_large"),
        ("scan.pdf", make_pdf(None), 422, "cv_not_extractable"),
        ("hong.pdf", b"%PDF-1.4 not really a pdf", 422, "cv_not_extractable"),
    ],
    ids=["wrong-type", "too-large", "scanned-pdf", "corrupted-pdf"],
)
async def test_upload_rejects_invalid_files_without_creating_version(client, name, data, status, code):
    response = await upload(client, name, data)
    assert response.status_code == status
    assert response.json()["code"] == code
    assert (await client.get("/api/v1/cv", headers=STUDENT)).json() == []


@pytest.mark.asyncio
async def test_activate_switches_active_version(client):
    first = (await upload(client, "a.pdf", make_pdf(CV_TEXT))).json()
    second = (await upload(client, "b.pdf", make_pdf(CV_TEXT))).json()

    response = await client.post(f"/api/v1/cv/{second['id']}/activate", headers=STUDENT)
    assert response.status_code == 200
    active = {cv["id"]: cv["is_active"] for cv in (await client.get("/api/v1/cv", headers=STUDENT)).json()}
    assert active == {first["id"]: False, second["id"]: True}


@pytest.mark.asyncio
async def test_delete_rules(client):
    active = (await upload(client, "a.pdf", make_pdf(CV_TEXT))).json()
    other = (await upload(client, "b.pdf", make_pdf(CV_TEXT))).json()

    blocked = await client.delete(f"/api/v1/cv/{active['id']}", headers=STUDENT)
    assert blocked.status_code == 409
    assert blocked.json()["code"] == "cv_active"

    assert (await client.delete(f"/api/v1/cv/{other['id']}", headers=STUDENT)).status_code == 204
    # CV đang dùng xoá được khi là phiên bản duy nhất còn lại
    assert (await client.delete(f"/api/v1/cv/{active['id']}", headers=STUDENT)).status_code == 204
    assert (await client.get("/api/v1/cv", headers=STUDENT)).json() == []


@pytest.mark.asyncio
async def test_file_and_text_preview(client):
    pdf = make_pdf(CV_TEXT)
    cv = (await upload(client, "cv.pdf", pdf)).json()

    file_response = await client.get(f"/api/v1/cv/{cv['id']}/file", headers=STUDENT)
    assert file_response.status_code == 200
    assert file_response.headers["content-type"] == "application/pdf"
    assert file_response.headers["content-disposition"].startswith("inline")
    assert file_response.content == pdf

    text_response = await client.get(f"/api/v1/cv/{cv['id']}/text", headers=STUDENT)
    assert "FastAPI" in text_response.json()["text"]


@pytest.mark.asyncio
async def test_advisor_cannot_use_student_cv_endpoints(client):
    response = await client.get("/api/v1/cv", headers=ADVISOR)
    assert response.status_code == 403
    assert response.json()["code"] == "forbidden"


@pytest.mark.asyncio
async def test_unknown_cv_is_not_found(client):
    response = await client.post("/api/v1/cv/cv_khong_ton_tai/activate", headers=STUDENT)
    assert response.status_code == 404
    assert response.json()["code"] == "cv_not_found"


def test_detects_pdf_text_with_split_vietnamese_letters():
    """PDF xuất từ Chrome: chữ có dấu nằm ở font dự phòng, cách trích thường chèn khoảng trắng quanh chữ đó."""
    broken = (
        "PH Ạ M MINH NH Ậ T\nHà N ộ i, Vi ệ t Nam\nJunior Web Developer có n ề n t ả ng v ề  HTML ở  m ứ c c ơ  b ả n"
    )
    normal = (
        "Phạm Minh Nhật\nHà Nội, Việt Nam\nJunior Web Developer có nền tảng về HTML ở mức cơ bản, đã tham gia dự án"
    )
    assert _split_diacritics(broken) is True
    assert _split_diacritics(normal) is False
