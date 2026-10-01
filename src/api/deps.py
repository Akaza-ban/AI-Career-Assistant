from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from src.api.errors import AppError
from src.db.database import get_db
from src.db.models import User
from src.db.seed import DEMO_ADVISOR_ID, DEMO_STUDENT_ID

DbSession = Annotated[Session, Depends(get_db)]

# Đăng nhập tạm thời: frontend gửi vai trò đang chọn qua header X-Demo-Role và backend
# ánh xạ sang người dùng demo cố định. Khi có đăng nhập bằng mật khẩu, chỉ cần thay phần thân
# get_current_user (đọc session/JWT) — các route dùng CurrentUser không phải sửa.
_DEMO_USER_BY_ROLE = {"student": DEMO_STUDENT_ID, "advisor": DEMO_ADVISOR_ID}


def get_current_user(db: DbSession, x_demo_role: Annotated[str | None, Header()] = None) -> User:
    user_id = _DEMO_USER_BY_ROLE.get(x_demo_role or "")
    if user_id is None:
        raise AppError(401, "Bạn chưa đăng nhập. Hãy chọn vai trò ở trang chủ.", "unauthenticated")
    user = db.get(User, user_id)
    if user is None:
        raise AppError(401, "Không tìm thấy tài khoản demo. Hãy khởi động lại backend.", "unauthenticated")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_student(user: CurrentUser) -> User:
    if user.role != "student":
        raise AppError(403, "Chức năng này chỉ dành cho sinh viên.", "forbidden")
    return user


CurrentStudent = Annotated[User, Depends(get_current_student)]


def get_current_advisor(user: CurrentUser) -> User:
    if user.role != "advisor":
        raise AppError(403, "Chức năng này chỉ dành cho cố vấn.", "forbidden")
    return user


CurrentAdvisor = Annotated[User, Depends(get_current_advisor)]
