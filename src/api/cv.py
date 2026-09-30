"""Quản lý CV của sinh viên (US-SV-01): tải lên, danh sách phiên bản, đặt CV đang dùng, xoá, xem file, xuất CV."""

import uuid
from typing import Annotated

from fastapi import APIRouter, File, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select, update

from src.api.deps import CurrentStudent, DbSession
from src.api.errors import AppError
from src.db.models import CvVersion, GapAnalysis, JobDescription
from src.models.schemas import CvTextResponse, CvVersionResponse, ExportCvRequest, ExportCvResponse
from src.services import cv_files, cv_optimizer, sharing

router = APIRouter(prefix="/cv", tags=["CV Management"])


def to_response(cv: CvVersion, latest: tuple[GapAnalysis, str] | None = None) -> CvVersionResponse:
    """latest: (lượt phân tích hoàn tất gần nhất của phiên bản này, tên vị trí của JD)."""
    analysis, jd_title = latest or (None, None)
    return CvVersionResponse(
        id=cv.id,
        version=cv.version,
        label=f"v{cv.version}.0",
        file_name=cv.file_name,
        file_type=cv.file_type,
        size_bytes=cv.size_bytes,
        page_count=cv.page_count,
        uploaded_at=cv.uploaded_at,
        origin=cv.origin,
        is_active=cv.is_active,
        is_draft=cv.is_draft,
        target_title=jd_title,
        # Thẻ CV hiển thị "Độ khớp JD gần nhất" = CV–JD Matching Score của lần phân tích gần nhất
        match_score=round(analysis.match_score) if analysis and analysis.match_score is not None else None,
        latest_analysis_id=analysis.id if analysis else None,
        source_analysis_id=cv.source_analysis_id,
    )


def latest_analyses(db: DbSession, owner_id: str) -> dict[str, tuple[GapAnalysis, str]]:
    """Lượt phân tích hoàn tất gần nhất cho từng phiên bản CV của sinh viên."""
    rows = db.execute(
        select(GapAnalysis, JobDescription.title)
        .join(JobDescription, JobDescription.id == GapAnalysis.jd_id)
        .where(GapAnalysis.owner_id == owner_id, GapAnalysis.status == "completed")
        .order_by(GapAnalysis.created_at)
    )
    return {analysis.cv_version_id: (analysis, title) for analysis, title in rows}


def get_owned_cv(db: DbSession, owner_id: str, cv_id: str) -> CvVersion:
    """CV của chính sinh viên; CV của người khác cũng trả 404 để không lộ sự tồn tại."""
    cv = db.get(CvVersion, cv_id)
    if cv is None or cv.owner_id != owner_id:
        raise AppError(404, "Không tìm thấy phiên bản CV.", "cv_not_found")
    return cv


@router.get("", response_model=list[CvVersionResponse])
def list_cv_versions(user: CurrentStudent, db: DbSession) -> list[CvVersionResponse]:
    """Các phiên bản CV của sinh viên, mới nhất trước."""
    cvs = db.scalars(select(CvVersion).where(CvVersion.owner_id == user.id).order_by(CvVersion.version.desc()))
    latest = latest_analyses(db, user.id)
    return [to_response(cv, latest.get(cv.id)) for cv in cvs]


@router.post("/upload", response_model=CvVersionResponse, status_code=status.HTTP_201_CREATED)
def upload_cv(
    user: CurrentStudent,
    db: DbSession,
    file: Annotated[UploadFile, File(description="File CV định dạng PDF hoặc DOCX, tối đa 5MB")],
) -> CvVersionResponse:
    """
    Tải lên CV mới và tạo phiên bản kế tiếp (không ghi đè bản cũ).
    Từ chối file sai định dạng / quá 5MB (AC3) và file không trích xuất được văn bản như PDF scan (AC2).
    """
    file_name = file.filename or "cv"
    file_type = cv_files.file_type_of(file_name)
    data = file.file.read(cv_files.CV_MAX_BYTES + 1)
    cv_files.check_size(len(data))
    extracted = cv_files.extract_cv(file_type, data)

    latest = db.scalar(select(func.max(CvVersion.version)).where(CvVersion.owner_id == user.id))
    cv = CvVersion(
        id=f"cv_{uuid.uuid4().hex[:12]}",
        owner_id=user.id,
        version=(latest or 0) + 1,
        file_name=file_name,
        file_type=file_type,
        size_bytes=len(data),
        page_count=extracted.page_count,
        content_text=extracted.text,
        # CV đầu tiên tự động là phiên bản đang dùng
        is_active=latest is None,
    )
    cv_files.save_file(user.id, cv.id, file_type, data)
    db.add(cv)
    try:
        db.commit()
    except Exception:
        cv_files.delete_file(user.id, cv.id, file_type)
        raise
    return to_response(cv)


