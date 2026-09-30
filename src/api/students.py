"""Tổng quan (S1) và Lịch sử & Tiến bộ (S8) của sinh viên đang đăng nhập."""

from fastapi import APIRouter, Query

from src.api.deps import CurrentStudent, DbSession
from src.db.models import utcnow
from src.models.schemas import ProgressRange, StudentOverviewResponse, StudentProgressResponse
from src.services import progress

router = APIRouter(prefix="/students/me", tags=["Student Progress"])


@router.get("/overview", response_model=StudentOverviewResponse)
def get_overview(user: CurrentStudent, db: DbSession) -> dict:
    """
    Số liệu tổng hợp cho trang Tổng quan: CV, độ khớp gần nhất, điểm STAR gần nhất (so với buổi đầu cùng vị trí),
    việc đang dở, bước nên làm tiếp theo, kỹ năng còn thiếu và các hoạt động gần đây.
    """
    return progress.overview(db, user, utcnow())


@router.get("/progress", response_model=StudentProgressResponse)
def get_progress(
    user: CurrentStudent,
    db: DbSession,
    range_: ProgressRange = Query("all", alias="range", description="30d / 90d / all"),
    jd_id: str | None = Query(None, description="Chỉ lấy dữ liệu của một vị trí (JD)"),
) -> dict:
    """
    Tiến bộ phỏng vấn (điểm 0–5 theo từng vị trí, S/T/A/R buổi trước so với buổi gần nhất), tiến bộ CV
    (độ khớp qua các phiên bản CV với cùng JD) và danh sách buổi phỏng vấn, lượt phân tích.
    """
    return progress.progress(db, user, range_, jd_id, utcnow())
