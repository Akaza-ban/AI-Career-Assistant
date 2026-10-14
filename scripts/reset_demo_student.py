"""
Làm trống tài khoản demo sinh viên (minhanh.nguyen@gmail.com): xoá CV, phân tích, phỏng vấn, chia sẻ, tin nhắn,
thông báo… chỉ giữ thông tin cá nhân và mật khẩu, giống một tài khoản vừa tạo. Tài khoản cố vấn và nhóm SV mẫu giữ nguyên.

Chạy ở thư mục gốc repo:  .venv/Scripts/python -m scripts.reset_demo_student
(DB lấy theo DATABASE_URL trong .env; nên sao lưu data/app.db trước.)
"""

from src.db.database import SessionLocal, init_db
from src.db.models import User
from src.db.seed import DEMO_STUDENT_ID
from src.services import account


def main() -> None:
    init_db()
    with SessionLocal() as db:
        user = db.get(User, DEMO_STUDENT_ID)
        if user is None:
            print("Không có tài khoản demo sinh viên.")
            return
        account.delete_all_data(db, user)
        user.preferences = None
        db.commit()
        print(f"Đã làm trống dữ liệu của {user.full_name} ({user.email}).")


if __name__ == "__main__":
    main()
