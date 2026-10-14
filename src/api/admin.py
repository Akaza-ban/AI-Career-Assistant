"""
Trang Quản trị: thống kê toàn hệ thống, quản lý tài khoản cố vấn và phân công sinh viên. Chỉ tài khoản "admin".
"""

from typing import Any, Literal

from fastapi import APIRouter, Query, status

from src.api.deps import CurrentAdmin, DbSession
from src.db.models import JobDescription, utcnow
from src.models.schemas import (
    AdminAdvisorResponse,
    AdminCommentsResponse,
    AdminJdDetail,
    AdminJdRow,
    AdminJdUpsert,
    AdminStatsResponse,
    AdminStudentResponse,
    AdminUploadedJd,
    AssignAdvisorRequest,
    AssignAdvisorResponse,
    CreateAdvisorRequest,
    ResetAdvisorPasswordRequest,
    UpdateAdvisorRequest,
)
from src.services import admin, jd_library

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats", response_model=AdminStatsResponse)
def get_stats(user: CurrentAdmin, db: DbSession, days: int = Query(30, description="Kỳ thống kê: 7, 30 hoặc 90")):
    """
    Tổng quan hệ thống: số SV (mới tuần này, hoạt động trong kỳ), cố vấn, SV chưa phân công; lượt phân tích / phỏng vấn
    theo tuần và so với kỳ trước; CSAT và phân bố số sao trong kỳ; nhận xét gần đây (không kèm tên SV).
    """
    return admin.stats(db, utcnow(), days)


@router.get("/comments", response_model=AdminCommentsResponse)
def list_comments(
    user: CurrentAdmin,
    db: DbSession,
    days: int | None = Query(None, description="7, 30 hoặc 90; bỏ trống = mọi lúc"),
    stars: int | None = Query(None, ge=1, le=5),
    activity: Literal["gap_analysis", "optimizer", "interview"] | None = Query(None),
    reason: str | None = Query(None, description="Mã lý do, ví dụ off_target"),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    """Mọi nhận xét kèm đánh giá CSAT của sinh viên (không kèm tên), mới nhất trước, có lọc và phân trang."""
    return admin.list_comments(
        db, utcnow(), days=days, stars=stars, activity=activity, reason=reason, offset=offset, limit=limit
    )


@router.get("/advisors", response_model=list[AdminAdvisorResponse])
def list_advisors(user: CurrentAdmin, db: DbSession) -> list[dict[str, Any]]:
    """Mọi tài khoản cố vấn: số SV phụ trách, số buổi chờ nhận xét, trạng thái (hoạt động / chưa đổi mật khẩu tạm / tạm khoá)."""
    return admin.list_advisors(db)


@router.post("/advisors", response_model=AdminAdvisorResponse, status_code=status.HTTP_201_CREATED)
def create_advisor(body: CreateAdvisorRequest, user: CurrentAdmin, db: DbSession) -> dict[str, Any]:
    """Tạo tài khoản cố vấn với mật khẩu tạm; cố vấn phải đổi ở lần đăng nhập đầu. Lỗi 409 "email_taken"."""
    return admin.create_advisor(db, body.full_name, body.email, body.title, body.temporary_password)


@router.patch("/advisors/{advisor_id}", response_model=AdminAdvisorResponse)
def update_advisor(advisor_id: str, body: UpdateAdvisorRequest, user: CurrentAdmin, db: DbSession) -> dict[str, Any]:
    """Sửa họ tên / email / chức danh, hoặc tạm khoá (disabled=true: đăng xuất mọi phiên) và mở khoá."""
    return admin.update_advisor(
        db,
        advisor_id,
        full_name=body.full_name,
        email=body.email,
        title=body.title,
        disabled=body.disabled,
        now=utcnow(),
    )


@router.post("/advisors/{advisor_id}/reset-password", response_model=AdminAdvisorResponse)
def reset_advisor_password(
    advisor_id: str, body: ResetAdvisorPasswordRequest, user: CurrentAdmin, db: DbSession
) -> dict[str, Any]:
    """Đặt mật khẩu tạm mới cho cố vấn; các phiên cũ bị đăng xuất."""
    return admin.reset_advisor_password(db, advisor_id, body.temporary_password)


@router.get("/students", response_model=list[AdminStudentResponse])
def list_students(user: CurrentAdmin, db: DbSession) -> list[dict[str, Any]]:
    """Mọi SV (mới nhất trước) kèm cố vấn phụ trách (null = chưa phân công) và lần hoạt động gần nhất."""
    return admin.list_students(db)


@router.post("/assignments", response_model=AssignAdvisorResponse)
def assign_advisor(body: AssignAdvisorRequest, user: CurrentAdmin, db: DbSession) -> dict[str, int]:
    """Gán / đổi cố vấn cho một hoặc nhiều SV. Đổi cố vấn thì tài liệu SV đã chia sẻ chuyển về riêng tư."""
    return admin.assign(db, body.student_ids, body.advisor_id, utcnow())


# ---------- Thư viện JD ----------

_UPSERT_EXCLUDE = {"skills", "text", "source_jd_id", "status"}


@router.get("/jds", response_model=list[AdminJdRow])
def list_library_jds(user: CurrentAdmin, db: DbSession) -> list[dict[str, Any]]:
    """Mọi JD thư viện (cả đã ẩn) kèm lượt phân tích CV + phỏng vấn trong 30 ngày."""
    return jd_library.list_library(db, utcnow())


@router.get("/jds/uploaded", response_model=list[AdminUploadedJd])
def list_uploaded_jds(user: CurrentAdmin, db: DbSession) -> list[dict[str, Any]]:
    """JD sinh viên tự dán, gộp theo vị trí – công ty; không kèm tên sinh viên."""
    return jd_library.list_uploaded(db)


@router.get("/jds/{jd_id}", response_model=AdminJdDetail)
def get_jd(jd_id: str, user: CurrentAdmin, db: DbSession) -> JobDescription:
    """Một JD để sửa (thư viện) hoặc để điền sẵn form "Đưa vào thư viện" (JD sinh viên tải lên)."""
    return jd_library.get_for_admin(db, jd_id)


@router.post("/jds", response_model=AdminJdDetail, status_code=status.HTTP_201_CREATED)
def create_library_jd(body: AdminJdUpsert, user: CurrentAdmin, db: DbSession) -> JobDescription:
    """Thêm JD vào thư viện (hiển thị ngay). Lỗi 409 "jd_duplicate" khi đã có vị trí cùng tên và công ty."""
    return jd_library.create_library(
        db,
        body.model_dump(exclude_unset=True, exclude=_UPSERT_EXCLUDE),
        [s.model_dump() for s in body.skills or []],
        text=body.text,
        source_jd_id=body.source_jd_id,
        now=utcnow(),
    )


@router.patch("/jds/{jd_id}", response_model=AdminJdDetail)
def update_library_jd(jd_id: str, body: AdminJdUpsert, user: CurrentAdmin, db: DbSession) -> JobDescription:
    """Sửa JD thư viện, hoặc ẩn / hiện (status). Ẩn: sinh viên không thấy nữa, dữ liệu cũ giữ nguyên."""
    return jd_library.update_library(
        db,
        jd_id,
        body.model_dump(exclude_unset=True, exclude=_UPSERT_EXCLUDE),
        [s.model_dump() for s in body.skills] if body.skills is not None else None,
        body.status,
        utcnow(),
    )
