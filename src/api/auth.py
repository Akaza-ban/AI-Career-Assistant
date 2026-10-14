from datetime import datetime

from fastapi import APIRouter, Response, status

from src.api.deps import CurrentUser, DbSession, SessionToken
from src.config import get_settings
from src.db.models import User
from src.models.schemas import (
    ChangePasswordRequest,
    ChangePasswordResponse,
    LoginRequest,
    LoginResponse,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    RegisterRequest,
    UserProfile,
)
from src.services import auth

router = APIRouter(prefix="/auth", tags=["Auth"])


def _set_session_cookie(response: Response, token: str, expires: datetime) -> None:
    settings = get_settings()
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=settings.session_days * 86_400,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )


def _signed_in(db: DbSession, response: Response, user: User) -> LoginResponse:
    token, expires = auth.create_session(db, user)
    _set_session_cookie(response, token, expires)
    profile = UserProfile.model_validate(user)
    return LoginResponse(role=user.role, profile=profile, must_change_password=profile.must_change_password)


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: DbSession, response: Response) -> LoginResponse:
    """
    Đăng nhập bằng email + mật khẩu. Sai 5 lần liên tiếp thì tạm khoá 15 phút (429 "too_many_attempts");
    tài khoản bị quản trị viên tạm khoá: 403 "account_disabled". must_change_password = true: đang dùng mật khẩu tạm.
    """
    user = auth.login(db, body.email, body.password)
    return _signed_in(db, response, user)


@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: DbSession, response: Response) -> LoginResponse:
    """Sinh viên tự tạo tài khoản và được đăng nhập ngay. Lỗi 409 "email_taken" khi email đã có tài khoản."""
    user = auth.register(
        db,
        full_name=body.full_name,
        date_of_birth=body.date_of_birth,
        phone=body.phone,
        email=body.email,
        password=body.password,
        consent=body.consent,
        integrity_pledge=body.integrity_pledge,
    )
    return _signed_in(db, response, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(db: DbSession, response: Response, session_token: SessionToken = None) -> None:
    """Kết thúc phiên hiện tại (gọi được cả khi phiên đã hết hạn)."""
    auth.end_session(db, session_token)
    response.delete_cookie(get_settings().session_cookie_name, path="/")


@router.post("/password-reset", status_code=status.HTTP_204_NO_CONTENT)
def request_password_reset(body: PasswordResetRequest, db: DbSession) -> None:
    """Gửi link đặt lại mật khẩu. Luôn trả 204 để không lộ email nào đã có tài khoản."""
    auth.request_password_reset(db, body.email)


@router.post("/password-reset/confirm", response_model=LoginResponse)
def confirm_password_reset(body: PasswordResetConfirmRequest, db: DbSession, response: Response) -> LoginResponse:
    """Đặt mật khẩu mới từ link trong email rồi đăng nhập luôn. Lỗi 400 "invalid_token" khi link hết hạn."""
    user = auth.confirm_password_reset(db, body.token, body.new_password)
    return _signed_in(db, response, user)


@router.post("/change-password", response_model=ChangePasswordResponse)
def change_password(
    body: ChangePasswordRequest, user: CurrentUser, db: DbSession, response: Response
) -> ChangePasswordResponse:
    """Đổi mật khẩu khi đang đăng nhập; các thiết bị khác bị đăng xuất, thiết bị này nhận phiên mới."""
    updated_at = auth.change_password(db, user, body.current_password, body.new_password)
    token, expires = auth.create_session(db, user)
    _set_session_cookie(response, token, expires)
    return ChangePasswordResponse(password_updated_at=updated_at)
