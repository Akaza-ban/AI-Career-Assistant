# K2. STAR Consistency Spot-check

> Mục tiêu: kiểm tra mức độ nhất quán giữa nhiều lần chấm STAR cho **cùng một CV và cùng một bộ câu trả lời phỏng vấn**.
>
> Hạn hoàn thành: Thứ Bảy, 03/10/2026.
>
> Trạng thái: Sẵn sàng thực hiện spot-check; chưa điền kết quả thực nghiệm.

## 1. Phạm vi kiểm tra

Spot-check này chỉ đo **độ ổn định của việc chấm điểm**, không đo CV hay câu trả lời có tốt hay không. Mỗi test case phải được chấm lặp lại trên đầu vào bất biến.

Các thành phần phải giữ nguyên giữa các lần chạy:

- cùng một file CV và cùng phiên bản CV;
- cùng JD/vị trí ứng tuyển;
- cùng câu hỏi phỏng vấn;
- cùng câu trả lời của ứng viên, giữ nguyên từng ký tự;
- cùng system prompt, STAR rubric và định dạng output;
- cùng model, model version và các tham số suy luận;
- cùng code/commit của hệ thống.

Nếu một trong các thành phần trên thay đổi, kết quả không được tính là lần lặp của cùng test case. Đặc biệt, chỉ giữ nguyên CV nhưng thay câu hỏi hoặc câu trả lời sẽ không chứng minh được tính nhất quán của bộ chấm STAR.

## 2. Rubric và công thức chuẩn

Không tạo rubric mới cho spot-check. Sử dụng nguyên rubric tại `docs/PRD.md`, mục 5.1:

| Tiêu chí | Nội dung cần chấm |
|---|---|
| S — Situation | Ứng viên mô tả đủ rõ bối cảnh/vấn đề |
| T — Task | Ứng viên nêu rõ nhiệm vụ hoặc trách nhiệm cá nhân |
| A — Action | Ứng viên giải thích cụ thể hành động, cách xử lý và kỹ năng đã dùng |
| R — Result | Ứng viên trình bày kết quả, tác động hoặc bằng chứng/số liệu |

Mỗi tiêu chí dùng thang điểm nguyên từ 0 đến 5:

| Điểm | Mức đánh giá |
|---:|---|
| 0 | Không đề cập/không có thông tin |
| 1 | Rất yếu, thông tin mơ hồ |
| 2 | Có đề cập nhưng thiếu nhiều |
| 3 | Đạt yêu cầu cơ bản |
| 4 | Tốt, rõ ràng và cụ thể |
| 5 | Rất tốt, đầy đủ và thuyết phục |

Điểm một câu trả lời:

```text
STAR Score = (S + T + A + R) / 4
```

Điểm một buổi phỏng vấn gồm `n` câu:

```text
Interview Score = (STAR₁ + STAR₂ + ... + STARₙ) / n
```

Quy tắc làm tròn: lưu điểm thành phần nguyên như model trả về; tính điểm tổng bằng số chưa làm tròn và chỉ làm tròn đến 2 chữ số thập phân khi hiển thị. Không dùng giá trị đã làm tròn để tính các độ lệch.

## 3. Thiết kế spot-check

### 3.1 Bộ mẫu tối thiểu

Chọn một CV thật đã ẩn dữ liệu cá nhân và tạo tối thiểu 3 test case trên CV đó:

| Case | Chất lượng câu trả lời dự kiến | Mục đích |
|---|---|---|
| SC-01 | Yếu/thiếu nhiều thành phần STAR | Kiểm tra hệ thống có ổn định ở vùng điểm thấp |
| SC-02 | Trung bình/có đủ nhưng chưa cụ thể | Kiểm tra các trường hợp sát ranh giới 2–4 |
| SC-03 | Tốt/cụ thể/có kết quả đo được | Kiểm tra hệ thống có ổn định ở vùng điểm cao |

