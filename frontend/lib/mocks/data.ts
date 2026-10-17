// Dữ liệu minh hoạ cho chế độ mock. Tên người, trường, công ty đều là giả định.

import type {
  AppNotification,
  CvVersion,
  GapAnalysis,
  InterviewReport,
  InterviewSummary,
  JobDescription,
  StarCriterion,
  UserProfile,
} from "@/lib/types"

const now = new Date()
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString()

export const mockStudent: UserProfile = {
  id: "sv-0142",
  role: "student",
  full_name: "Nguyễn Minh Anh",
  subtitle: "minhanh.nguyen@gmail.com",
  avatar_url: null,
}

export const mockAdvisor: UserProfile = {
  id: "cv-007",
  role: "advisor",
  full_name: "ThS. Trần Hoàng Nam",
  subtitle: "Cố vấn hướng nghiệp",
  avatar_url: null,
}

// Hai CV (mỗi CV là các phiên bản cùng family_id, xem lib/types.ts CvVersion), cũ → mới theo số thứ tự nội bộ:
// - CV Business Analyst: v1.0 tải lên → v1.1 tối ưu → v2.0 khôi phục từ v1.0 → v2.1 tối ưu (bản đang dùng).
// - CV Product Owner: chỉ có bản nháp v1.0.
// version_count được tính lại khi trả về danh sách (lib/mocks/handlers.ts).
const baCv = { family_id: "cv-ba-v10", target_title: "Business Analyst Intern", status: "ready", error_message: null } as const

export const mockCvVersions: CvVersion[] = [
  {
    ...baCv,
    id: "cv-v3",
    version: 5,
    label: "v2.1",
    version_count: 4,
    file_name: "CV_NguyenMinhAnh_BA_v2.1.docx",
    file_type: "docx",
    size_bytes: 1_200_000,
    page_count: null,
    uploaded_at: daysAgo(0),
    match_score: 85,
    origin: "optimized",
    latest_analysis_id: "ga-001",
    source_analysis_id: null,
    source_jd_title: "Business Analyst Intern",
    restored_from_label: null,
    is_active: true,
    is_draft: false,
  },
  {
    ...baCv,
    id: "cv-v2",
    version: 4,
    label: "v2.0",
    version_count: 4,
    file_name: "CV_NguyenMinhAnh_BA.pdf",
    file_type: "pdf",
    size_bytes: 1_100_000,
    page_count: 1,
    uploaded_at: daysAgo(1),
    match_score: 76,
    origin: "restored",
    latest_analysis_id: "ga-001",
    source_analysis_id: null,
    source_jd_title: null,
    restored_from_label: "v1.0",
    is_active: false,
    is_draft: false,
  },
  {
    id: "cv-v1",
    version: 3,
    label: "v1.0",
    family_id: "cv-v1",
    version_count: 1,
    file_name: "MinhAnh_ProductOwner_Draft.docx",
    file_type: "docx",
    size_bytes: 850_000,
    page_count: 1,
    uploaded_at: daysAgo(3),
    status: "ready",
    error_message: null,
    target_title: "Product Owner Assistant",
    match_score: 62,
    origin: "upload",
    latest_analysis_id: null,
    source_analysis_id: null,
    source_jd_title: null,
    restored_from_label: null,
    is_active: false,
    is_draft: true,
  },
  {
    ...baCv,
    id: "cv-ba-v11",
    version: 2,
    label: "v1.1",
    version_count: 4,
    file_name: "CV_NguyenMinhAnh_BA_v1.1.docx",
    file_type: "docx",
    size_bytes: 1_050_000,
    page_count: null,
    uploaded_at: daysAgo(8),
    match_score: 64,
    origin: "optimized",
    latest_analysis_id: null,
    source_analysis_id: null,
    source_jd_title: "Business Analyst Intern",
    restored_from_label: null,
    is_active: false,
    is_draft: false,
  },
  {
    ...baCv,
    id: "cv-ba-v10",
    version: 1,
    label: "v1.0",
    version_count: 4,
    file_name: "CV_NguyenMinhAnh_BA.pdf",
    file_type: "pdf",
    size_bytes: 1_100_000,
    page_count: 1,
    uploaded_at: daysAgo(12),
    match_score: 58,
    origin: "upload",
    latest_analysis_id: null,
    source_analysis_id: null,
    source_jd_title: null,
    restored_from_label: null,
    is_active: false,
    is_draft: false,
  },
]

