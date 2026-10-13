import json
from pathlib import Path

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from src.config import get_settings
from src.db.models import AdvisorAssignment, GapAnalysis, JobDescription, User
from src.services.auth import hash_password

# Individual development accounts. IDs are retained for existing records; these
# accounts now require their own credentials and are never selected by role.
DEMO_STUDENT_ID = "sv-0142"
SECOND_STUDENT_ID = "sv-0143"
DEMO_ADVISOR_ID = "cv-007"

# Public development-only passwords, never used to provision production accounts.
DEV_PASSWORDS = {
    DEMO_STUDENT_ID: "Student-A-dev-only!",
    SECOND_STUDENT_ID: "Student-B-dev-only!",
    DEMO_ADVISOR_ID: "Advisor-dev-only!",
}

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
        "id": SECOND_STUDENT_ID,
        "role": "student",
        "full_name": "Lê Thu Hà",
        "subtitle": "HTTT - K2022",
        "email": "thuha.k22@student.university.edu.vn",
        "student_code": "22125431",
        "major": "Hệ thống thông tin",
        "cohort": "K2022",
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
    """Seed individual development accounts; preserve existing passwords and assignments."""
    settings = get_settings()
    if settings.app_env == "production":
        return
    passwords = {
        DEMO_STUDENT_ID: settings.seed_student_a_password.get_secret_value() or DEV_PASSWORDS[DEMO_STUDENT_ID],
        SECOND_STUDENT_ID: settings.seed_student_b_password.get_secret_value() or DEV_PASSWORDS[SECOND_STUDENT_ID],
        DEMO_ADVISOR_ID: settings.seed_advisor_password.get_secret_value() or DEV_PASSWORDS[DEMO_ADVISOR_ID],
    }
    for data in DEMO_USERS:
        user = db.get(User, data["id"])
        if user is None:
            user = User(**data)
            db.add(user)
        else:
            for key, value in data.items():
                if getattr(user, key) is None:
                    setattr(user, key, value)
        if not user.password_hash:
            user.password_hash = hash_password(passwords[data["id"]])
    db.flush()
    assign(db, DEMO_ADVISOR_ID, DEMO_STUDENT_ID)
    assign(db, DEMO_ADVISOR_ID, SECOND_STUDENT_ID)
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


if __name__ == "__main__":
    # Run from the repository root: python -m src.db.seed.
    from src.db.database import init_db

    init_db()
