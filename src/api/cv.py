"""
Quản lý CV của sinh viên (US-SV-01): tải lên, danh sách CV, lịch sử phiên bản, khôi phục, đặt CV đang dùng, xoá,
xem file, xuất CV. Quy tắc phiên bản (v1.0, v1.1, v2.0) nằm ở services/cv_versions.py.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, File, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select, update

from src.api.deps import CurrentStudent, DbSession
from src.api.errors import AppError
from src.db.models import CvVersion, GapAnalysis, JobDescription, utcnow
from src.models.schemas import CvTextResponse, CvVersionResponse, ExportCvRequest, ExportCvResponse
from src.services import cv_files, cv_optimizer, cv_versions, sharing

router = APIRouter(prefix="/cv", tags=["CV Management"])


def to_response(
    cv: CvVersion,
    latest: tuple[GapAnalysis, str] | None = None,
    *,
    version_count: int = 1,
    target_title: str | None = None,
    source_jd_title: str | None = None,
    restored_from_label: str | None = None,
) -> CvVersionResponse:
    """latest: (lượt phân tích hoàn tất gần nhất của phiên bản này, tên vị trí của JD);
    target_title: vị trí dùng khi phiên bản này chưa được phân tích (ví dụ vị trí của bản trước trong cùng CV)."""
    analysis, jd_title = latest or (None, None)
    return CvVersionResponse(
        id=cv.id,
        version=cv.version,
        label=cv_versions.label(cv),
        family_id=cv_versions.family_of(cv),
        version_count=version_count,
        file_name=cv.file_name,
        file_type=cv.file_type,
        size_bytes=cv.size_bytes,
        page_count=cv.page_count,
        uploaded_at=cv.uploaded_at,
        origin=cv.origin,
        is_active=cv.is_active,
        is_draft=cv.is_draft,
        target_title=jd_title or target_title,
        # Thẻ CV hiển thị "Độ khớp JD gần nhất" = CV–JD Matching Score của lần phân tích gần nhất
        match_score=round(analysis.match_score) if analysis and analysis.match_score is not None else None,
        latest_analysis_id=analysis.id if analysis else None,
        source_analysis_id=cv.source_analysis_id,
        source_jd_title=source_jd_title,
        restored_from_label=restored_from_label,
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


def _versions(db: DbSession, cv: CvVersion) -> list[CvVersion]:
    """Các phiên bản của CV chứa cv, mới nhất trước."""
    return cv_versions.versions_of(db, cv.owner_id, cv_versions.family_of(cv)) or [cv]


def head_response(versions: list[CvVersion], latest: dict[str, tuple[GapAnalysis, str]]) -> CvVersionResponse:
    """Thẻ CV: phiên bản mới nhất; vị trí lấy từ bản gần nhất đã được phân tích nếu bản mới nhất chưa phân tích."""
    target = next((latest[v.id][1] for v in versions if v.id in latest), None)
    return to_response(versions[0], latest.get(versions[0].id), version_count=len(versions), target_title=target)


@router.get("", response_model=list[CvVersionResponse])
def list_cvs(user: CurrentStudent, db: DbSession) -> list[CvVersionResponse]:
    """Mỗi CV một dòng: phiên bản mới nhất kèm số phiên bản; CV vừa có bản mới đứng trước."""
    latest = latest_analyses(db, user.id)
    return [head_response(versions, latest) for versions in cv_versions.families(db, user.id)]


@router.post("/upload", response_model=CvVersionResponse, status_code=status.HTTP_201_CREATED)
def upload_cv(
    user: CurrentStudent,
    db: DbSession,
    file: Annotated[UploadFile, File(description="File CV định dạng PDF hoặc DOCX (nhận cả PDF scan), tối đa 5MB")],
) -> CvVersionResponse:
    """
    Tải lên một CV mới (bản đầu tiên v1.0), không đụng tới các CV đã có.
    Từ chối file sai định dạng / quá 5MB (AC3). PDF scan được đọc bằng OCR (read_by_ocr = true); chỉ từ chối khi
    vẫn không đọc được chữ (AC2).
    """
    file_name = file.filename or "cv"
    file_type = cv_files.file_type_of(file_name)
    data = file.file.read(cv_files.CV_MAX_BYTES + 1)
    cv_files.check_size(len(data))
    extracted = cv_files.extract_cv(file_type, data)

    sequence = cv_versions.next_sequence(db, user.id)
    cv = CvVersion(
        id=f"cv_{uuid.uuid4().hex[:12]}",
        owner_id=user.id,
        version=sequence,
        file_name=file_name,
        file_type=file_type,
        size_bytes=len(data),
        page_count=extracted.page_count,
        content_text=extracted.text,
        # CV đầu tiên tự động là CV đang dùng
        is_active=sequence == 1,
    )
    cv_versions.start_family(cv)
    cv_files.save_file(user.id, cv.id, file_type, data)
    db.add(cv)
    try:
        db.commit()
    except Exception:
        cv_files.delete_file(user.id, cv.id, file_type)
        raise
    return to_response(cv).model_copy(update={"read_by_ocr": extracted.read_by_ocr})


@router.get("/{cv_id}/versions", response_model=list[CvVersionResponse])
def list_versions(cv_id: str, user: CurrentStudent, db: DbSession) -> list[CvVersionResponse]:
    """Lịch sử phiên bản của CV chứa phiên bản cv_id (nhận cả mã CV), mới nhất trước."""
    versions = _versions(db, get_owned_cv(db, user.id, cv_id))
    latest = latest_analyses(db, user.id)
    labels = {v.id: cv_versions.label(v) for v in versions}
    sources = [v.source_analysis_id for v in versions if v.source_analysis_id]
    titles = dict(
        db.execute(
            select(GapAnalysis.id, JobDescription.title)
            .join(JobDescription, JobDescription.id == GapAnalysis.jd_id)
            .where(GapAnalysis.id.in_(sources))
        ).all()
    )
    return [
        to_response(
            v,
            latest.get(v.id),
            version_count=len(versions),
            source_jd_title=titles.get(v.source_analysis_id or ""),
            restored_from_label=labels.get(v.restored_from_id or ""),
        )
        for v in versions
    ]


@router.post("/{cv_id}/restore", response_model=CvVersionResponse, status_code=status.HTTP_201_CREATED)
def restore_version(cv_id: str, user: CurrentStudent, db: DbSession) -> CvVersionResponse:
    """
    Khôi phục phiên bản cv_id: tạo bản sao làm phiên bản mới nhất của CV với số chính mới (ví dụ v1.1 → v2.0).
    Không xoá bản nào; CV đang dùng thì bản khôi phục tự thành bản đang dùng.
    """
    source = get_owned_cv(db, user.id, cv_id)
    restored = cv_versions.restore(db, source, utcnow())
    return to_response(
        restored, version_count=len(_versions(db, restored)), restored_from_label=cv_versions.label(source)
    )


@router.post("/{cv_id}/activate", response_model=CvVersionResponse)
def set_active_cv(cv_id: str, user: CurrentStudent, db: DbSession) -> CvVersionResponse:
    """Đặt một CV làm CV đang dùng (mỗi sinh viên chỉ có một); bản đang dùng là phiên bản mới nhất của CV đó."""
    versions = _versions(db, get_owned_cv(db, user.id, cv_id))
    db.execute(update(CvVersion).where(CvVersion.owner_id == user.id).values(is_active=False))
    versions[0].is_active = True
    db.commit()
    return head_response(versions, latest_analyses(db, user.id))


@router.delete("/{cv_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cv(cv_id: str, user: CurrentStudent, db: DbSession) -> Response:
    """Xoá một CV cùng mọi phiên bản của nó (nhận mã của bất kỳ phiên bản nào). Không xoá được CV đang dùng khi
    sinh viên vẫn còn CV khác."""
    cv = get_owned_cv(db, user.id, cv_id)
    family_id = cv_versions.family_of(cv)
    versions = _versions(db, cv)
    if any(v.is_active for v in versions):
        others = db.scalar(
            select(func.count())
            .select_from(CvVersion)
            .where(CvVersion.owner_id == user.id, CvVersion.family_id != family_id)
        )
        if others:
            raise AppError(
                409, "Đây là CV đang dùng. Hãy chọn một CV khác làm CV đang dùng trước khi xoá.", "cv_active"
            )
    for v in versions:
        db.delete(v)
    sharing.unshare_deleted(db, family_id)
    db.commit()
    for v in versions:
        cv_files.delete_file(user.id, v.id, v.file_type)
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
