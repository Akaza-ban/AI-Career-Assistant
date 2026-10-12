"""
Nhóm SV giả định do cố vấn demo phụ trách, để các trang Cố vấn có dữ liệu minh hoạ (tên người, trường đều là giả định).
Mỗi SV có CV, lượt phân tích và buổi phỏng vấn đã chấm theo nhiều tình huống: tiến bộ, bị gắn cờ "Cần chú ý",
lâu không hoạt động, chưa chia sẻ, mới 1 buổi, chưa phỏng vấn, đang giảm, ổn định; kèm đánh giá CSAT sau các lượt dùng
và vài tin nhắn với cố vấn. Trang Quản trị có thêm 2 cố vấn khác và 3 SV mới đăng ký chưa được phân công.
Chỉ tạo bản ghi chưa có trong DB (CSAT, nhận xét, tin nhắn thì bổ sung nếu còn thiếu); tắt bằng SEED_DEMO_COHORT=false.
"""

from datetime import timedelta
from typing import Any

from sqlalchemy.orm import Session

from src.agents.gap_analysis.nodes.generate_suggestions import fallback_summary
from src.db.models import (
    AdvisorNote,
    AdvisorReview,
    CvVersion,
    Feedback,
    GapAnalysis,
    InterviewSession,
    InterviewTurn,
    JobDescription,
    Message,
    ShareGrant,
    User,
    utcnow,
)
from src.db.seed import DEMO_ADVISOR_ID, assign, migrate_school_profile
from src.services import cv_files
from src.services.cv_optimizer import DEVELOPING_TITLE, cv_document
from src.services.cv_versions import label
from src.services.interview import CRITERIA, GUIDANCE, QUESTION_BANK
from src.services.skill_matching import IMPORTANCE_WEIGHTS, compute_score

# Nội dung CV theo vị trí (phần kinh nghiệm / dự án)
CV_EXPERIENCE = {
    "jd-be-intern": [
        "Xây dựng API quản lý thư viện bằng Python FastAPI cho đồ án môn Công nghệ phần mềm.",
        "Thiết kế cơ sở dữ liệu PostgreSQL 12 bảng và viết truy vấn SQL báo cáo mượn trả.",
        "Quản lý mã nguồn nhóm 4 người bằng Git, review code qua pull request.",
    ],
    "jd-ba-intern": [
        "Thu thập yêu cầu từ giảng viên và sinh viên cho hệ thống đăng ký học phần của đồ án.",
        "Viết tài liệu đặc tả yêu cầu cho 10 chức năng chính và trình bày trước hội đồng.",
        "Tổng hợp dữ liệu khảo sát bằng Excel và SQL để đề xuất cải tiến quy trình.",
    ],
    "jd-xnk-fresher": [
        "Thực tập tại công ty giao nhận: hỗ trợ lập bộ chứng từ xuất khẩu cho 15 lô hàng.",
        "Theo dõi lịch tàu và cập nhật tình trạng lô hàng cho khách bằng Excel.",
        "Dịch thư giao dịch tiếng Anh thương mại với đối tác nước ngoài.",
    ],
    "jd-fe-junior": [
        "Xây dựng giao diện quản lý công việc bằng React và JavaScript cho đồ án nhóm.",
        "Cắt giao diện từ bản thiết kế thành HTML/CSS responsive cho 8 màn hình.",
        "Làm việc nhóm qua Git, chia nhánh theo tính năng.",
    ],
    "jd-mkt-analyst": [
        "Phụ trách kênh Facebook của câu lạc bộ, lên lịch đăng bài hằng tuần.",
        "Theo dõi lượt tiếp cận bằng Google Analytics và tổng hợp báo cáo tháng bằng Excel.",
        "Thiết kế ấn phẩm sự kiện bằng Canva.",
    ],
    "jd-fa-fresher": [
        "Phân tích báo cáo tài chính của 3 doanh nghiệp niêm yết cho bài tập lớn môn Tài chính doanh nghiệp.",
        "Xây dựng bảng tính Excel so sánh các chỉ số thanh khoản và sinh lời.",
        "Trình bày kết quả bằng PowerPoint trước lớp.",
    ],
    "jd-da-intern": [
        "Làm sạch dữ liệu bán hàng 20.000 dòng bằng Excel và viết truy vấn SQL tổng hợp doanh thu.",
        "Xây dựng dashboard doanh số theo tuần bằng Power BI cho đồ án môn Phân tích dữ liệu.",
        "Dùng Python (pandas) để thống kê mô tả dữ liệu khảo sát.",
    ],
    "jd-po-assistant": [
        "Viết User Story và tiêu chí chấp nhận cho ứng dụng đặt lịch phòng học của đồ án.",
        "Sắp xếp backlog theo độ ưu tiên cùng nhóm phát triển trong các buổi họp Scrum.",
        "Vẽ luồng người dùng cho 5 màn hình chính.",
    ],
}

