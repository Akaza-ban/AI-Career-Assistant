"""JD theo cấu trúc chung: tách toàn văn, JD của bạn (sinh viên), thư viện JD do quản trị viên quản lý."""

import json

import pytest
from sqlalchemy import delete, select

from src.db.database import SessionLocal, init_db
from src.db.models import JobDescription, SavedJd
from src.db.seed import JD_LIBRARY_FILE
from src.services import jd_library
from tests.helpers import ADMIN, ADVISOR, STUDENT

API = "/api/v1"
FIXTURE_IDS = [item["id"] for item in json.loads(JD_LIBRARY_FILE.read_text(encoding="utf-8"))]
PASTED = """Ví điện tử Z tuyển Business Analyst (Fresher) – Mảng thanh toán
Địa điểm: Hà Nội · Toàn thời gian · Làm việc kết hợp
Mức lương: 12 – 15 triệu
Hạn nộp: 30/10/2026

Mô tả công việc:
- Làm việc với đội sản phẩm để thu thập và phân tích yêu cầu nghiệp vụ của mảng thanh toán.
- Viết tài liệu BRD/SRS, vẽ quy trình bằng BPMN, quản lý backlog trên Jira cùng đội phát triển.

Yêu cầu:
- Tốt nghiệp các ngành Hệ thống thông tin, Kinh tế; dưới 1 năm kinh nghiệm.
- Biết SQL, có khả năng phân tích yêu cầu và trình bày rõ ràng.

Quyền lợi:
- Lương tháng 13, bảo hiểm đầy đủ, làm việc kết hợp 2 ngày ở nhà mỗi tuần.
"""
LIBRARY_JD = {
    "title": "Business Analyst – Mảng thanh toán",
    "company": "Ví điện tử Z",
    "level": "fresher",
    "industry": "Fintech & ngân hàng",
    "employment_type": "full_time",
    "work_mode": "hybrid",
    "location": "Hà Nội",
    "experience": "under_1",
    "description": "- Thu thập và phân tích yêu cầu nghiệp vụ mảng thanh toán cùng đội sản phẩm và đội phát triển.\n"
    "- Viết tài liệu BRD/SRS, vẽ quy trình nghiệp vụ bằng BPMN và theo dõi backlog trên Jira hằng tuần.",
    "requirements": "- Biết SQL, có khả năng phân tích yêu cầu và trình bày tài liệu rõ ràng, mạch lạc.\n"
    "- Ưu tiên đã dùng Jira hoặc vẽ quy trình BPMN trong đồ án môn học hoặc thực tập.",
    "skills": [
        {"name": "SQL", "importance": "required", "aliases": ["MySQL"]},
        {"name": "BPMN", "importance": "preferred", "aliases": []},
    ],
}


@pytest.fixture(autouse=True)
def clean_jds(monkeypatch):
    monkeypatch.setattr(jd_library, "REINDEX", False)
    init_db()
    with SessionLocal() as db:
        db.execute(delete(SavedJd))
        db.execute(delete(JobDescription).where(JobDescription.source == "pasted"))
        db.execute(
            delete(JobDescription).where(JobDescription.source == "library", JobDescription.id.notin_(FIXTURE_IDS))
        )
        db.commit()


# ---------- Tách toàn văn ----------


@pytest.mark.asyncio
async def test_parse_splits_sections_and_fields(client):
    res = await client.post(f"{API}/jd/parse", json={"text": PASTED}, headers=STUDENT)
    assert res.status_code == 200
    d = res.json()
    assert (d["title"], d["company"], d["level"]) == (
        "Business Analyst (Fresher) – Mảng thanh toán",
        "Ví điện tử Z",
        "fresher",
    )
    assert (d["location"], d["salary"], d["deadline"]) == ("Hà Nội", "12 – 15 triệu", "2026-10-30")
    assert (d["employment_type"], d["work_mode"], d["experience"]) == ("full_time", "hybrid", "under_1")
    assert d["majors"] == ["Hệ thống thông tin", "Kinh tế"]
    assert d["description"].startswith("- Làm việc với đội sản phẩm")
    assert "Biết SQL" in d["requirements"] and "Lương tháng 13" in d["benefits"]
    skills = {s["name"]: s["importance"] for s in d["skills"]}
    assert skills["SQL"] == "required" and skills["BPMN"] == "preferred"
    assert d["skills_source"] == "sections" and d["used_ai"] is False and d["word_count"] > 50

    short = await client.post(f"{API}/jd/parse", json={"text": "Tuyển BA"}, headers=STUDENT)
    assert (short.status_code, short.json()["code"]) == (422, "jd_too_short")
    assert (await client.post(f"{API}/jd/parse", json={"text": PASTED}, headers=ADVISOR)).status_code == 403
    assert (await client.post(f"{API}/jd/parse", json={"text": PASTED}, headers=ADMIN)).status_code == 200