@router.post("/{cv_id}/activate", response_model=CvVersionResponse)
def set_active_cv(cv_id: str, user: CurrentStudent, db: DbSession) -> CvVersionResponse:
    """Đặt một phiên bản làm CV đang dùng (mỗi sinh viên chỉ có một)."""
    cv = get_owned_cv(db, user.id, cv_id)
    db.execute(update(CvVersion).where(CvVersion.owner_id == user.id).values(is_active=False))
    cv.is_active = True
    db.commit()
    return to_response(cv, latest_analyses(db, user.id).get(cv.id))


@router.delete("/{cv_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cv(cv_id: str, user: CurrentStudent, db: DbSession) -> Response:
    """Xoá một phiên bản CV. Không xoá được CV đang dùng khi vẫn còn phiên bản khác."""
    cv = get_owned_cv(db, user.id, cv_id)
    if cv.is_active:
        others = db.scalar(
            select(func.count()).select_from(CvVersion).where(CvVersion.owner_id == user.id, CvVersion.id != cv.id)
        )
        if others:
            raise AppError(
                409,
                "Đây là CV đang dùng. Hãy chọn một phiên bản khác làm CV đang dùng trước khi xoá.",
                "cv_active",
            )
    db.delete(cv)
    sharing.unshare_deleted(db, cv.id)
    db.commit()
    cv_files.delete_file(user.id, cv.id, cv.file_type)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{cv_id}/file")
def get_cv_file(cv_id: str, user: CurrentStudent, db: DbSession) -> FileResponse:
    """File gốc của phiên bản CV (PDF hiển thị trực tiếp trong trình duyệt)."""
    cv = get_owned_cv(db, user.id, cv_id)
    path = cv_files.stored_path(user.id, cv.id, cv.file_type)
    if not path.exists():
        raise AppError(404, "Không tìm thấy file gốc của CV này.", "cv_file_missing")
    return FileResponse(
        path,
        media_type=cv_files.CV_MEDIA_TYPES[cv.file_type],
        filename=cv.file_name,
        content_disposition_type="inline",
    )


@router.get("/{cv_id}/text", response_model=CvTextResponse)
def get_cv_text(cv_id: str, user: CurrentStudent, db: DbSession) -> CvTextResponse:
    """Văn bản đã trích từ CV, dùng để xem nhanh file DOCX (trình duyệt không hiển thị được DOCX)."""
    cv = get_owned_cv(db, user.id, cv_id)
    return CvTextResponse(text=cv_optimizer.display_text(cv))


@router.post("/{cv_id}/export", response_model=ExportCvResponse)
def export_cv(cv_id: str, body: ExportCvRequest, user: CurrentStudent, db: DbSession) -> ExportCvResponse:
    """
    Ghi nhận một lần xuất CV sau khi SV tick cam kết liêm chính (bắt buộc). Sau đó frontend tải file
    (GET /cv/{cv_id}/file), mở hộp thoại in của trình duyệt, hoặc hiển thị các câu đã sửa để sao chép.
    """
    cv = get_owned_cv(db, user.id, cv_id)
    export = cv_optimizer.record_export(db, user, cv, body.format, body.integrity_confirmed)
    return ExportCvResponse(id=export.id, format=export.format, confirmed_at=export.integrity_confirmed_at)
