// Dữ liệu minh hoạ cho chế độ mock. Tên người, trường, công ty đều là giả định.

import type {
  AppNotification,
  CvVersion,
  GapAnalysis,
  InterviewQuota,
  InterviewReport,
  InterviewRoundOption,
  InterviewSession,
  InterviewSummary,
  JobDescription,
  StudentOverview,
  UserProfile,
} from "@/lib/types"

const now = new Date()
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString()

export const mockStudent: UserProfile = {
  id: "sv-0142",
  role: "student",
  full_name: "Nguyễn Minh Anh",
  subtitle: "KDQT - K2021",
  avatar_url: null,
}

export const mockAdvisor: UserProfile = {
  id: "cv-007",
  role: "advisor",
  full_name: "ThS. Trần Hoàng Nam",
  subtitle: "Khoa HTTT",
  avatar_url: null,
}

export const mockQuota: InterviewQuota = {
  used: 0,
  limit: 3,
  resets_at: new Date(now.getTime() + 3 * 86_400_000).toISOString(),
}

export const mockCvVersions: CvVersion[] = [
  {
    id: "cv-v3",
    version: 3,
    label: "v2.0",
    file_name: "Business_Analyst_MinhAnh_v2.pdf",
    file_type: "pdf",
    size_bytes: 1_200_000,
    page_count: 2,
    uploaded_at: daysAgo(0),
    status: "ready",
    error_message: null,
    target_title: "Business Analyst Intern",
    ats_score: 85,
    ats_note: "Khớp 12/14 từ khoá",
    origin: "optimized",
    latest_analysis_id: "ga-001",
    is_active: true,
    is_draft: false,
  },
  {
    id: "cv-v2",
    version: 2,
    label: "v1.1",
    file_name: "CV_NguyenMinhAnh_BA.pdf",
    file_type: "pdf",
    size_bytes: 1_100_000,
    page_count: 1,
    uploaded_at: daysAgo(1),
    status: "ready",
    error_message: null,
    target_title: "Business Analyst Intern",
    ats_score: 76,
    ats_note: "Khớp 11/14 từ khoá",
    origin: "optimized",
    latest_analysis_id: "ga-001",
    is_active: false,
    is_draft: false,
  },
  {
    id: "cv-v1",
    version: 1,
    label: "v1.0",
    file_name: "MinhAnh_ProductOwner_Draft.docx",
    file_type: "docx",
    size_bytes: 850_000,
    page_count: 1,
    uploaded_at: daysAgo(3),
    status: "ready",
    error_message: null,
    target_title: "Product Owner Assistant",
    ats_score: 62,
    ats_note: "Thiếu chỉ số định lượng",
    origin: "upload",
    latest_analysis_id: null,
    is_active: false,
    is_draft: true,
  },
]

export const mockJdLibrary: JobDescription[] = [
  {
    id: "jd-ba-intern",
    title: "Business Analyst Intern",
    company: "Công ty Công nghệ A",
    industry: "Công nghệ & phần mềm",
    level: "intern",
    skills: ["SQL", "BPMN 2.0", "Viết BRD", "Agile"],
    content: null,
    source: "library",
  },
  {
    id: "jd-da-intern",
    title: "Data Analyst Intern",
    company: "Công ty Thương mại điện tử B",
    industry: "Thương mại điện tử",
    level: "intern",
    skills: ["SQL", "Power BI", "Python", "Excel nâng cao"],
    content: null,
    source: "library",
  },
  {
    id: "jd-po-assistant",
    title: "Product Owner Assistant",
    company: "Ngân hàng C",
    industry: "Fintech & ngân hàng",
    level: "fresher",
    skills: ["User Story", "Scrum", "Backlog", "UX Flow"],
    content: null,
    source: "library",
  },
  {
    id: "jd-mkt-analyst",
    title: "Marketing Analyst",
    company: "Công ty Truyền thông D",
    industry: "Truyền thông số",
    level: "fresher",
    skills: ["Google Analytics", "A/B Testing", "Data Viz"],
    content: null,
    source: "library",
  },
]

