---
route: /advisor/dashboard
role: advisor
title: "Hướng dẫn bảng tổng quan cố vấn"
tags: [advisor, dashboard, at-risk, progress, pending-reviews, activity]
---

# Hướng dẫn bảng tổng quan cố vấn

## Tổng quan

Trang **Tổng quan** giúp cố vấn theo dõi nhóm sinh viên được phân công: việc cần làm, tình hình nhóm, tiến bộ và các nhận xét gần đây. Nhóm **at-risk** tương ứng với nhóm **Cần chú ý** trên giao diện; nên đọc lý do cảnh báo và diễn biến từng hồ sơ trước khi chọn cách hỗ trợ.

Route `/advisor/dashboard` trong frontmatter theo hợp đồng Assistant. Giao diện đặt bảng tổng quan tại `/advisor`. Nhóm cần chú ý dùng bộ lọc `status=flagged`, nhóm có buổi chờ nhận xét dùng `status=pending`, nhóm đang tiến bộ dùng `status=improving`.

## Các bước thực hiện

1. Đăng nhập bằng tài khoản cố vấn và mở `/advisor`. Dòng chào cho biết số sinh viên cần chú ý và số buổi phỏng vấn đang chờ nhận xét.
2. Ở mục **Việc cần làm**, khung **Chờ nhận xét** liệt kê các buổi phỏng vấn sinh viên đã chia sẻ và đang chờ góp ý; bấm **Nhận xét** ở từng dòng, hoặc **Xem tất cả** để mở `/advisor/students?status=pending`.
3. Khung **Cần chú ý** liệt kê sinh viên kèm lý do cảnh báo, ví dụ nhiều buổi liền không tăng điểm. Bấm **Nhắn tin** để liên hệ, hoặc **Xem danh sách** để mở `/advisor/students?status=flagged`.
4. Ở mục **Tình hình nhóm**, xem số sinh viên và tỷ lệ hoạt động 30 ngày qua, **Điểm phỏng vấn TB** so với buổi đầu, số sinh viên **Đang tiến bộ** và **Độ khớp CV TB**.
5. Ở mục **Phân tích nhóm**, xem điểm phỏng vấn trung bình theo tuần, **Tiêu chí STAR cả nhóm** (phần yếu nhất), **Mức tiến bộ** (Tăng, Giữ nguyên, Giảm) và **Tiến bộ nhiều nhất**.
6. Mục **Nhận xét gần đây** cho biết sinh viên đã xem nhận xét của bạn hay chưa.
7. Nút **Sinh viên phụ trách** và **Nhận xét buổi chờ** ở đầu trang mở nhanh danh sách tương ứng; bấm tên sinh viên để mở hồ sơ `/advisor/students/{id}`.

## Câu hỏi thường gặp (FAQ)

**Q: Tỷ lệ hoạt động 30 ngày qua được hiểu thế nào?**

A: Đây là tỷ trọng sinh viên trong nhóm có hoạt động (phân tích CV hoặc phỏng vấn thử) trong 30 ngày qua, so với mục tiêu hiển thị cạnh đó. Xem cùng tổng số sinh viên; tỷ lệ không phải cam kết tuyển dụng.

**Q: At-risk có nghĩa sinh viên chắc chắn không đáp ứng công việc không?**

A: Không. Đây là dấu hiệu cần quan tâm để cố vấn xem hồ sơ và hỗ trợ. Không kết luận chỉ từ nhãn; hãy đọc lý do cảnh báo, điểm và lịch sử hoạt động.

**Q: Vì sao tôi thấy điểm nhưng không mở được nội dung CV hoặc báo cáo?**

A: Cố vấn thấy số liệu tổng hợp của nhóm phụ trách. Nội dung chi tiết cần sinh viên bật quyền chia sẻ tại `/student/share`.

**Q: Vì sao bảng tổng quan không có sinh viên?**

A: Tài khoản có thể chưa được phân công sinh viên. Quản trị viên của trường thực hiện phân công; nếu trang báo lỗi tải dữ liệu, bấm **Thử lại** sau khi kiểm tra kết nối.