# Câu trả lời mẫu theo chủ đề câu hỏi (QUESTION_BANK), {role} là tên vị trí
ANSWERS = [
    "Trong đồ án môn học gần nhất, nhóm em làm sản phẩm sát với công việc {role}. Em phụ trách phần chính của nhóm, "
    "tự lên kế hoạch, chia việc và báo cáo tiến độ hằng tuần. Cuối kỳ nhóm bàn giao đúng hạn.",
    "Có lần dữ liệu đầu vào của nhóm bị sai định dạng ngay trước buổi bảo vệ. Em rà lại từng bước, tìm ra nguyên nhân "
    "và cùng bạn sửa lại quy trình kiểm tra. Nhóm vẫn kịp trình bày.",
    "Trong nhóm có bạn muốn làm thêm nhiều chức năng trong khi thời gian ít. Em đề xuất cả nhóm liệt kê công sức và "
    "giá trị từng chức năng rồi bỏ phiếu. Nhóm thống nhất tập trung vào phần quan trọng nhất.",
    "Khi cần dùng một công cụ mới cho vị trí {role}, em học theo tài liệu chính thức và làm lại các ví dụ mẫu, sau đó "
    "nhờ anh chị khoá trên góp ý. Sau một tuần em dùng được cho phần việc của mình.",
]

TURN_OFFSETS = [0.2, -0.1, 0.1, -0.2]

