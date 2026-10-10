---
route: /advisor/dashboard
role: advisor
title: "Hướng dẫn bảng tổng quan cố vấn"
tags: [advisor, dashboard, readiness, at-risk, progress, pending-reviews]
---

# Hướng dẫn bảng tổng quan cố vấn

## Tổng quan

Bảng tổng quan giúp cố vấn theo dõi nhóm sinh viên được phân công, mức sẵn sàng, tiến bộ và các báo cáo chờ nhận xét. Danh sách **at-risk** tương ứng với nhóm sinh viên **cần chú ý** trên giao diện; nên đọc lý do cảnh báo và diễn biến từng hồ sơ trước khi chọn cách hỗ trợ.

Route `/advisor/dashboard` trong frontmatter theo hợp đồng Assistant. Giao diện hiện tại đặt bảng tổng quan tại `/advisor`. Nhóm cần chú ý dùng bộ lọc `status=flagged`, nhóm báo cáo chờ nhận xét dùng `status=pending`.

## Các bước thực hiện

1. Đăng nhập bằng tài khoản cố vấn và mở `/advisor`.
2. Kiểm tra tổng số sinh viên phụ trách và các thẻ thống kê trạng thái. Đọc tỷ lệ sẵn sàng cùng số lượng sinh viên, không suy diễn từ tỷ lệ khi nhóm chưa có dữ liệu.
3. Xem danh sách sinh viên cần chú ý và lý do cảnh báo để ưu tiên hỗ trợ.
4. Mở `/advisor/students?status=flagged` để xem danh sách đã lọc theo nhóm cần chú ý.
5. Bấm **Nhận xét báo cáo** hoặc mở `/advisor/students?status=pending` để tìm sinh viên có báo cáo đang chờ góp ý.
6. Chọn sinh viên và mở hồ sơ `/advisor/students/{id}` để xem tiến bộ, nội dung được chia sẻ và thực hiện nhận xét.

## Các nút và thành phần giao diện

Các selector dưới đây là đề xuất bổ sung cho Task 1.4; SPEC-03 chưa quy định selector trang cố vấn và frontend hiện chưa gắn các thuộc tính này.

- **Thẻ thống kê mức sẵn sàng** (đề xuất): Selector `[data-agent-target="advisor-readiness-summary"]`. Hiển thị thống kê trạng thái của nhóm phụ trách.
- **Danh sách sinh viên cần chú ý** (đề xuất): Selector `[data-agent-target="advisor-at-risk-list"]`. Hiển thị các hồ sơ cần xem và lý do cảnh báo.
- **Liên kết nhóm cần chú ý** (đề xuất): Selector `[data-agent-target="btn-view-at-risk-students"]`. Mở danh sách tại `/advisor/students?status=flagged`.
- **Nút "Nhận xét báo cáo"** (đề xuất): Selector `[data-agent-target="btn-review-pending-reports"]`. Mở nhóm chờ nhận xét tại `/advisor/students?status=pending`; có thể chỉ xuất hiện khi có báo cáo chờ.

## Câu hỏi thường gặp (FAQ)

**Q: Tỷ lệ sẵn sàng được hiểu thế nào?**

A: Đây là tỷ trọng sinh viên thuộc nhóm trạng thái sẵn sàng trong tập sinh viên đang được thống kê. Xem cùng tổng số và tiêu chí trạng thái hiển thị; tỷ lệ không phải cam kết tuyển dụng.

**Q: At-risk có nghĩa sinh viên chắc chắn không đáp ứng công việc không?**

A: Đây là dấu hiệu cần quan tâm để cố vấn xem hồ sơ và hỗ trợ. Không kết luận chỉ từ nhãn; hãy đọc lý do cảnh báo, điểm và lịch sử hoạt động.

**Q: Vì sao tôi thấy điểm nhưng không mở được nội dung CV hoặc báo cáo?**

A: Cố vấn thấy số liệu tổng hợp của nhóm phụ trách. Nội dung chi tiết cần sinh viên bật quyền chia sẻ tại `/student/share`.

**Q: Vì sao bảng tổng quan không có sinh viên?**

A: Tài khoản có thể chưa được phân công sinh viên. Kiểm tra việc phân công với đơn vị quản lý; nếu trang báo lỗi tải dữ liệu, bấm **Thử lại** sau khi kiểm tra kết nối.
