---
route: /student/analysis
role: student
title: "Hướng dẫn phân tích khoảng cách CV - JD"
tags: [cv, jd, analysis, match-score, skills]
---

# Hướng dẫn phân tích khoảng cách CV - JD

## Tổng quan

Phân tích khoảng cách đối chiếu nội dung CV với yêu cầu trong JD, giúp nhận diện kỹ năng phù hợp, kỹ năng còn thiếu và hướng cải thiện. **Match Score** là mức độ phù hợp do hệ thống đánh giá trên thang **0–100%**; cần đọc cùng chi tiết kỹ năng và minh chứng trong CV.

Route `/student/analysis` trong frontmatter theo hợp đồng Assistant. Giao diện hiện tại tạo phân tích tại `/student/analysis/new` và hiển thị kết quả tại `/student/analysis/{id}`; `{id}` là mã phiên thực tế.

## Các bước thực hiện

1. Tải CV tại `/student/cv` nếu chưa có CV, rồi mở `/student/analysis/new`.
2. Chọn phiên bản CV muốn đối chiếu và tiếp tục đến bước chọn vị trí/JD.
3. Chọn một JD trong thư viện hoặc chuyển sang phần dán JD. Nếu dán JD, nhập tiêu đề và nội dung tối thiểu **50 từ**; tên công ty là thông tin tùy chọn.
4. Kiểm tra lại CV, vị trí ứng tuyển và nguồn JD đang chọn.
5. Bấm nút chạy phân tích. Theo đặc tả, nút có tên **Bắt đầu phân tích**; nhãn trong giao diện hiện tại là **Phân tích CV với JD**, ở thanh hành động cuối trang.
6. Chờ các bước xử lý trên trang kết quả. Đọc Match Score, các kỹ năng phù hợp/còn thiếu và đề xuất cải thiện.
7. Cập nhật CV dựa trên kinh nghiệm thật và phân tích lại với cùng JD để theo dõi thay đổi. Xem lại phiên cũ tại `/student/history`.

## Các nút và thành phần giao diện

Các selector dưới đây được quy định trong SPEC-03, Task 3.2; frontend hiện chưa gắn các thuộc tính này. Selector Match Score thuộc trang kết quả, còn nút chạy và vùng chọn CV thuộc luồng tạo phân tích.

- **Nút "Bắt đầu phân tích" / "Phân tích CV với JD"**: Selector `[data-agent-target="btn-start-analysis"]`. Gửi CV và JD đã chọn để tạo phiên; nút chưa khả dụng khi thiếu JD hợp lệ hoặc đang gửi.
- **Vùng chọn CV**: Selector `[data-agent-target="select-cv"]`. Chọn phiên bản CV làm đầu vào; giao diện hiện tại dùng bước chọn CV thay vì bắt buộc một dropdown.
- **Thẻ Match Score**: Selector `[data-agent-target="match-score-badge"]`. Hiển thị mức độ phù hợp 0–100% sau khi phân tích hoàn tất.

## Câu hỏi thường gặp (FAQ)

**Q: Match Score 70% có nghĩa gì?**

A: Hệ thống đánh giá CV phù hợp khoảng 70% với yêu cầu của JD theo cách chấm của hệ thống. Đây không phải xác suất được tuyển dụng; hãy đọc từng kỹ năng và nhận xét để biết cần cải thiện gì.

**Q: Vì sao tôi chưa bấm được nút phân tích?**

A: Hãy kiểm tra đã có CV, đã chọn JD thư viện hoặc đã nhập tiêu đề và ít nhất 50 từ cho JD tự dán. Nút cũng tạm khóa khi đang gửi yêu cầu.

**Q: Vì sao cùng CV nhưng hai JD có điểm khác nhau?**

A: Mỗi JD có yêu cầu riêng. Để đánh giá tiến bộ, nên so sánh các phiên dùng cùng vị trí/JD.

**Q: Tôi có nên thêm mọi kỹ năng còn thiếu vào CV?**

A: Chỉ thêm kỹ năng và kinh nghiệm bạn thực sự có, kèm minh chứng. Với kỹ năng chưa có, dùng đề xuất để lập kế hoạch học hoặc làm dự án thực hành.