# (id, họ tên, email, mã SV, ngành, viết tắt ngành, khoá, JD, tiêu chí yếu nhất, các phiên bản CV, các buổi phỏng vấn,
#  cách chia sẻ, nhận xét của cố vấn, ghi chú nội bộ)
# versions: (số ngày trước, kỹ năng thiếu, kỹ năng chỉ liệt kê); sessions: (số ngày trước, điểm tổng, số câu hết giờ)
# share: "all" | "latest" | "cv" | "none"; review: (buổi thứ mấy, đã xem?, nội dung)
# csat: số sao SV chấm sau từng lượt dùng, theo thứ tự các lượt phân tích rồi các buổi phỏng vấn
COHORT: list[dict[str, Any]] = [
    {
        "id": "sv-0151",
        "full_name": "Lê Quang Huy",
        "email": "huy.lq@gmail.com",
        "phone": "0903 214 587",
        "major": "Công nghệ thông tin",
        "cohort": "K2021",
        "jd": "jd-be-intern",
        "weak": "result",
        "versions": [(40, ["Docker", "Redis", "Unit test", "Linux"], ["Git"]), (20, ["Redis", "Unit test"], ["Linux"])],
        "sessions": [(38, 2.6, 0), (27, 3.0, 0), (15, 3.5, 0), (4, 3.9, 0)],
        "share": "all",
        "csat": [5, 4, 5, 5, 4],
        "review": (
            4,
            True,
            "Em trình bày bối cảnh và nhiệm vụ rất rõ. Buổi tới thử nêu thêm kết quả đo được, ví dụ thời gian phản hồi API.",
        ),
        "note": ("Tiến bộ đều qua 4 buổi. Có thể giới thiệu thực tập backend.", ["technical"], False),
    },
    {
        "id": "sv-0152",
        "full_name": "Phạm Thu Trang",
        "email": "trang.pt@gmail.com",
        "phone": "0987 552 130",
        "major": "Hệ thống thông tin quản lý",
        "cohort": "K2022",
        "jd": "jd-ba-intern",
        "weak": "action",
        "versions": [(33, ["BPMN", "Jira", "Figma"], ["Agile/Scrum"])],
        "sessions": [(30, 3.2, 0), (20, 3.1, 0), (9, 2.9, 1), (2, 2.9, 1)],
        "share": "latest",
        "csat": [4, 3, 3],
        "review": None,
        "note": ("Điểm không tăng mấy buổi gần đây, có câu hết giờ. Hẹn gặp trực tiếp.", ["watch"], True),
    },
    {
        "id": "sv-0153",
        "full_name": "Lê Thu Hà",
        "email": "ha.lt@gmail.com",
        "phone": "0916 408 772",
        "major": "Kinh doanh quốc tế",
        "cohort": "K2021",
        "jd": "jd-xnk-fresher",
        "weak": "task",
        "versions": [(48, ["Incoterms", "Thủ tục hải quan"], ["Thanh toán quốc tế"])],
        "sessions": [(45, 2.8, 0), (30, 3.1, 0)],
        "share": "cv",
        "csat": [4, 5],
        "review": None,
        "note": None,
    },
    {
        "id": "sv-0154",
        "full_name": "Phạm Quang Huy",
        "email": "huy.pq@gmail.com",
        "phone": "0935 117 264",
        "major": "Công nghệ thông tin",
        "cohort": "K2022",
        "jd": "jd-fe-junior",
        "weak": "result",
        "versions": [(22, ["TypeScript", "Next.js", "Unit test"], ["Tailwind CSS"])],
        "sessions": [(20, 3.1, 0), (12, 3.4, 0), (5, 3.3, 0)],
        "share": "none",
        "csat": [4],
        "review": None,
        "note": None,
    },
    {
        "id": "sv-0155",
        "full_name": "Võ Ngọc Lan",
        "email": "lan.vn@gmail.com",
        "phone": "0978 630 415",
        "major": "Marketing",
        "cohort": "K2022",
        "jd": "jd-mkt-analyst",
        "weak": "action",
        "versions": [(10, ["A/B Testing", "Quảng cáo trả phí", "SQL", "SEO"], ["Báo cáo hiệu quả chiến dịch"])],
        "sessions": [(6, 2.7, 1)],
        "share": "all",
        "csat": [5],
        "review": None,
        "note": None,
    },
    {
        "id": "sv-0156",
        "full_name": "Đặng Minh Khoa",
        "email": "khoa.dm@gmail.com",
        "phone": "0908 742 091",
        "major": "Tài chính – Ngân hàng",
        "cohort": "K2021",
        "jd": "jd-fa-fresher",
        "weak": "result",
        "versions": [(8, ["Định giá doanh nghiệp", "Mô hình tài chính", "CFA"], [])],
        "sessions": [],
        "share": "cv",
        "csat": [4],
        "review": None,
        "note": None,
    },
    {
        "id": "sv-0157",
        "full_name": "Trần Bảo Châu",
        "email": "chau.tb@gmail.com",
        "phone": "0941 285 336",
        "major": "Hệ thống thông tin quản lý",
        "cohort": "K2021",
        "jd": "jd-da-intern",
        "weak": "situation",
        "versions": [(18, ["Tableau", "Google Analytics"], ["Thống kê"])],
        "sessions": [(16, 3.6, 0), (3, 3.1, 0)],
        "share": "all",
        "csat": [5, 4],
        "review": (1, True, "Câu trả lời về dashboard Power BI rất cụ thể. Giữ cách kể có số liệu như vậy."),
        "note": None,
    },
    {
        "id": "sv-0158",
        "full_name": "Trần Văn Hưng",
        "email": "hung.tv@gmail.com",
        "phone": "0962 019 548",
        "major": "Kinh doanh quốc tế",
        "cohort": "K2022",
        "jd": "jd-po-assistant",
        "weak": "task",
        "versions": [(30, ["Kiến thức ngân hàng số"], ["Phân tích dữ liệu"])],
        "sessions": [(28, 4.0, 0), (18, 4.1, 0), (7, 4.2, 0)],
        "share": "latest",
        "csat": [5, 5, 4],
        "review": (3, False, "Rất tốt. Thử luyện thêm câu hỏi về xử lý xung đột ưu tiên giữa các bên liên quan."),
        "note": ("Hồ sơ tốt, có thể giới thiệu vị trí PO Assistant.", ["soft_skill"], False),
    },
]