Mỗi case chạy độc lập **5 lần**. Không đưa kết quả của lần trước vào prompt lần sau. Thứ tự khuyến nghị là xen kẽ `SC-01 → SC-02 → SC-03` rồi lặp lại, thay vì chạy năm lần liên tiếp một case, để giảm ảnh hưởng do thứ tự hoặc cache.

Tổng tối thiểu: `3 case × 5 lần = 15 lượt chấm`.

### 3.2 Thông tin môi trường phải ghi lại

```text
Ngày/giờ chạy:
Người thực hiện:
Git commit:
CV ID + version + SHA-256:
JD ID + version + SHA-256:
Question/answer fixture version + SHA-256:
System prompt/rubric version + SHA-256:
Provider:
Model + model version/snapshot:
Temperature:
Seed (nếu provider hỗ trợ):
Các tham số khác (top_p, max_tokens...):
```

Không ghi nội dung CV chứa dữ liệu cá nhân vào báo cáo. Chỉ dùng ID, phiên bản và hash để chứng minh đầu vào không đổi.

### 3.3 Dữ liệu cần lưu cho từng lượt

Lưu output thô trước khi tổng hợp. Mỗi lượt phải có:

- `case_id`, `run_id`, timestamp và request/trace ID;
- điểm `S`, `T`, `A`, `R`;
- `STAR Score` do hệ thống trả về;
- `STAR Score` được người kiểm tra tính lại từ bốn điểm thành phần;
- lý do/evidence mà bộ chấm dùng cho từng tiêu chí;
- lỗi parse, timeout hoặc retry nếu có.

Nếu retry, ghi thành một lượt riêng; không âm thầm thay thế kết quả lỗi bằng kết quả retry.

## 4. Chỉ số nhất quán

Với mỗi case và mỗi tiêu chí `c ∈ {S, T, A, R}`:

```text
Range(c) = max(c qua 5 lần) − min(c qua 5 lần)
Exact agreement(c) = số lần có điểm bằng mode(c) / 5 × 100%
```

Với điểm STAR tổng:

```text
STAR range = max(STAR Score) − min(STAR Score)
Mean STAR = tổng STAR Score / 5
```

Kiểm tra thêm tính đúng công thức cho mọi lượt:

```text
Formula error = |STAR Score hệ thống − (S + T + A + R) / 4|
```

Nếu có nhiều mode cùng tần suất, chọn mode thấp hơn để tính `Exact agreement` theo hướng thận trọng và ghi chú trường hợp đồng hạng.

## 5. Điều kiện PASS/FAIL của spot-check

Một test case chỉ **PASS** khi đồng thời thỏa tất cả điều kiện:

1. Mỗi tiêu chí S/T/A/R có `Range ≤ 1` điểm.
2. Mỗi tiêu chí S/T/A/R có `Exact agreement ≥ 80%` (ít nhất 4/5 lần cùng điểm mode).
3. `STAR range ≤ 0.50` trên thang 0–5.
4. Mọi lượt có `Formula error ≤ 0.01`.
5. Không có lượt nào thiếu điểm, vượt ngoài `[0, 5]`, sai kiểu dữ liệu hoặc không có lý do/evidence.
6. Lý do chấm không mâu thuẫn trực tiếp giữa các lần, ví dụ cùng một chi tiết bị coi là “có số liệu kết quả” ở lần này nhưng “không có số liệu” ở lần khác.

Spot-check tổng thể chỉ **PASS** khi cả 3 case đều PASS. Nếu chưa có dữ liệu thực nghiệm thì trạng thái là **NOT RUN**, không được ghi PASS.

Các ngưỡng trên là ngưỡng kiểm thử của tài liệu K2, không thay thế hay sửa rubric sản phẩm trong PRD.

## 6. Bảng ghi kết quả

### 6.1 Kết quả từng lượt