// Trùng id/nội dung chính với thư viện JD của backend (src/db/fixtures/jd_library.json), bản rút gọn cho chế độ mock.
export const mockJdLibrary: JobDescription[] = [
  {
    id: "jd-ba-intern",
    title: "Business Analyst Intern",
    company: "Công ty Công nghệ A",
    industry: "Công nghệ & phần mềm",
    level: "intern",
    skills: [
      { name: "SQL", importance: "required" },
      { name: "Phân tích yêu cầu", importance: "required" },
      { name: "Viết tài liệu BRD/SRS", importance: "required" },
      { name: "BPMN", importance: "preferred" },
      { name: "Agile/Scrum", importance: "preferred" },
      { name: "Excel", importance: "preferred" },
      { name: "Jira", importance: "additional" },
      { name: "Figma", importance: "additional" },
      { name: "Tiếng Anh", importance: "additional" },
    ],
    content:
      "Công ty Công nghệ A phát triển nền tảng quản lý bán hàng cho doanh nghiệp vừa và nhỏ, tuyển Thực tập sinh Phân tích nghiệp vụ làm việc cùng đội sản phẩm.\n\nMô tả công việc:\n- Thu thập và phân tích yêu cầu từ khách hàng và các phòng ban.\n- Viết tài liệu BRD/SRS và user story cho đội phát triển.\n- Vẽ sơ đồ quy trình nghiệp vụ bằng BPMN.\n- Truy vấn dữ liệu bằng SQL để kiểm tra giả thuyết nghiệp vụ.\n\nYêu cầu bắt buộc:\n- Biết viết truy vấn SQL cơ bản.\n- Có khả năng phân tích yêu cầu và trình bày tài liệu rõ ràng.\n\nƯu tiên: đã vẽ sơ đồ BPMN, hiểu Agile/Scrum, thành thạo Excel.\n\nĐiểm cộng: đã dùng Jira, biết vẽ wireframe bằng Figma, tiếng Anh đọc hiểu tốt.",
    source: "library",
  },
  {
    id: "jd-da-intern",
    title: "Data Analyst Intern",
    company: "Công ty Thương mại điện tử B",
    industry: "Thương mại điện tử",
    level: "intern",
    skills: [
      { name: "SQL", importance: "required" },
      { name: "Excel", importance: "required" },
      { name: "Power BI", importance: "required" },
      { name: "Python", importance: "preferred" },
      { name: "Trực quan hoá dữ liệu", importance: "preferred" },
      { name: "Thống kê", importance: "preferred" },
      { name: "Tableau", importance: "additional" },
      { name: "Google Analytics", importance: "additional" },
      { name: "Tiếng Anh", importance: "additional" },
    ],
    content:
      "Công ty Thương mại điện tử B tuyển Thực tập sinh Phân tích dữ liệu cho phòng Business Intelligence.\n\nMô tả công việc:\n- Truy vấn và làm sạch dữ liệu đơn hàng bằng SQL.\n- Xây dựng dashboard báo cáo doanh số trên Power BI.\n- Tổng hợp số liệu bằng Excel phục vụ báo cáo tuần.\n\nYêu cầu bắt buộc: SQL, Excel (Pivot Table, VLOOKUP), Power BI.\n\nƯu tiên: Python (Pandas), trực quan hoá dữ liệu, thống kê cơ bản.\n\nĐiểm cộng: Tableau, Google Analytics, tiếng Anh đọc hiểu tốt.",
    source: "library",
  },
  {
    id: "jd-po-assistant",
    title: "Product Owner Assistant",
    company: "Ngân hàng C",
    industry: "Fintech & ngân hàng",
    level: "fresher",
    skills: [
      { name: "User Story", importance: "required" },
      { name: "Scrum", importance: "required" },
      { name: "Quản lý Backlog", importance: "required" },
      { name: "UX Flow", importance: "preferred" },
      { name: "Phân tích dữ liệu", importance: "preferred" },
      { name: "Jira", importance: "preferred" },
      { name: "Kiến thức ngân hàng số", importance: "additional" },
      { name: "Tiếng Anh", importance: "additional" },
    ],
    content:
      "Ngân hàng C tuyển Trợ lý Product Owner cho đội sản phẩm thanh toán trên ứng dụng di động.\n\nMô tả công việc:\n- Hỗ trợ viết user story và tiêu chí nghiệm thu.\n- Quản lý và sắp xếp ưu tiên product backlog trên Jira.\n- Tham gia các nghi thức Scrum.\n\nYêu cầu bắt buộc: viết user story, hiểu Scrum, quản lý backlog.\n\nƯu tiên: vẽ user flow (Figma), phân tích dữ liệu bằng Excel/SQL, đã dùng Jira.\n\nĐiểm cộng: hiểu biết ngân hàng số, tiếng Anh giao tiếp tốt.",
    source: "library",
  },
  {
    id: "jd-mkt-analyst",
    title: "Marketing Analyst",
    company: "Công ty Truyền thông D",
    industry: "Truyền thông số",
    level: "fresher",
    skills: [
      { name: "Google Analytics", importance: "required" },
      { name: "Excel", importance: "required" },
      { name: "Báo cáo hiệu quả chiến dịch", importance: "required" },
      { name: "A/B Testing", importance: "preferred" },
      { name: "Trực quan hoá dữ liệu", importance: "preferred" },
      { name: "Quảng cáo trả phí", importance: "preferred" },
      { name: "SQL", importance: "additional" },
      { name: "SEO", importance: "additional" },
      { name: "Canva", importance: "additional" },
    ],
    content:
      "Công ty Truyền thông D tuyển Chuyên viên Phân tích Marketing (Fresher).\n\nMô tả công việc:\n- Phân tích hiệu quả chiến dịch trên Google Analytics (GA4).\n- Lập báo cáo hiệu quả chiến dịch theo KPI hằng tuần.\n- Thiết kế và đánh giá thử nghiệm A/B.\n\nYêu cầu bắt buộc: Google Analytics, Excel, báo cáo hiệu quả chiến dịch.\n\nƯu tiên: A/B testing, trực quan hoá dữ liệu (Looker Studio, Power BI), Facebook Ads/Google Ads.\n\nĐiểm cộng: SQL cơ bản, SEO, Canva.",
    source: "library",
  },
  {
    id: "jd-xnk-fresher",
    title: "Nhân viên Xuất nhập khẩu",
    company: "Công ty Logistics E",
    industry: "Logistics & chuỗi cung ứng",
    level: "fresher",
    skills: [
      { name: "Chứng từ xuất nhập khẩu", importance: "required" },
      { name: "Incoterms", importance: "required" },
      { name: "Tiếng Anh thương mại", importance: "required" },
      { name: "Thủ tục hải quan", importance: "preferred" },
      { name: "Excel", importance: "preferred" },
      { name: "Đàm phán", importance: "preferred" },
      { name: "Thanh toán quốc tế", importance: "additional" },
      { name: "Logistics", importance: "additional" },
    ],
    content: "Công ty Logistics E cung cấp dịch vụ giao nhận và khai báo hải quan cho doanh nghiệp xuất nhập khẩu, tuyển Nhân viên Xuất nhập khẩu (Fresher).\n\nMô tả công việc:\n- Soạn thảo và kiểm tra bộ chứng từ xuất nhập khẩu: hợp đồng, invoice, packing list, bill of lading, C/O.\n- Theo dõi lịch tàu, phối hợp với hãng tàu và forwarder để giao nhận hàng đúng hạn.\n- Hỗ trợ khai báo hải quan trên phần mềm ECUS và làm thủ tục thông quan.\n- Trao đổi email bằng tiếng Anh với khách hàng và đối tác nước ngoài.\n- Cập nhật tình trạng lô hàng trên file Excel theo dõi.\n\nYêu cầu bắt buộc:\n- Tốt nghiệp các ngành Kinh doanh quốc tế, Ngoại thương, Logistics.\n- Nắm vững bộ chứng từ xuất nhập khẩu và điều kiện Incoterms.\n- Tiếng Anh thương mại đọc, viết email tốt (tương đương TOEIC 600 hoặc IELTS 5.5 trở lên).\n\nƯu tiên:\n- Hiểu thủ tục hải quan, đã từng dùng ECUS.\n- Sử dụng Excel thành thạo.\n- Có kỹ năng đàm phán, giao tiếp với đối tác.\n\nĐiểm cộng:\n- Có kiến thức thanh toán quốc tế (L/C, T/T).\n- Từng thực tập tại công ty logistics hoặc forwarder.\n\nQuyền lợi: lương cứng và thưởng theo lô hàng, được đào tạo nghiệp vụ hải quan thực tế.",
    source: "library",
  },
  {
    id: "jd-fa-fresher",
    title: "Financial Analyst",
    company: "Công ty Đầu tư F",
    industry: "Tài chính – đầu tư",
    level: "fresher",
    skills: [
      { name: "Phân tích báo cáo tài chính", importance: "required" },
      { name: "Excel", importance: "required" },
      { name: "Định giá doanh nghiệp", importance: "required" },
      { name: "Mô hình tài chính", importance: "preferred" },
      { name: "PowerPoint", importance: "preferred" },
      { name: "CFA", importance: "preferred" },
      { name: "Power BI", importance: "additional" },
      { name: "Tiếng Anh", importance: "additional" },
    ],
    content: "Công ty Đầu tư F quản lý danh mục đầu tư vào các doanh nghiệp niêm yết, tuyển Chuyên viên Phân tích Tài chính (Fresher) cho phòng Nghiên cứu.\n\nMô tả công việc:\n- Thu thập và phân tích báo cáo tài chính của doanh nghiệp niêm yết.\n- Xây dựng mô hình tài chính trên Excel để dự phóng doanh thu, lợi nhuận.\n- Định giá doanh nghiệp bằng các phương pháp DCF, P/E, P/B.\n- Viết báo cáo phân tích và trình bày kết quả bằng PowerPoint cho hội đồng đầu tư.\n\nYêu cầu bắt buộc:\n- Tốt nghiệp các ngành Tài chính, Ngân hàng, Kế toán, Kinh tế.\n- Đọc hiểu và phân tích báo cáo tài chính (bảng cân đối, kết quả kinh doanh, lưu chuyển tiền tệ).\n- Thành thạo Excel.\n- Nắm được các phương pháp định giá doanh nghiệp cơ bản.\n\nƯu tiên:\n- Đã từng xây dựng mô hình tài chính (financial modeling).\n- Trình bày báo cáo, slide bằng PowerPoint tốt.\n- Đang theo học CFA hoặc ACCA.\n\nĐiểm cộng:\n- Biết Power BI để trực quan hoá số liệu.\n- Tiếng Anh đọc hiểu báo cáo quốc tế.\n\nQuyền lợi: thưởng hiệu quả, hỗ trợ học phí chứng chỉ CFA, lộ trình lên Chuyên viên cao cấp.",
    source: "library",
  },
  {
    id: "jd-be-intern",
    title: "Backend Developer Intern (Python)",
    company: "Công ty Phần mềm G",
    industry: "Công nghệ & phần mềm",
    level: "intern",
    skills: [
      { name: "Python", importance: "required" },
      { name: "REST API", importance: "required" },
      { name: "SQL", importance: "required" },
      { name: "FastAPI", importance: "preferred" },
      { name: "Git", importance: "preferred" },
      { name: "Docker", importance: "preferred" },
      { name: "Redis", importance: "additional" },
      { name: "Unit test", importance: "additional" },
      { name: "Linux", importance: "additional" },
    ],
    content: "Công ty Phần mềm G xây dựng hệ thống quản lý đơn hàng cho chuỗi bán lẻ, tuyển Thực tập sinh Backend (Python).\n\nMô tả công việc:\n- Phát triển REST API bằng Python (FastAPI) cho các dịch vụ đơn hàng, kho.\n- Thiết kế bảng và viết truy vấn SQL trên PostgreSQL.\n- Viết unit test cho các API đã phát triển.\n- Đóng gói dịch vụ bằng Docker và quản lý mã nguồn bằng Git.\n\nYêu cầu bắt buộc:\n- Sinh viên năm 3, năm 4 ngành Công nghệ thông tin, Khoa học máy tính hoặc liên quan.\n- Nắm vững Python và lập trình hướng đối tượng.\n- Hiểu nguyên tắc thiết kế REST API.\n- Biết SQL và cơ sở dữ liệu quan hệ.\n\nƯu tiên:\n- Đã làm dự án với FastAPI.\n- Sử dụng Git trong làm việc nhóm.\n- Biết Docker cơ bản.\n\nĐiểm cộng:\n- Đã dùng Redis.\n- Có thói quen viết unit test (pytest).\n- Quen làm việc trên Linux.\n\nQuyền lợi: phụ cấp thực tập, được review code bởi kỹ sư senior, cơ hội lên nhân viên chính thức.",
    source: "library",
  },
  {
    id: "jd-fe-junior",
    title: "Frontend Developer (React)",
    company: "Công ty Công nghệ H",
    industry: "Công nghệ & phần mềm",
    level: "junior",
    skills: [
      { name: "JavaScript", importance: "required" },
      { name: "React", importance: "required" },
      { name: "HTML/CSS", importance: "required" },
      { name: "TypeScript", importance: "preferred" },
      { name: "Next.js", importance: "preferred" },
      { name: "Tailwind CSS", importance: "preferred" },
      { name: "Git", importance: "additional" },
      { name: "Figma", importance: "additional" },
      { name: "Unit test", importance: "additional" },
    ],
    content: "Công ty Công nghệ H phát triển nền tảng học trực tuyến với hơn 200.000 người dùng, tuyển Lập trình viên Frontend (Junior) chuyên React.\n\nMô tả công việc:\n- Xây dựng giao diện web bằng React và Next.js từ thiết kế Figma.\n- Viết mã TypeScript rõ ràng, tái sử dụng được; tạo component theo design system.\n- Tối ưu hiệu năng tải trang và trải nghiệm trên thiết bị di động.\n- Viết unit test cho component với Jest và Testing Library.\n- Phối hợp với đội backend tích hợp API.\n\nYêu cầu bắt buộc:\n- Có ít nhất 1 năm kinh nghiệm (tính cả dự án cá nhân hoặc thực tập) với JavaScript.\n- Thành thạo React (hooks, state management).\n- Nắm vững HTML/CSS và responsive design.\n\nƯu tiên:\n- Đã dùng TypeScript.\n- Có kinh nghiệm với Next.js.\n- Sử dụng Tailwind CSS.\n\nĐiểm cộng:\n- Sử dụng Git thành thạo.\n- Đọc được thiết kế Figma.\n- Có thói quen viết unit test.\n\nQuyền lợi: lương cạnh tranh, làm việc hybrid, ngân sách học tập hằng năm.",
    source: "library",
  },
]

