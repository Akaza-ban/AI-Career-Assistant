"""
Phiên bản CV theo từng CV (family_id).

- Tải file lên tạo một CV mới, bản đầu là v1.0.
- "Hoàn tất" ở Trình tối ưu thêm số phụ trong cùng CV (v1.1, v1.2...).
- Khôi phục một bản cũ tạo bản sao của bản đó với số chính mới (v2.0); bản cũ và các bản sau nó vẫn giữ nguyên.
- Lịch sử mỗi CV là một đường thẳng; bản mới nhất là bản hiển thị trên thẻ CV, được chia sẻ với cố vấn.
- CV đang dùng có bản mới thì bản mới tự thành bản đang dùng (mỗi SV chỉ có một bản đang dùng).
"""

import re
import uuid
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.api.errors import AppError
from src.db.models import CvVersion, GapAnalysis, ShareGrant
from src.services import cv_files

KIND_CV = "cv"


def label(cv: CvVersion) -> str:
    major = cv.major if cv.major is not None else cv.version
    return f"v{major}.{cv.minor or 0}"


def family_of(cv: CvVersion) -> str:
    return cv.family_id or cv.id


def restored_file_name(file_name: str, version_label: str) -> str:
    """Tên file bản khôi phục: hậu tố phiên bản cũ (CV_v1.1.docx) đổi theo nhãn mới; tên không có hậu tố giữ nguyên."""
    path = Path(file_name)
    return re.sub(r"_v\d+(\.\d+)?$", f"_{version_label}", path.stem) + path.suffix


def next_sequence(db: Session, owner_id: str) -> int:
    """Số thứ tự nội bộ kế tiếp (tăng dần trên mọi CV của SV)."""
    return (db.scalar(select(func.max(CvVersion.version)).where(CvVersion.owner_id == owner_id)) or 0) + 1


def versions_of(db: Session, owner_id: str, family_id: str) -> list[CvVersion]:
    """Các phiên bản của một CV, mới nhất trước."""
    return list(
        db.scalars(
            select(CvVersion)
            .where(CvVersion.owner_id == owner_id, CvVersion.family_id == family_id)
            .order_by(CvVersion.version.desc())
        )
    )


def families(db: Session, owner_id: str) -> list[list[CvVersion]]:
    """Các CV của SV, mỗi CV là danh sách phiên bản mới nhất trước (phần tử đầu là bản hiển thị trên thẻ CV);
    CV vừa có bản mới đứng trước."""
    groups: dict[str, list[CvVersion]] = {}
    for cv in db.scalars(select(CvVersion).where(CvVersion.owner_id == owner_id).order_by(CvVersion.version.desc())):
        groups.setdefault(family_of(cv), []).append(cv)
    return list(groups.values())


def start_family(cv: CvVersion) -> None:
    """Phiên bản đầu tiên của một CV mới (bản tải lên)."""
    cv.family_id = cv.id
    cv.major, cv.minor = 1, 0


def append(db: Session, base: CvVersion, new_cv: CvVersion, *, new_major: bool) -> None:
    """
    Thêm new_cv vào CV của base làm bản mới nhất: tăng số phụ (tối ưu) hoặc số chính, về .0 (khôi phục).
    Gọi trước khi đặt tên file vì tên file dùng nhãn phiên bản.
    """
    family = versions_of(db, base.owner_id, family_of(base))
    head = family[0] if family else base
    major, minor = head.major or 1, head.minor or 0
    new_cv.family_id = family_of(base)
    new_cv.version = next_sequence(db, base.owner_id)
    new_cv.major, new_cv.minor = (major + 1, 0) if new_major else (major, minor + 1)
    if any(v.is_active for v in family):
        for v in family:
            v.is_active = False
        new_cv.is_active = True


def restore(db: Session, source: CvVersion, now: datetime) -> CvVersion:
    """Khôi phục một bản cũ: tạo bản sao (kể cả file) làm bản mới nhất với số chính mới."""
    family = versions_of(db, source.owner_id, family_of(source))
    if family and family[0].id == source.id:
        raise AppError(409, "Đây đã là phiên bản hiện tại của CV.", "cv_already_current")
    path = cv_files.stored_path(source.owner_id, source.id, source.file_type)
    if not path.exists():
        raise AppError(409, "Không tìm thấy file của phiên bản này nên không khôi phục được.", "cv_file_missing")

    restored = CvVersion(
        id=f"cv_{uuid.uuid4().hex[:12]}",
        owner_id=source.owner_id,
        file_name=source.file_name,
        file_type=source.file_type,
        size_bytes=source.size_bytes,
        page_count=source.page_count,
        content_text=source.content_text,
        developing_skills=source.developing_skills,
        origin="restored",
        restored_from_id=source.id,
        read_by_ocr=source.read_by_ocr,
        is_active=False,
        is_draft=False,
        uploaded_at=now,
    )
    append(db, source, restored, new_major=True)
    restored.file_name = restored_file_name(source.file_name, label(restored))
    cv_files.save_file(source.owner_id, restored.id, restored.file_type, path.read_bytes())
    db.add(restored)
    try:
        db.commit()
    except Exception:
        cv_files.delete_file(source.owner_id, restored.id, restored.file_type)
        raise
    return restored


