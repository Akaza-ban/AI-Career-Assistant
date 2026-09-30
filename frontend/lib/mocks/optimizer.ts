// Dữ liệu minh hoạ cho Trình tối ưu CV và Xuất CV. Nội dung CV là giả định.

import type { CvDocLine, CvDocument, Suggestion } from "@/lib/types"

const line = (line_no: number, text: string): CvDocLine => ({ id: `l${line_no}`, line_no, text })

/** Nội dung CV tách theo mục như backend trả về (số dòng đếm cả dòng tiêu đề mục). */
export const mockCvDocument: CvDocument = {
  header: [
    line(1, "Nguyễn Minh Anh"),
    line(2, "Fresher Business Analyst"),
    line(3, "minhanh.k21@truongx.edu.vn | (+84) 900 000 000 | Hà Nội, Việt Nam"),
  ],
  sections: [
    {
      id: "s4",
      title: "MỤC TIÊU NGHỀ NGHIỆP",
      lines: [
        line(
          5,
          "Sinh viên năm cuối ngành Kinh doanh quốc tế với nền tảng phân tích quy trình doanh nghiệp và tư duy giải quyết vấn đề bằng dữ liệu.",
        ),
      ],
    },
    {
      id: "s6",
      title: "KINH NGHIỆM DỰ ÁN & THỰC TẬP",
      lines: [
        line(7, "Cổng quản lý thông tin CLB sinh viên – Đồ án môn Phân tích thiết kế hệ thống (09/2023 – 12/2023)"),
        line(8, "Đóng vai trò phân tích yêu cầu trong nhóm 5 người, phỏng vấn giảng viên và viết tài liệu chức năng."),
        line(9, "Soạn thảo tài liệu đặc tả yêu cầu người dùng (SRS) cho 12 tính năng chính của ứng dụng di động."),
        line(10, "Hệ thống quản lý thư viện sinh viên – Bài tập lớn (03/2023 – 06/2023)"),
        line(11, "Thu thập phản hồi của hơn 150 người dùng thử nghiệm beta trước khi bảo vệ trước hội đồng khoa."),
        line(12, "Vẽ sơ đồ chức năng đồ án hệ thống quản lý thư viện sinh viên."),
        line(13, "Làm việc nhóm theo sprint 2 tuần, hoàn thành dự án đúng hạn."),
        line(14, "Nghiên cứu tối ưu chuỗi cung ứng bán lẻ – Thực tập sinh nghiên cứu dữ liệu (07/2024 – 09/2024)"),
        line(15, "Sử dụng PostgreSQL trích xuất 50.000 dòng dữ liệu bán hàng cho đồ án Thương mại điện tử."),
        line(16, "Tổng hợp và làm sạch dữ liệu khảo sát 300 sinh viên bằng Excel (PivotTable)."),
      ],
    },
    {
      id: "s17",
      title: "HỌC VẤN",
      lines: [
        line(18, "Trường Đại học X – Cử nhân Kinh doanh quốc tế (2021 – 2025, dự kiến)"),
        line(19, "GPA 3.4/4.0. Trình bày đồ án tốt nghiệp trước hội đồng khoa và 2 doanh nghiệp đối tác."),
      ],
    },
    {
      id: "s20",
      title: "KỸ NĂNG",
      lines: [line(21, "Viết BRD & SRS, SQL (PostgreSQL), Phỏng vấn stakeholder, Excel (PivotTable), Phân tích SWOT")],
    },
  ],
  developing_skills: [],
}

type SuggestionSeed = Omit<Suggestion, "status" | "final_text" | "evidence_span" | "line_id"> & { line_no: number }

const seed = (s: SuggestionSeed): Suggestion => {
  const { line_no, ...rest } = s
  return {
    ...rest,
    line_id: `l${line_no}`,
    evidence_span: { text: s.original_text, line_start: line_no, line_end: line_no },
    status: "pending",
    final_text: null,
  }
}

export const mockSuggestions: Suggestion[] = [
  seed({
    id: "sg-quantify",
    kind: "star_quantify",
    skill: "Phỏng vấn & khơi gợi yêu cầu",
    line_no: 8,
    original_text: "Đóng vai trò phân tích yêu cầu trong nhóm 5 người, phỏng vấn giảng viên và viết tài liệu chức năng.",
    proposed_text: "",
    rationale:
      "Thêm số liệu cụ thể giúp nhà tuyển dụng hình dung quy mô dự án. AI không tự đặt con số, hãy cung cấp số liệu thật của bạn.",
    needs_context: true,
    context_question: "Bạn đã phỏng vấn bao nhiêu người và mô hình hoá bao nhiêu quy trình trong dự án này? Hãy nêu con số thật.",
  }),
  seed({
    id: "sg-uat",
    kind: "ats_keyword",
    skill: "Kiểm thử chấp nhận (UAT)",
    line_no: 11,
    original_text: "Thu thập phản hồi của hơn 150 người dùng thử nghiệm beta trước khi bảo vệ trước hội đồng khoa.",
    proposed_text:
      "Tổ chức kiểm thử chấp nhận người dùng (UAT – User Acceptance Testing) với hơn 150 người dùng beta, thu thập phản hồi trước khi bảo vệ trước hội đồng khoa.",
    rationale:
      "Bạn đã mô tả việc thử nghiệm với người dùng cuối. Dùng thuật ngữ chuẩn \"User Acceptance Testing (UAT)\" giúp hệ thống lọc hồ sơ nhận diện đúng kinh nghiệm kiểm thử.",
    needs_context: false,
    context_question: null,
  }),
  seed({
    id: "sg-bpmn",
    kind: "rephrase",
    skill: "Vẽ sơ đồ quy trình BPMN / UML",
    line_no: 12,
    original_text: "Vẽ sơ đồ chức năng đồ án hệ thống quản lý thư viện sinh viên.",
    proposed_text: "Mô hình hoá quy trình mượn – trả sách của hệ thống quản lý thư viện bằng sơ đồ BPMN 2.0 trên Draw.io.",
    rationale:
      "Nêu rõ chuẩn (BPMN 2.0) và công cụ để khớp từ khoá JD. Chỉ chấp nhận nếu bạn thực sự dùng BPMN và Draw.io; nếu không, hãy sửa lại cho đúng.",
    needs_context: false,
    context_question: null,
  }),
  seed({
    id: "sg-agile",
    kind: "rephrase",
    skill: "Agile / Scrum",
    line_no: 13,
    original_text: "Làm việc nhóm theo sprint 2 tuần, hoàn thành dự án đúng hạn.",
    proposed_text: "Tham gia Sprint Planning và Daily Standup trong nhóm Scrum theo chu kỳ sprint 2 tuần, hoàn thành dự án đúng hạn.",
    rationale: "JD yêu cầu Agile/Scrum. Chỉ chấp nhận nếu bạn thực sự tham gia các buổi Sprint Planning và Daily Standup.",
    needs_context: false,
    context_question: null,
  }),
]
