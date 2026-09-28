// Dữ liệu minh hoạ cho Trình tối ưu CV và Xuất CV. Nội dung CV là giả định.

import type { CapabilityCheck, CvDocument, OptimizerSession, Suggestion } from "@/lib/types"

export const mockCvDocument: CvDocument = {
  full_name: "Nguyễn Minh Anh",
  headline: "Fresher Business Analyst",
  email: "minhanh.k21@truongx.edu.vn",
  phone: "(+84) 900 000 000",
  location: "Hà Nội, Việt Nam",
  sections: [
    {
      id: "sec-objective",
      title: "Mục tiêu nghề nghiệp",
      entries: [
        {
          id: "e-obj",
          title: null,
          meta: null,
          lines: [
            {
              id: "l-3",
              line_no: 3,
              text: "Sinh viên năm cuối ngành Kinh doanh quốc tế với nền tảng phân tích quy trình doanh nghiệp và tư duy giải quyết vấn đề bằng dữ liệu. Mục tiêu trở thành Business Analyst trong 2 năm tới.",
            },
          ],
        },
      ],
    },
    {
      id: "sec-projects",
      title: "Kinh nghiệm dự án & thực tập",
      entries: [
        {
          id: "e-club",
          title: "Cổng quản lý thông tin CLB sinh viên",
          meta: "Đồ án môn Phân tích thiết kế hệ thống · 09/2023 – 12/2023",
          lines: [
            { id: "l-11", line_no: 11, text: "Đóng vai trò phân tích yêu cầu trong nhóm 5 người, phỏng vấn giảng viên và viết tài liệu chức năng." },
            { id: "l-14", line_no: 14, text: "Soạn thảo tài liệu đặc tả yêu cầu người dùng (SRS) cho 12 tính năng chính của ứng dụng di động." },
            { id: "l-15", line_no: 15, text: "Ghi lại các yêu cầu chức năng của hệ thống dưới dạng danh sách." },
          ],
        },
        {
          id: "e-library",
          title: "Hệ thống quản lý thư viện sinh viên",
          meta: "Bài tập lớn · 03/2023 – 06/2023",
          lines: [
            { id: "l-22", line_no: 22, text: "Thu thập phản hồi của hơn 150 người dùng thử nghiệm beta trước khi bảo vệ trước hội đồng khoa." },
            { id: "l-24", line_no: 24, text: "Vẽ sơ đồ chức năng đồ án hệ thống quản lý thư viện sinh viên." },
            { id: "l-28", line_no: 28, text: "Làm việc nhóm theo sprint 2 tuần, hoàn thành dự án đúng hạn." },
          ],
        },
        {
          id: "e-retail",
          title: "Nghiên cứu tối ưu chuỗi cung ứng bán lẻ",
          meta: "Thực tập sinh nghiên cứu dữ liệu · 07/2024 – 09/2024",
          lines: [
            { id: "l-18", line_no: 18, text: "Sử dụng PostgreSQL trích xuất 50.000 dòng dữ liệu bán hàng cho đồ án Thương mại điện tử." },
            { id: "l-31", line_no: 31, text: "Tổng hợp và làm sạch dữ liệu khảo sát 300 sinh viên bằng Excel (PivotTable)." },
          ],
        },
      ],
    },
    {
      id: "sec-education",
      title: "Học vấn",
      entries: [
        {
          id: "e-edu",
          title: "Trường Đại học X",
          meta: "Cử nhân Kinh doanh quốc tế · 2021 – 2025 (dự kiến)",
          lines: [{ id: "l-40", line_no: 40, text: "GPA 3.4/4.0. Trình bày đồ án tốt nghiệp trước hội đồng khoa và 2 doanh nghiệp đối tác." }],
        },
      ],
    },
  ],
  skills: {
    confirmed: ["Viết BRD & SRS", "SQL (PostgreSQL)", "Phỏng vấn stakeholder", "Excel (PivotTable)", "Phân tích SWOT"],
    developing: [],
  },
}

