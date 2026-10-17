import json

from fastapi import APIRouter, Response, status

from src.api.deps import CurrentStudent, DbSession
from src.models.schemas import DataExportResponse, StudentSettingsResponse, UpdateProfileRequest, UpdateSettingsRequest
from src.services import account

router = APIRouter(prefix="/students/me", tags=["Settings"])


@router.get("/settings", response_model=StudentSettingsResponse)
def get_settings(user: CurrentStudent, db: DbSession) -> dict:
    return account.settings_of(db, user)


@router.patch("/settings", response_model=StudentSettingsResponse)
def update_settings(body: UpdateSettingsRequest, user: CurrentStudent, db: DbSession) -> dict:
    """Bật / tắt cài đặt quyền riêng tư và thông báo (chỉ gửi các khoá cần đổi)."""
    return account.update_settings(db, user, body.privacy, body.notifications)


@router.patch("/profile", response_model=StudentSettingsResponse)
def update_profile(body: UpdateProfileRequest, user: CurrentStudent, db: DbSession) -> dict:
    """Sửa họ tên, số điện thoại, ngày sinh. Email dùng để đăng nhập nên không đổi ở đây."""
    return account.update_profile(db, user, body.full_name, body.phone, body.date_of_birth)


@router.post("/consent/withdraw", response_model=StudentSettingsResponse)
def withdraw_consent(user: CurrentStudent, db: DbSession) -> dict:
    return account.withdraw_consent(db, user)


@router.post("/data-export", response_model=DataExportResponse)
def request_data_export(user: CurrentStudent) -> DataExportResponse:
    """Dữ liệu được tạo khi tải; trả về đường dẫn tải (cùng phiên đăng nhập)."""
    return DataExportResponse(download_url="/api/v1/students/me/data-export/download")


@router.get("/data-export/download")
def download_data_export(user: CurrentStudent, db: DbSession) -> Response:
    payload = json.dumps(account.export_data(db, user), ensure_ascii=False, indent=2, default=str)
    return Response(
        content=payload,
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="careerv-du-lieu-cua-toi.json"'},
    )


@router.delete("/data", status_code=status.HTTP_204_NO_CONTENT)
def delete_all_data(user: CurrentStudent, db: DbSession) -> None:
    account.delete_all_data(db, user)