@pytest.mark.asyncio
async def test_library_jds_have_structure(client):
    library = {jd["id"]: jd for jd in (await client.get(f"{API}/jd/library", headers=STUDENT)).json()}
    ba = library["jd-ba-intern"]
    assert ba["description"].startswith("Công ty Công nghệ A")
    assert "Ưu tiên:" in ba["requirements"] and ba["benefits"]
    assert ba["majors"][:2] == ["Hệ thống thông tin", "Kinh tế"] and ba["skills_source"] == "admin"


# ---------- JD của bạn ----------


@pytest.mark.asyncio
async def test_student_adds_reviews_edits_and_deletes_jd(client):
    draft = (await client.post(f"{API}/jd/parse", json={"text": PASTED}, headers=STUDENT)).json()
    body = {k: draft[k] for k in ("title", "company", "description", "requirements", "skills", "skills_source")}
    # Sinh viên xoá cấp bậc ở bước xem lại (gửi null); trường không gửi thì lấy từ bản tách
    cleared_level = {"text": PASTED, "reviewed": True, **body, "level": None}
    missing = await client.post(f"{API}/jd", json=cleared_level, headers=STUDENT)
    assert (missing.status_code, missing.json()["code"]) == (422, "jd_fields_required")
    assert "cấp bậc" in missing.json()["detail"]

    # Kỹ năng không có trong JD (client tự thêm) bị bỏ
    skills = [*draft["skills"], {"name": "Kubernetes", "importance": "required", "aliases": []}]
    res = await client.post(
        f"{API}/jd",
        json={"text": PASTED, "reviewed": True, **body, "skills": skills, "level": "fresher", "salary": "15 triệu"},
        headers=STUDENT,
    )
    assert res.status_code == 201
    jd = res.json()
    assert (jd["source"], jd["level"], jd["salary"], jd["location"]) == ("pasted", "fresher", "15 triệu", "Hà Nội")
    assert "Kubernetes" not in {s["name"] for s in jd["skills"]} and "SQL" in {s["name"] for s in jd["skills"]}

    mine = (await client.get(f"{API}/jd/mine", headers=STUDENT)).json()
    assert [j["id"] for j in mine] == [jd["id"]]
    edited = await client.patch(f"{API}/jd/{jd['id']}", json={"company": "Ví điện tử Z+"}, headers=STUDENT)
    assert edited.json()["company"] == "Ví điện tử Z+"
    cleared = await client.patch(f"{API}/jd/{jd['id']}", json={"requirements": ""}, headers=STUDENT)
    assert cleared.status_code == 422

    assert (await client.put(f"{API}/jd/{jd['id']}/saved", headers=STUDENT)).status_code == 200
    assert (await client.delete(f"{API}/jd/{jd['id']}", headers=STUDENT)).status_code == 204
    assert (await client.get(f"{API}/jd/mine", headers=STUDENT)).json() == []
    assert jd["id"] not in {j["id"] for j in (await client.get(f"{API}/jd", headers=STUDENT)).json()}
    assert (await client.get(f"{API}/jd/saved", headers=STUDENT)).json() == []
    with SessionLocal() as db:
        assert db.get(JobDescription, jd["id"]) is not None  # lượt phân tích cũ vẫn mở được
    assert (await client.patch(f"{API}/jd/{jd['id']}", json={"title": "x"}, headers=STUDENT)).status_code == 404


