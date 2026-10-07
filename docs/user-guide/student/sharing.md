---
route: /student/share
role: student
title: "Hướng dẫn chia sẻ kết quả với cố vấn"
tags: [sharing, advisor, privacy, cv, interview-report, feedback]
---

# Hướng dẫn chia sẻ kết quả với cố vấn

## Tổng quan

Trang **Chia sẻ với Cố vấn** cho phép bạn cấp hoặc thu hồi quyền xem nội dung CV và báo cáo phỏng vấn. Cố vấn chỉ xem nội dung chi tiết khi bạn bật chia sẻ. Cố vấn luôn thấy số liệu tổng hợp như điểm STAR, độ khớp CV, mức tiến bộ và ngày hoạt động để theo dõi nhóm sinh viên phụ trách.

## Các bước thực hiện

1. Mở `/student/share` và kiểm tra thông tin cố vấn được phân công.
2. Lọc danh sách theo **Tất cả**, **CV** hoặc **Báo cáo phỏng vấn** để tìm tài liệu cần chia sẻ.
3. Kiểm tra tên, thời điểm và phiên bản/báo cáo trước khi bật công tắc chia sẻ của tài liệu đó.
4. Chờ thông báo cập nhật thành công. Có thể dùng **Chia sẻ tất cả** nếu muốn cấp quyền cho toàn bộ tài liệu trong danh sách.
5. Đọc mục **Phản hồi từ cố vấn** và mở báo cáo tương ứng để xem nhận xét trong bối cảnh phiên luyện tập.
6. Khi muốn thu hồi quyền, tắt công tắc của tài liệu và chờ thông báo chuyển về chế độ riêng tư. Việc tắt chia sẻ không xóa tài liệu của bạn.

## Các nút và thành phần giao diện

Các selector dưới đây là đề xuất bổ sung cho Task 1.4; SPEC-03 chưa quy định selector trang chia sẻ và frontend hiện chưa gắn các thuộc tính này.

- **Thẻ cố vấn** (đề xuất): Selector `[data-agent-target="sharing-advisor-card"]`. Hiển thị cố vấn đang phụ trách để kiểm tra người nhận.
- **Danh sách tài liệu** (đề xuất): Selector `[data-agent-target="sharing-item-list"]`. Hiển thị CV, báo cáo và trạng thái quyền xem.
- **Công tắc chia sẻ tài liệu** (đề xuất): Selector `[data-agent-target="sharing-item-toggle"]`. Bật/tắt quyền xem nội dung. Có nhiều công tắc cùng loại; cần xác định đúng tài liệu trước khi thao tác.
- **Nút "Chia sẻ tất cả"** (đề xuất): Selector `[data-agent-target="btn-share-all"]`. Bật chia sẻ cho toàn bộ tài liệu; kiểm tra phạm vi trước khi bấm.
- **Phản hồi từ cố vấn** (đề xuất): Selector `[data-agent-target="advisor-feedback-list"]`. Hiển thị nhận xét và liên kết đến báo cáo liên quan.

## Câu hỏi thường gặp (FAQ)

**Q: Tắt chia sẻ thì cố vấn có còn thấy điểm không?**

A: Có. Số liệu tổng hợp vẫn hiển thị cho cố vấn; quyền xem nội dung CV, câu trả lời và nhận xét AI trong báo cáo phụ thuộc vào chia sẻ.

**Q: Vì sao công tắc trở lại trạng thái cũ?**

A: Cập nhật có thể thất bại. Đọc thông báo lỗi, kiểm tra kết nối và thử lại; chỉ coi là thành công khi có thông báo xác nhận.

**Q: Tại sao chưa có nhận xét của cố vấn?**

A: Hãy kiểm tra báo cáo phỏng vấn cần góp ý đã được chia sẻ. Cố vấn cần thời gian để xem và gửi nhận xét; bật chia sẻ không tự tạo nhận xét.

**Q: Tôi chưa có cố vấn được phân công thì làm gì?**

A: Kiểm tra thông tin trên thẻ cố vấn và liên hệ đơn vị quản lý của nhà trường để được phân công.