# Tin nhắn với cố vấn: (người gửi, số giờ trước, người nhận đã đọc?, nội dung)
MESSAGES: dict[str, list[tuple[str, int, bool, str]]] = {
    "sv-0151": [
        (
            "advisor",
            70,
            True,
            "Chào Huy, mình đã xem báo cáo buổi 4 của em. Phần Kết quả em thử nêu thêm số liệu đo được, ví dụ thời "
            "gian phản hồi API trước và sau khi tối ưu.",
        ),
        ("student", 66, True, "Dạ em cảm ơn ạ. Em sẽ bổ sung số liệu vào câu trả lời và luyện lại trong tuần này."),
    ],
    "sv-0152": [
        (
            "student",
            20,
            False,
            "Em chào cố vấn ạ. Mấy buổi gần đây điểm của em không tăng, nhất là phần Hành động. Em có thể đặt lịch "
            "gặp trong giờ tư vấn tuần này không ạ?",
        ),
    ],
    "sv-0158": [
        (
            "advisor",
            140,
            True,
            "Hưng chuẩn bị rất tốt. Tuần tới em ghé phòng A2.305 để trao đổi thêm về vị trí PO Assistant nhé.",
        ),
        ("student", 5, False, "Dạ vâng ạ. Em ghé vào chiều thứ 5 được không ạ?"),
    ],
}


def _clip(value: float) -> float:
    return round(min(5.0, max(0.0, value)), 2)


def _star_offsets(weak: str) -> dict[str, float]:
    """Tiêu chí yếu nhất thấp hơn 0,5; các tiêu chí còn lại cao hơn (tổng độ lệch bằng 0)."""
    others = [c for c in CRITERIA if c != weak]
    return {weak: -0.5, others[0]: 0.3, others[1]: 0.1, others[2]: 0.1}


def _cv_text(spec: dict[str, Any], jd: JobDescription, version_index: int) -> str:
    experience = list(CV_EXPERIENCE[spec["jd"]])
    if version_index > 0:
        # Phiên bản sau: SV đã sửa một câu cho rõ hơn
        experience[0] = experience[0].rstrip(".") + ", viết tài liệu hướng dẫn cho nhóm."
    skills = [s["name"] for s in jd.skills if s["name"] not in spec["versions"][version_index][1]]
    return "\n".join(
        [
            spec["full_name"],
            f"{spec['email']} | {spec['phone']} | Hà Nội",
            "MỤC TIÊU NGHỀ NGHIỆP",
            f"Sinh viên năm cuối ngành {spec['major']}, mong muốn ứng tuyển vị trí {jd.title}.",
            "HỌC VẤN",
            f"Trường Đại học X – Ngành {spec['major']} ({spec['cohort']})",
            "KINH NGHIỆM & DỰ ÁN",
            *[f"- {line}" for line in experience],
            "KỸ NĂNG",
            ", ".join(skills),
        ]
    )


def _analysis_result(jd: JobDescription, missing: list[str], partial: list[str]) -> tuple[float | None, dict[str, Any]]:
    requirements = []
    for index, skill in enumerate(jd.skills, start=1):
        status = "missing" if skill["name"] in missing else "partial" if skill["name"] in partial else "matched"
        requirements.append(
            {
                "id": f"r{index}",
                "skill": skill["name"],
                "importance": skill["importance"],
                "weight": IMPORTANCE_WEIGHTS[skill["importance"]],
                "match": {"matched": 1, "partial": 0.5, "missing": 0}[status],
                "status": status,
                "evidence": None,
                "note": None,
            }
        )
    score, breakdown = compute_score(requirements)
    return score, {
        "requirements": requirements,
        "suggestions": [],
        "pending_review_count": 0,
        "breakdown": breakdown,
        "summary": fallback_summary(requirements, score),
        "llm_used": False,
    }