export const mockGapAnalysis: GapAnalysis = {
  id: "ga-001",
  response_id: "resp-ga-001",
  cv_version_id: "cv-v2",
  cv_file_name: "CV_NguyenMinhAnh_BA.pdf",
  jd: { id: "jd-ba-intern", title: "Business Analyst Intern", company: "Công ty Công nghệ A", level: "intern" },
  created_at: daysAgo(0),
  match_score: 76,
  ats_score: 84,
  matched_skills: [
    {
      skill: "SQL & truy vấn dữ liệu",
      requirement_note: "Bắt buộc · Mức độ cơ bản",
      status: "matched",
      evidence_span: {
        text: "Sử dụng PostgreSQL trích xuất 50.000 dòng dữ liệu bán hàng cho đồ án Thương mại điện tử",
        line_start: 18,
        line_end: 18,
      },
      advice: "Đã nêu rõ công cụ và quy mô dữ liệu. Giữ nguyên cấu trúc này.",
    },
    {
      skill: "Viết tài liệu BRD / SRS",
      requirement_note: "Kỹ năng nền tảng · Tài liệu hoá",
      status: "matched",
      evidence_span: {
        text: "Soạn thảo tài liệu đặc tả yêu cầu người dùng (SRS) cho 12 tính năng chính của ứng dụng di động",
        line_start: 14,
        line_end: 14,
      },
      advice: "Đạt yêu cầu. Có thể bổ sung chỉ số nghiệm thu nếu có.",
    },
    {
      skill: "Phỏng vấn & khơi gợi yêu cầu",
      requirement_note: "Bắt buộc · Làm việc với stakeholder",
      status: "matched",
      evidence_span: {
        text: "Tổ chức 6 buổi phỏng vấn người dùng để thu thập yêu cầu cho cổng quản lý thông tin CLB",
        line_start: 11,
        line_end: 12,
      },
      advice: "Bằng chứng rõ ràng, có số lượng cụ thể.",
    },
    {
      skill: "Excel / Google Sheets",
      requirement_note: "Công cụ văn phòng · Bắt buộc",
      status: "matched",
      evidence_span: { text: "Tổng hợp và làm sạch dữ liệu khảo sát 300 sinh viên bằng Excel (PivotTable)", line_start: 31, line_end: 31 },
      advice: null,
    },
    {
      skill: "Kỹ năng thuyết trình",
      requirement_note: "Kỹ năng mềm",
      status: "matched",
      evidence_span: { text: "Trình bày kết quả đồ án trước hội đồng khoa và 2 doanh nghiệp đối tác", line_start: 20, line_end: 20 },
      advice: null,
    },
  ],
  weak_skills: [
    {
      skill: "Vẽ sơ đồ quy trình BPMN / UML",
      requirement_note: "Trọng tâm JD · Phân tích nghiệp vụ",
      status: "weak",
      evidence_span: { text: "Vẽ sơ đồ chức năng đồ án hệ thống quản lý thư viện sinh viên", line_start: 24, line_end: 24 },
      advice: "Nêu rõ công cụ (Draw.io, Lucidchart) và chuẩn BPMN 2.0 để hệ thống ATS nhận diện.",
    },
    {
      skill: "Agile / Scrum",
      requirement_note: "Quy trình làm việc · Bắt buộc",
      status: "weak",
      evidence_span: { text: "Làm việc nhóm theo sprint 2 tuần hoàn thành dự án đúng hạn", line_start: 28, line_end: 28 },
      advice: "Bổ sung vai trò của bạn trong các nghi thức Scrum như Daily Standup, Sprint Planning.",
    },
    {
      skill: "Viết User Story & Acceptance Criteria",
      requirement_note: "Trọng tâm JD · Tài liệu hoá",
      status: "weak",
      evidence_span: { text: "Ghi lại các yêu cầu chức năng của hệ thống dưới dạng danh sách", line_start: 15, line_end: 15 },
      advice: "Nếu bạn đã viết theo định dạng User Story, hãy ghi rõ thuật ngữ này và số lượng story.",
    },
  ],
  missing_skills: [
    {
      skill: "Tableau / Power BI",
      requirement_note: "Trực quan hoá dữ liệu · Điểm cộng",
      status: "missing",
      evidence_span: null,
      advice: "Không tìm thấy trong CV. Hãy cân nhắc học thêm trước khi ứng tuyển.",
    },
    {
      skill: "JIRA / Confluence",
      requirement_note: "Công cụ quản lý dự án · Điểm cộng",
      status: "missing",
      evidence_span: null,
      advice: "Không tìm thấy trong CV. Nếu bạn đã dùng trong môn học hoặc dự án, hãy bổ sung ngữ cảnh cụ thể.",
    },
  ],
  unclear_skills: [
    {
      skill: "Phân tích dữ liệu bằng Python",
      requirement_note: "Điểm cộng",
      status: "unclear",
      evidence_span: { text: "Tham gia khoá học lập trình cơ bản", line_start: 35, line_end: 35 },
      advice: "Chưa đủ thông tin để xác định bạn đã dùng Python cho phân tích dữ liệu hay chưa. Hãy tự kiểm tra lại.",
    },
  ],
  suggestions: [],
  summary:
    "Nền tảng định lượng và tư duy logic tốt, thể hiện qua việc xử lý dữ liệu SQL quy mô lớn. Điểm cần cải thiện là cách dùng thuật ngữ kỹ thuật chuẩn của vị trí Business Analyst.",
  ats_feedback: "Bố cục 1 cột, phông chữ chuẩn, không có bảng biểu phức tạp gây lỗi đọc.",
  next_steps: [
    { title: "Bổ sung mô hình STAR", description: "Làm rõ kết quả đầu ra đo được ở dự án môn học Hệ thống thư viện." },
    { title: "Chèn tên công cụ cụ thể", description: "Nêu Draw.io, JIRA (nếu đã dùng thật) và các câu lệnh SQL đã viết." },
  ],
}

