---
route: /student/interview
role: student
title: "Hướng dẫn phỏng vấn thử theo STAR"
tags: [interview, mock-interview, star, questions, feedback]
---

# Hướng dẫn phỏng vấn thử theo STAR

## Tổng quan

Phỏng vấn thử giúp sinh viên luyện trả lời theo bối cảnh CV và vị trí ứng tuyển. Mỗi câu nên trình bày theo **STAR**: **Situation** (tình huống), **Task** (nhiệm vụ), **Action** (hành động bạn thực hiện), **Result** (kết quả). Báo cáo cho biết điểm và góp ý để luyện tập tiếp.

Route `/student/interview` trong frontmatter theo hợp đồng Assistant. Giao diện hiện tại thiết lập phiên tại `/student/interview/new`, thực hiện tại `/student/interview/{id}` và xem báo cáo tại `/student/interview/{id}/report`.

## Các bước thực hiện

1. Chuẩn bị CV và mở `/student/interview/new`.
2. Chọn vị trí ứng tuyển và CV dùng làm bối cảnh. Đọc phần hướng dẫn và kiểm tra lượt luyện còn lại.
3. Bấm **Bắt đầu phỏng vấn** khi đã chọn đủ thông tin và còn lượt cho vị trí này.
4. Trong vòng đọc câu hỏi, xác định tình huống và nhiệm vụ cần kể. Phiên hiện tại gồm **4 câu hỏi**; theo dõi tiến độ trên giao diện.
5. Trong vòng trả lời, nêu hành động của chính bạn và kết quả cụ thể theo STAR. Gửi câu trả lời bằng điều khiển trong phòng phỏng vấn, rồi tiếp tục câu tiếp theo.
6. Hoàn thành các câu hỏi và mở báo cáo để đọc đánh giá, điểm STAR thang **0–5** cùng gợi ý cải thiện.
7. Xem lại tại `/student/history`; nếu cần cố vấn góp ý, bật chia sẻ báo cáo tại `/student/share`.

## Các nút và thành phần giao diện

Selector nút bắt đầu được quy định trong SPEC-03, Task 3.2. Các selector còn lại là đề xuất cho phòng phỏng vấn và báo cáo. Frontend hiện chưa gắn các thuộc tính này.

- **Nút "Bắt đầu phỏng vấn"**: Selector `[data-agent-target="btn-start-interview"]`. Tạo phiên theo CV và vị trí đã chọn; không khả dụng khi đang tạo phiên, thiếu thông tin hoặc hết lượt.
- **Vùng câu hỏi** (đề xuất): Selector `[data-agent-target="interview-question"]`. Hiển thị câu hiện tại để đọc trước khi trả lời.
- **Ô trả lời** (đề xuất): Selector `[data-agent-target="interview-answer-input"]`. Nhập câu trả lời với đủ bốn phần STAR.
- **Nút gửi câu trả lời** (đề xuất): Selector `[data-agent-target="btn-submit-interview-answer"]`. Gửi nội dung đã kiểm tra để tiếp tục phiên.
- **Báo cáo phỏng vấn** (đề xuất): Selector `[data-agent-target="interview-report"]`. Hiển thị điểm và góp ý sau phiên.

## Câu hỏi thường gặp (FAQ)

**Q: STAR khác kể chuyện thông thường ở đâu?**

A: STAR giúp câu trả lời có bối cảnh, nhiệm vụ, hành động cá nhân và kết quả. Hãy làm rõ bạn đóng góp gì thay vì chỉ kể việc của cả nhóm.

**Q: Vì sao không bắt đầu được phiên?**

A: Kiểm tra CV, vị trí và trạng thái tải dữ liệu. Nếu hết lượt trong tuần cho vị trí này, xem ngày làm mới trên trang hoặc chọn vị trí khác.

**Q: Điểm STAR có cùng thang với Match Score không?**

A: Không. STAR dùng thang 0–5 để đánh giá câu trả lời; Match Score dùng 0–100% để đánh giá mức phù hợp CV với JD.

**Q: Tôi tìm báo cáo cũ ở đâu?**

A: Vào `/student/history`, tìm phiên phỏng vấn và mở báo cáo. So sánh các phiên cùng vị trí để thấy tiến bộ rõ hơn.
