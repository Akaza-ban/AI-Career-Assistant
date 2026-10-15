"""Đổi tên CareerX → CareerV: tài khoản demo tạo trước đó được đổi email và mật khẩu demo khi khởi động."""

from sqlalchemy import select

from src.db.database import SessionLocal, init_db
from src.db.models import User
from src.db.seed import DEMO_ADMIN_ID, DEMO_ADVISOR_ID, seed_demo_users
from src.services.auth import hash_password, verify_password


def test_legacy_careerx_accounts_are_migrated():
    init_db()
    with SessionLocal() as db:
        advisor, admin = db.get(User, DEMO_ADVISOR_ID), db.get(User, DEMO_ADMIN_ID)
        # Trạng thái như DB tạo trước khi đổi tên
        advisor.email = "nam.tran@careerx.vn"
        advisor.password_hash = hash_password("careerx123")
        admin.email = "admin@careerx.vn"
        admin.password_hash = hash_password("mat-khau-rieng-1")  # quản trị đã tự đổi mật khẩu: giữ nguyên
        db.commit()

        seed_demo_users(db)

        advisor, admin = db.get(User, DEMO_ADVISOR_ID), db.get(User, DEMO_ADMIN_ID)
        assert (advisor.email, admin.email) == ("nam.tran@careerv.vn", "admin@careerv.vn")
        assert verify_password("careerv123", advisor.password_hash)
        assert verify_password("mat-khau-rieng-1", admin.password_hash)
        assert db.scalars(select(User).where(User.email.like("%@careerx.vn"))).first() is None
