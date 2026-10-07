---
route: /student/cv
role: student
title: "Hướng dẫn tải lên và quản lý CV"
tags: [cv, upload, pdf, docx, versions]
---

# Hướng dẫn tải lên và quản lý CV

## Tổng quan

Trang **CV của tôi** giúp sinh viên tải lên, xem lại và chọn phiên bản CV để phân tích với mô tả công việc (JD) hoặc luyện phỏng vấn. Hệ thống nhận tệp **PDF hoặc DOCX**, dung lượng tối đa **5 MB**. Nên dùng tệp có văn bản đọc được để hệ thống trích xuất nội dung chính xác.

## Các bước thực hiện

1. Mở trang `/student/cv` bằng tài khoản sinh viên.
2. Bấm **Tải lên CV** hoặc dùng vùng tải tệp trên trang, rồi chọn tệp PDF/DOCX phù hợp.
3. Chờ thông báo tải lên thành công, có tên tệp và thời điểm tải. Nếu có lỗi, đọc thông báo và sửa định dạng hoặc dung lượng trước khi thử lại.
4. Tìm CV vừa tải trong danh sách. Chờ xử lý nội dung và mở chi tiết để kiểm tra thông tin được trích xuất.
5. Khi có nhiều phiên bản, chọn đúng bản cần dùng. Trước mỗi lần phân tích hoặc phỏng vấn, kiểm tra lại tên tệp và phiên bản đã chọn.
6. Để phân tích, chọn thao tác **Phân tích** trên CV hoặc mở `/student/analysis/new`. Để luyện phỏng vấn, mở `/student/interview/new`.

## Các nút và thành phần giao diện

Các selector dưới đây đã được gắn vào giao diện để trợ lý chỉ vị trí nút và danh sách CV. Trợ lý có thể mở hộp thoại tải CV; sinh viên vẫn tự chọn tệp từ máy.

- **Nút "Tải lên CV"**: Selector `[data-agent-target="btn-upload-cv"]`. Mở bộ chọn tệp để tải CV lên; sinh viên phải tự chọn tệp từ máy.
- **Danh sách CV**: Selector `[data-agent-target="cv-list"]`. Hiển thị các phiên bản đã tải để kiểm tra tên tệp, thời gian và trạng thái xử lý; từ mỗi bản có thể mở chi tiết hoặc bắt đầu phân tích.

## Câu hỏi thường gặp (FAQ)

**Q: Tôi có thể tải ảnh hoặc tệp DOC không?**

A: Không. Hãy xuất CV thành PDF hoặc DOCX. Đổi đuôi tệp đơn thuần không chuyển đổi định dạng.

**Q: Vì sao tệp bị từ chối?**

A: Kiểm tra tệp có đuôi `.pdf` hoặc `.docx` và không vượt quá 5 MB. Nếu vẫn lỗi, đọc thông báo trên trang và thử lại sau khi kiểm tra kết nối.

**Q: CV tải lên thành công nhưng nội dung trích xuất thiếu thì làm gì?**

A: Mở chi tiết CV để kiểm tra. Nếu PDF chỉ chứa ảnh quét, hãy xuất lại bản có văn bản từ tài liệu gốc và tải phiên bản mới.

**Q: Tải CV lên có tự chia sẻ nội dung cho cố vấn không?**

A: Quyền xem nội dung được quản lý tại `/student/share`. Cố vấn vẫn thấy số liệu tổng hợp về tiến bộ; xem [hướng dẫn chia sẻ](sharing.md) để biết phạm vi quyền xem.