def backfill_ocr_flags(db: Session) -> None:
    """
    Điền read_by_ocr cho phiên bản tạo trước khi có cột này (idempotent, gọi khi khởi động): bản tải lên là PDF không
    có lớp chữ (cùng ngưỡng như lúc tải lên) thì là bản đọc bằng OCR; bản tối ưu / khôi phục theo bản gốc.
    """
    pending = list(db.scalars(select(CvVersion).where(CvVersion.read_by_ocr.is_(None)).order_by(CvVersion.version)))
    if not pending:
        return
    by_id = {
        cv.id: cv for cv in db.scalars(select(CvVersion).where(CvVersion.owner_id.in_({c.owner_id for c in pending})))
    }
    analyzed = dict(db.execute(select(GapAnalysis.id, GapAnalysis.cv_version_id)).all())
    for cv in pending:
        if cv.origin == "restored" and cv.restored_from_id in by_id:
            parent = by_id[cv.restored_from_id]
        elif cv.origin == "optimized" and analyzed.get(cv.source_analysis_id) in by_id:
            parent = by_id[analyzed[cv.source_analysis_id]]
        else:
            parent = None
        if parent is not None:
            cv.read_by_ocr = bool(parent.read_by_ocr)
        elif cv.file_type == "pdf":
            path = cv_files.stored_path(cv.owner_id, cv.id, cv.file_type)
            cv.read_by_ocr = path.exists() and not cv_files.has_text_layer(path.read_bytes())
        else:
            cv.read_by_ocr = False
    db.commit()


def backfill(db: Session) -> None:
    """
    Điền family_id / major / minor cho phiên bản tạo trước khi có lịch sử phiên bản (idempotent, gọi khi khởi động):
    bản tối ưu thuộc CV của bản đã được phân tích để tối ưu ra nó, số phụ tăng theo thứ tự tạo. Đồng thời đổi nhãn
    trong các lượt phân tích, gom quyền chia sẻ CV về mã CV và chuyển "bản đang dùng" sang bản mới nhất.
    """
    pending = list(db.scalars(select(CvVersion).where(CvVersion.major.is_(None)).order_by(CvVersion.version)))
    if not pending:
        return
    owners = {cv.owner_id for cv in pending}
    by_id = {cv.id: cv for cv in db.scalars(select(CvVersion).where(CvVersion.owner_id.in_(owners)))}
    sources = {cv.source_analysis_id for cv in pending if cv.source_analysis_id}
    analyzed = dict(
        db.execute(select(GapAnalysis.id, GapAnalysis.cv_version_id).where(GapAnalysis.id.in_(sources))).all()
    )

    head: dict[str, CvVersion] = {}
    for cv in sorted((c for c in by_id.values() if c.major is not None), key=lambda c: c.version):
        head[family_of(cv)] = cv
    for cv in sorted(pending, key=lambda c: (c.owner_id, c.version)):
        parent = by_id.get(analyzed.get(cv.source_analysis_id, "")) if cv.origin == "optimized" else None
        if parent is not None and parent.major is not None:
            latest = head[family_of(parent)]
            cv.family_id, cv.major, cv.minor = family_of(parent), latest.major, (latest.minor or 0) + 1
        else:
            start_family(cv)
        head[cv.family_id] = cv

    members: dict[str, list[CvVersion]] = defaultdict(list)
    for cv in by_id.values():
        members[cv.family_id].append(cv)
    for family_id, group in members.items():
        if any(v.is_active for v in group):
            for v in group:
                v.is_active = v is head[family_id]

    pending_ids = {cv.id for cv in pending}
    for analysis in db.scalars(select(GapAnalysis).where(GapAnalysis.cv_version_id.in_(pending_ids))):
        analysis.cv_label = label(by_id[analysis.cv_version_id])

    # Mỗi CV giữ một quyền chia sẻ (ưu tiên quyền đã gắn đúng mã CV, sau đó quyền bật sớm nhất). Xoá quyền thừa
    # trước rồi mới đổi mã để không vướng ràng buộc duy nhất (kind, item_id).
    grants: dict[str, list[ShareGrant]] = defaultdict(list)
    for grant in db.scalars(select(ShareGrant).where(ShareGrant.kind == KIND_CV).order_by(ShareGrant.shared_at)):
        cv = by_id.get(grant.item_id)
        if cv is not None:
            grants[cv.family_id].append(grant)
    for family_id, group in grants.items():
        group.sort(key=lambda g: g.item_id != family_id)
        for extra in group[1:]:
            db.delete(extra)
    db.flush()
    for family_id, group in grants.items():
        group[0].item_id = family_id
    db.commit()