def _add_session(
    db: Session, spec: dict[str, Any], jd: JobDescription, cv: CvVersion, days: int, target: float, timed_out: int
):
    completed = utcnow() - timedelta(days=days, hours=2)
    started = completed - timedelta(minutes=18)
    session = InterviewSession(
        id=f"iv_{spec['id'][3:]}_{days}",
        owner_id=spec["id"],
        jd_id=jd.id,
        cv_version_id=cv.id,
        cv_file_name=cv.file_name,
        status="completed",
        current_index=len(QUESTION_BANK) + 1,
        created_at=started,
        completed_at=completed,
    )
    offsets = _star_offsets(spec["weak"])
    turns = []
    for index, (theme, template) in enumerate(QUESTION_BANK, start=1):
        stars = {c: _clip(target + TURN_OFFSETS[index - 1] + offsets[c]) for c in CRITERIA}
        score = round(sum(stars.values()) / len(CRITERIA), 2)
        is_timed_out = index > len(QUESTION_BANK) - timed_out
        weakest = min(CRITERIA, key=lambda c: stars[c])
        turns.append(
            InterviewTurn(
                id=f"{session.id}_t{index}",
                session_id=session.id,
                index=index,
                theme=theme,
                question=template.format(role=jd.title),
                answer=ANSWERS[index - 1].format(role=jd.title),
                timed_out=is_timed_out,
                score=score,
                feedback=f"Câu trả lời có cấu trúc khá rõ. Gợi ý: {GUIDANCE[weakest][0].lower()}{GUIDANCE[weakest][1:]}",
                asked_at=started + timedelta(minutes=4 * (index - 1)),
                answered_at=started + timedelta(minutes=4 * index),
                **stars,
            )
        )
    session.star = {c: round(sum(getattr(t, c) for t in turns) / len(turns), 2) for c in CRITERIA}
    session.overall_score = round(sum(t.score for t in turns) / len(turns), 2)
    db.add(session)
    db.add_all(turns)
    return session


