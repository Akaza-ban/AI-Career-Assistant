# Brief — Trợ lý nghề nghiệp X (EDU-17)

**Loại dự án**: Team-of-4 course project, category C — AI Vận hành
**Ngày**: 19/09/2026 (Gate 1 — hạn 23:59 Chủ nhật 20/09)

## a. Vấn đề
Sinh viên năm cuối chuẩn bị ứng tuyển thường có CV không khớp với yêu cầu vị trí (JD), thiếu cơ hội luyện phỏng vấn thực tế, và khó tự đánh giá điểm yếu của bản thân. Cố vấn hướng nghiệp của trường không đủ nguồn lực để hỗ trợ cá nhân hoá ở quy mô lớn.

## b. Giải pháp
AI agent phân tích khoảng cách (gap) giữa CV và JD mục tiêu, đưa ra gợi ý tối ưu CV dựa trên kinh nghiệm thật của sinh viên (không bịa/thổi phồng), tổ chức mock interview nhiều vòng theo rubric STAR, chấm điểm và theo dõi tiến bộ qua thời gian. Giá trị khác biệt so với việc SV tự dùng ChatGPT: theo dõi xuyên phiên (tracking), rubric chấm điểm nhất quán có lịch sử, và dữ liệu JD/ATS được curate riêng (RAG).

## c. Đối tượng dùng
- **Sinh viên** (người dùng chính): tải CV, chọn vị trí ứng tuyển, nhận gợi ý tối ưu, luyện phỏng vấn.
- **Cố vấn hướng nghiệp** (vai trò giám sát): xem báo cáo tiến bộ của SV được phân công, không truy cập toàn bộ SV.

## d. Phạm vi Gate 1 (Basic)
**Trong scope:**
- Gap analysis CV vs JD + gợi ý tối ưu (không bịa kinh nghiệm)
- Mock interview 1 vị trí, chấm điểm theo rubric STAR
- Advisor xem báo cáo (HITL), giới hạn theo SV được assign
- Metric cơ bản: CSAT + điểm phỏng vấn trước/sau

**Ngoài scope (ranh giới đã chốt, không làm ở Gate 1):**
- Đóng khoảng cách năng lực thực (capability gap) — agent chỉ phát hiện và escalate, không "sửa" bằng câu chữ
- Multi-position ATS optimization, multi-round nâng cao (→ Roadmap)
- Pipeline RAG thật với dữ liệu JD lớn (Gate 1 chỉ liệt kê nguồn dự kiến, xem PRD mục 7)

## e. KPI
- Usage rate ≥60% SV trong nhóm thử nghiệm (adoption)
- CSAT ≥4/5 (adoption)
- **Metric chính (value)**: điểm phỏng vấn trung bình cải thiện trước/sau (score delta) — công thức trong PRD mục 6

## f. Ràng buộc quan trọng
- **Không bịa/thổi phồng kinh nghiệm** — agent chỉ đề xuất diễn đạt tốt hơn cho kinh nghiệm thật, phát hiện điểm không nhất quán chứ không xác minh sự thật
- **HITL** — SV chịu trách nhiệm cuối cùng với CV nộp; cố vấn giám sát qua dashboard
- **Bảo mật dữ liệu CV cá nhân** — phân quyền theo vai trò, cố vấn chỉ xem SV được assign
- **Kiểm soát chi phí AI** — giới hạn số vòng mock interview/tuần