@pytest.mark.asyncio
async def test_quick_paste_only_needs_title(client):
    """Dán ở màn So sánh: chỉ gửi tên vị trí, phần còn lại tự tách."""
    res = await client.post(f"{API}/jd", json={"title": "BA thanh toán", "text": PASTED}, headers=STUDENT)
    assert res.status_code == 201
    assert res.json()["title"] == "BA thanh toán" and res.json()["level"] == "fresher"


# ---------- Thư viện JD (quản trị) ----------


@pytest.mark.asyncio
async def test_admin_manages_library(client):
    url = f"{API}/admin/jds"
    assert (await client.get(url, headers=STUDENT)).status_code == 403
    no_location = {k: v for k, v in LIBRARY_JD.items() if k != "location"}
    assert (await client.post(url, json=no_location, headers=ADMIN)).json()["code"] == "jd_fields_required"
    only_preferred = {**LIBRARY_JD, "skills": [{"name": "BPMN", "importance": "preferred"}]}
    assert (await client.post(url, json=only_preferred, headers=ADMIN)).json()["code"] == "jd_skills_required"
    bad_industry = {**LIBRARY_JD, "industry": "Ngành tự đặt"}
    assert (await client.post(url, json=bad_industry, headers=ADMIN)).status_code == 422

    created = await client.post(url, json=LIBRARY_JD, headers=ADMIN)
    assert created.status_code == 201
    jd = created.json()
    assert (jd["source"], jd["status"], jd["skills_source"]) == ("library", "published", "admin")
    assert jd["content"].startswith("Business Analyst – Mảng thanh toán")
    duplicate = await client.post(url, json=LIBRARY_JD, headers=ADMIN)
    assert (duplicate.status_code, duplicate.json()["code"]) == (409, "jd_duplicate")

    assert jd["id"] in {j["id"] for j in (await client.get(f"{API}/jd/library", headers=STUDENT)).json()}
    rows = {r["id"]: r for r in (await client.get(url, headers=ADMIN)).json()}
    assert rows[jd["id"]]["usage_30d"] == 0 and len(rows) == len(FIXTURE_IDS) + 1

    hidden = await client.patch(f"{url}/{jd['id']}", json={"status": "hidden"}, headers=ADMIN)
    assert hidden.json()["status"] == "hidden"
    assert jd["id"] not in {j["id"] for j in (await client.get(f"{API}/jd/library", headers=STUDENT)).json()}
    edited = await client.patch(
        f"{url}/{jd['id']}", json={"salary": "Thoả thuận", "status": "published"}, headers=ADMIN
    )
    assert (edited.json()["salary"], edited.json()["status"]) == ("Thoả thuận", "published")
    with SessionLocal() as db:
        assert db.get(JobDescription, jd["id"]).updated_at is not None


@pytest.mark.asyncio
async def test_uploaded_jds_grouped_and_promoted(client):
    for headers in (STUDENT, STUDENT):
        await client.post(
            f"{API}/jd", json={"title": "BA thanh toán", "company": "Ví Z", "text": PASTED}, headers=headers
        )
    groups = (await client.get(f"{API}/admin/jds/uploaded", headers=ADMIN)).json()
    [group] = groups
    assert (group["title"], group["student_count"], group["library_jd_id"]) == ("BA thanh toán", 1, None)
    assert "owner_id" not in group

    source = (await client.get(f"{API}/admin/jds/{group['sample_jd_id']}", headers=ADMIN)).json()
    assert source["source"] == "pasted" and "owner_id" not in source
    body = {**LIBRARY_JD, "title": "BA thanh toán", "company": "Ví Z", "source_jd_id": group["sample_jd_id"]}
    promoted = (await client.post(f"{API}/admin/jds", json=body, headers=ADMIN)).json()
    [group] = (await client.get(f"{API}/admin/jds/uploaded", headers=ADMIN)).json()
    assert group["library_jd_id"] == promoted["id"]
    with SessionLocal() as db:
        # JD gốc của sinh viên giữ nguyên
        assert db.scalar(select(JobDescription).where(JobDescription.id == group["sample_jd_id"])).source == "pasted"
