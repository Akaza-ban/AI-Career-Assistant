from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.database import Base


def utcnow() -> datetime:
    """Thời điểm hiện tại theo UTC, lưu dạng naive (SQLite không giữ múi giờ)."""
    return datetime.now(UTC).replace(tzinfo=None)


class ProviderUsage(Base):
    """One physical dispatch, including failed/cancelled and system job calls.

    Only numeric usage and server-controlled labels; never prompts or outputs.
    Unknown prices/tokens remain explicit instead of masquerading as free calls.
    """

    __tablename__ = "provider_usage"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: uuid4().hex)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    operation: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(16), default="started")
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    usage_known: Mapped[bool] = mapped_column(Boolean, default=False)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    cost_known: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class User(Base):
    """Người dùng hệ thống (sinh viên hoặc cố vấn)."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    # "student" | "advisor"
    role: Mapped[str] = mapped_column(String(16), index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    # Ví dụ "KDQT - K2021" (sinh viên) hoặc "Khoa HTTT" (cố vấn)
    subtitle: Mapped[str] = mapped_column(String(255), default="")
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), default=None)
    avatar_url: Mapped[str | None] = mapped_column(String(1024), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    # Sinh viên: mã SV, ngành, khoá (lọc danh sách ở trang Cố vấn)
    student_code: Mapped[str | None] = mapped_column(String(32), default=None)
    major: Mapped[str | None] = mapped_column(String(255), default=None)
    cohort: Mapped[str | None] = mapped_column(String(32), default=None)
    # Cố vấn: chức danh, văn phòng, giờ tư vấn (hiện ở trang Chia sẻ với cố vấn của SV)
    title: Mapped[str | None] = mapped_column(String(255), default=None)
    office: Mapped[str | None] = mapped_column(String(255), default=None)
    office_hours: Mapped[str | None] = mapped_column(String(255), default=None)


class AuthSession(Base):
    """Revocable session: the cookie token itself is never stored in the database."""

    __tablename__ = "auth_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
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
    # "gap_analysis" | "interview" (chỉ với csat)
    activity: Mapped[str | None] = mapped_column(String(32), default=None)
    comment: Mapped[str | None] = mapped_column(Text, default=None)
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
    cv_version_id: Mapped[str] = mapped_column(String(64))
    cv_file_name: Mapped[str] = mapped_column(String(255))
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
    # Assigned atomically by the privacy vault on first use, retained across TTL.
    pii_nonce: Mapped[str | None] = mapped_column(String(32), default=None)
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