// Kết quả mẫu cho JD "Business Analyst Intern": (3·(1+1+1) + 2·(0.5+1+1) + 1·(0+0+0.5)) / 18 × 100 = 80.6
export const mockGapAnalysis: GapAnalysis = {
  id: "ga-001",
  response_id: "ga-001",
  status: "completed",
  current_step: null,
  error_message: null,
  cv_version_id: "cv-v2",
  cv_file_name: "CV_NguyenMinhAnh_BA.pdf",
  cv_label: "v2.0",
  jd: {
    id: "jd-ba-intern",
    title: "Business Analyst Intern",
    company: "Công ty Công nghệ A",
    industry: "Công nghệ & phần mềm",
    level: "intern",
    source: "library",
  },
  created_at: daysAgo(0),
  completed_at: daysAgo(0),
  match_score: 80.6,
  match_label: "high",
  counts: { matched: 5, partial: 2, missing: 2 },
  breakdown: [
    { importance: "required", label: "Bắt buộc", weight: 3, total: 3, matched: 3, partial: 0, missing: 0, earned: 9, possible: 9 },
    { importance: "preferred", label: "Ưu tiên", weight: 2, total: 3, matched: 2, partial: 1, missing: 0, earned: 5, possible: 6 },
    { importance: "additional", label: "Bổ trợ", weight: 1, total: 3, matched: 0, partial: 1, missing: 2, earned: 0.5, possible: 3 },
  ],
  requirements: [
    {
      id: "r1",
      skill: "SQL",
      importance: "required",
      weight: 3,
      match: 1,
      status: "matched",
      evidence: {
        line_no: 18,
        text: "Sử dụng PostgreSQL trích xuất dữ liệu bán hàng cho đồ án Thương mại điện tử",
        section: "projects",
        section_label: "Dự án",
      },
      note: "PostgreSQL → tính là SQL (taxonomy)",
    },
    {
      id: "r2",
      skill: "Phân tích yêu cầu",
      importance: "required",
      weight: 3,
      match: 1,
      status: "matched",
      evidence: {
        line_no: 11,
        text: "Tổ chức 6 buổi phỏng vấn người dùng để thu thập yêu cầu cho cổng quản lý thông tin CLB",
        section: "activities",
        section_label: "Hoạt động",
      },
      note: null,
    },
    {
      id: "r3",
      skill: "Viết tài liệu BRD/SRS",
      importance: "required",
      weight: 3,
      match: 1,
      status: "matched",
      evidence: {
        line_no: 14,
        text: "Soạn thảo tài liệu đặc tả yêu cầu người dùng (SRS) cho 12 tính năng chính của ứng dụng di động",
        section: "projects",
        section_label: "Dự án",
      },
      note: null,
    },
    {
      id: "r4",
      skill: "BPMN",
      importance: "preferred",
      weight: 2,
      match: 0.5,
      status: "partial",
      evidence: { line_no: 33, text: "Draw.io, BPMN, Excel, SQL", section: "skills", section_label: "Kỹ năng" },
      note: "Chỉ có trong danh sách kỹ năng, chưa có câu nào trong Kinh nghiệm hoặc Dự án mô tả bạn đã dùng BPMN làm gì",
    },
    {
      id: "r5",
      skill: "Agile/Scrum",
      importance: "preferred",
      weight: 2,
      match: 1,
      status: "matched",
      evidence: {
        line_no: 28,
        text: "Làm việc nhóm theo sprint 2 tuần, hoàn thành dự án đúng hạn",
        section: "projects",
        section_label: "Dự án",
      },
      note: null,
    },
    {
      id: "r6",
      skill: "Excel",
      importance: "preferred",
      weight: 2,
      match: 1,
      status: "matched",
      evidence: {
        line_no: 31,
        text: "Tổng hợp và làm sạch dữ liệu khảo sát 300 sinh viên bằng Excel (PivotTable)",
        section: "activities",
        section_label: "Hoạt động",
      },
      note: null,
    },
    { id: "r7", skill: "Jira", importance: "additional", weight: 1, match: 0, status: "missing", evidence: null, note: null },
    { id: "r8", skill: "Figma", importance: "additional", weight: 1, match: 0, status: "missing", evidence: null, note: null },
    {
      id: "r9",
      skill: "Tiếng Anh",
      importance: "additional",
      weight: 1,
      match: 0.5,
      status: "partial",
      evidence: { line_no: 36, text: "IELTS 7.0", section: "certifications", section_label: "Chứng chỉ & giải thưởng" },
      note: "Chỉ có trong danh sách kỹ năng, chưa có câu nào trong Kinh nghiệm hoặc Dự án mô tả bạn đã dùng Tiếng Anh làm gì",
    },
  ],
  suggestions: [
    {
      id: "sg-ga-001-1",
      skill: "Viết tài liệu BRD/SRS",
      section_label: "Dự án",
      original_text: "Soạn thảo tài liệu đặc tả yêu cầu người dùng (SRS) cho 12 tính năng chính của ứng dụng di động",
      suggested_text: "Viết tài liệu đặc tả yêu cầu phần mềm (SRS) cho 12 tính năng chính của ứng dụng di động",
      reason: "JD dùng thuật ngữ 'tài liệu BRD/SRS'; nêu rõ loại tài liệu giúp nhà tuyển dụng nhận ra kỹ năng ngay.",
    },
    {
      id: "sg-ga-001-2",
      skill: "Agile/Scrum",
      section_label: "Dự án",
      original_text: "Làm việc nhóm theo sprint 2 tuần, hoàn thành dự án đúng hạn",
      suggested_text: "Làm việc theo mô hình Scrum với sprint 2 tuần, hoàn thành dự án đúng hạn",
      reason: "Câu gốc đã có 'sprint' nhưng chưa gọi tên Scrum như JD yêu cầu.",
    },
  ],
  pending_review_count: 1,
  summary:
    "CV có bằng chứng cụ thể cho cả 3 yêu cầu bắt buộc (SQL, phân tích yêu cầu, tài liệu SRS). BPMN và tiếng Anh mới chỉ được liệt kê; Jira và Figma chưa xuất hiện trong CV.",
  llm_used: true,
}