export const mockSuggestions: Suggestion[] = [
  {
    id: "sg-quantify",
    kind: "star_quantify",
    skill: "Phỏng vấn & khơi gợi yêu cầu",
    line_id: "l-11",
    original_text: "Đóng vai trò phân tích yêu cầu trong nhóm 5 người, phỏng vấn giảng viên và viết tài liệu chức năng.",
    proposed_text: "",
    rationale:
      "Thêm số liệu cụ thể giúp nhà tuyển dụng hình dung quy mô dự án. AI không tự đặt con số, hãy cung cấp số liệu thật của bạn.",
    evidence_span: {
      text: "Đóng vai trò phân tích yêu cầu trong nhóm 5 người, phỏng vấn giảng viên và viết tài liệu chức năng.",
      line_start: 11,
      line_end: 11,
    },
    status: "pending",
    needs_context: true,
    context_question: "Bạn đã phỏng vấn bao nhiêu người và mô hình hoá bao nhiêu quy trình trong dự án này? Hãy nêu con số thật.",
  },
  {
    id: "sg-uat",
    kind: "ats_keyword",
    skill: "Kiểm thử chấp nhận (UAT)",
    line_id: "l-22",
    original_text: "Thu thập phản hồi của hơn 150 người dùng thử nghiệm beta trước khi bảo vệ trước hội đồng khoa.",
    proposed_text:
      "Tổ chức kiểm thử chấp nhận người dùng (UAT – User Acceptance Testing) với hơn 150 người dùng beta, thu thập phản hồi trước khi bảo vệ trước hội đồng khoa.",
    rationale:
      "Bạn đã mô tả việc thử nghiệm với người dùng cuối. Dùng thuật ngữ chuẩn \"User Acceptance Testing (UAT)\" giúp hệ thống ATS nhận diện đúng kinh nghiệm kiểm thử.",
    evidence_span: {
      text: "Thu thập phản hồi của hơn 150 người dùng thử nghiệm beta trước khi bảo vệ trước hội đồng khoa.",
      line_start: 22,
      line_end: 22,
    },
    status: "pending",
    needs_context: false,
    context_question: null,
  },
  {
    id: "sg-bpmn",
    kind: "rephrase",
    skill: "Vẽ sơ đồ quy trình BPMN / UML",
    line_id: "l-24",
    original_text: "Vẽ sơ đồ chức năng đồ án hệ thống quản lý thư viện sinh viên.",
    proposed_text: "Mô hình hoá quy trình mượn – trả sách của hệ thống quản lý thư viện bằng sơ đồ BPMN 2.0 trên Draw.io.",
    rationale:
      "Nêu rõ chuẩn (BPMN 2.0) và công cụ để khớp từ khoá JD. Chỉ chấp nhận nếu bạn thực sự dùng BPMN và Draw.io; nếu không, hãy sửa lại cho đúng.",
    evidence_span: { text: "Vẽ sơ đồ chức năng đồ án hệ thống quản lý thư viện sinh viên.", line_start: 24, line_end: 24 },
    status: "pending",
    needs_context: false,
    context_question: null,
  },
  {
    id: "sg-agile",
    kind: "rephrase",
    skill: "Agile / Scrum",
    line_id: "l-28",
    original_text: "Làm việc nhóm theo sprint 2 tuần, hoàn thành dự án đúng hạn.",
    proposed_text: "Tham gia Sprint Planning và Daily Standup trong nhóm Scrum theo chu kỳ sprint 2 tuần, hoàn thành dự án đúng hạn.",
    rationale: "JD yêu cầu Agile/Scrum. Chỉ chấp nhận nếu bạn thực sự tham gia các buổi Sprint Planning và Daily Standup.",
    evidence_span: { text: "Làm việc nhóm theo sprint 2 tuần, hoàn thành dự án đúng hạn.", line_start: 28, line_end: 28 },
    status: "pending",
    needs_context: false,
    context_question: null,
  },
]

export const mockCapabilityChecks: CapabilityCheck[] = [
  {
    id: "cc-powerbi",
    skill: "Power BI / Tableau",
    jd_requirement: "Ứng viên cần biết sử dụng công cụ Power BI hoặc Tableau để trực quan hoá dữ liệu và báo cáo quy trình kinh doanh.",
    status: "pending",
    context: null,
  },
  {
    id: "cc-jira",
    skill: "JIRA / Confluence",
    jd_requirement: "Ưu tiên ứng viên đã dùng JIRA / Confluence để quản lý backlog và tài liệu dự án.",
    status: "pending",
    context: null,
  },
]

export const mockOptimizerSessionBase: Omit<OptimizerSession, "cv"> = {
  analysis_id: "ga-001",
  jd: { id: "jd-ba-intern", title: "Business Analyst Intern", company: "Công ty Công nghệ A" },
  document: mockCvDocument,
  suggestions: mockSuggestions,
  capability_checks: mockCapabilityChecks,
  ats_score: 84,
  ats_checks: [
    { label: "Bố cục 1 cột, trình đọc ATS phân tích được", passed: true },
    { label: "Phông chữ hệ thống, hiển thị đúng tiếng Việt (UTF-8)", passed: true },
    { label: "Không chứa bảng biểu phức tạp hoặc text-box ẩn", passed: true },
    { label: "Dung lượng file dưới 2 MB", passed: true },
  ],
}
