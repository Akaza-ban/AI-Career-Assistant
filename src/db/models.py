from datetime import UTC, date, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.database import Base


def utcnow() -> datetime:
    """Thời điểm hiện tại theo UTC, lưu dạng naive (SQLite không giữ múi giờ)."""
    return datetime.now(UTC).replace(tzinfo=None)


class User(Base):
    """Người dùng hệ thống (sinh viên, cố vấn hoặc quản trị viên)."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    # "student" | "advisor" | "admin"
    role: Mapped[str] = mapped_column(String(16), index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    # Dòng phụ dưới tên: email (sinh viên) hoặc chức danh (cố vấn)
    subtitle: Mapped[str] = mapped_column(String(255), default="")
    email: Mapped[str] = mapped_column(String(255), unique=True)
    avatar_url: Mapped[str | None] = mapped_column(String(1024), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    # Sinh viên: hồ sơ cá nhân, không gắn với trường (người dùng đến từ nhiều trường khác nhau).
    # DB cũ còn cột student_code / major / cohort: không dùng nữa, để nguyên (cho phép NULL).
    phone: Mapped[str | None] = mapped_column(String(32), default=None)
    date_of_birth: Mapped[date | None] = mapped_column(Date, default=None)
    # Cố vấn: chức danh, văn phòng, giờ tư vấn (hiện ở trang Chia sẻ với cố vấn của SV)
    title: Mapped[str | None] = mapped_column(String(255), default=None)
    office: Mapped[str | None] = mapped_column(String(255), default=None)
    office_hours: Mapped[str | None] = mapped_column(String(255), default=None)
    # Tài khoản: mật khẩu băm PBKDF2 (src/services/auth.py); None = chưa đặt mật khẩu (chỉ vào được bằng demo)
    password_hash: Mapped[str | None] = mapped_column(String(255), default=None)
    password_updated_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    # Đồng ý xử lý dữ liệu & cam kết liêm chính khi đăng ký; None = chưa đồng ý hoặc đã rút lại
    consent_accepted_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    integrity_pledge_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    # Cài đặt quyền riêng tư và thông báo: {"privacy": {...}, "notifications": {...}}; None = mặc định
    preferences: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=None)
    # Chống dò mật khẩu: số lần nhập sai liên tiếp và thời điểm hết khoá
    failed_logins: Mapped[int | None] = mapped_column(Integer, default=None)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    # Tài khoản cố vấn do quản trị viên tạo / đặt lại bằng mật khẩu tạm: phải đổi mật khẩu trước khi dùng
    must_change_password: Mapped[bool | None] = mapped_column(Boolean, default=None)
    # Quản trị viên tạm khoá tài khoản: không đăng nhập được, mọi phiên bị kết thúc
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    # Lần gần nhất gọi API (cập nhật thưa, xem src/api/deps.py), hiện ở cột "Hoạt động" của trang Quản trị
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)


class AuthSession(Base):
    """Phiên đăng nhập. Cookie giữ token ngẫu nhiên; DB chỉ lưu SHA-256 của token."""

    __tablename__ = "auth_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)


class PasswordResetToken(Base):
    """Link đặt lại mật khẩu gửi qua email; dùng một lần, hết hạn sau password_reset_minutes."""

    __tablename__ = "password_reset_tokens"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)


class Notification(Base):
    """Thông báo trong chuông (gửi khi có nhận xét mới, báo cáo / phân tích xong, SV chia sẻ buổi mới…)."""

    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    # advisor_comment | interview_report | gap_analysis | integrity_alert | student_activity | student_inactive
    kind: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text, default="")
    action_label: Mapped[str | None] = mapped_column(String(64), default=None)
    action_href: Mapped[str | None] = mapped_column(String(512), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)


class SavedJd(Base):
    """Vị trí sinh viên đã lưu (♥) trong Thư viện JD."""

    __tablename__ = "saved_jds"
    __table_args__ = (UniqueConstraint("user_id", "jd_id"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    jd_id: Mapped[str] = mapped_column(ForeignKey("job_descriptions.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AdvisorAssignment(Base):
    """Phân công cố vấn phụ trách sinh viên; mỗi SV có tối đa một cố vấn. Mọi quyền của cố vấn dựa trên bảng này."""

    __tablename__ = "advisor_assignments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    advisor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ShareGrant(Base):
    """
    SV bật chia sẻ một tài liệu với cố vấn phụ trách (mặc định riêng tư; tắt chia sẻ = xoá bản ghi).
    Không chia sẻ thì cố vấn chỉ thấy số liệu tổng hợp, không xem được nội dung.
    """

    __tablename__ = "share_grants"
    __table_args__ = (UniqueConstraint("kind", "item_id"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    # "cv" (cả CV: item_id là mã CV / family_id, cố vấn xem bản mới nhất và các bản trước) |
    # "interview" (báo cáo buổi phỏng vấn)
    kind: Mapped[str] = mapped_column(String(16))
    item_id: Mapped[str] = mapped_column(String(64))
    shared_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    # Lần gần nhất cố vấn mở tài liệu
    advisor_viewed_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)


class AdvisorReview(Base):
    """Nhận xét của cố vấn cho một báo cáo phỏng vấn SV đã chia sẻ. Không thay đổi điểm AI."""

    __tablename__ = "advisor_reviews"
    __table_args__ = (UniqueConstraint("advisor_id", "session_id"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    advisor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    session_id: Mapped[str] = mapped_column(String(64), index=True)
    comment: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    # Lúc SV mở xem nhận xét (lần gần nhất sau khi cố vấn sửa); None nếu chưa xem
    seen_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)


class Message(Base):
    """
    Tin nhắn giữa SV và cố vấn phụ trách (chỉ văn bản). Hội thoại là cặp (cố vấn, SV); chỉ cặp đang có trong
    bảng phân công mới đọc / gửi được.
    """

    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    advisor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    sender_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    # Lúc người nhận đọc; None nếu chưa đọc
    read_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)


class AdvisorNote(Base):
    """Ghi chú nội bộ của cố vấn về một SV; SV không bao giờ thấy."""

    __tablename__ = "advisor_notes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    advisor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    body: Mapped[str] = mapped_column(Text)
    # ["behavior" | "soft_skill" | "technical" | "watch"]
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class CvVersion(Base):
    """
    Một phiên bản CV của sinh viên, không ghi đè bản cũ (US-SV-01). Các phiên bản cùng family_id là một CV
    (một thẻ trong "CV của tôi"): tải file lên tạo CV mới (v1.0); "Hoàn tất" ở Trình tối ưu thêm số phụ (v1.1, v1.2);
    khôi phục một bản cũ thêm số chính (v2.0). Phiên bản mới nhất của CV là bản hiển thị trên thẻ.
    """

    __tablename__ = "cv_versions"
    __table_args__ = (UniqueConstraint("owner_id", "version"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    # Số thứ tự nội bộ, tăng dần theo từng sinh viên (mọi CV), bắt đầu từ 1; nhãn hiển thị dùng major/minor
    version: Mapped[int] = mapped_column(Integer)
    # Mã CV = id của phiên bản đầu tiên (bản tải lên). Cột cho phép NULL để tự thêm vào DB cũ; được điền khi khởi động
    family_id: Mapped[str | None] = mapped_column(String(64), index=True, default=None)
    # Nhãn "v{major}.{minor}", đánh số riêng trong từng CV
    major: Mapped[int | None] = mapped_column(Integer, default=None)
    minor: Mapped[int | None] = mapped_column(Integer, default=None)
    # Phiên bản cũ được khôi phục thành bản này (origin = "restored")
    restored_from_id: Mapped[str | None] = mapped_column(String(64), default=None)
    file_name: Mapped[str] = mapped_column(String(255))
    # "pdf" | "docx"
    file_type: Mapped[str] = mapped_column(String(8))
    size_bytes: Mapped[int] = mapped_column(Integer)
    page_count: Mapped[int | None] = mapped_column(Integer, default=None)
    # Văn bản trích từ file, đầu vào cho phân tích khoảng cách CV–JD
    content_text: Mapped[str] = mapped_column(Text)
    # "upload": SV tự tải lên; "optimized": tạo ra khi "Hoàn tất" ở Trình tối ưu (US-SV-03);
    # "restored": bản sao của một phiên bản cũ khi SV khôi phục
    origin: Mapped[str] = mapped_column(String(16), default="upload")
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    is_draft: Mapped[bool] = mapped_column(Boolean, default=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    # Kỹ năng SV tự ghi là đang học (US-SV-05): [{"name", "note"}]. Không nằm trong content_text nên không được
    # chấm như kỹ năng đã có khi phân tích lại; chỉ in ở mục "Kỹ năng đang phát triển" của file CV.
    developing_skills: Mapped[list[dict[str, str]] | None] = mapped_column(JSON, default=None)
    # Lượt phân tích đã dùng để tối ưu ra phiên bản này (origin = "optimized")
    source_analysis_id: Mapped[str | None] = mapped_column(String(64), default=None)


class JobDescription(Base):
    """JD trong thư viện (source="library", owner_id=None) hoặc JD sinh viên tự dán (source="pasted")."""

    __tablename__ = "job_descriptions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source: Mapped[str] = mapped_column(String(16), index=True)
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), default=None, index=True)
    title: Mapped[str] = mapped_column(String(255))
    company: Mapped[str | None] = mapped_column(String(255), default=None)
    industry: Mapped[str | None] = mapped_column(String(255), default=None)
    # "intern" | "fresher" | "junior"; None với JD tự dán
    level: Mapped[str | None] = mapped_column(String(16), default=None)
    content: Mapped[str] = mapped_column(Text)
    # [{"name", "importance": "required"|"preferred"|"additional", "aliases": [...]}];
    # JD tự dán có danh sách này sau khi phân tích (trích bằng LLM hoặc từ điển).
    skills: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    # Cấu trúc chung (src/services/jd_parser.py). content giữ toàn văn gốc để đối chiếu khi tách sai.
    # "full_time" | "part_time" | "internship"
    employment_type: Mapped[str | None] = mapped_column(String(16), default=None)
    # "onsite" | "remote" | "hybrid"
    work_mode: Mapped[str | None] = mapped_column(String(16), default=None)
    location: Mapped[str | None] = mapped_column(String(255), default=None)
    # Chữ tự do: "12 – 15 triệu", "Thoả thuận"
    salary: Mapped[str | None] = mapped_column(String(120), default=None)
    deadline: Mapped[date | None] = mapped_column(Date, default=None)
    # "none" | "under_1" | "1_2" | "2_plus"
    experience: Mapped[str | None] = mapped_column(String(16), default=None)
    majors: Mapped[list[str] | None] = mapped_column(JSON(none_as_null=True), default=None)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    requirements: Mapped[str | None] = mapped_column(Text, default=None)
    benefits: Mapped[str | None] = mapped_column(Text, default=None)
    how_to_apply: Mapped[str | None] = mapped_column(Text, default=None)
    # Nguồn mức quan trọng của kỹ năng: "dictionary" (tạm, mọi kỹ năng là bắt buộc) | "sections" | "ai" | "analysis"
    # | "admin". Phân tích CV dùng thẳng danh sách đã có, trừ "dictionary" (trích lại bằng AI).
    skills_source: Mapped[str | None] = mapped_column(String(16), default=None)
    # JD thư viện: None / "published" = hiển thị cho sinh viên, "hidden" = đã ẩn (dữ liệu cũ vẫn giữ)
    status: Mapped[str | None] = mapped_column(String(16), default=None)
    # JD thư viện tạo từ JD sinh viên tự dán ("Đưa vào thư viện")
    source_jd_id: Mapped[str | None] = mapped_column(String(64), default=None, index=True)
    # Lần quản trị viên sửa gần nhất; None = chưa sửa, nên thư viện vẫn đồng bộ theo fixtures/jd_library.json
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)


class GapAnalysis(Base):
    """Một lượt phân tích khoảng cách CV–JD (US-SV-02, US-SV-05), chạy nền và cập nhật tiến độ theo từng bước."""

    __tablename__ = "gap_analyses"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    # Không đặt khoá ngoại: kết quả vẫn xem được sau khi SV xoá phiên bản CV đó
    cv_version_id: Mapped[str] = mapped_column(String(64), index=True)
    cv_file_name: Mapped[str] = mapped_column(String(255))
    cv_label: Mapped[str] = mapped_column(String(32))
    jd_id: Mapped[str] = mapped_column(ForeignKey("job_descriptions.id"))
    # "processing" | "completed" | "failed"
    status: Mapped[str] = mapped_column(String(16), default="processing")
    # "parse" | "retrieve" | "compare" | "generate" | "verify_grounding"; None khi đã xong
    current_step: Mapped[str | None] = mapped_column(String(32), default="parse")
    error_message: Mapped[str | None] = mapped_column(Text, default=None)
    # CV–JD Matching Score 0–100 (PRD mục 5.2)
    match_score: Mapped[float | None] = mapped_column(Float, default=None)
    # Toàn bộ kết quả hiển thị (requirements, suggestions, breakdown...), xem src/services/gap_analysis.py
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=None)
    llm_calls: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)


class CvOptimization(Base):
    """
    Phiên tối ưu CV của một lượt phân tích (US-SV-03). Quyết định của SV được gom vào bản nháp;
    "Hoàn tất" tạo đúng một phiên bản CV mới, sau đó phiên bị khoá.
    """

    __tablename__ = "cv_optimizations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    analysis_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    # "draft" | "finalized"
    status: Mapped[str] = mapped_column(String(16), default="draft")
    # Quyết định hiện tại theo mã gợi ý: {suggestion_id: {"action": "accept"|"edit"|"reject", "final_text"}}
    decisions: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    # Trả lời kiểm tra kỹ năng thiếu theo mã yêu cầu JD:
    # {requirement_id: {"has_experience", "context", "learning_note", "answered_at"}}
    capability_answers: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    # Ngữ cảnh SV bổ sung cho gợi ý cần số liệu (US-SV-03 AC2):
    # {suggestion_id: {"answer", "proposed_text", "answered_at"}}; None ở phiên tạo trước khi có cột này
    contexts: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=None)
    # Phiên bản CV tạo ra khi "Hoàn tất"
    result_cv_version_id: Mapped[str | None] = mapped_column(String(64), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    finalized_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)


class CvEditAudit(Base):
    """Audit Trail (PRD mục 6.5): mỗi quyết định của SV với một gợi ý AI. Chỉ ghi thêm, không sửa, không xoá."""

    __tablename__ = "cv_edit_audit"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    analysis_id: Mapped[str] = mapped_column(String(64), index=True)
    suggestion_id: Mapped[str] = mapped_column(String(64))
    # Phiên bản CV được tối ưu (bản gốc của gợi ý)
    cv_version_id: Mapped[str] = mapped_column(String(64))
    original_content: Mapped[str] = mapped_column(Text)
    ai_suggestion: Mapped[str] = mapped_column(Text)
    # Vị trí căn cứ trong CV gốc
    evidence_line_no: Mapped[int] = mapped_column(Integer)
    evidence_text: Mapped[str] = mapped_column(Text)
    reason: Mapped[str] = mapped_column(Text, default="")
    # "accept" | "edit" | "reject" | "undo"
    action: Mapped[str] = mapped_column(String(16))
    final_content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class CvExport(Base):
    """Một lần xuất CV, chỉ ghi khi SV đã xác nhận cam kết liêm chính."""

    __tablename__ = "cv_exports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    cv_version_id: Mapped[str] = mapped_column(String(64), index=True)
    # "docx" (tải file) | "print" (in / lưu PDF từ trình duyệt) | "text" (sao chép các câu đã sửa)
    format: Mapped[str] = mapped_column(String(8))
    integrity_confirmed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Feedback(Base):
    """Phản hồi của người dùng cho một phản hồi AI: like/dislike ("thumb") hoặc CSAT 1–5 sao (US-SV-06)."""

    __tablename__ = "feedback"
    # Mỗi người chỉ gửi một lần cho mỗi phản hồi (US-SV-06 AC3)
    __table_args__ = (UniqueConstraint("user_id", "response_id", "kind"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    # Mã phản hồi AI được đánh giá: id gợi ý (thumb) hoặc id lượt phân tích/phỏng vấn (csat)
    response_id: Mapped[str] = mapped_column(String(64), index=True)
    # "thumb" | "csat"
    kind: Mapped[str] = mapped_column(String(8))
    value: Mapped[int] = mapped_column(Integer)
    # csat: "gap_analysis" | "optimizer" | "interview";
    # thumb: "gap_suggestion" | "interview_turn" | "job_recommendation" | "jd_compare" (None ở dữ liệu cũ)
    activity: Mapped[str | None] = mapped_column(String(32), default=None)
    comment: Mapped[str | None] = mapped_column(Text, default=None)
    # Chỉ với csat 1–3 sao: mã lý do sinh viên chọn nhanh (src/services/feedback.py REASONS)
    tags: Mapped[list[str] | None] = mapped_column(JSON(none_as_null=True), default=None)
    # Chỉ với csat: "Bạn có dùng lại không?" (S7b); None nếu SV bỏ qua câu này
    would_reuse: Mapped[bool | None] = mapped_column(Boolean, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class InterviewSession(Base):
    """
    Một buổi phỏng vấn thử (US-SV-04): 4 câu, mỗi câu có hạn chót trả lời.
    Chỉ buổi đã hoàn thành mới được lưu lâu dài và tính vào hạn mức; buổi bỏ dở bị xoá.
    """

    __tablename__ = "interview_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    jd_id: Mapped[str] = mapped_column(ForeignKey("job_descriptions.id"), index=True)
    cv_version_id: Mapped[str | None] = mapped_column(String(64), nullable=True, default=None)
    cv_file_name: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)
    interview_mode: Mapped[str] = mapped_column(String(16), default="with_cv")
    # "in_progress" | "completed"
    status: Mapped[str] = mapped_column(String(16), default="in_progress", index=True)
    # Câu đang trả lời, đánh số từ 1
    current_index: Mapped[int] = mapped_column(Integer, default=1)
    # Hạn chót của câu hiện tại (UTC); None khi đã hoàn thành
    question_deadline: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    # Mỗi buổi được tạm dừng một lần, tối đa 1 phút
    pause_used: Mapped[bool] = mapped_column(Boolean, default=False)
    paused_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    # Điểm STAR thang 0–5 (PRD mục 5.1), có khi hoàn thành
    overall_score: Mapped[float | None] = mapped_column(Float, default=None)
    # {"situation", "task", "action", "result"}: điểm trung bình từng tiêu chí
    star: Mapped[dict[str, float] | None] = mapped_column(JSON, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)


class InterviewTurn(Base):
    """Một câu hỏi – trả lời trong buổi phỏng vấn, kèm điểm S/T/A/R của câu đó."""

    __tablename__ = "interview_turns"
    __table_args__ = (UniqueConstraint("session_id", "index"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id"), index=True)
    index: Mapped[int] = mapped_column(Integer)
    theme: Mapped[str] = mapped_column(String(64))
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str | None] = mapped_column(Text, default=None)
    # Hết giờ: tự nộp phần đang gõ, hoặc 0 điểm nếu chưa có câu trả lời
    timed_out: Mapped[bool] = mapped_column(Boolean, default=False)
    situation: Mapped[float | None] = mapped_column(Float, default=None)
    task: Mapped[float | None] = mapped_column(Float, default=None)
    action: Mapped[float | None] = mapped_column(Float, default=None)
    result: Mapped[float | None] = mapped_column(Float, default=None)
    score: Mapped[float | None] = mapped_column(Float, default=None)
    feedback: Mapped[str | None] = mapped_column(Text, default=None)
    asked_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)


class AssistantConversation(Base):
    """Hội thoại của người dùng với trợ lý hướng dẫn."""

    __tablename__ = "assistant_conversations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    role: Mapped[str] = mapped_column(String(16), default="student")
    title: Mapped[str] = mapped_column(String(255), default="Cuộc trò chuyện mới")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    turns: Mapped[list["AssistantTurn"]] = relationship(
        "AssistantTurn", back_populates="conversation", cascade="all, delete-orphan"
    )


class AssistantTurn(Base):
    """Một lượt hỏi đáp, kèm ngữ cảnh giao diện và nguồn trích dẫn."""

    __tablename__ = "assistant_turns"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid4()))
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("assistant_conversations.id", ondelete="CASCADE"), index=True
    )
    user_message: Mapped[str] = mapped_column(Text)
    assistant_message: Mapped[str] = mapped_column(Text)
    intent: Mapped[str] = mapped_column(String(16))
    context_json: Mapped[dict[str, Any] | list[Any]] = mapped_column(JSON, default=dict)
    sources_json: Mapped[dict[str, Any] | list[Any]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    conversation: Mapped["AssistantConversation"] = relationship("AssistantConversation", back_populates="turns")
    actions: Mapped[list["AgentActionLog"]] = relationship(
        "AgentActionLog", back_populates="turn", cascade="all, delete-orphan"
    )
    feedback: Mapped[list["AssistantFeedback"]] = relationship(
        "AssistantFeedback", back_populates="turn", cascade="all, delete-orphan"
    )


class AgentActionLog(Base):
    """Nhật ký đề xuất và thực thi hành động giao diện của trợ lý."""

    __tablename__ = "agent_action_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid4()))
    turn_id: Mapped[str] = mapped_column(ForeignKey("assistant_turns.id", ondelete="CASCADE"), index=True)
    action_type: Mapped[str] = mapped_column(String(32))
    params_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    # "pending" | "confirmed" | "executed" | "rejected" | "failed"
    status: Mapped[str] = mapped_column(String(16), default="pending")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    client_executed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    turn: Mapped["AssistantTurn"] = relationship("AssistantTurn", back_populates="actions")


class AssistantFeedback(Base):
    """Đánh giá của người dùng cho một lượt trả lời của trợ lý."""

    __tablename__ = "assistant_feedback"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid4()))
    turn_id: Mapped[str] = mapped_column(ForeignKey("assistant_turns.id", ondelete="CASCADE"), index=True)
    # 1: hữu ích; -1: không hữu ích
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    turn: Mapped["AssistantTurn"] = relationship("AssistantTurn", back_populates="feedback")


class JobComparisonHistory(Base):
    """Lịch sử các lần so sánh nhiều JD của sinh viên (Multi-JD Matching History)."""

    __tablename__ = "jd_comparison_history"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    cv_version_id: Mapped[str | None] = mapped_column(String(64), index=True, default=None)
    cv_label: Mapped[str | None] = mapped_column(String(32), default=None)
    cv_name: Mapped[str | None] = mapped_column(String(255), default=None)
    jd_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    total_compared: Mapped[int] = mapped_column(Integer, default=0)
    comparisons: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    common_missing_skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
