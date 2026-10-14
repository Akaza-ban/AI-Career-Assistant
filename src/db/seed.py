import json
from pathlib import Path

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from src.db.models import AdvisorAssignment, GapAnalysis, JobDescription, User

# Người dùng demo cho giai đoạn chưa có đăng nhập thật.
# Trùng id/tên với dữ liệu mock của frontend (frontend/lib/mocks/data.ts) để giao diện nhất quán
# khi một số nhóm API gọi backend thật còn các nhóm khác vẫn dùng mock.
DEMO_STUDENT_ID = "sv-0142"
DEMO_ADVISOR_ID = "cv-007"

DEMO_USERS = [
    {
        "id": DEMO_STUDENT_ID,
        "role": "student",
        "full_name": "Nguyễn Minh Anh",
        "subtitle": "KDQT - K2021",
        "email": "minhanh.k21@student.university.edu.vn",
        "student_code": "21125430",
        "major": "Kinh doanh quốc tế",
        "cohort": "K2021",
    },
    {
        "id": DEMO_ADVISOR_ID,
        "role": "advisor",
        "full_name": "ThS. Trần Hoàng Nam",
        "subtitle": "Khoa HTTT",
        "email": "nam.th@university.edu.vn",
        "title": "Cố vấn nghề nghiệp Khoa Hệ thống thông tin",
        "office": "Phòng A2.305",
        "office_hours": "Thứ 3 & Thứ 5 (14:00 – 16:30)",
    },
]


def seed_demo_users(db: Session) -> None:
    """
    Thêm người dùng demo nếu chưa có và phân công SV demo cho cố vấn demo. Bản ghi đã có chỉ được bổ sung
    các trường còn trống (ví dụ trường hồ sơ mới thêm), không ghi đè.
    """
    for data in DEMO_USERS:
        user = db.get(User, data["id"])
        if user is None:
            db.add(User(**data))
            continue
        for key, value in data.items():
            if getattr(user, key) is None:
                setattr(user, key, value)
    db.flush()
    assign(db, DEMO_ADVISOR_ID, DEMO_STUDENT_ID)
    db.commit()


def assign(db: Session, advisor_id: str, student_id: str) -> None:
    """Phân công cố vấn cho SV nếu SV chưa có cố vấn."""
    if db.scalar(select(AdvisorAssignment).where(AdvisorAssignment.student_id == student_id)) is None:
        db.add(AdvisorAssignment(id=f"as_{student_id}", advisor_id=advisor_id, student_id=student_id))


JD_LIBRARY_FILE = Path(__file__).parent / "fixtures" / "jd_library.json"


def seed_jd_library(db: Session) -> None:
    """Đồng bộ thư viện JD từ fixtures/jd_library.json (thêm mới hoặc cập nhật theo id)."""
    items = json.loads(JD_LIBRARY_FILE.read_text(encoding="utf-8"))
    for item in items:
        jd = db.get(JobDescription, item["id"]) or JobDescription(id=item["id"], source="library")
        jd.title = item["title"]
        jd.company = item.get("company")
        jd.industry = item.get("industry")
        jd.level = item.get("level")
        jd.content = item["content"]
        jd.skills = item["skills"]
        db.add(jd)
    db.commit()


def fail_interrupted_analyses(db: Session) -> None:
    """Lượt phân tích đang chạy dở khi máy chủ tắt sẽ không bao giờ xong; đánh dấu lỗi để SV chạy lại."""
    db.execute(
        update(GapAnalysis)
        .where(GapAnalysis.status == "processing")
        .values(
            status="failed",
            current_step=None,
            error_message="Máy chủ đã khởi động lại trong lúc phân tích. Hãy bấm Thử lại.",
        )
    )
    db.commit()


def seed_vector_store() -> int:
    """Nạp và index toàn bộ JD từ fixtures vào Vector Store (ChromaDB)."""
    try:
        from src.services.jd_store import get_jd_store

        store = get_jd_store()
        count = store.index_from_fixtures(str(JD_LIBRARY_FILE))
        return count
    except Exception as e:
        import logging

        logging.getLogger(__name__).warning("Không thể nạp JD Vector Store: %s", e)
        return 0