def _seed_student(db: Session, spec: dict[str, Any]) -> None:
    now = utcnow()
    db.add(
        User(
            id=spec["id"],
            role="student",
            full_name=spec["full_name"],
            subtitle=spec["email"],
            email=spec["email"],
            phone=spec["phone"],
        )
    )
    db.flush()
    assign(db, DEMO_ADVISOR_ID, spec["id"])
    jd = db.get(JobDescription, spec["jd"])

    cvs: list[CvVersion] = []
    for index, (days, missing, partial) in enumerate(spec["versions"]):
        stem = f"CV_{spec['full_name'].split()[-1]}"
        # Mọi phiên bản của SV demo thuộc cùng một CV: bản tải lên v1.0, các lần tối ưu v1.1, v1.2...
        cv = CvVersion(
            id=f"cv_{spec['id'][3:]}_{index + 1}",
            owner_id=spec["id"],
            version=index + 1,
            family_id=f"cv_{spec['id'][3:]}_1",
            major=1,
            minor=index,
            file_name=f"{stem}_v1.{index}.docx",
            file_type="docx",
            size_bytes=0,
            content_text=_cv_text(spec, jd, index),
            origin="upload" if index == 0 else "optimized",
            is_active=index == len(spec["versions"]) - 1,
            uploaded_at=now - timedelta(days=days, hours=3),
        )
        data = cv_files.build_docx(cv_document(cv), DEVELOPING_TITLE)
        cv.size_bytes = len(data)
        cv_files.save_file(spec["id"], cv.id, "docx", data)
        db.add(cv)
        cvs.append(cv)

        score, result = _analysis_result(jd, missing, partial)
        analyzed = now - timedelta(days=days, hours=2)
        db.add(
            GapAnalysis(
                id=f"ga_{spec['id'][3:]}_{index + 1}",
                owner_id=spec["id"],
                cv_version_id=cv.id,
                cv_file_name=cv.file_name,
                cv_label=label(cv),
                jd_id=jd.id,
                status="completed",
                current_step=None,
                match_score=score,
                result=result,
                created_at=analyzed,
                completed_at=analyzed + timedelta(seconds=40),
            )
        )
        if index > 0:
            cv.source_analysis_id = f"ga_{spec['id'][3:]}_{index}"

    sessions = []
    for days, score, timed_out in spec["sessions"]:
        cv = next((c for c in reversed(cvs) if c.uploaded_at < now - timedelta(days=days)), cvs[0])
        sessions.append(_add_session(db, spec, jd, cv, days, score, timed_out))

    shared: list[tuple[str, str]] = []
    if spec["share"] in ("all", "cv", "latest"):
        # Chia sẻ theo cả CV (mã CV = id bản đầu tiên): cố vấn xem bản mới nhất và các bản trước
        shared.append(("cv", cvs[0].id))
    if spec["share"] == "all":
        shared += [("interview", s.id) for s in sessions]
    elif spec["share"] == "latest":
        shared += [("interview", s.id) for s in sessions[-2:]]
    for kind, item_id in shared:
        db.add(
            ShareGrant(
                id=f"sh_{item_id}", owner_id=spec["id"], kind=kind, item_id=item_id, shared_at=now - timedelta(days=1)
            )
        )

    if spec["review"]:
        number, seen, comment = spec["review"]
        session = sessions[number - 1]
        reviewed = min(session.completed_at + timedelta(days=1), now)
        db.add(
            AdvisorReview(
                id=f"rv_{session.id}",
                advisor_id=DEMO_ADVISOR_ID,
                student_id=spec["id"],
                session_id=session.id,
                comment=comment,
                created_at=reviewed,
                updated_at=reviewed,
                seen_at=reviewed + timedelta(hours=5) if seen else None,
            )
        )
    if spec["note"]:
        body, tags, pinned = spec["note"]
        db.add(
            AdvisorNote(
                id=f"nt_{spec['id'][3:]}",
                advisor_id=DEMO_ADVISOR_ID,
                student_id=spec["id"],
                body=body,
                tags=tags,
                pinned=pinned,
                created_at=now - timedelta(days=2),
                updated_at=now - timedelta(days=2),
            )
        )


# Nhận xét kèm CSAT (hiện ở "Nhận xét gần đây" của trang Quản trị, không kèm tên SV), theo mã phản hồi
CSAT_COMMENTS = {
    "fb_iv_0151_27": "Câu hỏi sát với vị trí, phần gợi ý cải thiện Kết quả rất dễ làm theo.",
    "fb_iv_0152_20": "Câu hỏi hơi lặp lại giữa các buổi, mong có thêm câu hỏi tình huống.",
    "fb_ga_0157_1": "Chỉ ra đúng kỹ năng còn thiếu, có ví dụ câu viết lại nên sửa CV nhanh.",
    "fb_ga_0156_1": "Danh sách kỹ năng rõ ràng, mong có thêm gợi ý khoá học cho phần còn thiếu.",
}

# Lý do chọn nhanh của các lượt 1–3 sao (src/services/feedback.py REASONS)
CSAT_TAGS = {
    "fb_iv_0152_20": ["off_target_questions"],
    "fb_iv_0152_30": ["too_short"],
}

# Cố vấn khác (chưa đặt mật khẩu nên không đăng nhập được) và SV mới đăng ký đang chờ phân công
EXTRA_ADVISORS = [
    {"id": "cv-008", "full_name": "Lê Thu Hà", "email": "ha.le@careerx.vn", "title": "Cố vấn hướng nghiệp"},
    {"id": "cv-009", "full_name": "Võ Minh Đức", "email": "duc.vo@careerx.vn", "title": "Cố vấn ngành CNTT"},
]
UNASSIGNED_STUDENTS = [
    {
        "id": "sv-0171",
        "full_name": "Hoàng Minh Thu",
        "email": "hoangthu.ng@gmail.com",
        "phone": "0901 223 445",
        "days": 0,
    },
    {
        "id": "sv-0172",
        "full_name": "Phan Văn Long",
        "email": "longphan.dev@gmail.com",
        "phone": "0938 112 907",
        "days": 1,
    },
    {"id": "sv-0173", "full_name": "Ngô Tường Vy", "email": "vy.ngo@outlook.com", "phone": "0977 450 128", "days": 2},
]