export const mockRoundOptions: InterviewRoundOption[] = [
  {
    id: "round-hr",
    title: "Vòng 1: HR & Động lực ứng tuyển",
    description: "Mức độ phù hợp văn hoá, định hướng nghề nghiệp và khả năng tự nhận thức.",
    minutes: 10,
    question_count: 3,
    focus_jd: false,
  },
  {
    id: "round-domain",
    title: "Vòng 2: Chuyên môn & Tình huống",
    description: "Kỹ năng phân tích nghiệp vụ, mô hình hoá quy trình, xử lý xung đột yêu cầu.",
    minutes: 15,
    question_count: 4,
    focus_jd: true,
  },
  {
    id: "round-behavioral",
    title: "Vòng 3: Hành vi chuyên sâu",
    description: "Làm việc nhóm dưới áp lực tiến độ và giao tiếp với các bên liên quan.",
    minutes: 15,
    question_count: 4,
    focus_jd: false,
  },
]

export const mockInterviewSession: InterviewSession = {
  id: "iv-001",
  jd: { id: "jd-ba-intern", title: "Business Analyst Intern", company: "Công ty Công nghệ A" },
  level: "intern",
  difficulty: "realistic",
  round_title: "Vòng 2: Chuyên môn & Tình huống",
  status: "in_progress",
  started_at: now.toISOString(),
  time_limit_seconds_per_question: 180,
  current_index: 0,
  questions: [
    {
      id: "q-1",
      index: 1,
      text: "Hãy giới thiệu ngắn gọn về bản thân và lý do bạn muốn trở thành Business Analyst.",
      based_on: "Định hướng nghề nghiệp",
    },
    {
      id: "q-2",
      index: 2,
      text: "Hãy mô tả một tình huống bạn phải làm rõ yêu cầu từ một người có ý tưởng rất mơ hồ.",
      based_on: "Khơi gợi & làm rõ yêu cầu",
    },
    {
      id: "q-3",
      index: 3,
      text: "Khi Lead Developer báo tính năng không kịp tiến độ Sprint, bạn xử lý xung đột với stakeholder thế nào?",
      based_on: "Kỹ năng đàm phán & quản trị yêu cầu trong JD",
    },
    {
      id: "q-4",
      index: 4,
      text: "Bạn xây dựng kịch bản kiểm thử chấp nhận (UAT) và đồng hành cùng người dùng cuối như thế nào?",
      based_on: "Kiểm thử chấp nhận & bàn giao",
    },
  ],
}

