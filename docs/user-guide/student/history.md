---
route: /student/history
role: student
title: "Hướng dẫn xem lịch sử và tiến bộ"
tags: [history, progress, interview, analysis, date-filter]
---

# Hướng dẫn xem lịch sử và tiến bộ

## Tổng quan

Trang **Lịch sử & Tiến bộ** tổng hợp các phiên phỏng vấn và phân tích CV–JD. Bạn có thể xem điểm STAR, độ khớp CV, thời điểm hoạt động và mở chi tiết từng phiên. Các chỉ số tiến bộ được so sánh theo từng vị trí.

## Các bước thực hiện

1. Mở `/student/history` bằng tài khoản sinh viên.
2. Chọn vị trí cần xem hoặc giữ **Tất cả vị trí**.
3. Chọn bộ lọc thời gian **30 ngày qua**, **90 ngày** hoặc **Toàn bộ quá trình**. Giao diện hiện tại lọc theo khoảng thời gian này, chưa có bộ chọn ngày bắt đầu/kết thúc riêng.
4. Xem biểu đồ tiến bộ phỏng vấn và tiến bộ CV của từng vị trí.
5. Trong bảng phỏng vấn, chọn phiên để mở báo cáo tại `/student/interview/{id}/report`.
6. Trong bảng phân tích, chọn phiên để mở kết quả tại `/student/analysis/{id}`.
7. Nếu không thấy phiên cần tìm, mở rộng khoảng thời gian và chọn lại **Tất cả vị trí**.

## Các nút và thành phần giao diện

Selector tìm kiếm và danh sách phiên được quy định trong SPEC-03, Task 3.2. Frontend hiện chưa gắn các thuộc tính này và chưa có ô tìm kiếm lịch sử; việc tìm phiên hiện dùng bộ lọc vị trí, thời gian và các bảng. Các selector khác dưới đây là đề xuất.

- **Ô tìm kiếm lịch sử** (theo đặc tả, chưa có trên trang hiện tại): Selector `[data-agent-target="history-search-input"]`. Mục tiêu tích hợp tìm phiên bằng từ khóa.
- **Danh sách phiên**: Selector `[data-agent-target="history-session-list"]`. Vùng chứa lịch sử phỏng vấn và phân tích để mở chi tiết.
- **Bộ lọc vị trí** (đề xuất): Selector `[data-agent-target="history-position-filter"]`. Chọn vị trí hoặc tất cả vị trí.
- **Bộ lọc thời gian** (đề xuất): Selector `[data-agent-target="history-date-filter"]`. Chọn khoảng 30 ngày, 90 ngày hoặc toàn bộ quá trình.

## Câu hỏi thường gặp (FAQ)

**Q: Vì sao lịch sử trống?**

A: Có thể chưa có hoạt động hoặc bộ lọc đang quá hẹp. Chọn toàn bộ quá trình và tất cả vị trí; nếu chưa có dữ liệu, hoàn thành một phiên phân tích hoặc phỏng vấn đầu tiên.

**Q: Vì sao tôi chưa thấy mức tăng hoặc giảm?**

A: Khi mới có một phiên ở một vị trí, chưa có phiên trước để so sánh. Luyện thêm với cùng vị trí để theo dõi thay đổi.

**Q: Tôi có thể so điểm phỏng vấn trực tiếp với độ khớp CV không?**

A: Hai chỉ số đo nội dung khác nhau và dùng thang khác nhau: STAR 0–5, Match Score 0–100%. Hãy xem xu hướng riêng của từng chỉ số.

**Q: Trang báo lỗi tải lịch sử thì làm gì?**

A: Kiểm tra kết nối rồi bấm **Thử lại**. Nếu lỗi còn xuất hiện, giữ lại nội dung thông báo để cung cấp khi cần hỗ trợ.
