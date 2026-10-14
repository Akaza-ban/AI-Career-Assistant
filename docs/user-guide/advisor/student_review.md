---
route: /advisor/students
role: advisor
title: "Hướng dẫn xem hồ sơ và nhận xét sinh viên"
tags: [advisor, student-review, feedback, notes, cv, interview]
---

# Hướng dẫn xem hồ sơ và nhận xét sinh viên

## Tổng quan

Cố vấn mở danh sách sinh viên tại `/advisor/students`, rồi chọn hồ sơ `/advisor/students/{id}` để xem tiến bộ, CV và báo cáo được chia sẻ. **Nhận xét báo cáo phỏng vấn** được gửi cho sinh viên; **ghi chú riêng** phục vụ việc theo dõi của cố vấn. Nhận xét của cố vấn bổ sung đánh giá chuyên môn và giữ nguyên điểm AI.

## Các bước thực hiện

1. Mở `/advisor/students`, tìm sinh viên cần hỗ trợ bằng các bộ lọc trên danh sách và mở hồ sơ đúng người.
2. Kiểm tra tên sinh viên, vị trí ứng tuyển và tiến bộ. Chọn phần CV hoặc phỏng vấn cần xem.
3. Với nội dung chưa được chia sẻ, đề nghị sinh viên bật quyền cho đúng tài liệu; không suy đoán nội dung từ số liệu tổng hợp.
4. Mở báo cáo phỏng vấn đã được chia sẻ, đọc câu trả lời, điểm STAR và góp ý AI.
5. Mở phần nhận xét, nhập điểm mạnh, điều cần cải thiện và gợi ý cụ thể. Nhận xét phải có **10–2000 ký tự** sau khi bỏ khoảng trắng ở hai đầu.
6. Bấm **Gửi nhận xét**; nếu sửa nhận xét đã có, bấm **Lưu nhận xét**. Chờ thông báo thành công trước khi chuyển sang hồ sơ khác.
7. Nếu cần ghi thông tin theo dõi riêng, mở phần ghi chú, nhập nội dung, chọn thẻ phù hợp và lưu. Kiểm tra ghi chú xuất hiện trong hồ sơ.

## Các nút và thành phần giao diện

Các selector dưới đây là đề xuất bổ sung cho Task 1.4; SPEC-03 chưa quy định selector duyệt sinh viên và frontend hiện chưa gắn các thuộc tính này. Các điều khiển nhận xét và ghi chú nằm trong hồ sơ chi tiết, không nằm trên bảng danh sách.

- **Danh sách sinh viên** (đề xuất): Selector `[data-agent-target="advisor-student-list"]`. Chọn đúng sinh viên để mở hồ sơ.
- **Vùng hồ sơ sinh viên** (đề xuất): Selector `[data-agent-target="advisor-student-profile"]`. Kiểm tra danh tính và nội dung đang xem.
- **Nút mở nhận xét báo cáo** (đề xuất): Selector `[data-agent-target="btn-open-student-review"]`. Mở hộp thoại nhận xét cho báo cáo đã chia sẻ.
- **Ô nhập nhận xét** (đề xuất): Selector `[data-agent-target="student-review-comment"]`. Nhập góp ý gửi cho sinh viên; ô hiện tại có ID `review-comment`.
- **Nút "Gửi nhận xét" / "Lưu nhận xét"** (đề xuất): Selector `[data-agent-target="btn-submit-student-review"]`. Gửi hoặc cập nhật nhận xét sau khi kiểm tra nội dung.
- **Ô ghi chú riêng** (đề xuất): Selector `[data-agent-target="advisor-note-input"]`. Soạn nội dung phục vụ theo dõi riêng.
- **Nút lưu ghi chú** (đề xuất): Selector `[data-agent-target="btn-save-advisor-note"]`. Lưu ghi chú vào hồ sơ của sinh viên đang mở.

## Câu hỏi thường gặp (FAQ)

**Q: Sinh viên xem nhận xét ở đâu?**

A: Nhận xét xuất hiện trong báo cáo phỏng vấn tương ứng và mục phản hồi từ cố vấn tại `/student/share`.

**Q: Tôi có thể sửa nhận xét đã gửi không?**

A: Có. Mở nhận xét của báo cáo, cập nhật nội dung và bấm **Lưu nhận xét**. Sau khi sửa, sinh viên thấy nhận xét như một bản mới chưa đọc.

**Q: Nhận xét có thay đổi điểm STAR do AI chấm không?**

A: Không. Điểm AI được giữ nguyên; nhận xét cung cấp thêm hướng dẫn của cố vấn.

**Q: Ghi chú riêng có giống phản hồi gửi sinh viên không?**

A: Không. Ghi chú riêng dùng để theo dõi hồ sơ của cố vấn. Muốn sinh viên nhận góp ý về buổi phỏng vấn, hãy dùng phần nhận xét báo cáo.

**Q: Vì sao không gửi được nhận xét?**

A: Kiểm tra độ dài 10–2000 ký tự, quyền xem báo cáo và kết nối. Đọc thông báo lỗi trong hộp thoại và thử lại; không coi nhận xét đã lưu khi chưa có thông báo thành công.