// ---------- Phỏng vấn thử (thang STAR 0–5) ----------

/** Ngân hàng câu hỏi mock, trùng với backend (src/services/interview.py). {role} = tên vị trí. */
/** Hướng dẫn cải thiện theo tiêu chí yếu nhất (khớp GUIDANCE ở src/services/interview.py). */
export const mockStarGuidance: Record<StarCriterion, string> = {
  situation: "Mở đầu bằng bối cảnh: thời điểm, nơi làm việc hoặc dự án, quy mô và vấn đề cần giải quyết.",
  task: "Nói rõ nhiệm vụ của riêng bạn và mục tiêu cần đạt, tách khỏi phần việc của cả nhóm.",
  action: "Kể lần lượt các bước bạn trực tiếp làm, công cụ hoặc kỹ năng đã dùng và lý do chọn cách làm đó.",
  result: "Kết thúc bằng kết quả đo được nếu có (thời gian, tỷ lệ, số lượng) và điều bạn rút ra; chỉ nêu số liệu có thật.",
}

export const mockInterviewQuestionBank: { theme: string; template: string }[] = [
  {
    theme: "Nhiệm vụ tiêu biểu",
    template:
      "Hãy kể về một dự án hoặc nhiệm vụ bạn tự hào nhất có liên quan đến vị trí {role}. Bối cảnh lúc đó thế nào, bạn phụ trách phần việc gì, đã làm những gì và kết quả ra sao?",
  },
  {
    theme: "Xử lý khó khăn",
    template:
      "Hãy kể về một lần công việc hoặc dự án của bạn gặp trục trặc ngoài dự kiến. Bạn đã nhận ra vấn đề như thế nào, xử lý ra sao và kết quả cuối cùng là gì?",
  },
  {
    theme: "Làm việc nhóm",
    template:
      "Hãy chia sẻ một tình huống bạn có ý kiến khác với thành viên trong nhóm hoặc người hướng dẫn. Bạn đã trao đổi và cùng đi đến thống nhất như thế nào?",
  },
  {
    theme: "Học hỏi & ưu tiên",
    template:
      "Hãy kể về một lần bạn phải học nhanh một kỹ năng hoặc công cụ mới, hoặc xử lý nhiều việc cùng lúc với deadline gấp. Bạn đã sắp xếp ưu tiên và học như thế nào để hoàn thành?",
  },
]