| Case | Run | S | T | A | R | STAR hệ thống | STAR tính lại | Formula error | Trace ID | Ghi chú |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| SC-01 | 1 | — | — | — | — | — | — | — | — | Chưa chạy |
| SC-01 | 2 | — | — | — | — | — | — | — | — | Chưa chạy |
| SC-01 | 3 | — | — | — | — | — | — | — | — | Chưa chạy |
| SC-01 | 4 | — | — | — | — | — | — | — | — | Chưa chạy |
| SC-01 | 5 | — | — | — | — | — | — | — | — | Chưa chạy |
| SC-02 | 1–5 | — | — | — | — | — | — | — | — | Tách thành 5 dòng khi chạy |
| SC-03 | 1–5 | — | — | — | — | — | — | — | — | Tách thành 5 dòng khi chạy |

### 6.2 Tổng hợp theo case

| Case | Range S/T/A/R | Agreement S/T/A/R | STAR range | Formula hợp lệ | Lý do nhất quán | Kết luận |
|---|---|---|---:|---|---|---|
| SC-01 | — | — | — | — | — | NOT RUN |
| SC-02 | — | — | — | — | — | NOT RUN |
| SC-03 | — | — | — | — | — | NOT RUN |

### 6.3 Kết luận chung

```text
Trạng thái: NOT RUN
Số case PASS / tổng số case: 0 / 3
Sai lệch đáng chú ý:
Quyết định phát hành:
Người kiểm tra:
Ngày xác nhận:
```

## 7. Quy trình thực hiện

1. Ẩn dữ liệu cá nhân trong CV mẫu; khóa và hash toàn bộ fixture.
2. Ghi metadata môi trường tại mục 3.2 trước lượt chạy đầu tiên.
3. Chạy 15 lượt theo thứ tự xen kẽ và lưu nguyên output/trace.
4. Điền bảng từng lượt; tính lại STAR Score từ S/T/A/R.
5. Tính range, exact agreement và kiểm tra sự nhất quán của phần giải thích.
6. Áp dụng đúng điều kiện tại mục 5 và ghi `PASS`, `FAIL` hoặc `NOT RUN`.
7. Người thứ hai spot-check lại phép tính và đối chiếu ngẫu nhiên ít nhất 3 trace trước khi ký xác nhận.

## 8. Xử lý khi FAIL

Khi một case FAIL, tạo issue kèm `case_id`, các `run_id`, trace đã ẩn dữ liệu nhạy cảm và tiêu chí vi phạm. Điều tra theo thứ tự:

1. Xác nhận fixture, prompt, model và tham số có thật sự giống nhau.
2. Xác nhận parser và công thức tính tổng không làm tròn sớm hoặc ánh xạ sai trường.
3. So sánh evidence/rationale để tìm anchor rubric còn mơ hồ.
4. Nếu nguyên nhân là tính ngẫu nhiên của model, cân nhắc cấu hình suy luận ổn định hơn trong một thay đổi riêng có review; không sửa cấu hình chỉ để làm đẹp kết quả đang đo.
5. Chạy lại toàn bộ 5 lượt của case sau khi fix, ghi thành đợt mới và giữ lại kết quả cũ để audit.

Không được chọn bỏ các lượt điểm khác biệt, chỉ giữ “kết quả đẹp”, hoặc sửa tay điểm đầu ra.

## 9. Checklist nghiệm thu K2

- [ ] Cùng CV/version/hash ở mọi lượt.
- [ ] Cùng JD, câu hỏi và câu trả lời ở mọi lần lặp của một case.
- [ ] Cùng prompt/rubric/model/parameters/code commit.
- [ ] Có ít nhất 3 case và 5 lượt/case.
- [ ] Có output thô hoặc trace ID cho đủ 15 lượt.
- [ ] Có điểm S/T/A/R, điểm tổng, phép tính lại và rationale.
- [ ] Có range, exact agreement và kết luận theo ngưỡng định trước.
- [ ] Không chứa dữ liệu cá nhân hoặc secret trong báo cáo.
- [ ] Có người kiểm tra chéo và ngày xác nhận.

