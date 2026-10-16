# Bộ đo đọc CV (PDF có chữ, PDF scan, ảnh chụp, DOCX)

Đo chất lượng chữ hệ thống đọc ra khi sinh viên tải CV lên, bằng đúng hàm hệ thống dùng
(`src.services.cv_files.extract_cv`). Không gọi AI. Dùng trước và sau mỗi lần sửa phần đọc CV: một thay đổi
chỉ được giữ khi tốt hơn trên **tổng cả bộ** và không làm CV nào tệ đi rõ rệt.

```powershell
python -m eval.ocr.run_ocr_eval                    # bộ mẫu hư cấu trong eval/ocr/samples
python -m eval.ocr.run_ocr_eval --real D:\cv-test  # thêm CV thật, chỉ đo trên máy
python -m eval.ocr.run_ocr_eval --save             # ghi bảng vào eval/ocr/results.md
```

## Bộ mẫu

6 CV hư cấu, mỗi CV có 3 bản: PDF có chữ, bản scan (~150 dpi, thang xám) và bản giả ảnh chụp điện thoại
(nghiêng 1–2°, mờ, nén JPEG, ~110 dpi). Thêm 2 DOCX: một file đoạn văn + tab + bảng, một file để liên hệ và kỹ
năng trong hộp chữ (text box).

| Mẫu | Bố cục |
|---|---|
| en_harvard | một cột, ngày căn phải, câu dài xuống dòng |
| vi_onecol | tiếng Việt một cột |
| en_sidebar | hai cột: cột bên màu (liên hệ, thanh mức kỹ năng), cột chính |
| vi_hybrid | bố cục lai: nửa trên một cột, nửa dưới hai ô (Học vấn \| Kỹ năng) |
| vi_canva | kiểu Canva: dải tiêu đề màu, hai cột, dự án hai ô lồng trong một cột |
| en_dense | chữ nhỏ, dày, nhiều dự án, chứng chỉ có ngày căn phải |

Tạo lại bộ mẫu (cần node và playwright trong `frontend/node_modules`):

```powershell
python -m eval.ocr.make_samples
```

## CV thật (không đưa vào repo)

Đặt `<tên>.pdf` hoặc `<tên>.docx` cùng `<tên>.expect.json` trong một thư mục **ngoài repo**:

```json
{"name": "Họ và tên", "phrases": ["Các cụm chữ quan trọng", "phải đọc ra được", "..."]}
```

## Chỉ số

| Chỉ số | Cách đo |
|---|---|
| Chữ đúng | Tỉ lệ từ của đáp án có trong chữ đọc ra (bỏ dấu, hoa/thường, dấu câu khi so). CV thật: tỉ lệ cụm tìm thấy. |
| Dính | Tỉ lệ "từ" dài bất thường (> 18 ký tự, không phải email/link). Càng thấp càng tốt. |
| Tách sai | Tỉ lệ chỗ một từ của đáp án bị cắt làm hai ("Strea mlit"). Càng thấp càng tốt. |
| Thứ tự | Trong các dòng của đáp án tìm thấy, tỉ lệ cặp dòng liền nhau giữ đúng trước–sau. |
| Tiêu đề | Tỉ lệ tiêu đề mục được nhận là tiêu đề đúng mục. |
| Tên đầu | Họ tên nằm ở dòng đầu (mẫu CV xuất ra lấy dòng đầu làm họ tên). |
| Dấu | Chữ có dấu tiếng Việt đọc ra / chữ có dấu trong đáp án. Mô hình OCR hiện tại không đọc dấu tiếng Việt. |

## Giới hạn đã biết

- Bản scan / ảnh chụp tiếng Việt mất dấu: do mô hình OCR (RapidOCR), quy tắc không khôi phục được.
- Hai ô sát nhau không có khoảng trắng (chữ hai ô gần chạm nhau) vẫn bị đọc ghép theo hàng.
- Số đo trên bộ mẫu nhỏ chỉ để so sánh trước/sau, không phải độ chính xác tuyệt đối với mọi CV.