const baJd = { id: "jd-ba-intern", title: "Business Analyst Intern", company: "Công ty Công nghệ A", source: "library" as const }
const question = (index: number) => mockInterviewQuestionBank[index - 1].template.replace("{role}", baJd.title)

// Điểm tổng = trung bình điểm 4 câu; điểm mỗi tiêu chí = trung bình 4 câu (PRD mục 5.1).
export const mockInterviewReport: InterviewReport = {
  id: "iv-005",
  response_id: "iv-005",
  jd: baJd,
  cv_file_name: "CV_NguyenMinhAnh_BA.pdf",
  created_at: new Date(now.getTime() - 16 * 60_000).toISOString(),
  completed_at: now.toISOString(),
  duration_seconds: 16 * 60,
  overall_score: 3.6,
  label: "fair",
  star: { situation: 4.19, task: 3.81, action: 3.6, result: 2.8 },
  weakest: "result",
  turns: [
    {
      id: "it-005-1",
      index: 1,
      theme: "Nhiệm vụ tiêu biểu",
      question: question(1),
      answer:
        "Trong đồ án môn Phân tích thiết kế hệ thống, nhóm em xây dựng cổng quản lý thông tin CLB. Em phụ trách thu thập yêu cầu: tổ chức 6 buổi phỏng vấn người dùng, tổng hợp thành tài liệu SRS và vẽ sơ đồ quy trình. Nhờ đó nhóm chốt phạm vi sớm và bàn giao đúng hạn.",
      timed_out: false,
      star: { situation: 4.5, task: 4, action: 4, result: 3.5 },
      score: 4,
      feedback:
        "Bối cảnh và vai trò rõ ràng, các bước làm cụ thể. Phần kết quả nên nêu điều đo được nếu có, ví dụ số yêu cầu đã chốt hoặc thời gian tiết kiệm.",
    },
    {
      id: "it-005-2",
      index: 2,
      theme: "Xử lý khó khăn",
      question: question(2),
      answer:
        "Gần hạn nộp, giảng viên đổi yêu cầu phân quyền người dùng. Em rà lại tài liệu, liệt kê các màn hình bị ảnh hưởng và đề xuất nhóm ưu tiên phần quan trọng trước. Cuối cùng nhóm vẫn nộp kịp, chỉ lùi một tính năng phụ.",
      timed_out: false,
      star: { situation: 4.25, task: 3.75, action: 3.5, result: 2.5 },
      score: 3.5,
      feedback:
        "Tình huống rõ, cách xử lý hợp lý. Hãy nói rõ bạn trực tiếp làm gì (khác phần của nhóm) và kết quả cụ thể hơn là 'nộp kịp'.",
    },
    {
      id: "it-005-3",
      index: 3,
      theme: "Làm việc nhóm",
      question: question(3),
      answer:
        "Bạn trưởng nhóm muốn làm thêm nhiều tính năng, còn em thấy thời gian không đủ. Em lập bảng so sánh công sức và giá trị từng tính năng rồi đề xuất nhóm bỏ phiếu. Nhóm đồng ý tập trung vào 4 tính năng chính.",
      timed_out: false,
      star: { situation: 4, task: 4, action: 3.5, result: 2.75 },
      score: 3.56,
      feedback:
        "Cách thuyết phục bằng dữ liệu rất tốt. Phần kết quả nên nói thêm tác động của quyết định đó tới dự án.",
    },
    {
      id: "it-005-4",
      index: 4,
      theme: "Học hỏi & ưu tiên",
      question: question(4),
      answer:
        "Khi làm dự án em phải tự học BPMN trong một tuần. Em xem tài liệu chính thức, vẽ lại các quy trình mẫu rồi nhờ anh hướng dẫn góp ý. Sau đó em vẽ được sơ đồ quy trình đăng ký thành viên cho nhóm.",
      timed_out: false,
      star: { situation: 4, task: 3.5, action: 3.4, result: 2.45 },
      score: 3.34,
      feedback:
        "Cách học có kế hoạch, có nhờ góp ý. Nên nói rõ mục tiêu học cụ thể và kết quả sơ đồ được dùng thế nào sau đó.",
    },
  ],
  timed_out_count: 0,
  guidance: [
    "Kết thúc bằng kết quả đo được nếu có (thời gian, tỷ lệ, số lượng) và điều bạn rút ra; chỉ nêu số liệu có thật.",
    "Kể lần lượt các bước bạn trực tiếp làm, công cụ hoặc kỹ năng đã dùng và lý do chọn cách làm đó.",
  ],
  comparison: {
    first_session_id: "iv-001",
    first_score: 2.9,
    first_completed_at: daysAgo(14),
    delta: 0.7,
  },
  advisor_review: null,
}

