---
route: /student/analysis
role: student
title: "Hướng dẫn phân tích khoảng cách CV - JD"
tags: [cv, jd, analysis, match-score, skills, compare]
---

# Hướng dẫn phân tích khoảng cách CV - JD

## Tổng quan

Trang **Phân tích CV & JD** đối chiếu CV với yêu cầu của một vị trí, giúp nhận diện kỹ năng đã đáp ứng, kỹ năng còn thiếu và hướng cải thiện. **Match Score** (mục **Mức phù hợp**) là mức độ phù hợp do hệ thống đánh giá trên thang **0–100%**; cần đọc cùng chi tiết kỹ năng và bằng chứng trong CV.

Route `/student/analysis` trong frontmatter theo hợp đồng Assistant. Giao diện tạo phân tích tại `/student/analysis/new` và hiển thị kết quả tại `/student/analysis/{id}`; `{id}` là mã phiên thực tế.

## Các bước thực hiện

1. Tải CV tại `/student/cv` nếu chưa có CV, rồi mở `/student/analysis/new`.
2. Chọn chế độ ở đầu trang: **So với 1 vị trí** hoặc **So với nhiều vị trí** (so sánh 2–3 vị trí cùng lúc).
3. Ở mục **CV**, kiểm tra tên tệp và phiên bản. CV đang dùng được chọn sẵn; bấm **Đổi CV** để chọn CV khác.
4. Ở mục **Chọn vị trí**, giữ tab **Gợi ý & đã lưu** để chọn một vị trí trong danh sách (vị trí gợi ý theo CV có nhãn Cao, Khá hoặc Trung bình; vị trí bạn lưu có nhãn Đã lưu). Bấm **Tìm thêm trong Thư viện JD** nếu chưa thấy vị trí cần tìm.
5. Hoặc chuyển sang tab **Dán JD**: nhập **Tên vị trí**, dán **Mô tả công việc** và **Yêu cầu ứng viên** (bắt buộc, tổng cộng tối thiểu **50 từ**). Công ty, Cấp bậc, Ngành và **Quyền lợi và thông tin khác** là tùy chọn. Đánh dấu **Lưu JD này vào mục Đã lưu để dùng lại** nếu muốn.
6. Kiểm tra dòng **Đã chọn** ở thanh cuối trang, rồi bấm **Bắt đầu phân tích**.
7. Chờ các bước xử lý trên trang kết quả. Đọc **Mức phù hợp**, **Kỹ năng và bằng chứng**, **Gợi ý cải thiện** và **Nhận xét của AI**. Ở **Kỹ năng và bằng chứng**, kỹ năng CNTT còn thiếu hoặc mới liệt kê có link **Lộ trình học trên roadmap.sh**; kỹ năng ngoài CNTT ghi "roadmap.sh chưa có lộ trình cho kỹ năng này". Mục **Việc nên làm với CV** dẫn sang trình tối ưu CV và luyện phỏng vấn cho vị trí này.
8. Cập nhật CV dựa trên kinh nghiệm thật và phân tích lại với cùng JD để theo dõi thay đổi. Xem lại phiên cũ tại `/student/history`.

## So sánh nhiều vị trí

Chọn **So với nhiều vị trí**, thêm từ 2 đến 3 vị trí vào mục **Vị trí so sánh** bằng nút **Chọn** trên từng dòng, rồi bấm **So sánh 2 vị trí** hoặc **So sánh 3 vị trí**. Trang **So sánh vị trí** cho biết kỹ năng chung, kỹ năng riêng của từng vị trí và vị trí nào gần CV nhất. Trong ô **Thiếu ở cả … vị trí**, bấm vào kỹ năng có mũi tên để mở lộ trình học trên roadmap.sh.

## Các nút và thành phần giao diện

Các selector dưới đây đã được gắn vào giao diện. Vùng chọn CV và nút chạy thuộc trang tạo phân tích; thẻ Match Score thuộc trang kết quả. Phân tích chỉ bắt đầu khi đã có vị trí hợp lệ và người dùng đồng ý thực hiện.

- **Nút "Bắt đầu phân tích"**: Selector `[data-agent-target="btn-start-analysis"]`. Nút bắt đầu phân tích CV với vị trí đã chọn, nằm ở thanh cuối trang Phân tích CV & JD (chế độ So với 1 vị trí). Nút chưa khả dụng khi thiếu vị trí hợp lệ hoặc đang gửi.
- **Vùng CV**: Selector `[data-agent-target="select-cv"]`. Hiển thị CV đang chọn và nút **Đổi CV**.
- **Thẻ Match Score**: Selector `[data-agent-target="match-score-badge"]`. Mục **Mức phù hợp** ở trang kết quả, hiển thị điểm 0–100% sau khi phân tích hoàn tất.

Khi yêu cầu trợ lý bắt đầu phân tích với CV và vị trí đang chọn, hộp thoại **Yêu cầu xác nhận hành động** xuất hiện. Bấm **Đồng ý** để chạy hoặc **Huỷ bỏ** để giữ nguyên; trợ lý không chạy phân tích chỉ vì bạn hỏi vị trí nút.

## Đánh giá kết quả

Cuối trang kết quả có câu hỏi **Bạn thấy lượt phân tích này thế nào?**. Bấm **Đánh giá lượt này** để chọn số sao, lý do (khi chấm 1–3 sao) và viết góp ý nếu muốn; mỗi lượt phân tích đánh giá một lần. Ở từng gợi ý cải thiện có nút thích/không thích; bấm lại nút đã chọn để huỷ nếu bấm nhầm.

## Câu hỏi thường gặp (FAQ)

**Q: Match Score 70% có nghĩa gì?**

A: Hệ thống đánh giá CV phù hợp khoảng 70% với yêu cầu của JD theo cách chấm của hệ thống. Đây không phải xác suất được tuyển dụng; hãy đọc từng kỹ năng và nhận xét để biết cần cải thiện gì.

**Q: Vì sao tôi chưa bấm được nút Bắt đầu phân tích?**

A: Hãy kiểm tra đã có CV và đã chọn một vị trí. Nếu dán JD, cần có tên vị trí, mô tả công việc, yêu cầu ứng viên và tổng cộng ít nhất 50 từ; dòng gợi ý cạnh nút cho biết còn thiếu gì. Nút cũng tạm khóa khi đang gửi yêu cầu.

**Q: Nhãn Cao, Khá, Trung bình trong danh sách vị trí là gì?**

A: Đó là ước tính nhanh theo kỹ năng giữa CV và vị trí, dùng để gợi ý. Điểm chi tiết chỉ có sau khi phân tích.

**Q: Vì sao cùng CV nhưng hai JD có điểm khác nhau?**

A: Mỗi JD có yêu cầu riêng. Để đánh giá tiến bộ, nên so sánh các phiên dùng cùng vị trí/JD.

**Q: Tôi có nên thêm mọi kỹ năng còn thiếu vào CV?**

A: Chỉ thêm kỹ năng và kinh nghiệm bạn thực sự có, kèm minh chứng. Với kỹ năng chưa có, dùng đề xuất để lập kế hoạch học hoặc làm dự án thực hành.