export const mockInterviewReport: InterviewReport = {
  id: "rp-001",
  response_id: "resp-rp-001",
  session_id: "iv-001",
  jd: { id: "jd-ba-intern", title: "Business Analyst Intern", company: "Công ty Công nghệ A" },
  round_title: "Vòng 2: Chuyên môn & Tình huống",
  completed_at: now.toISOString(),
  duration_seconds: 18 * 60,
  total_score: 82,
  star: { situation: 88, task: 82, action: 85, result: 72 },
  star_notes: {
    situation: "Rõ ràng, mạch lạc, nêu đúng ngữ cảnh bài toán thực tế.",
    task: "Xác định đúng vai trò và trách nhiệm trọng tâm của bản thân.",
    action: "Nêu rõ phương pháp phân tích yêu cầu (Use Case, 5W1H, BPMN).",
    result: "Mức độ khá. Cần bổ sung dữ liệu đo lường hiệu quả cụ thể.",
  },
  summary:
    "Thể hiện tư duy phân tích sắc bén, nắm vững quy trình thu thập và phân loại yêu cầu nghiệp vụ. Cần cải thiện khả năng đưa ra chỉ số định lượng ở giai đoạn Kết quả (Result) để tăng sức thuyết phục.",
  questions: [
    {
      question_id: "q-1",
      index: 1,
      skill: "Định hướng nghề nghiệp",
      question: "Hãy giới thiệu ngắn gọn về bản thân và lý do bạn muốn trở thành Business Analyst.",
      answer_excerpt:
        "Em là sinh viên năm cuối ngành Kinh doanh quốc tế, đã tham gia 3 dự án môn học liên quan đến phân tích quy trình…",
      answer_seconds: 96,
      score: 85,
      gap_label: null,
      strengths: ["Giới thiệu mạch lạc, gắn với vị trí ứng tuyển"],
      improvements: ["Nêu thêm một thành tích cụ thể để tạo ấn tượng"],
      diagnosis: null,
      sample_answer: null,
    },
    {
      question_id: "q-2",
      index: 2,
      skill: "Khơi gợi & làm rõ yêu cầu",
      question: "Hãy mô tả một tình huống bạn phải làm rõ yêu cầu từ một người có ý tưởng rất mơ hồ.",
      answer_excerpt:
        "Trong đồ án, nhóm em nhận đề tài xây dựng cổng quản lý CLB với yêu cầu rất chung. Em chủ động đề xuất buổi phỏng vấn 30 phút và vẽ trước 3 màn hình mockup…",
      answer_seconds: 134,
      score: 90,
      gap_label: null,
      strengths: ["Chủ động giải quyết vấn đề thay vì chờ chỉ thị", "Dùng wireframe để thống nhất góc nhìn với người dùng"],
      improvements: ["Bổ sung cách quản lý biên bản cuộc họp để thể hiện tính chặt chẽ"],
      diagnosis: null,
      sample_answer: null,
    },
    {
      question_id: "q-3",
      index: 3,
      skill: "Đàm phán kỹ thuật & xử lý xung đột",
      question: "Khi Lead Developer báo tính năng không kịp tiến độ Sprint, bạn xử lý xung đột với stakeholder thế nào?",
      answer_excerpt: "Em sẽ lắng nghe lý do từ lập trình viên, sau đó báo cáo lại với trưởng nhóm để họ quyết định…",
      answer_seconds: 95,
      score: 70,
      gap_label: "Thiếu yếu tố Hành động (Action) & thương lượng",
      strengths: ["Tôn trọng ý kiến kỹ thuật"],
      improvements: ["Nêu hành động cụ thể của chính bạn thay vì chuyển tiếp cho người khác"],
      diagnosis:
        "Bạn mới dừng ở việc lắng nghe và chuyển trách nhiệm ra ngoài. Nhà tuyển dụng kỳ vọng BA đề xuất phương án thay thế, ví dụ chia nhỏ tính năng thành bản MVP và giai đoạn sau, hoặc điều chỉnh tiêu chí chấp nhận.",
      sample_answer:
        "(S-T) Khi Tech Lead báo tính năng lọc tốn thêm thời gian, (A) em tổ chức buổi trao đổi 15 phút để phân tích nguyên nhân và đề xuất tách phần cốt lõi làm MVP cho Sprint này; (R) tính năng vẫn ra mắt đúng hạn, phần nâng cao chuyển sang Sprint sau.",
    },
    {
      question_id: "q-4",
      index: 4,
      skill: "Kiểm thử chấp nhận (UAT) & bàn giao",
      question: "Bạn xây dựng kịch bản kiểm thử chấp nhận (UAT) và đồng hành cùng người dùng cuối như thế nào?",
      answer_excerpt: "Em lập danh sách kịch bản theo từng tiêu chí chấp nhận, mời 10 người dùng thử và ghi nhận lỗi vào bảng theo dõi…",
      answer_seconds: 118,
      score: 78,
      gap_label: null,
      strengths: ["Quy trình rõ ràng, có số lượng người dùng thử"],
      improvements: ["Nêu kết quả sau UAT, ví dụ số lỗi được sửa trước khi bàn giao"],
      diagnosis: null,
      sample_answer: null,
    },
  ],
  advisor_review: {
    advisor_name: "ThS. Trần Hoàng Nam",
    score: 85,
    comment:
      "Thầy đánh giá cao cách em trả lời câu hỏi về xung đột yêu cầu. Lưu ý ở câu 3 em nên nhấn mạnh thêm bài học rút ra và hành động cụ thể của bản thân.",
    reviewed_at: now.toISOString(),
  },
}

