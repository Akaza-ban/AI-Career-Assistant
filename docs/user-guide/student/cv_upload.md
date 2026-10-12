---
route: /student/cv
role: student
title: "Hướng dẫn tải lên và quản lý CV"
tags: [cv, upload, pdf, docx, versions]
---

# Hướng dẫn tải lên và quản lý CV

## Tổng quan

Trang **CV của tôi** giúp sinh viên tải CV lên, xem các phiên bản và chọn CV đang dùng để phân tích với mô tả công việc (JD) hoặc luyện phỏng vấn. Hệ thống nhận tệp **PDF hoặc DOCX**, dung lượng tối đa **5 MB**. Nên dùng tệp có văn bản đọc được để hệ thống trích xuất nội dung chính xác.

## Các bước thực hiện

1. Mở trang `/student/cv` bằng tài khoản sinh viên.
2. Kéo thả tệp PDF/DOCX vào vùng tải lên ở đầu trang, hoặc bấm **Chọn file** rồi chọn tệp từ máy.
3. Chờ dòng **Đang tải lên và trích xuất nội dung CV…** chạy xong. Nếu báo **Tải lên thất bại**, đọc thông báo, sửa định dạng hoặc dung lượng rồi thử lại.
4. CV mới xuất hiện trong mục **Tất cả CV**. Dùng ô **Tìm CV** để tìm theo tên tệp, hoặc đổi cách sắp xếp: **Cập nhật gần nhất**, **Độ khớp cao nhất**, **Tên file A–Z**.
5. Bấm vào tên CV để mở trang chi tiết: xem nội dung đã trích xuất, **Lịch sử phiên bản** và **Độ khớp qua các phiên bản**. Có thể **Tải file gốc** hoặc **Khôi phục** một phiên bản cũ; khôi phục tạo phiên bản mới là bản sao của bản cũ, không bản nào bị xoá.
6. CV có nhãn **Đang dùng** được chọn sẵn khi phân tích và luyện phỏng vấn. Để đổi, mở menu của thẻ CV và chọn **Đặt làm CV đang dùng**; menu này còn có **Phân tích với vị trí**, **Tối ưu CV** và **Xoá CV**.
7. Để phân tích, bấm **Phân tích với vị trí** ở trang chi tiết CV hoặc mở `/student/analysis/new`. Để luyện phỏng vấn, mở `/student/interview/new`.

## Các nút và thành phần giao diện

Các selector dưới đây đã được gắn vào giao diện để trợ lý chỉ vị trí nút và danh sách CV. Trợ lý có thể mở hộp thoại **Tải CV lên**; sinh viên vẫn tự chọn tệp từ máy.

- **Nút "Chọn file"**: Selector `[data-agent-target="btn-upload-cv"]`. Nằm trong vùng kéo thả ở đầu trang; mở bộ chọn tệp để tải CV lên.
- **Ô "Tìm CV"**: Selector `[data-agent-target="cv-search-input"]`. Lọc danh sách theo tên tệp.
- **Danh sách CV**: Selector `[data-agent-target="cv-list"]`. Các thẻ CV trong mục **Tất cả CV**, có nhãn Đang dùng hoặc Bản nháp, số phiên bản và độ khớp của lần phân tích gần nhất.

## Câu hỏi thường gặp (FAQ)

**Q: Tôi có thể tải ảnh hoặc tệp DOC không?**

A: Không. Hãy xuất CV thành PDF hoặc DOCX. Đổi đuôi tệp đơn thuần không chuyển đổi định dạng.

**Q: Vì sao tệp bị từ chối?**

A: Kiểm tra tệp có đuôi `.pdf` hoặc `.docx` và không vượt quá 5 MB. Nếu vẫn lỗi, đọc thông báo trên trang và thử lại sau khi kiểm tra kết nối.

**Q: CV tải lên thành công nhưng nội dung trích xuất thiếu thì làm gì?**

A: Mở chi tiết CV để kiểm tra. Nếu PDF chỉ chứa ảnh quét, hãy xuất lại bản có văn bản từ tài liệu gốc và tải phiên bản mới.

**Q: Vì sao tôi không xoá được CV đang dùng?**

A: Khi còn CV khác, cần đặt CV khác làm CV đang dùng trước khi xoá. Các báo cáo phân tích đã tạo từ CV vẫn được giữ trong lịch sử.

**Q: Tải CV lên có tự chia sẻ nội dung cho cố vấn không?**

A: Không. Mặc định không chia sẻ gì; quyền xem được quản lý tại `/student/share`. Cố vấn vẫn thấy số liệu tổng hợp về tiến bộ; xem [hướng dẫn chia sẻ](sharing.md) để biết phạm vi quyền xem.
