---
route: /student/history
role: student
title: "Hướng dẫn xem lịch sử và tiến bộ"
tags: [history, progress, interview, analysis, timeline]
---

# Hướng dẫn xem lịch sử và tiến bộ

## Tổng quan

Trang **Lịch sử & tiến bộ** tổng hợp các buổi phỏng vấn thử và các lượt phân tích CV–JD. Mục **Tiến bộ** cho thấy điểm phỏng vấn và độ khớp CV thay đổi thế nào theo từng vị trí; mục **Dòng thời gian** liệt kê mọi hoạt động theo tháng để mở lại chi tiết.

## Các bước thực hiện

1. Mở `/student/history` bằng tài khoản sinh viên. Trên thanh bên, mục này tên là **Tiến bộ**.
2. Xem mục **Tiến bộ**: **Điểm phỏng vấn** (thang 0–5) và **Độ khớp CV** (0–100%) của từng vị trí, kèm mức tăng hoặc giảm so với lần đầu. Điểm chỉ so sánh trong cùng một vị trí.
3. Ở đầu trang, chọn bộ lọc **Tất cả**, **Phỏng vấn** hoặc **Phân tích CV** để lọc mục **Dòng thời gian**.
4. Trong **Dòng thời gian**, các hoạt động được nhóm theo tháng. Với buổi phỏng vấn, bấm **Báo cáo** để mở `/student/interview/{id}/report`. Với lượt phân tích, bấm **Xem** để mở kết quả tại `/student/analysis/{id}`.
5. Nhãn **Cố vấn đã nhận xét** cho biết buổi phỏng vấn đó đã có góp ý của cố vấn.
6. Nếu chưa có hoạt động nào, trang gợi ý **Phân tích CV với JD** hoặc **Luyện phỏng vấn** để bắt đầu.

## Các nút và thành phần giao diện

Các selector dưới đây đã được gắn vào giao diện. Trang không có ô tìm kiếm, bộ lọc vị trí hay bộ lọc khoảng thời gian; chỉ lọc theo loại hoạt động.

- **Bộ lọc loại hoạt động**: Selector `[data-agent-target="history-type-filter"]`. Chọn **Tất cả**, **Phỏng vấn** hoặc **Phân tích CV**.
- **Dòng thời gian**: Selector `[data-agent-target="history-session-list"]`. Danh sách buổi phỏng vấn và lượt phân tích theo tháng, có nút **Báo cáo** hoặc **Xem** để mở chi tiết.

## Câu hỏi thường gặp (FAQ)

**Q: Vì sao lịch sử trống?**

A: Có thể bạn chưa có hoạt động nào, hoặc bộ lọc đang chỉ hiện một loại. Chọn **Tất cả**; nếu vẫn trống, hãy hoàn thành một lượt phân tích hoặc một buổi phỏng vấn thử đầu tiên.

**Q: Vì sao tôi chưa thấy mức tăng hoặc giảm?**

A: Khi mới có một lần ở một vị trí, chưa có lần trước để so sánh. Luyện thêm với cùng vị trí để theo dõi thay đổi.

**Q: Tôi có thể so điểm phỏng vấn trực tiếp với độ khớp CV không?**

A: Hai chỉ số đo nội dung khác nhau và dùng thang khác nhau: STAR 0–5, Match Score 0–100%. Hãy xem xu hướng riêng của từng chỉ số.

**Q: Dòng phân tích hiện nhãn Lỗi thì làm gì?**

A: Lượt phân tích đó chưa hoàn tất. Bấm **Xem** để đọc thông báo, rồi chạy lại phân tích với cùng CV và vị trí.

**Q: Trang báo lỗi tải lịch sử thì làm gì?**

A: Kiểm tra kết nối rồi bấm **Thử lại**. Nếu lỗi còn xuất hiện, giữ lại nội dung thông báo để cung cấp khi cần hỗ trợ.