export const mockRecentInterviews: InterviewSummary[] = [
  {
    id: "iv-005",
    jd: baJd,
    completed_at: daysAgo(0),
    overall_score: 3.6,
    star: { situation: 4.19, task: 3.81, action: 3.6, result: 2.8 },
  },
  {
    id: "iv-004",
    jd: baJd,
    completed_at: daysAgo(3),
    overall_score: 3.4,
    star: { situation: 4, task: 3.6, action: 3.4, result: 2.6 },
  },
  {
    id: "iv-003",
    jd: baJd,
    completed_at: daysAgo(7),
    overall_score: 3.1,
    star: { situation: 3.8, task: 3.2, action: 3, result: 2.4 },
  },
]

const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString()

export const mockStudentNotifications: AppNotification[] = [
  {
    id: "n-s1",
    kind: "advisor_comment",
    title: "ThS. Trần Hoàng Nam đã nhận xét buổi phỏng vấn Business Analyst Intern",
    body: "“Thầy đã xem qua phần trả lời STAR câu hỏi xử lý xung đột của em…”",
    created_at: minutesAgo(15),
    read: false,
    action_label: "Xem nhận xét",
    action_href: "/student/interview/iv-001/report",
  },
  {
    id: "n-s2",
    kind: "interview_report",
    title: "Báo cáo phỏng vấn Business Analyst Intern đã sẵn sàng",
    body: "Điểm AI 3,6 / 5. Xem điểm từng tiêu chí STAR và phần nên luyện thêm.",
    created_at: minutesAgo(60),
    read: false,
    action_label: "Xem báo cáo",
    action_href: "/student/interview/iv-001/report",
  },
  {
    id: "n-s3",
    kind: "gap_analysis",
    title: "Phân tích CV với Business Analyst Intern đã xong",
    body: "CV_NguyenMinhAnh_BA_v2.1.docx · Mức phù hợp 76% · Cao",
    created_at: minutesAgo(180),
    read: false,
    action_label: "Xem kết quả",
    action_href: "/student/analysis/ga-001",
  },
]

export const mockAdvisorNotifications: AppNotification[] = [
  {
    id: "n-a1",
    kind: "student_activity",
    title: "Nguyễn Minh Anh vừa chia sẻ buổi phỏng vấn Business Analyst Intern",
    body: "Điểm AI 3,6 / 5. Buổi này đang chờ bạn nhận xét.",
    created_at: minutesAgo(10),
    read: false,
    action_label: "Nhận xét",
    action_href: "/advisor/students/sv-0142?tab=interviews",
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