export const mockRecentInterviews: InterviewSummary[] = [
  { id: "iv-005", title: "Buổi 5: BA chuyên môn", completed_at: daysAgo(0), total_score: 82, note: "A: 85 • R: 72" },
  { id: "iv-004", title: "Buổi 4: HR & phù hợp văn hoá", completed_at: daysAgo(3), total_score: 88, note: "Động lực & cam kết cao" },
  { id: "iv-003", title: "Buổi 3: Xử lý tình huống Agile", completed_at: daysAgo(7), total_score: 74, note: "Cần bổ sung chỉ số định lượng" },
]

export const mockOverview: StudentOverview = {
  cv_version_count: 3,
  cv_latest_at: daysAgo(1),
  interview_count: 5,
  streak_days: 4,
  latest_score: 82,
  score_delta: 21,
  target: { title: "Business Analyst Intern", company: "Công ty Công nghệ A" },
  current_match_score: 78,
  star_average: { situation: 88, task: 80, action: 74, result: 68 },
  star_notes: { action: "Cần nêu rõ công cụ", result: "Bổ sung % chỉ số" },
  recent_activity: [
    {
      id: "a1",
      kind: "interview",
      title: "Phỏng vấn: Xử lý xung đột yêu cầu của stakeholder",
      description: "Hoàn thành phiên luyện tập với điểm STAR 82/100.",
      occurred_at: daysAgo(0),
    },
    {
      id: "a2",
      kind: "cv_optimized",
      title: "Tối ưu CV: Business_Analyst_MinhAnh_v2.pdf",
      description: "Điểm ATS tăng từ 76 lên 85 sau khi chuẩn hoá thuật ngữ SQL và BPMN.",
      occurred_at: daysAgo(1),
    },
    {
      id: "a3",
      kind: "advisor_comment",
      title: "Cố vấn ThS. Trần Hoàng Nam để lại nhận xét",
      description: "“Cấu trúc trả lời rất gãy gọn, chỉ cần chú ý giọng điệu tự tin hơn ở đoạn kết quả dự án.”",
      occurred_at: daysAgo(2),
    },
    {
      id: "a4",
      kind: "gap_analysis",
      title: "Phân tích JD: Business Analyst Intern – Công ty Công nghệ A",
      description: "Phát hiện 3 kỹ năng còn thiếu: Wireframing (Figma), JIRA sprint planning và viết User Story.",
      occurred_at: daysAgo(3),
    },
  ],
  advisor_tip: {
    advisor_name: "ThS. Trần Hoàng Nam",
    text: "Áp dụng công thức STAR kèm con số định lượng khi kể về đồ án, ví dụ thời gian xử lý giảm bao nhiêu phần trăm.",
  },
}