def _seed_admin_examples(db: Session) -> None:
    now = utcnow()
    for spec in EXTRA_ADVISORS:
        if db.get(User, spec["id"]) is None:
            db.add(User(role="advisor", subtitle=spec["title"], **spec))
    for spec in UNASSIGNED_STUDENTS:
        if db.get(User, spec["id"]) is None:
            data = {k: v for k, v in spec.items() if k != "days"}
            db.add(User(role="student", subtitle=spec["email"], created_at=now - timedelta(days=spec["days"]), **data))


def _activity_ids(spec: dict[str, Any]) -> list[tuple[str, str]]:
    """Các lượt dùng của SV (mã lượt, loại hoạt động): lượt phân tích rồi buổi phỏng vấn, cũ → mới."""
    key = spec["id"][3:]
    analyses = [(f"ga_{key}_{index + 1}", "gap_analysis") for index in range(len(spec["versions"]))]
    return analyses + [(f"iv_{key}_{days}", "interview") for days, _, _ in spec["sessions"]]


def _seed_csat(db: Session, spec: dict[str, Any]) -> None:
    """CSAT của SV giả định; bổ sung nếu còn thiếu (DB tạo trước khi có phần này)."""
    for (response_id, activity), value in zip(_activity_ids(spec), spec["csat"], strict=False):
        feedback_id = f"fb_{response_id}"
        existing = db.get(Feedback, feedback_id)
        if existing is not None:
            if existing.comment is None and feedback_id in CSAT_COMMENTS:
                existing.comment = CSAT_COMMENTS[feedback_id]
            if existing.tags is None and feedback_id in CSAT_TAGS:
                existing.tags = CSAT_TAGS[feedback_id]
        else:
            db.add(
                Feedback(
                    id=feedback_id,
                    user_id=spec["id"],
                    response_id=response_id,
                    kind="csat",
                    value=value,
                    activity=activity,
                    comment=CSAT_COMMENTS.get(feedback_id),
                    tags=CSAT_TAGS.get(feedback_id),
                )
            )


def _seed_messages(db: Session, spec: dict[str, Any]) -> None:
    """Tin nhắn demo với cố vấn; bổ sung nếu còn thiếu (DB tạo trước khi có phần này)."""
    now = utcnow()
    for index, (sender, hours, read, body) in enumerate(MESSAGES.get(spec["id"], []), start=1):
        message_id = f"msg_{spec['id'][3:]}_{index}"
        if db.get(Message, message_id) is not None:
            continue
        sent = now - timedelta(hours=hours)
        db.add(
            Message(
                id=message_id,
                advisor_id=DEMO_ADVISOR_ID,
                student_id=spec["id"],
                sender_id=DEMO_ADVISOR_ID if sender == "advisor" else spec["id"],
                body=body,
                created_at=sent,
                read_at=sent + timedelta(hours=1) if read else None,
            )
        )


def seed_demo_cohort(db: Session) -> None:
    """Tạo các SV giả định chưa có trong DB (không đụng tới dữ liệu SV đã có, chỉ bổ sung CSAT / tin nhắn còn thiếu)."""
    for spec in COHORT:
        user = db.get(User, spec["id"])
        if user is None:
            _seed_student(db, spec)
            db.flush()
        else:
            migrate_school_profile(user, {"subtitle": spec["email"], "email": spec["email"]})
            if user.phone is None:
                user.phone = spec["phone"]
        _seed_csat(db, spec)
        _seed_messages(db, spec)
    _seed_admin_examples(db)
    db.commit()