const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString()

export const mockStudentNotifications: AppNotification[] = [
  {
    id: "n-s1",
    kind: "advisor_comment",
    title: "ThS. Trần Hoàng Nam đã gửi nhận xét cho Buổi 5",
    body: "“Thầy đã xem qua phần trả lời STAR câu hỏi xử lý xung đột của em…”",
    created_at: minutesAgo(15),
    read: false,
    action_label: "Xem nhận xét",
    action_href: "/student/interview/iv-001/report",
  },
  {
    id: "n-s2",
    kind: "interview_report",
    title: "Báo cáo phỏng vấn Buổi 5 đã sẵn sàng – AI chấm 82/100",
    body: "Xem phân tích STAR chi tiết và gợi ý cải thiện phần Result.",
    created_at: minutesAgo(60),
    read: false,
    action_label: "Xem báo cáo",
    action_href: "/student/interview/iv-001/report",
  },
  {
    id: "n-s3",
    kind: "gap_analysis",
    title: "Phân tích CV Business_Analyst_MinhAnh_v2.pdf hoàn tất",
    body: "Độ khớp với JD Business Analyst Intern: 76/100.",
    created_at: minutesAgo(180),
    read: false,
    action_label: null,
    action_href: "/student/analysis/ga-001",
  },
]

export const mockAdvisorNotifications: AppNotification[] = [
  {
    id: "n-a1",
    kind: "student_activity",
    title: "Nguyễn Minh Anh vừa hoàn thành Buổi 5 – báo cáo chờ duyệt",
    body: "Điểm AI: 82/100. Sinh viên có yêu cầu xem xét lại câu hỏi số 3.",
    created_at: minutesAgo(10),
    read: false,
    action_label: "Duyệt ngay",
    action_href: "/advisor/students/sv-0142",
  },
  {
    id: "n-a2",
    kind: "student_inactive",
    title: "Phạm Thu Trang không hoạt động 4 ngày",
    body: "Sinh viên chưa nộp bản nháp CV và chưa thực hiện phỏng vấn thử.",
    created_at: minutesAgo(120),
    read: false,
    action_label: null,
    action_href: "/advisor/students/sv-0163",
  },
]

/** Kịch bản sinh viên mới: chưa có CV, chưa phỏng vấn (NEXT_PUBLIC_MOCK_SCENARIO=new_student). */
export const mockOverviewNewStudent: StudentOverview = {
  cv_version_count: 0,
  cv_latest_at: null,
  interview_count: 0,
  streak_days: 0,
  latest_score: null,
  score_delta: null,
  target: null,
  current_match_score: null,
  star_average: null,
  star_notes: {},
  recent_activity: [],
  advisor_tip: null,
}
