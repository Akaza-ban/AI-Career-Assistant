# RAG Evaluation

- Thời điểm UTC: 2026-10-07T20:38:07.116430+00:00
- Dataset: `D:\DATA\IT\AIA\P-131\eval\rag_golden_dataset.json` (15 mẫu)
- Embedding: `e5:intfloat/multilingual-e5-small:384`; top_k yêu cầu: 5
- Retriever thực tế áp dụng ngưỡng relevance và giới hạn tối đa 3 citation chunks.
- LLM cấu hình: True; generator: `llama-3.3-70b-versatile`; judge: `openai/gpt-oss-120b`
- Faithfulness: số ý được context thực sự gửi vào generator hỗ trợ / tổng ý trong câu trả lời (LLM judge).
- Completeness: số ý chuẩn được câu trả lời bao phủ / tổng ý chuẩn, tách theo dấu `;` (LLM judge).
- Relevance: cosine E5 giữa question và answer; nếu E5 dùng hashing thì dùng đánh giá ngữ nghĩa của LLM judge.
- Context Recall: tỷ lệ từ khóa chuẩn có trong nội dung các chunks được trả về; chuẩn hóa Unicode, hoa/thường và dấu gạch.
- Context Precision: reciprocal rank (MRR từng mẫu) của chunk đúng expected_route có nhiều từ khóa chuẩn nhất;
  đồng hạng chọn chunk sớm hơn, không có bằng chứng đạt 0. Top 1 = 1, top 2 = 0.5, top 3 = 0.333.
  Đây là chỉ số thứ hạng theo yêu cầu, không phải precision@k; cột Coverage cho biết độ đầy đủ của chunk tốt nhất.
- N/A là lỗi hoặc thiếu scorer, không bị thay bằng 0. TB tính trên mẫu có điểm và ghi rõ mẫu số.
- Chế độ fallback được ghi riêng; điểm này đánh giá câu trả lời dự phòng của pipeline.

| # | Role | Route | Faithfulness | Relevance | Completeness | Context Recall | Context Precision | Rank | Coverage | Generation | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | student | /student/cv | 1.000 | 0.907 | 1.000 | 1.000 | 0.500 | 2 | 1.000 | grounded_fallback | OK |
| 2 | student | /student/cv | 1.000 | 0.934 | 0.500 | 1.000 | 1.000 | 1 | 0.667 | grounded_fallback | OK |
| 3 | student | /student/cv | 1.000 | 0.943 | 0.500 | 1.000 | 1.000 | 1 | 1.000 | grounded_fallback | OK |
| 4 | student | /student/analysis | 1.000 | 0.930 | 0.750 | 1.000 | 1.000 | 1 | 1.000 | grounded_fallback | OK |
| 5 | student | /student/analysis | 1.000 | 0.934 | 0.750 | 1.000 | 1.000 | 1 | 1.000 | grounded_fallback | OK |
| 6 | student | /student/analysis | 1.000 | 0.911 | 0.750 | 1.000 | 1.000 | 1 | 0.667 | grounded_fallback | OK |
| 7 | student | /student/interview | 1.000 | 0.912 | 0.600 | 1.000 | 1.000 | 1 | 1.000 | grounded_fallback | OK |
| 8 | student | /student/interview | 1.000 | 0.916 | 0.250 | 1.000 | 0.500 | 2 | 1.000 | grounded_fallback | OK |
| 9 | student | /student/interview | 1.000 | 0.930 | 0.750 | 1.000 | 1.000 | 1 | 1.000 | grounded_fallback | OK |
| 10 | student | /student/history | 0.800 | 0.932 | 0.500 | 1.000 | 1.000 | 1 | 1.000 | grounded_fallback | OK |
| 11 | student | /student/history | 1.000 | 0.925 | 0.750 | 1.000 | 1.000 | 1 | 1.000 | grounded_fallback | OK |
| 12 | student | /student/history | 1.000 | 0.922 | 0.250 | 0.500 | 0.500 | 2 | 0.500 | grounded_fallback | OK |
| 13 | advisor | /advisor/dashboard | 1.000 | 0.946 | 0.750 | 1.000 | 0.500 | 2 | 0.750 | grounded_fallback | OK |
| 14 | advisor | /advisor/dashboard | 1.000 | 0.939 | 0.750 | 1.000 | 1.000 | 1 | 1.000 | grounded_fallback | OK |
| 15 | advisor | /advisor/dashboard | 1.000 | 0.939 | 0.750 | 1.000 | 1.000 | 1 | 0.500 | grounded_fallback | OK |
| **TB** |  |  | 0.987 (15/15) | 0.928 (15/15) | 0.640 (15/15) | 0.967 (15/15) | 0.867 (15/15) |  |  |  |  |

Mẫu có lỗi: 0/15. Fallback: 15/15.

## Chi tiết từng mẫu

### 1. /student/cv

**Câu hỏi:** Ở trang CV, định dạng và dung lượng nào được chấp nhận? A. PDF hoặc DOCX, tối đa 5 MB. B. Chỉ ảnh JPG. C. DOC không giới hạn dung lượng.

**Đáp án chuẩn:** Đáp án A; Hệ thống nhận PDF hoặc DOCX; Dung lượng tối đa 5 MB; Nên dùng tệp có văn bản đọc được.

**Câu trả lời thực tế (grounded_fallback):**

Theo tài liệu hướng dẫn:

**Q: Tôi có thể tải ảnh hoặc tệp DOC không?**

A: Không. Hãy xuất CV thành PDF hoặc DOCX. Đổi đuôi tệp đơn thuần không chuyển đổi định dạng.

Nguồn: [Hướng dẫn tải lên và quản lý CV](/student/cv) — Hướng dẫn tải lên và quản lý CV > Câu hỏi thường gặp (FAQ)

Trang **CV của tôi** giúp sinh viên tải lên, xem lại và chọn phiên bản CV để phân tích với mô tả công việc (JD) hoặc luyện phỏng vấn. Hệ thống nhận tệp **PDF hoặc DOCX**, dung lượng tối đa **5 MB**. Nên dùng tệp có văn bản đọc được để hệ thống trích xuất nội dung chính xác.

Nguồn: [Hướng dẫn tải lên và quản lý CV](/student/cv) — Hướng dẫn tải lên và quản lý CV > Tổng quan

2. Bấm **Tải lên CV** hoặc dùng vùng tải tệp trên trang, rồi chọn tệp PDF/DOCX phù hợp.

Nguồn: [Hướng dẫn tải lên và quản lý CV](/student/cv) — Hướng dẫn tải lên và quản lý CV > Các bước thực hiện

**Relevance scorer:** e5_cosine

**Từ khóa thiếu:** 

| Rank | Chunk ID | Route | Context thực sự retrieve |
|---|---|---|---|
| 1 | daca6b2fee8a23d79226317c81f92d01da641892187bae486a41eaa3a92a3ce5 | /student/cv | **Q: Tôi có thể tải ảnh hoặc tệp DOC không?**  A: Không. Hãy xuất CV thành PDF hoặc DOCX. Đổi đuôi tệp đơn thuần không chuyển đổi định dạng. |
| 2 | 6f51d7953bcf3c753bb987e7b18bd9640bc628350bc0b9db090ce0930d2f26b5 | /student/cv | Trang **CV của tôi** giúp sinh viên tải lên, xem lại và chọn phiên bản CV để phân tích với mô tả công việc (JD) hoặc luyện phỏng vấn. Hệ thống nhận tệp **PDF hoặc DOCX**, dung lượng tối đa **5 MB**. Nên dùng tệp có văn bản đọc được để hệ thống trích xuất nội dung chính xác. |
| 3 | 54d3b04d91c92dc1bfc8469248755be4ab248975a538d062200956ff8308be71 | /student/cv | 2. Bấm **Tải lên CV** hoặc dùng vùng tải tệp trên trang, rồi chọn tệp PDF/DOCX phù hợp. |

**Context gửi vào generator:**

**Q: Tôi có thể tải ảnh hoặc tệp DOC không?**

A: Không. Hãy xuất CV thành PDF hoặc DOCX. Đổi đuôi tệp đơn thuần không chuyển đổi định dạng.

Trang **CV của tôi** giúp sinh viên tải lên, xem lại và chọn phiên bản CV để phân tích với mô tả công việc (JD) hoặc luyện phỏng vấn. Hệ thống nhận tệp **PDF hoặc DOCX**, dung lượng tối đa **5 MB**. Nên dùng tệp có văn bản đọc được để hệ thống trích xuất nội dung chính xác.

2. Bấm **Tải lên CV** hoặc dùng vùng tải tệp trên trang, rồi chọn tệp PDF/DOCX phù hợp.

**Bằng chứng chấm điểm:**

```json
{
  "claims": [
    {
      "statement": "The system does not accept images or DOC files; only PDF or DOCX are accepted.",
      "supported": true,
      "evidence": "A: Không. Hãy xuất CV thành PDF hoặc DOCX."
    },
    {
      "statement": "The system accepts PDF or DOCX files.",
      "supported": true,
      "evidence": "Hệ thống nhận tệp PDF hoặc DOCX, dung lượng tối đa 5 MB."
    },
    {
      "statement": "The maximum file size is 5 MB.",
      "supported": true,
      "evidence": "Hệ thống nhận tệp PDF hoặc DOCX, dung lượng tối đa 5 MB."
    },
    {
      "statement": "Users should use files with readable text for accurate extraction.",
      "supported": true,
      "evidence": "Nên dùng tệp có văn bản đọc được để hệ thống trích xuất nội dung chính xác."
    },
    {
      "statement": "Users can upload CV by clicking \"Tải lên CV\" or using the drag-and-drop area.",
      "supported": true,
      "evidence": "Bấm Tải lên CV hoặc dùng vùng tải tệp trên trang, rồi chọn tệp PDF/DOCX phù hợp."
    },
    {
      "statement": "\"CV của tôi\" page allows students to upload, view, and select CV versions for analysis with a job description or interview practice.",
      "supported": true,
      "evidence": "Trang CV của tôi giúp sinh viên tải lên, xem lại và chọn phiên bản CV để phân tích với mô tả công việc (JD) hoặc luyện phỏng vấn."
    }
  ],
  "expected_points": [
    {
      "statement": "Đáp án A",
      "supported": true,
      "evidence": "Hệ thống nhận tệp PDF hoặc DOCX, dung lượng tối đa 5 MB."
    },
    {
      "statement": "Hệ thống nhận PDF hoặc DOCX",
      "supported": true,
      "evidence": "Hệ thống nhận tệp PDF hoặc DOCX, dung lượng tối đa 5 MB."
    },
    {
      "statement": "Dung lượng tối đa 5 MB",
      "supported": true,
      "evidence": "Hệ thống nhận tệp PDF hoặc DOCX, dung lượng tối đa 5 MB."
    },
    {
      "statement": "Nên dùng tệp có văn bản đọc được",
      "supported": true,
      "evidence": "Nên dùng tệp có văn bản đọc được để hệ thống trích xuất nội dung chính xác."
    }
  ],
  "semantic_relevance": 1.0
}
```

### 2. /student/cv

**Câu hỏi:** Muốn tải CV và chọn đúng phiên bản trước khi phân tích, tôi làm thế nào? A. Chỉ đổi tên tệp. B. Bấm Tải lên CV, chọn tệp rồi kiểm tra phiên bản trong danh sách. C. Tải lên là tự chạy phân tích.

**Đáp án chuẩn:** Đáp án B; Mở /student/cv và bấm Tải lên CV; Sinh viên tự chọn tệp PDF hoặc DOCX từ máy; Kiểm tra tên tệp và phiên bản trong danh sách trước khi phân tích.

**Câu trả lời thực tế (grounded_fallback):**

Theo tài liệu hướng dẫn:

- **Danh sách CV**: Selector . Hiển thị các phiên bản đã tải để kiểm tra tên tệp, thời gian và trạng thái xử lý; từ mỗi bản có thể mở chi tiết hoặc bắt đầu phân tích.

Nguồn: [Hướng dẫn tải lên và quản lý CV](/student/cv) — Hướng dẫn tải lên và quản lý CV > Các nút và thành phần giao diện

5. Khi có nhiều phiên bản, chọn đúng bản cần dùng. Trước mỗi lần phân tích hoặc phỏng vấn, kiểm tra lại tên tệp và phiên bản đã chọn.

Nguồn: [Hướng dẫn tải lên và quản lý CV](/student/cv) — Hướng dẫn tải lên và quản lý CV > Các bước thực hiện

2. Bấm **Tải lên CV** hoặc dùng vùng tải tệp trên trang, rồi chọn tệp PDF/DOCX phù hợp.

Nguồn: [Hướng dẫn tải lên và quản lý CV](/student/cv) — Hướng dẫn tải lên và quản lý CV > Các bước thực hiện

**Relevance scorer:** e5_cosine

**Từ khóa thiếu:** 

| Rank | Chunk ID | Route | Context thực sự retrieve |
|---|---|---|---|
| 1 | 4ab044296e5ffe9d211e660b60a03e8810ac8b6cd147dc052bd98abcd6657e7f | /student/cv | - **Danh sách CV**: Selector `[data-agent-target="cv-list"]`. Hiển thị các phiên bản đã tải để kiểm tra tên tệp, thời gian và trạng thái xử lý; từ mỗi bản có thể mở chi tiết hoặc bắt đầu phân tích. |
| 2 | 663226b887acacea5c0b7b94b5fb6d774bf036db04e7a8023c711700fbf7d21d | /student/cv | 5. Khi có nhiều phiên bản, chọn đúng bản cần dùng. Trước mỗi lần phân tích hoặc phỏng vấn, kiểm tra lại tên tệp và phiên bản đã chọn. |
| 3 | 54d3b04d91c92dc1bfc8469248755be4ab248975a538d062200956ff8308be71 | /student/cv | 2. Bấm **Tải lên CV** hoặc dùng vùng tải tệp trên trang, rồi chọn tệp PDF/DOCX phù hợp. |

**Context gửi vào generator:**

- **Danh sách CV**: Selector . Hiển thị các phiên bản đã tải để kiểm tra tên tệp, thời gian và trạng thái xử lý; từ mỗi bản có thể mở chi tiết hoặc bắt đầu phân tích.

5. Khi có nhiều phiên bản, chọn đúng bản cần dùng. Trước mỗi lần phân tích hoặc phỏng vấn, kiểm tra lại tên tệp và phiên bản đã chọn.

2. Bấm **Tải lên CV** hoặc dùng vùng tải tệp trên trang, rồi chọn tệp PDF/DOCX phù hợp.

**Bằng chứng chấm điểm:**

```json
{
  "claims": [
    {
      "statement": "The CV list selector displays uploaded versions to check file name, time, and processing status; each can open details or start analysis.",
      "supported": true,
      "evidence": "- **Danh sách CV**: Selector . Hiển thị các phiên bản đã tải để kiểm tra tên tệp, thời gian và trạng thái xử lý; từ mỗi bản có thể mở chi tiết hoặc bắt đầu phân tích."
    },
    {
      "statement": "When there are multiple versions, you should select the correct one before each analysis or interview, checking file name and selected version.",
      "supported": true,
      "evidence": "5. Khi có nhiều phiên bản, chọn đúng bản cần dùng. Trước mỗi lần phân tích hoặc phỏng vấn, kiểm tra lại tên tệp và phiên bản đã chọn."
    },
    {
      "statement": "To upload a CV, press \"Tải lên CV\" or use the upload area, then select a suitable PDF/DOCX file.",
      "supported": true,
      "evidence": "2. Bấm **Tải lên CV** hoặc dùng vùng tải tệp trên trang, rồi chọn tệp PDF/DOCX phù hợp."
    }
  ],
  "expected_points": [
    {
      "statement": "Đáp án B",
      "supported": false,
      "evidence": ""
    },
    {
      "statement": "Mở /student/cv và bấm Tải lên CV",
      "supported": false,
      "evidence": ""
    },
    {
      "statement": "Sinh viên tự chọn tệp PDF hoặc DOCX từ máy",
      "supported": true,
      "evidence": "2. Bấm **Tải lên CV** hoặc dùng vùng tải tệp trên trang, rồi chọn tệp PDF/DOCX phù hợp."
    },
    {
      "statement": "Kiểm tra tên tệp và phiên bản trong danh sách trước khi phân tích",
      "supported": true,
      "evidence": "5. Khi có nhiều phiên bản, chọn đúng bản cần dùng. Trước mỗi lần phân tích hoặc phỏng vấn, kiểm tra lại tên tệp và phiên bản đã chọn."
    }
  ],
  "semantic_relevance": 0.95
}
```

### 3. /student/cv

**Câu hỏi:** CV PDF tải lên thành công nhưng thiếu nội dung vì là ảnh quét, tôi nên làm gì? A. Chỉ đổi đuôi sang DOCX. B. Giữ nguyên vì hệ thống luôn đọc được ảnh. C. Kiểm tra chi tiết và xuất lại bản có văn bản từ tài liệu gốc.

**Đáp án chuẩn:** Đáp án C; Mở chi tiết CV để kiểm tra nội dung trích xuất; Nếu PDF chỉ chứa ảnh quét thì xuất lại bản có văn bản từ tài liệu gốc; Tải phiên bản mới.

**Câu trả lời thực tế (grounded_fallback):**

Theo tài liệu hướng dẫn:

**Q: CV tải lên thành công nhưng nội dung trích xuất thiếu thì làm gì?**

A: Mở chi tiết CV để kiểm tra. Nếu PDF chỉ chứa ảnh quét, hãy xuất lại bản có văn bản từ tài liệu gốc và tải phiên bản mới.

Nguồn: [Hướng dẫn tải lên và quản lý CV](/student/cv) — Hướng dẫn tải lên và quản lý CV > Câu hỏi thường gặp (FAQ)

**Q: Tôi có thể tải ảnh hoặc tệp DOC không?**

A: Không. Hãy xuất CV thành PDF hoặc DOCX. Đổi đuôi tệp đơn thuần không chuyển đổi định dạng.

Nguồn: [Hướng dẫn tải lên và quản lý CV](/student/cv) — Hướng dẫn tải lên và quản lý CV > Câu hỏi thường gặp (FAQ)

Trang **CV của tôi** giúp sinh viên tải lên, xem lại và chọn phiên bản CV để phân tích với mô tả công việc (JD) hoặc luyện phỏng vấn. Hệ thống nhận tệp **PDF hoặc DOCX**, dung lượng tối đa **5 MB**. Nên dùng tệp có văn bản đọc được để hệ thống trích xuất nội dung chính xác.

Nguồn: [Hướng dẫn tải lên và quản lý CV](/student/cv) — Hướng dẫn tải lên và quản lý CV > Tổng quan

**Relevance scorer:** e5_cosine

**Từ khóa thiếu:** 

| Rank | Chunk ID | Route | Context thực sự retrieve |
|---|---|---|---|
| 1 | e3f01f2221a1686d2d53826eb89db5a6c4e5573681122d3c1b45e1a2ace6033b | /student/cv | **Q: CV tải lên thành công nhưng nội dung trích xuất thiếu thì làm gì?**  A: Mở chi tiết CV để kiểm tra. Nếu PDF chỉ chứa ảnh quét, hãy xuất lại bản có văn bản từ tài liệu gốc và tải phiên bản mới. |
| 2 | daca6b2fee8a23d79226317c81f92d01da641892187bae486a41eaa3a92a3ce5 | /student/cv | **Q: Tôi có thể tải ảnh hoặc tệp DOC không?**  A: Không. Hãy xuất CV thành PDF hoặc DOCX. Đổi đuôi tệp đơn thuần không chuyển đổi định dạng. |
| 3 | 6f51d7953bcf3c753bb987e7b18bd9640bc628350bc0b9db090ce0930d2f26b5 | /student/cv | Trang **CV của tôi** giúp sinh viên tải lên, xem lại và chọn phiên bản CV để phân tích với mô tả công việc (JD) hoặc luyện phỏng vấn. Hệ thống nhận tệp **PDF hoặc DOCX**, dung lượng tối đa **5 MB**. Nên dùng tệp có văn bản đọc được để hệ thống trích xuất nội dung chính xác. |

**Context gửi vào generator:**

**Q: CV tải lên thành công nhưng nội dung trích xuất thiếu thì làm gì?**

A: Mở chi tiết CV để kiểm tra. Nếu PDF chỉ chứa ảnh quét, hãy xuất lại bản có văn bản từ tài liệu gốc và tải phiên bản mới.

**Q: Tôi có thể tải ảnh hoặc tệp DOC không?**

A: Không. Hãy xuất CV thành PDF hoặc DOCX. Đổi đuôi tệp đơn thuần không chuyển đổi định dạng.

Trang **CV của tôi** giúp sinh viên tải lên, xem lại và chọn phiên bản CV để phân tích với mô tả công việc (JD) hoặc luyện phỏng vấn. Hệ thống nhận tệp **PDF hoặc DOCX**, dung lượng tối đa **5 MB**. Nên dùng tệp có văn bản đọc được để hệ thống trích xuất nội dung chính xác.

**Bằng chứng chấm điểm:**

```json
{
  "claims": [
    {
      "statement": "Mở chi tiết CV để kiểm tra.",
      "supported": true,
      "evidence": "Mở chi tiết CV để kiểm tra."
    },
    {
      "statement": "Nếu PDF chỉ chứa ảnh quét, hãy xuất lại bản có văn bản từ tài liệu gốc.",
      "supported": true,
      "evidence": "Nếu PDF chỉ chứa ảnh quét, hãy xuất lại bản có văn bản từ tài liệu gốc"
    },
    {
      "statement": "Nếu PDF chỉ chứa ảnh quét, hãy xuất lại bản có văn bản từ tài liệu gốc và tải phiên bản mới.",
      "supported": true,
      "evidence": "Nếu PDF chỉ chứa ảnh quét, hãy xuất lại bản có văn bản từ tài liệu gốc và tải phiên bản mới."
    },
    {
      "statement": "Không thể tải ảnh hoặc tệp DOC.",
      "supported": true,
      "evidence": "Không. Hãy xuất CV thành PDF hoặc DOCX. Đổi đuôi tệp đơn thuần không chuyển đổi định dạng."
    },
    {
      "statement": "Bạn nên xuất CV thành PDF hoặc DOCX.",
      "supported": true,
      "evidence": "Hãy xuất CV thành PDF hoặc DOCX."
    },
    {
      "statement": "Đổi đuôi tệp đơn thuần không chuyển đổi định dạng.",
      "supported": true,
      "evidence": "Đổi đuôi tệp đơn thuần không chuyển đổi định dạng."
    },
    {
      "statement": "Trang CV của tôi giúp sinh viên tải lên, xem lại và chọn phiên bản CV để phân tích với mô tả công việc (JD) hoặc luyện phỏng vấn.",
      "supported": true,
      "evidence": "Trang **CV của tôi** giúp sinh viên tải lên, xem lại và chọn phiên bản CV để phân tích với mô tả công việc (JD) hoặc luyện phỏng vấn."
    },
    {
      "statement": "Hệ thống nhận tệp PDF hoặc DOCX, dung lượng tối đa 5 MB.",
      "supported": true,
      "evidence": "Hệ thống nhận tệp **PDF hoặc DOCX**, dung lượng tối đa **5 MB**."
    },
    {
      "statement": "Nên dùng tệp có văn bản đọc được để hệ thống trích xuất nội dung chính xác.",
      "supported": true,
      "evidence": "Nên dùng tệp có văn bản đọc được để hệ thống trích xuất nội dung chính xác."
    }
  ],
  "expected_points": [
    {
      "statement": "Đáp án C",
      "supported": false,
      "evidence": ""
    },
    {
      "statement": "Mở chi tiết CV để kiểm tra nội dung trích xuất",
      "supported": true,
      "evidence": "Mở chi tiết CV để kiểm tra."
    },
    {
      "statement": "Nếu PDF chỉ chứa ảnh quét thì xuất lại bản có văn bản từ tài liệu gốc",
      "supported": true,
      "evidence": "Nếu PDF chỉ chứa ảnh quét, hãy xuất lại bản có văn bản từ tài liệu gốc."
    },
    {
      "statement": "Tải phiên bản mới",
      "supported": true,
      "evidence": "và tải phiên bản mới."
    }
  ],
  "semantic_relevance": 0.98
}
```

### 4. /student/analysis

**Câu hỏi:** Match Score 70% trong Gap Analysis có nghĩa gì? A. CV được đánh giá phù hợp khoảng 70% với yêu cầu JD. B. Chắc chắn có 70% khả năng được tuyển. C. Điểm STAR là 70 trên 100.

**Đáp án chuẩn:** Đáp án A; CV được đánh giá phù hợp khoảng 70% với yêu cầu JD theo cách chấm của hệ thống; Đây không phải xác suất được tuyển dụng; Cần đọc từng kỹ năng và nhận xét để biết cần cải thiện gì.

**Câu trả lời thực tế (grounded_fallback):**

Theo tài liệu hướng dẫn:

**Q: Match Score 70% có nghĩa gì?**

A: Hệ thống đánh giá CV phù hợp khoảng 70% với yêu cầu của JD theo cách chấm của hệ thống. Đây không phải xác suất được tuyển dụng; hãy đọc từng kỹ năng và nhận xét để biết cần cải thiện gì.

Nguồn: [Hướng dẫn phân tích khoảng cách CV - JD](/student/analysis) — Hướng dẫn phân tích khoảng cách CV - JD > Câu hỏi thường gặp (FAQ)

Phân tích khoảng cách đối chiếu nội dung CV với yêu cầu trong JD, giúp nhận diện kỹ năng phù hợp, kỹ năng còn thiếu và hướng cải thiện. **Match Score** là mức độ phù hợp do hệ thống đánh giá trên thang **0–100%**; cần đọc cùng chi tiết kỹ năng và minh chứng trong CV.

Nguồn: [Hướng dẫn phân tích khoảng cách CV - JD](/student/analysis) — Hướng dẫn phân tích khoảng cách CV - JD > Tổng quan

- **Thẻ Match Score**: Selector . Hiển thị mức độ phù hợp 0–100% sau khi phân tích hoàn tất.

Nguồn: [Hướng dẫn phân tích khoảng cách CV - JD](/student/analysis) — Hướng dẫn phân tích khoảng cách CV - JD > Các nút và thành phần giao diện

**Relevance scorer:** e5_cosine

**Từ khóa thiếu:** 

| Rank | Chunk ID | Route | Context thực sự retrieve |
|---|---|---|---|
| 1 | 0c08b2de9b990368629a46d9521449fcebd77a886694c4ffa9a6d75fd0fe738c | /student/analysis | **Q: Match Score 70% có nghĩa gì?**  A: Hệ thống đánh giá CV phù hợp khoảng 70% với yêu cầu của JD theo cách chấm của hệ thống. Đây không phải xác suất được tuyển dụng; hãy đọc từng kỹ năng và nhận xét để biết cần cải thiện gì. |
| 2 | 82e7f057c4a3ef5f0b7d282999cfb9120e595e0258a465ec8e33a094dc08c86d | /student/analysis | Phân tích khoảng cách đối chiếu nội dung CV với yêu cầu trong JD, giúp nhận diện kỹ năng phù hợp, kỹ năng còn thiếu và hướng cải thiện. **Match Score** là mức độ phù hợp do hệ thống đánh giá trên thang **0–100%**; cần đọc cùng chi tiết kỹ năng và minh chứng trong CV. |
| 3 | cb19a2c6eb25485c03dafadea6b69a208b892409c3f5f06b91783c4f08ca0335 | /student/analysis | - **Thẻ Match Score**: Selector `[data-agent-target="match-score-badge"]`. Hiển thị mức độ phù hợp 0–100% sau khi phân tích hoàn tất. |

**Context gửi vào generator:**

**Q: Match Score 70% có nghĩa gì?**

A: Hệ thống đánh giá CV phù hợp khoảng 70% với yêu cầu của JD theo cách chấm của hệ thống. Đây không phải xác suất được tuyển dụng; hãy đọc từng kỹ năng và nhận xét để biết cần cải thiện gì.

Phân tích khoảng cách đối chiếu nội dung CV với yêu cầu trong JD, giúp nhận diện kỹ năng phù hợp, kỹ năng còn thiếu và hướng cải thiện. **Match Score** là mức độ phù hợp do hệ thống đánh giá trên thang **0–100%**; cần đọc cùng chi tiết kỹ năng và minh chứng trong CV.

- **Thẻ Match Score**: Selector . Hiển thị mức độ phù hợp 0–100% sau khi phân tích hoàn tất.

**Bằng chứng chấm điểm:**

```json
{
  "claims": [
    {
      "statement": "The system evaluates CV suitability at about 70% with JD requirements according to its scoring method.",
      "supported": true,
      "evidence": "A: Hệ thống đánh giá CV phù hợp khoảng 70% với yêu cầu của JD theo cách chấm của hệ thống."
    },
    {
      "statement": "This is not a probability of being hired.",
      "supported": true,
      "evidence": "Đây không phải xác suất được tuyển dụng; hãy đọc từng kỹ năng và nhận xét để biết cần cải thiện gì."
    },
    {
      "statement": "One should read each skill and comment to know what to improve.",
      "supported": true,
      "evidence": "Đây không phải xác suất được tuyển dụng; hãy đọc từng kỹ năng và nhận xét để biết cần cải thiện gì."
    },
    {
      "statement": "Match Score is a suitability level evaluated by the system on a 0–100% scale.",
      "supported": true,
      "evidence": "Match Score là mức độ phù hợp do hệ thống đánh giá trên thang 0–100%;"
    },
    {
      "statement": "The Match Score tag (selector) displays the suitability level 0–100% after analysis completes.",
      "supported": true,
      "evidence": "- **Thẻ Match Score**: Selector . Hiển thị mức độ phù hợp 0–100% sau khi phân tích hoàn tất."
    }
  ],
  "expected_points": [
    {
      "statement": "Đáp án A",
      "supported": false,
      "evidence": ""
    },
    {
      "statement": "CV được đánh giá phù hợp khoảng 70% với yêu cầu JD theo cách chấm của hệ thống",
      "supported": true,
      "evidence": "A: Hệ thống đánh giá CV phù hợp khoảng 70% với yêu cầu của JD theo cách chấm của hệ thống."
    },
    {
      "statement": "Đây không phải xác suất được tuyển dụng",
      "supported": true,
      "evidence": "Đây không phải xác suất được tuyển dụng; hãy đọc từng kỹ năng và nhận xét để biết cần cải thiện gì."
    },
    {
      "statement": "Cần đọc từng kỹ năng và nhận xét để biết cần cải thiện gì",
      "supported": true,
      "evidence": "Đây không phải xác suất được tuyển dụng; hãy đọc từng kỹ năng và nhận xét để biết cần cải thiện gì."
    }
  ],
  "semantic_relevance": 0.95
}
```

### 5. /student/analysis

**Câu hỏi:** Tôi dán JD nhưng nút Phân tích CV với JD chưa khả dụng. Điều kiện nào cần kiểm tra? A. Chỉ cần tên công ty. B. Có CV, tiêu đề JD và nội dung ít nhất 50 từ, đồng thời không đang gửi yêu cầu. C. Chỉ cần dán một dòng bất kỳ.

**Đáp án chuẩn:** Đáp án B; Cần có CV được chọn; JD tự dán phải có tiêu đề và nội dung tối thiểu 50 từ; Nút tạm khóa khi đang gửi yêu cầu.

**Câu trả lời thực tế (grounded_fallback):**

Theo tài liệu hướng dẫn:

**Q: Vì sao tôi chưa bấm được nút phân tích?**

A: Hãy kiểm tra đã có CV, đã chọn JD thư viện hoặc đã nhập tiêu đề và ít nhất 50 từ cho JD tự dán. Nút cũng tạm khóa khi đang gửi yêu cầu.

Nguồn: [Hướng dẫn phân tích khoảng cách CV - JD](/student/analysis) — Hướng dẫn phân tích khoảng cách CV - JD > Câu hỏi thường gặp (FAQ)

3. Chọn một JD trong thư viện hoặc chuyển sang phần dán JD. Nếu dán JD, nhập tiêu đề và nội dung tối thiểu **50 từ**; tên công ty là thông tin tùy chọn.

Nguồn: [Hướng dẫn phân tích khoảng cách CV - JD](/student/analysis) — Hướng dẫn phân tích khoảng cách CV - JD > Các bước thực hiện

- **Nút "Bắt đầu phân tích" / "Phân tích CV với JD"**: Selector . Gửi CV và JD đã chọn để tạo phiên; nút chưa khả dụng khi thiếu JD hợp lệ hoặc đang gửi.

Nguồn: [Hướng dẫn phân tích khoảng cách CV - JD](/student/analysis) — Hướng dẫn phân tích khoảng cách CV - JD > Các nút và thành phần giao diện

**Relevance scorer:** e5_cosine

**Từ khóa thiếu:** 

| Rank | Chunk ID | Route | Context thực sự retrieve |
|---|---|---|---|
| 1 | 692385a896a58903cb38c9632cabe8e45e9c7fa217dc867fc04ddbe30faff5ef | /student/analysis | **Q: Vì sao tôi chưa bấm được nút phân tích?**  A: Hãy kiểm tra đã có CV, đã chọn JD thư viện hoặc đã nhập tiêu đề và ít nhất 50 từ cho JD tự dán. Nút cũng tạm khóa khi đang gửi yêu cầu. |
| 2 | 28d1576dd0126ff905738130e5829d76379bdbaacf79ed30617c0461051e36a2 | /student/analysis | 3. Chọn một JD trong thư viện hoặc chuyển sang phần dán JD. Nếu dán JD, nhập tiêu đề và nội dung tối thiểu **50 từ**; tên công ty là thông tin tùy chọn. |
| 3 | 6ddbe68fbbd2881faf0fe4b6bbf062f7dd4b0b531d38c0dd1c3bc269367109e7 | /student/analysis | - **Nút "Bắt đầu phân tích" / "Phân tích CV với JD"**: Selector `[data-agent-target="btn-start-analysis"]`. Gửi CV và JD đã chọn để tạo phiên; nút chưa khả dụng khi thiếu JD hợp lệ hoặc đang gửi. |

**Context gửi vào generator:**

**Q: Vì sao tôi chưa bấm được nút phân tích?**

A: Hãy kiểm tra đã có CV, đã chọn JD thư viện hoặc đã nhập tiêu đề và ít nhất 50 từ cho JD tự dán. Nút cũng tạm khóa khi đang gửi yêu cầu.

3. Chọn một JD trong thư viện hoặc chuyển sang phần dán JD. Nếu dán JD, nhập tiêu đề và nội dung tối thiểu **50 từ**; tên công ty là thông tin tùy chọn.

- **Nút "Bắt đầu phân tích" / "Phân tích CV với JD"**: Selector . Gửi CV và JD đã chọn để tạo phiên; nút chưa khả dụng khi thiếu JD hợp lệ hoặc đang gửi.

**Bằng chứng chấm điểm:**

```json
{
  "claims": [
    {
      "statement": "You must have a CV.",
      "supported": true,
      "evidence": "Hãy kiểm tra đã có CV, đã chọn JD thư viện hoặc đã nhập tiêu đề và ít nhất 50 từ cho JD tự dán. Nút cũng tạm khóa khi đang gửi yêu cầu."
    },
    {
      "statement": "You must have selected a JD from the library or entered a title and at least 50 words for a pasted JD.",
      "supported": true,
      "evidence": "Hãy kiểm tra đã có CV, đã chọn JD thư viện hoặc đã nhập tiêu đề và ít nhất 50 từ cho JD tự dán. Nút cũng tạm khóa khi đang gửi yêu cầu."
    },
    {
      "statement": "The button is temporarily locked when a request is being sent.",
      "supported": true,
      "evidence": "Nút cũng tạm khóa khi đang gửi yêu cầu."
    },
    {
      "statement": "When pasting a JD, you need to input a title and content of at least 50 words; the company name is optional.",
      "supported": true,
      "evidence": "Nếu dán JD, nhập tiêu đề và nội dung tối thiểu 50 từ; tên công ty là thông tin tùy chọn."
    },
    {
      "statement": "The button is unavailable when the JD is invalid or when a request is being sent.",
      "supported": true,
      "evidence": "nút chưa khả dụng khi thiếu JD hợp lệ hoặc đang gửi."
    }
  ],
  "expected_points": [
    {
      "statement": "Đáp án B",
      "supported": false,
      "evidence": ""
    },
    {
      "statement": "Cần có CV được chọn",
      "supported": true,
      "evidence": "Hãy kiểm tra đã có CV, đã chọn JD thư viện hoặc đã nhập tiêu đề và ít nhất 50 từ cho JD tự dán."
    },
    {
      "statement": "JD tự dán phải có tiêu đề và nội dung tối thiểu 50 từ",
      "supported": true,
      "evidence": "đã nhập tiêu đề và ít nhất 50 từ cho JD tự dán."
    },
    {
      "statement": "Nút tạm khóa khi đang gửi yêu cầu",
      "supported": true,
      "evidence": "Nút cũng tạm khóa khi đang gửi yêu cầu."
    }
  ],
  "semantic_relevance": 0.95
}
```

### 6. /student/analysis

**Câu hỏi:** Sau Gap Analysis, cách nào cải thiện CV và theo dõi tiến bộ đúng? A. Thêm mọi kỹ năng còn thiếu dù chưa biết. B. So điểm với hai JD bất kỳ. C. Bổ sung kinh nghiệm thật có minh chứng, học kỹ năng thiếu rồi phân tích lại cùng JD.

**Đáp án chuẩn:** Đáp án C; Chỉ bổ sung kỹ năng và kinh nghiệm thực sự có kèm minh chứng; Với kỹ năng chưa có, lập kế hoạch học hoặc làm dự án thực hành; Phân tích lại với cùng JD để theo dõi thay đổi.

**Câu trả lời thực tế (grounded_fallback):**

Theo tài liệu hướng dẫn:

**Q: Tôi có nên thêm mọi kỹ năng còn thiếu vào CV?**

A: Chỉ thêm kỹ năng và kinh nghiệm bạn thực sự có, kèm minh chứng. Với kỹ năng chưa có, dùng đề xuất để lập kế hoạch học hoặc làm dự án thực hành.

Nguồn: [Hướng dẫn phân tích khoảng cách CV - JD](/student/analysis) — Hướng dẫn phân tích khoảng cách CV - JD > Câu hỏi thường gặp (FAQ)

7. Cập nhật CV dựa trên kinh nghiệm thật và phân tích lại với cùng JD để theo dõi thay đổi. Xem lại phiên cũ tại `/student/history`.

Nguồn: [Hướng dẫn phân tích khoảng cách CV - JD](/student/analysis) — Hướng dẫn phân tích khoảng cách CV - JD > Các bước thực hiện

6. Chờ các bước xử lý trên trang kết quả. Đọc Match Score, các kỹ năng phù hợp/còn thiếu và đề xuất cải thiện.

Nguồn: [Hướng dẫn phân tích khoảng cách CV - JD](/student/analysis) — Hướng dẫn phân tích khoảng cách CV - JD > Các bước thực hiện

**Relevance scorer:** e5_cosine

**Từ khóa thiếu:** 

| Rank | Chunk ID | Route | Context thực sự retrieve |
|---|---|---|---|
| 1 | 38c008bad043ff8eb93930aafbc75dcb9c8c671a436c401e639a3bbc5512da71 | /student/analysis | **Q: Tôi có nên thêm mọi kỹ năng còn thiếu vào CV?**  A: Chỉ thêm kỹ năng và kinh nghiệm bạn thực sự có, kèm minh chứng. Với kỹ năng chưa có, dùng đề xuất để lập kế hoạch học hoặc làm dự án thực hành. |
| 2 | 52f5a4c44d6723bd11a36e490f6fabb365b028f75c4ca6939338ecb9128a4ae1 | /student/analysis | 7. Cập nhật CV dựa trên kinh nghiệm thật và phân tích lại với cùng JD để theo dõi thay đổi. Xem lại phiên cũ tại `/student/history`. |
| 3 | d623961d2c79c258c6bd162d7ba4e274d5ae2b700fa57585040ac5d75c790757 | /student/analysis | 6. Chờ các bước xử lý trên trang kết quả. Đọc Match Score, các kỹ năng phù hợp/còn thiếu và đề xuất cải thiện. |

**Context gửi vào generator:**

**Q: Tôi có nên thêm mọi kỹ năng còn thiếu vào CV?**

A: Chỉ thêm kỹ năng và kinh nghiệm bạn thực sự có, kèm minh chứng. Với kỹ năng chưa có, dùng đề xuất để lập kế hoạch học hoặc làm dự án thực hành.

7. Cập nhật CV dựa trên kinh nghiệm thật và phân tích lại với cùng JD để theo dõi thay đổi. Xem lại phiên cũ tại `/student/history`.

6. Chờ các bước xử lý trên trang kết quả. Đọc Match Score, các kỹ năng phù hợp/còn thiếu và đề xuất cải thiện.

**Bằng chứng chấm điểm:**

```json
{
  "claims": [
    {
      "statement": "Chỉ thêm kỹ năng và kinh nghiệm bạn thực sự có, kèm minh chứng.",
      "supported": true,
      "evidence": "Chỉ thêm kỹ năng và kinh nghiệm bạn thực sự có, kèm minh chứng."
    },
    {
      "statement": "Với kỹ năng chưa có, dùng đề xuất để lập kế hoạch học hoặc làm dự án thực hành.",
      "supported": true,
      "evidence": "Với kỹ năng chưa có, dùng đề xuất để lập kế hoạch học hoặc làm dự án thực hành."
    },
    {
      "statement": "Cập nhật CV dựa trên kinh nghiệm thật và phân tích lại với cùng JD để theo dõi thay đổi.",
      "supported": true,
      "evidence": "Cập nhật CV dựa trên kinh nghiệm thật và phân tích lại với cùng JD để theo dõi thay đổi."
    },
    {
      "statement": "Xem lại phiên cũ tại `/student/history`.",
      "supported": true,
      "evidence": "Xem lại phiên cũ tại `/student/history`."
    },
    {
      "statement": "Chờ các bước xử lý trên trang kết quả.",
      "supported": true,
      "evidence": "Chờ các bước xử lý trên trang kết quả."
    },
    {
      "statement": "Đọc Match Score, các kỹ năng phù hợp/còn thiếu và đề xuất cải thiện.",
      "supported": true,
      "evidence": "Đọc Match Score, các kỹ năng phù hợp/còn thiếu và đề xuất cải thiện."
    }
  ],
  "expected_points": [
    {
      "statement": "Đáp án C",
      "supported": false,
      "evidence": ""
    },
    {
      "statement": "Chỉ bổ sung kỹ năng và kinh nghiệm thực sự có kèm minh chứng",
      "supported": true,
      "evidence": "Chỉ thêm kỹ năng và kinh nghiệm bạn thực sự có, kèm minh chứng."
    },
    {
      "statement": "Với kỹ năng chưa có, lập kế hoạch học hoặc làm dự án thực hành",
      "supported": true,
      "evidence": "Với kỹ năng chưa có, dùng đề xuất để lập kế hoạch học hoặc làm dự án thực hành."
    },
    {
      "statement": "Phân tích lại với cùng JD để theo dõi thay đổi",
      "supported": true,
      "evidence": "Cập nhật CV dựa trên kinh nghiệm thật và phân tích lại với cùng JD để theo dõi thay đổi."
    }
  ],
  "semantic_relevance": 0.95
}
```

### 7. /student/interview

**Câu hỏi:** Trong Mock Interview, STAR gồm những phần nào? A. Situation, Task, Action, Result. B. Skill, Test, Award, Rank. C. Chỉ cần kể thành tích của cả nhóm.

**Đáp án chuẩn:** Đáp án A; Situation là tình huống; Task là nhiệm vụ; Action là hành động cá nhân bạn thực hiện; Result là kết quả cụ thể.

**Câu trả lời thực tế (grounded_fallback):**

Theo tài liệu hướng dẫn:

Phỏng vấn thử giúp sinh viên luyện trả lời theo bối cảnh CV và vị trí ứng tuyển. Mỗi câu nên trình bày theo **STAR**: **Situation** (tình huống), **Task** (nhiệm vụ), **Action** (hành động bạn thực hiện), **Result** (kết quả). Báo cáo cho biết điểm và góp ý để luyện tập tiếp.

Nguồn: [Hướng dẫn phỏng vấn thử theo STAR](/student/interview) — Hướng dẫn phỏng vấn thử theo STAR > Tổng quan

**Q: STAR khác kể chuyện thông thường ở đâu?**

A: STAR giúp câu trả lời có bối cảnh, nhiệm vụ, hành động cá nhân và kết quả. Hãy làm rõ bạn đóng góp gì thay vì chỉ kể việc của cả nhóm.

Nguồn: [Hướng dẫn phỏng vấn thử theo STAR](/student/interview) — Hướng dẫn phỏng vấn thử theo STAR > Câu hỏi thường gặp (FAQ)

- **Ô trả lời** (đề xuất): Selector . Nhập câu trả lời với đủ bốn phần STAR.

Nguồn: [Hướng dẫn phỏng vấn thử theo STAR](/student/interview) — Hướng dẫn phỏng vấn thử theo STAR > Các nút và thành phần giao diện

**Relevance scorer:** e5_cosine

**Từ khóa thiếu:** 

| Rank | Chunk ID | Route | Context thực sự retrieve |
|---|---|---|---|
| 1 | 7128db2c064b131de7eb26743b66f7cdd36601664340be214703fb3887964b34 | /student/interview | Phỏng vấn thử giúp sinh viên luyện trả lời theo bối cảnh CV và vị trí ứng tuyển. Mỗi câu nên trình bày theo **STAR**: **Situation** (tình huống), **Task** (nhiệm vụ), **Action** (hành động bạn thực hiện), **Result** (kết quả). Báo cáo cho biết điểm và góp ý để luyện tập tiếp. |
| 2 | 113c5a3ed4454b764069f9e28788eb847052fe74fa42f62e41fd8fc25db46bc0 | /student/interview | **Q: STAR khác kể chuyện thông thường ở đâu?**  A: STAR giúp câu trả lời có bối cảnh, nhiệm vụ, hành động cá nhân và kết quả. Hãy làm rõ bạn đóng góp gì thay vì chỉ kể việc của cả nhóm. |
| 3 | c1951040d665852c0ce8a62b156d14b7dea0100082bdffc12f2053b43d9ca496 | /student/interview | - **Ô trả lời** (đề xuất): Selector `[data-agent-target="interview-answer-input"]`. Nhập câu trả lời với đủ bốn phần STAR. |

**Context gửi vào generator:**

Phỏng vấn thử giúp sinh viên luyện trả lời theo bối cảnh CV và vị trí ứng tuyển. Mỗi câu nên trình bày theo **STAR**: **Situation** (tình huống), **Task** (nhiệm vụ), **Action** (hành động bạn thực hiện), **Result** (kết quả). Báo cáo cho biết điểm và góp ý để luyện tập tiếp.

**Q: STAR khác kể chuyện thông thường ở đâu?**

A: STAR giúp câu trả lời có bối cảnh, nhiệm vụ, hành động cá nhân và kết quả. Hãy làm rõ bạn đóng góp gì thay vì chỉ kể việc của cả nhóm.

- **Ô trả lời** (đề xuất): Selector . Nhập câu trả lời với đủ bốn phần STAR.

**Bằng chứng chấm điểm:**

```json
{
  "claims": [
    {
      "statement": "Phỏng vấn thử giúp sinh viên luyện trả lời theo bối cảnh CV và vị trí ứng tuyển.",
      "supported": true,
      "evidence": "Phỏng vấn thử giúp sinh viên luyện trả lời theo bối cảnh CV và vị trí ứng tuyển."
    },
    {
      "statement": "Mỗi câu nên trình bày theo STAR: Situation, Task, Action, Result.",
      "supported": true,
      "evidence": "Mỗi câu nên trình bày theo **STAR**: **Situation** (tình huống), **Task** (nhiệm vụ), **Action** (hành động bạn thực hiện), **Result** (kết quả)."
    },
    {
      "statement": "Situation nghĩa là tình huống.",
      "supported": true,
      "evidence": "Situation (tình huống)"
    },
    {
      "statement": "Task nghĩa là nhiệm vụ.",
      "supported": true,
      "evidence": "Task (nhiệm vụ)"
    },
    {
      "statement": "Action nghĩa là hành động bạn thực hiện.",
      "supported": true,
      "evidence": "Action (hành động bạn thực hiện)"
    },
    {
      "statement": "Result nghĩa là kết quả.",
      "supported": true,
      "evidence": "Result (kết quả)"
    },
    {
      "statement": "STAR giúp câu trả lời có bối cảnh, nhiệm vụ, hành động cá nhân và kết quả.",
      "supported": true,
      "evidence": "STAR giúp câu trả lời có bối cảnh, nhiệm vụ, hành động cá nhân và kết quả."
    },
    {
      "statement": "Bạn nên làm rõ đóng góp cá nhân thay vì chỉ kể việc của cả nhóm.",
      "supported": true,
      "evidence": "Hãy làm rõ bạn đóng góp gì thay vì chỉ kể việc của cả nhóm."
    },
    {
      "statement": "Có ô trả lời dạng Selector để nhập câu trả lời với đủ bốn phần STAR.",
      "supported": true,
      "evidence": "- **Ô trả lời** (đề xuất): Selector . Nhập câu trả lời với đủ bốn phần STAR."
    }
  ],
  "expected_points": [
    {
      "statement": "Đáp án A",
      "supported": false,
      "evidence": ""
    },
    {
      "statement": "Situation là tình huống",
      "supported": true,
      "evidence": "Situation (tình huống)"
    },
    {
      "statement": "Task là nhiệm vụ",
      "supported": true,
      "evidence": "Task (nhiệm vụ)"
    },
    {
      "statement": "Action là hành động cá nhân bạn thực hiện",
      "supported": true,
      "evidence": "Action (hành động bạn thực hiện)"
    },
    {
      "statement": "Result là kết quả cụ thể",
      "supported": false,
      "evidence": ""
    }
  ],
  "semantic_relevance": 0.95
}
```

**Chấm lại scorer:** 2026-10-07T20:38:41.606039+00:00; giữ nguyên câu trả lời và context đã quan sát.

### 8. /student/interview

**Câu hỏi:** Quy trình bắt đầu Mock Interview đúng là gì? A. Không cần CV hay vị trí. B. Chọn CV và vị trí, còn lượt luyện, bấm Bắt đầu phỏng vấn rồi Sẵn sàng trong phòng chờ. C. Chỉ mở báo cáo cũ.

**Đáp án chuẩn:** Đáp án B; Mở /student/interview/new và chọn CV cùng vị trí ứng tuyển; Kiểm tra còn lượt luyện cho vị trí này; Bấm Bắt đầu phỏng vấn rồi Sẵn sàng trong phòng chờ để tạo phiên.

**Câu trả lời thực tế (grounded_fallback):**

Theo tài liệu hướng dẫn:

3. Bấm **Bắt đầu phỏng vấn** khi đã chọn đủ thông tin và còn lượt cho vị trí này.

Nguồn: [Hướng dẫn phỏng vấn thử theo STAR](/student/interview) — Hướng dẫn phỏng vấn thử theo STAR > Các bước thực hiện

- **Nút "Bắt đầu phỏng vấn"**: Selector . Mở phòng chờ với CV và vị trí đã chọn; bấm **Sẵn sàng** trong phòng chờ mới tạo phiên. Nút không khả dụng khi thiếu thông tin hoặc hết lượt.

Nguồn: [Hướng dẫn phỏng vấn thử theo STAR](/student/interview) — Hướng dẫn phỏng vấn thử theo STAR > Các nút và thành phần giao diện

2. Chọn vị trí ứng tuyển và CV dùng làm bối cảnh. Đọc phần hướng dẫn và kiểm tra lượt luyện còn lại.

Nguồn: [Hướng dẫn phỏng vấn thử theo STAR](/student/interview) — Hướng dẫn phỏng vấn thử theo STAR > Các bước thực hiện

**Relevance scorer:** e5_cosine

**Từ khóa thiếu:** 

| Rank | Chunk ID | Route | Context thực sự retrieve |
|---|---|---|---|
| 1 | 676f23eb73b30c85ea9686014c1aff47207d7766c1bbe523bcb8a57861172c19 | /student/interview | 3. Bấm **Bắt đầu phỏng vấn** khi đã chọn đủ thông tin và còn lượt cho vị trí này. |
| 2 | f5bcde0b35a5688446b8505df4709721f5760497be5aa757eda3dbdcb8466f46 | /student/interview | - **Nút "Bắt đầu phỏng vấn"**: Selector `[data-agent-target="btn-start-interview"]`. Mở phòng chờ với CV và vị trí đã chọn; bấm **Sẵn sàng** trong phòng chờ mới tạo phiên. Nút không khả dụng khi thiếu thông tin hoặc hết lượt. |
| 3 | 0bd597e310db4d857efe738382bcf54e3e4be68153499fb332c1367d97d2cb68 | /student/interview | 2. Chọn vị trí ứng tuyển và CV dùng làm bối cảnh. Đọc phần hướng dẫn và kiểm tra lượt luyện còn lại. |

**Context gửi vào generator:**

3. Bấm **Bắt đầu phỏng vấn** khi đã chọn đủ thông tin và còn lượt cho vị trí này.

- **Nút "Bắt đầu phỏng vấn"**: Selector . Mở phòng chờ với CV và vị trí đã chọn; bấm **Sẵn sàng** trong phòng chờ mới tạo phiên. Nút không khả dụng khi thiếu thông tin hoặc hết lượt.

2. Chọn vị trí ứng tuyển và CV dùng làm bối cảnh. Đọc phần hướng dẫn và kiểm tra lượt luyện còn lại.

**Bằng chứng chấm điểm:**

```json
{
  "claims": [
    {
      "statement": "Press \"Bắt đầu phỏng vấn\" when you have selected enough information and still have attempts for the position.",
      "supported": true,
      "evidence": "3. Bấm **Bắt đầu phỏng vấn** khi đã chọn đủ thông tin và còn lượt cho vị trí này."
    },
    {
      "statement": "The \"Bắt đầu phỏng vấn\" button opens a waiting room with the selected CV and position, and you must press \"Sẵn sàng\" in the waiting room to create a session.",
      "supported": true,
      "evidence": "- **Nút \"Bắt đầu phỏng vấn\"**: Selector . Mở phòng chờ với CV và vị trí đã chọn; bấm **Sẵn sàng** trong phòng chờ mới tạo phiên."
    },
    {
      "statement": "The button is disabled when information is missing or attempts are exhausted.",
      "supported": true,
      "evidence": "Nút không khả dụng khi thiếu thông tin hoặc hết lượt."
    },
    {
      "statement": "You must choose the applied position and CV as the context.",
      "supported": true,
      "evidence": "2. Chọn vị trí ứng tuyển và CV dùng làm bối cảnh."
    },
    {
      "statement": "You should read the instructions and check the remaining attempts.",
      "supported": true,
      "evidence": "Đọc phần hướng dẫn và kiểm tra lượt luyện còn lại."
    }
  ],
  "expected_points": [
    {
      "statement": "Đáp án B",
      "supported": false,
      "evidence": ""
    },
    {
      "statement": "Mở /student/interview/new và chọn CV cùng vị trí ứng tuyển",
      "supported": false,
      "evidence": ""
    },
    {
      "statement": "Kiểm tra còn lượt luyện cho vị trí này",
      "supported": true,
      "evidence": "Đọc phần hướng dẫn và kiểm tra lượt luyện còn lại."
    },
    {
      "statement": "Bấm Bắt đầu phỏng vấn rồi Sẵn sàng trong phòng chờ để tạo phiên",
      "supported": true,
      "evidence": "Bấm **Bắt đầu phỏng vấn** ...; bấm **Sẵn sàng** trong phòng chờ mới tạo phiên."
    }
  ],
  "semantic_relevance": 0.95
}
```

### 9. /student/interview

**Câu hỏi:** Điểm STAR và Match Score có cùng thang đo không? A. Cả hai đều 0–100%. B. Cả hai đều 0–5. C. STAR là 0–5, còn Match Score là 0–100%.

**Đáp án chuẩn:** Đáp án C; STAR dùng thang 0–5 để đánh giá câu trả lời phỏng vấn; Match Score dùng thang 0–100% để đánh giá mức phù hợp CV với JD; Hai chỉ số đo nội dung khác nhau.

**Câu trả lời thực tế (grounded_fallback):**

Theo tài liệu hướng dẫn:

**Q: Điểm STAR có cùng thang với Match Score không?**

A: Không. STAR dùng thang 0–5 để đánh giá câu trả lời; Match Score dùng 0–100% để đánh giá mức phù hợp CV với JD.

Nguồn: [Hướng dẫn phỏng vấn thử theo STAR](/student/interview) — Hướng dẫn phỏng vấn thử theo STAR > Câu hỏi thường gặp (FAQ)

6. Hoàn thành các câu hỏi và mở báo cáo để đọc đánh giá, điểm STAR thang **0–5** cùng gợi ý cải thiện.

Nguồn: [Hướng dẫn phỏng vấn thử theo STAR](/student/interview) — Hướng dẫn phỏng vấn thử theo STAR > Các bước thực hiện

**Q: Tôi có thể so điểm phỏng vấn trực tiếp với độ khớp CV không?**

A: Hai chỉ số đo nội dung khác nhau và dùng thang khác nhau: STAR 0–5, Match Score 0–100%. Hãy xem xu hướng riêng của từng chỉ số.

Nguồn: [Hướng dẫn xem lịch sử và tiến bộ](/student/history) — Hướng dẫn xem lịch sử và tiến bộ > Câu hỏi thường gặp (FAQ)

**Relevance scorer:** e5_cosine

**Từ khóa thiếu:** 

| Rank | Chunk ID | Route | Context thực sự retrieve |
|---|---|---|---|
| 1 | e36d497cdf263a627e61e58181a0a77b05fad4a3423da609ea9921ded044d2f3 | /student/interview | **Q: Điểm STAR có cùng thang với Match Score không?**  A: Không. STAR dùng thang 0–5 để đánh giá câu trả lời; Match Score dùng 0–100% để đánh giá mức phù hợp CV với JD. |
| 2 | 5a2f4c3ba2eff07fea043a0f523034684b7f1b251ab994b9a42ff5f805a0f52b | /student/interview | 6. Hoàn thành các câu hỏi và mở báo cáo để đọc đánh giá, điểm STAR thang **0–5** cùng gợi ý cải thiện. |
| 3 | 8a943f406da01be802dc06331eb09f05008f2b611589ae85d21421e95c0a38fa | /student/history | **Q: Tôi có thể so điểm phỏng vấn trực tiếp với độ khớp CV không?**  A: Hai chỉ số đo nội dung khác nhau và dùng thang khác nhau: STAR 0–5, Match Score 0–100%. Hãy xem xu hướng riêng của từng chỉ số. |

**Context gửi vào generator:**

**Q: Điểm STAR có cùng thang với Match Score không?**

A: Không. STAR dùng thang 0–5 để đánh giá câu trả lời; Match Score dùng 0–100% để đánh giá mức phù hợp CV với JD.

6. Hoàn thành các câu hỏi và mở báo cáo để đọc đánh giá, điểm STAR thang **0–5** cùng gợi ý cải thiện.

**Q: Tôi có thể so điểm phỏng vấn trực tiếp với độ khớp CV không?**

A: Hai chỉ số đo nội dung khác nhau và dùng thang khác nhau: STAR 0–5, Match Score 0–100%. Hãy xem xu hướng riêng của từng chỉ số.

**Bằng chứng chấm điểm:**

```json
{
  "claims": [
    {
      "statement": "STAR dùng thang 0–5 để đánh giá câu trả lời.",
      "supported": true,
      "evidence": "STAR dùng thang 0–5 để đánh giá câu trả lời"
    },
    {
      "statement": "Match Score dùng 0–100% để đánh giá mức phù hợp CV với JD.",
      "supported": true,
      "evidence": "Match Score dùng 0–100% để đánh giá mức phù hợp CV với JD."
    },
    {
      "statement": "STAR và Match Score không cùng thang.",
      "supported": true,
      "evidence": "Không. STAR dùng thang 0–5 để đánh giá câu trả lời; Match Score dùng 0–100% để đánh giá mức phù hợp CV với JD."
    },
    {
      "statement": "Hai chỉ số đo nội dung khác nhau và dùng thang khác nhau.",
      "supported": true,
      "evidence": "Hai chỉ số đo nội dung khác nhau và dùng thang khác nhau: STAR 0–5, Match Score 0–100%."
    }
  ],
  "expected_points": [
    {
      "statement": "Đáp án C",
      "supported": false,
      "evidence": ""
    },
    {
      "statement": "STAR dùng thang 0–5 để đánh giá câu trả lời phỏng vấn",
      "supported": true,
      "evidence": "STAR dùng thang 0–5 để đánh giá câu trả lời"
    },
    {
      "statement": "Match Score dùng thang 0–100% để đánh giá mức phù hợp CV với JD",
      "supported": true,
      "evidence": "Match Score dùng 0–100% để đánh giá mức phù hợp CV với JD."
    },
    {
      "statement": "Hai chỉ số đo nội dung khác nhau",
      "supported": true,
      "evidence": "Hai chỉ số đo nội dung khác nhau và dùng thang khác nhau: STAR 0–5, Match Score 0–100%."
    }
  ],
  "semantic_relevance": 1.0
}
```

### 10. /student/history

**Câu hỏi:** Ở History, bộ lọc thời gian nào có sẵn? A. 30 ngày qua, 90 ngày hoặc Toàn bộ quá trình. B. Chỉ hôm nay. C. Luôn phải chọn riêng ngày bắt đầu và kết thúc.

**Đáp án chuẩn:** Đáp án A; Có thể chọn 30 ngày qua, 90 ngày hoặc Toàn bộ quá trình; Giao diện hiện chưa có bộ chọn ngày bắt đầu và kết thúc riêng; Có thể kết hợp bộ lọc vị trí.

**Câu trả lời thực tế (grounded_fallback):**

Theo tài liệu hướng dẫn:

3. Chọn bộ lọc thời gian **30 ngày qua**, **90 ngày** hoặc **Toàn bộ quá trình**. Giao diện hiện tại lọc theo khoảng thời gian này, chưa có bộ chọn ngày bắt đầu/kết thúc riêng.

Nguồn: [Hướng dẫn xem lịch sử và tiến bộ](/student/history) — Hướng dẫn xem lịch sử và tiến bộ > Các bước thực hiện

- **Bộ lọc thời gian**: Selector . Chọn khoảng 30 ngày, 90 ngày hoặc toàn bộ quá trình.

Nguồn: [Hướng dẫn xem lịch sử và tiến bộ](/student/history) — Hướng dẫn xem lịch sử và tiến bộ > Các nút và thành phần giao diện

**Q: Vì sao lịch sử trống?**

A: Có thể chưa có hoạt động hoặc bộ lọc đang quá hẹp. Chọn toàn bộ quá trình và tất cả vị trí; nếu chưa có dữ liệu, hoàn thành một phiên phân tích hoặc phỏng vấn đầu tiên.

Nguồn: [Hướng dẫn xem lịch sử và tiến bộ](/student/history) — Hướng dẫn xem lịch sử và tiến bộ > Câu hỏi thường gặp (FAQ)

**Relevance scorer:** e5_cosine

**Từ khóa thiếu:** 

| Rank | Chunk ID | Route | Context thực sự retrieve |
|---|---|---|---|
| 1 | 902311f189e174e28dd3c56cbfd3758821ae1d17049b8c4e93e096c3017e479d | /student/history | 3. Chọn bộ lọc thời gian **30 ngày qua**, **90 ngày** hoặc **Toàn bộ quá trình**. Giao diện hiện tại lọc theo khoảng thời gian này, chưa có bộ chọn ngày bắt đầu/kết thúc riêng. |
| 2 | eb8c351dfd34e2ae477beb2be969ea8309712f0f936f8749b71b11f540fdab36 | /student/history | - **Bộ lọc thời gian**: Selector `[data-agent-target="history-date-filter"]`. Chọn khoảng 30 ngày, 90 ngày hoặc toàn bộ quá trình. |
| 3 | 086a07819770b18649b4214f82cb466abc6c6c3c725e5f92284b23a745d8adb6 | /student/history | **Q: Vì sao lịch sử trống?**  A: Có thể chưa có hoạt động hoặc bộ lọc đang quá hẹp. Chọn toàn bộ quá trình và tất cả vị trí; nếu chưa có dữ liệu, hoàn thành một phiên phân tích hoặc phỏng vấn đầu tiên. |

**Context gửi vào generator:**

3. Chọn bộ lọc thời gian **30 ngày qua**, **90 ngày** hoặc **Toàn bộ quá trình**. Giao diện hiện tại lọc theo khoảng thời gian này, chưa có bộ chọn ngày bắt đầu/kết thúc riêng.

- **Bộ lọc thời gian**: Selector . Chọn khoảng 30 ngày, 90 ngày hoặc toàn bộ quá trình.

**Q: Vì sao lịch sử trống?**

A: Có thể chưa có hoạt động hoặc bộ lọc đang quá hẹp. Chọn toàn bộ quá trình và tất cả vị trí; nếu chưa có dữ liệu, hoàn thành một phiên phân tích hoặc phỏng vấn đầu tiên.

**Bằng chứng chấm điểm:**

```json
{
  "claims": [
    {
      "statement": "The time filter options are \"30 ngày qua\", \"90 ngày\", or \"Toàn bộ quá trình\".",
      "supported": true,
      "evidence": "3. Chọn bộ lọc thời gian **30 ngày qua**, **90 ngày** hoặc **Toàn bộ quá trình**."
    },
    {
      "statement": "The current interface filters by these time ranges and does not have a separate start/end date selector.",
      "supported": true,
      "evidence": "Giao diện hiện tại lọc theo khoảng thời gian này, chưa có bộ chọn ngày bắt đầu/kết thúc riêng."
    },
    {
      "statement": "The time filter is a selector that allows choosing 30 days, 90 days, or whole period.",
      "supported": true,
      "evidence": "- **Bộ lọc thời gian**: Selector . Chọn khoảng 30 ngày, 90 ngày hoặc toàn bộ quá trình."
    },
    {
      "statement": "History may be empty because no activity or filter too narrow; choose whole period and all locations; if still no data, complete a session.",
      "supported": true,
      "evidence": "A: Có thể chưa có hoạt động hoặc bộ lọc đang quá hẹp. Chọn toàn bộ quá trình và tất cả vị trí; nếu chưa có dữ liệu, hoàn thành một phiên phân tích hoặc phỏng vấn đầu tiên."
    },
    {
      "statement": "The source is the guide \"Hướng dẫn xem lịch sử và tiến bộ\" under \"Các bước thực hiện\".",
      "supported": false,
      "evidence": ""
    }
  ],
  "expected_points": [
    {
      "statement": "Đáp án A",
      "supported": false,
      "evidence": ""
    },
    {
      "statement": "Có thể chọn 30 ngày qua, 90 ngày hoặc Toàn bộ quá trình",
      "supported": true,
      "evidence": "3. Chọn bộ lọc thời gian **30 ngày qua**, **90 ngày** hoặc **Toàn bộ quá trình**."
    },
    {
      "statement": "Giao diện hiện chưa có bộ chọn ngày bắt đầu và kết thúc riêng",
      "supported": true,
      "evidence": "Giao diện hiện tại lọc theo khoảng thời gian này, chưa có bộ chọn ngày bắt đầu/kết thúc riêng."
    },
    {
      "statement": "Có thể kết hợp bộ lọc vị trí",
      "supported": false,
      "evidence": ""
    }
  ],
  "semantic_relevance": 0.95
}
```

### 11. /student/history

**Câu hỏi:** Lịch sử trống dù tôi muốn xem các phiên cũ, nên xử lý thế nào? A. Chỉ đổi tên CV. B. Chọn Toàn bộ quá trình và Tất cả vị trí, kiểm tra đã có hoạt động hay chưa. C. Chỉ giữ khoảng 30 ngày.

**Đáp án chuẩn:** Đáp án B; Lịch sử có thể trống vì chưa có hoạt động hoặc bộ lọc quá hẹp; Chọn Toàn bộ quá trình và Tất cả vị trí; Nếu chưa có dữ liệu, hoàn thành một phiên phân tích hoặc phỏng vấn đầu tiên.

**Câu trả lời thực tế (grounded_fallback):**

Theo tài liệu hướng dẫn:

**Q: Vì sao lịch sử trống?**

A: Có thể chưa có hoạt động hoặc bộ lọc đang quá hẹp. Chọn toàn bộ quá trình và tất cả vị trí; nếu chưa có dữ liệu, hoàn thành một phiên phân tích hoặc phỏng vấn đầu tiên.

Nguồn: [Hướng dẫn xem lịch sử và tiến bộ](/student/history) — Hướng dẫn xem lịch sử và tiến bộ > Câu hỏi thường gặp (FAQ)

- **Bộ lọc thời gian**: Selector . Chọn khoảng 30 ngày, 90 ngày hoặc toàn bộ quá trình.

Nguồn: [Hướng dẫn xem lịch sử và tiến bộ](/student/history) — Hướng dẫn xem lịch sử và tiến bộ > Các nút và thành phần giao diện

3. Chọn bộ lọc thời gian **30 ngày qua**, **90 ngày** hoặc **Toàn bộ quá trình**. Giao diện hiện tại lọc theo khoảng thời gian này, chưa có bộ chọn ngày bắt đầu/kết thúc riêng.

Nguồn: [Hướng dẫn xem lịch sử và tiến bộ](/student/history) — Hướng dẫn xem lịch sử và tiến bộ > Các bước thực hiện

**Relevance scorer:** e5_cosine

**Từ khóa thiếu:** 

| Rank | Chunk ID | Route | Context thực sự retrieve |
|---|---|---|---|
| 1 | 086a07819770b18649b4214f82cb466abc6c6c3c725e5f92284b23a745d8adb6 | /student/history | **Q: Vì sao lịch sử trống?**  A: Có thể chưa có hoạt động hoặc bộ lọc đang quá hẹp. Chọn toàn bộ quá trình và tất cả vị trí; nếu chưa có dữ liệu, hoàn thành một phiên phân tích hoặc phỏng vấn đầu tiên. |
| 2 | eb8c351dfd34e2ae477beb2be969ea8309712f0f936f8749b71b11f540fdab36 | /student/history | - **Bộ lọc thời gian**: Selector `[data-agent-target="history-date-filter"]`. Chọn khoảng 30 ngày, 90 ngày hoặc toàn bộ quá trình. |
| 3 | 902311f189e174e28dd3c56cbfd3758821ae1d17049b8c4e93e096c3017e479d | /student/history | 3. Chọn bộ lọc thời gian **30 ngày qua**, **90 ngày** hoặc **Toàn bộ quá trình**. Giao diện hiện tại lọc theo khoảng thời gian này, chưa có bộ chọn ngày bắt đầu/kết thúc riêng. |

**Context gửi vào generator:**

**Q: Vì sao lịch sử trống?**

A: Có thể chưa có hoạt động hoặc bộ lọc đang quá hẹp. Chọn toàn bộ quá trình và tất cả vị trí; nếu chưa có dữ liệu, hoàn thành một phiên phân tích hoặc phỏng vấn đầu tiên.

- **Bộ lọc thời gian**: Selector . Chọn khoảng 30 ngày, 90 ngày hoặc toàn bộ quá trình.

3. Chọn bộ lọc thời gian **30 ngày qua**, **90 ngày** hoặc **Toàn bộ quá trình**. Giao diện hiện tại lọc theo khoảng thời gian này, chưa có bộ chọn ngày bắt đầu/kết thúc riêng.

**Bằng chứng chấm điểm:**

```json
{
  "claims": [
    {
      "statement": "The history may be empty because there is no activity.",
      "supported": true,
      "evidence": "Có thể chưa có hoạt động hoặc bộ lọc đang quá hẹp."
    },
    {
      "statement": "The history may be empty because the filter is too narrow.",
      "supported": true,
      "evidence": "Có thể chưa có hoạt động hoặc bộ lọc đang quá hẹp."
    },
    {
      "statement": "To view history, select \"all process\" and \"all positions\".",
      "supported": true,
      "evidence": "Chọn toàn bộ quá trình và tất cả vị trí;"
    },
    {
      "statement": "If there is no data, complete a first analysis session or interview.",
      "supported": true,
      "evidence": "nếu chưa có dữ liệu, hoàn thành một phiên phân tích hoặc phỏng vấn đầu tiên."
    },
    {
      "statement": "There is a time filter selector in the UI.",
      "supported": true,
      "evidence": "- **Bộ lọc thời gian**: Selector ."
    },
    {
      "statement": "The time filter options are 30 days, 90 days, or all process.",
      "supported": true,
      "evidence": "Chọn khoảng 30 ngày, 90 ngày hoặc toàn bộ quá trình."
    },
    {
      "statement": "The current UI filters by these time ranges and does not have separate start/end date selectors.",
      "supported": true,
      "evidence": "Giao diện hiện tại lọc theo khoảng thời gian này, chưa có bộ chọn ngày bắt đầu/kết thúc riêng."
    }
  ],
  "expected_points": [
    {
      "statement": "Đáp án B",
      "supported": false,
      "evidence": ""
    },
    {
      "statement": "Lịch sử có thể trống vì chưa có hoạt động hoặc bộ lọc quá hẹp",
      "supported": true,
      "evidence": "Có thể chưa có hoạt động hoặc bộ lọc đang quá hẹp."
    },
    {
      "statement": "Chọn Toàn bộ quá trình và Tất cả vị trí",
      "supported": true,
      "evidence": "Chọn toàn bộ quá trình và tất cả vị trí;"
    },
    {
      "statement": "Nếu chưa có dữ liệu, hoàn thành một phiên phân tích hoặc phỏng vấn đầu tiên",
      "supported": true,
      "evidence": "nếu chưa có dữ liệu, hoàn thành một phiên phân tích hoặc phỏng vấn đầu tiên."
    }
  ],
  "semantic_relevance": 0.95
}
```

### 12. /student/history

**Câu hỏi:** Muốn mở chi tiết phiên cũ ở History, chọn đường dẫn nào? A. Cả hai loại phiên đều mở trang CV. B. Chỉ xem được biểu đồ. C. Phỏng vấn mở /student/interview/{id}/report, phân tích mở /student/analysis/{id}.

**Đáp án chuẩn:** Đáp án C; Chọn phiên trong bảng phỏng vấn để mở /student/interview/{id}/report; Chọn phiên trong bảng phân tích để mở /student/analysis/{id}; Mã id phải là mã phiên thực tế.

**Câu trả lời thực tế (grounded_fallback):**

Theo tài liệu hướng dẫn:

- **Danh sách phiên**: Selector . Vùng chứa lịch sử phỏng vấn và phân tích để mở chi tiết.

Nguồn: [Hướng dẫn xem lịch sử và tiến bộ](/student/history) — Hướng dẫn xem lịch sử và tiến bộ > Các nút và thành phần giao diện

5. Trong bảng phỏng vấn, chọn phiên để mở báo cáo tại `/student/interview/{id}/report`.

Nguồn: [Hướng dẫn xem lịch sử và tiến bộ](/student/history) — Hướng dẫn xem lịch sử và tiến bộ > Các bước thực hiện

- **Bộ lọc loại phiên**: Selector . Chọn tất cả phiên, Mock Interview hoặc phân tích CV–JD.

Nguồn: [Hướng dẫn xem lịch sử và tiến bộ](/student/history) — Hướng dẫn xem lịch sử và tiến bộ > Các nút và thành phần giao diện

**Relevance scorer:** e5_cosine

**Từ khóa thiếu:** /student/analysis/{id}

| Rank | Chunk ID | Route | Context thực sự retrieve |
|---|---|---|---|
| 1 | 466530bfdc33e2f34cbd185cb26e7fe6a1d454f68f5610abd592073a63fd13a2 | /student/history | - **Danh sách phiên**: Selector `[data-agent-target="history-session-list"]`. Vùng chứa lịch sử phỏng vấn và phân tích để mở chi tiết. |
| 2 | dfefc3fb87afef8247e8cd8661d9f8b01e3b22156380a099a96c048cd1465e5a | /student/history | 5. Trong bảng phỏng vấn, chọn phiên để mở báo cáo tại `/student/interview/{id}/report`. |
| 3 | 178fe22fe9b1d37800647b13ba0db986a2fd5d2e79fe2c851fccbabb4ddc9eb6 | /student/history | - **Bộ lọc loại phiên**: Selector `[data-agent-target="history-type-filter"]`. Chọn tất cả phiên, Mock Interview hoặc phân tích CV–JD. |

**Context gửi vào generator:**

- **Danh sách phiên**: Selector . Vùng chứa lịch sử phỏng vấn và phân tích để mở chi tiết.

5. Trong bảng phỏng vấn, chọn phiên để mở báo cáo tại `/student/interview/{id}/report`.

- **Bộ lọc loại phiên**: Selector . Chọn tất cả phiên, Mock Interview hoặc phân tích CV–JD.

**Bằng chứng chấm điểm:**

```json
{
  "claims": [
    {
      "statement": "Danh sách phiên: Selector . Vùng chứa lịch sử phỏng vấn và phân tích để mở chi tiết.",
      "supported": true,
      "evidence": "- **Danh sách phiên**: Selector . Vùng chứa lịch sử phỏng vấn và phân tích để mở chi tiết."
    },
    {
      "statement": "Trong bảng phỏng vấn, chọn phiên để mở báo cáo tại `/student/interview/{id}/report`.",
      "supported": true,
      "evidence": "5. Trong bảng phỏng vấn, chọn phiên để mở báo cáo tại `/student/interview/{id}/report`."
    },
    {
      "statement": "Bộ lọc loại phiên: Selector . Chọn tất cả phiên, Mock Interview hoặc phân tích CV–JD.",
      "supported": true,
      "evidence": "- **Bộ lọc loại phiên**: Selector . Chọn tất cả phiên, Mock Interview hoặc phân tích CV–JD."
    }
  ],
  "expected_points": [
    {
      "statement": "Đáp án C",
      "supported": false,
      "evidence": ""
    },
    {
      "statement": "Chọn phiên trong bảng phỏng vấn để mở /student/interview/{id}/report",
      "supported": true,
      "evidence": "5. Trong bảng phỏng vấn, chọn phiên để mở báo cáo tại `/student/interview/{id}/report`."
    },
    {
      "statement": "Chọn phiên trong bảng phân tích để mở /student/analysis/{id}",
      "supported": false,
      "evidence": ""
    },
    {
      "statement": "Mã id phải là mã phiên thực tế",
      "supported": false,
      "evidence": ""
    }
  ],
  "semantic_relevance": 0.8
}
```

### 13. /advisor/dashboard

**Câu hỏi:** Trong Dashboard Cố vấn, at-risk có ý nghĩa gì và xem nhóm này ở đâu? A. Nhóm cần chú ý, xem lý do cảnh báo và danh sách status=flagged. B. Chắc chắn không đáp ứng công việc. C. Tất cả sinh viên đã sẵn sàng.

**Đáp án chuẩn:** Đáp án A; At-risk là dấu hiệu sinh viên cần chú ý và hỗ trợ, không phải kết luận chắc chắn không đáp ứng công việc; Đọc lý do cảnh báo và lịch sử hồ sơ; Mở /advisor/students?status=flagged để xem nhóm cần chú ý.

**Câu trả lời thực tế (grounded_fallback):**

Theo tài liệu hướng dẫn:

**Q: At-risk có nghĩa sinh viên chắc chắn không đáp ứng công việc không?**

A: Đây là dấu hiệu cần quan tâm để cố vấn xem hồ sơ và hỗ trợ. Không kết luận chỉ từ nhãn; hãy đọc lý do cảnh báo, điểm và lịch sử hoạt động.

Nguồn: [Hướng dẫn bảng tổng quan cố vấn](/advisor/dashboard) — Hướng dẫn bảng tổng quan cố vấn > Câu hỏi thường gặp (FAQ)

Bảng tổng quan giúp cố vấn theo dõi nhóm sinh viên được phân công, mức sẵn sàng, tiến bộ và các báo cáo chờ nhận xét. Danh sách **at-risk** tương ứng với nhóm sinh viên **cần chú ý** trên giao diện; nên đọc lý do cảnh báo và diễn biến từng hồ sơ trước khi chọn cách hỗ trợ.

Nguồn: [Hướng dẫn bảng tổng quan cố vấn](/advisor/dashboard) — Hướng dẫn bảng tổng quan cố vấn > Tổng quan

- **Liên kết nhóm cần chú ý** (đề xuất): Selector . Mở danh sách tại `/advisor/students?status=flagged`.

Nguồn: [Hướng dẫn bảng tổng quan cố vấn](/advisor/dashboard) — Hướng dẫn bảng tổng quan cố vấn > Các nút và thành phần giao diện

**Relevance scorer:** e5_cosine

**Từ khóa thiếu:** 

| Rank | Chunk ID | Route | Context thực sự retrieve |
|---|---|---|---|
| 1 | ffd2b4a1bd4919520de126e533b6f9fa85aaa140ba7d56a4d80cf8018a30e1e7 | /advisor/dashboard | **Q: At-risk có nghĩa sinh viên chắc chắn không đáp ứng công việc không?**  A: Đây là dấu hiệu cần quan tâm để cố vấn xem hồ sơ và hỗ trợ. Không kết luận chỉ từ nhãn; hãy đọc lý do cảnh báo, điểm và lịch sử hoạt động. |
| 2 | 2ad080d5f089fc11457e738ca850d1cfe9b6d6b098fd5987943cf8ad9f510cfa | /advisor/dashboard | Bảng tổng quan giúp cố vấn theo dõi nhóm sinh viên được phân công, mức sẵn sàng, tiến bộ và các báo cáo chờ nhận xét. Danh sách **at-risk** tương ứng với nhóm sinh viên **cần chú ý** trên giao diện; nên đọc lý do cảnh báo và diễn biến từng hồ sơ trước khi chọn cách hỗ trợ. |
| 3 | 1e7497919cb2accb5a0e01a3ad2e109f440fe9df01a540aaf8b869795851e129 | /advisor/dashboard | - **Liên kết nhóm cần chú ý** (đề xuất): Selector `[data-agent-target="btn-view-at-risk-students"]`. Mở danh sách tại `/advisor/students?status=flagged`. |

**Context gửi vào generator:**

**Q: At-risk có nghĩa sinh viên chắc chắn không đáp ứng công việc không?**

A: Đây là dấu hiệu cần quan tâm để cố vấn xem hồ sơ và hỗ trợ. Không kết luận chỉ từ nhãn; hãy đọc lý do cảnh báo, điểm và lịch sử hoạt động.

Bảng tổng quan giúp cố vấn theo dõi nhóm sinh viên được phân công, mức sẵn sàng, tiến bộ và các báo cáo chờ nhận xét. Danh sách **at-risk** tương ứng với nhóm sinh viên **cần chú ý** trên giao diện; nên đọc lý do cảnh báo và diễn biến từng hồ sơ trước khi chọn cách hỗ trợ.

- **Liên kết nhóm cần chú ý** (đề xuất): Selector . Mở danh sách tại `/advisor/students?status=flagged`.

**Bằng chứng chấm điểm:**

```json
{
  "claims": [
    {
      "statement": "At-risk is a sign that advisors should pay attention to and support the student's file.",
      "supported": true,
      "evidence": "Đây là dấu hiệu cần quan tâm để cố vấn xem hồ sơ và hỗ trợ."
    },
    {
      "statement": "One should not conclude that a student does not meet job requirements solely from the at-risk label.",
      "supported": true,
      "evidence": "Không kết luận chỉ từ nhãn;"
    },
    {
      "statement": "Advisors should read the warning reason, score, and activity history.",
      "supported": true,
      "evidence": "hãy đọc lý do cảnh báo, điểm và lịch sử hoạt động."
    },
    {
      "statement": "The dashboard helps advisors monitor assigned student groups, readiness level, progress, and pending reports.",
      "supported": true,
      "evidence": "Bảng tổng quan giúp cố vấn theo dõi nhóm sinh viên được phân công, mức sẵn sàng, tiến bộ và các báo cáo chờ nhận xét."
    },
    {
      "statement": "The at-risk list corresponds to the \"need attention\" group on the interface.",
      "supported": true,
      "evidence": "Danh sách **at-risk** tương ứng với nhóm sinh viên **cần chú ý** trên giao diện;"
    },
    {
      "statement": "Advisors should read the warning reason and each file's evolution before choosing support method.",
      "supported": true,
      "evidence": "nên đọc lý do cảnh báo và diễn biến từng hồ sơ trước khi chọn cách hỗ trợ."
    },
    {
      "statement": "There is a link to the \"need attention\" group: open list at `/advisor/students?status=flagged`.",
      "supported": true,
      "evidence": "Mở danh sách tại `/advisor/students?status=flagged`."
    }
  ],
  "expected_points": [
    {
      "statement": "Đáp án A",
      "supported": false,
      "evidence": ""
    },
    {
      "statement": "At-risk là dấu hiệu sinh viên cần chú ý và hỗ trợ, không phải kết luận chắc chắn không đáp ứng công việc",
      "supported": true,
      "evidence": "Đây là dấu hiệu cần quan tâm để cố vấn xem hồ sơ và hỗ trợ. Không kết luận chỉ từ nhãn;"
    },
    {
      "statement": "Đọc lý do cảnh báo và lịch sử hồ sơ",
      "supported": true,
      "evidence": "hãy đọc lý do cảnh báo, điểm và lịch sử hoạt động."
    },
    {
      "statement": "Mở /advisor/students?status=flagged để xem nhóm cần chú ý",
      "supported": true,
      "evidence": "Mở danh sách tại `/advisor/students?status=flagged`."
    }
  ],
  "semantic_relevance": 0.95
}
```

### 14. /advisor/dashboard

**Câu hỏi:** Tỷ lệ sẵn sàng trên Dashboard Cố vấn nên được hiểu thế nào? A. Xác suất mỗi sinh viên được tuyển dụng. B. Tỷ trọng sinh viên thuộc nhóm trạng thái sẵn sàng, cần xem cùng tổng số và tiêu chí trạng thái. C. Điểm STAR trung bình.

**Đáp án chuẩn:** Đáp án B; Tỷ lệ sẵn sàng là tỷ trọng sinh viên thuộc nhóm trạng thái sẵn sàng trong tập đang thống kê; Xem cùng tổng số sinh viên và tiêu chí trạng thái hiển thị; Tỷ lệ không phải cam kết tuyển dụng.

**Câu trả lời thực tế (grounded_fallback):**

Theo tài liệu hướng dẫn:

**Q: Tỷ lệ sẵn sàng được hiểu thế nào?**

A: Đây là tỷ trọng sinh viên thuộc nhóm trạng thái sẵn sàng trong tập sinh viên đang được thống kê. Xem cùng tổng số và tiêu chí trạng thái hiển thị; tỷ lệ không phải cam kết tuyển dụng.

Nguồn: [Hướng dẫn bảng tổng quan cố vấn](/advisor/dashboard) — Hướng dẫn bảng tổng quan cố vấn > Câu hỏi thường gặp (FAQ)

2. Kiểm tra tổng số sinh viên phụ trách và các thẻ thống kê trạng thái. Đọc tỷ lệ sẵn sàng cùng số lượng sinh viên, không suy diễn từ tỷ lệ khi nhóm chưa có dữ liệu.

Nguồn: [Hướng dẫn bảng tổng quan cố vấn](/advisor/dashboard) — Hướng dẫn bảng tổng quan cố vấn > Các bước thực hiện

- **Thẻ thống kê mức sẵn sàng** (đề xuất): Selector . Hiển thị thống kê trạng thái của nhóm phụ trách.

Nguồn: [Hướng dẫn bảng tổng quan cố vấn](/advisor/dashboard) — Hướng dẫn bảng tổng quan cố vấn > Các nút và thành phần giao diện

**Relevance scorer:** e5_cosine

**Từ khóa thiếu:** 

| Rank | Chunk ID | Route | Context thực sự retrieve |
|---|---|---|---|
| 1 | e9e5a47d25cac10c8c2a155b2bb784e9bfc03a80dd0e1f77b746d8de8881ece2 | /advisor/dashboard | **Q: Tỷ lệ sẵn sàng được hiểu thế nào?**  A: Đây là tỷ trọng sinh viên thuộc nhóm trạng thái sẵn sàng trong tập sinh viên đang được thống kê. Xem cùng tổng số và tiêu chí trạng thái hiển thị; tỷ lệ không phải cam kết tuyển dụng. |
| 2 | a3598f402b6dc9d5d39f720ab55882ade034821435bb0ef6d713086401228a3a | /advisor/dashboard | 2. Kiểm tra tổng số sinh viên phụ trách và các thẻ thống kê trạng thái. Đọc tỷ lệ sẵn sàng cùng số lượng sinh viên, không suy diễn từ tỷ lệ khi nhóm chưa có dữ liệu. |
| 3 | 6c18a1e1f1304872c21f2be40be0e47e9bddadbf499dd6214901c595c1ca0b81 | /advisor/dashboard | - **Thẻ thống kê mức sẵn sàng** (đề xuất): Selector `[data-agent-target="advisor-readiness-summary"]`. Hiển thị thống kê trạng thái của nhóm phụ trách. |

**Context gửi vào generator:**

**Q: Tỷ lệ sẵn sàng được hiểu thế nào?**

A: Đây là tỷ trọng sinh viên thuộc nhóm trạng thái sẵn sàng trong tập sinh viên đang được thống kê. Xem cùng tổng số và tiêu chí trạng thái hiển thị; tỷ lệ không phải cam kết tuyển dụng.

2. Kiểm tra tổng số sinh viên phụ trách và các thẻ thống kê trạng thái. Đọc tỷ lệ sẵn sàng cùng số lượng sinh viên, không suy diễn từ tỷ lệ khi nhóm chưa có dữ liệu.

- **Thẻ thống kê mức sẵn sàng** (đề xuất): Selector . Hiển thị thống kê trạng thái của nhóm phụ trách.

**Bằng chứng chấm điểm:**

```json
{
  "claims": [
    {
      "statement": "Tỷ lệ sẵn sàng là tỷ trọng sinh viên thuộc nhóm trạng thái sẵn sàng trong tập sinh viên đang được thống kê.",
      "supported": true,
      "evidence": "Đây là tỷ trọng sinh viên thuộc nhóm trạng thái sẵn sàng trong tập sinh viên đang được thống kê."
    },
    {
      "statement": "Tỷ lệ sẵn sàng được xem cùng tổng số và tiêu chí trạng thái hiển thị.",
      "supported": true,
      "evidence": "Xem cùng tổng số và tiêu chí trạng thái hiển thị;"
    },
    {
      "statement": "Tỷ lệ sẵn sàng không phải cam kết tuyển dụng.",
      "supported": true,
      "evidence": "tỷ lệ không phải cam kết tuyển dụng."
    },
    {
      "statement": "Có thể kiểm tra tổng số sinh viên phụ trách và các thẻ thống kê trạng thái.",
      "supported": true,
      "evidence": "Kiểm tra tổng số sinh viên phụ trách và các thẻ thống kê trạng thái."
    },
    {
      "statement": "Đọc tỷ lệ sẵn sàng cùng số lượng sinh viên, không suy diễn từ tỷ lệ khi nhóm chưa có dữ liệu.",
      "supported": true,
      "evidence": "Đọc tỷ lệ sẵn sàng cùng số lượng sinh viên, không suy diễn từ tỷ lệ khi nhóm chưa có dữ liệu."
    },
    {
      "statement": "Có thẻ thống kê mức sẵn sàng (đề xuất) với selector, hiển thị thống kê trạng thái của nhóm phụ trách.",
      "supported": true,
      "evidence": "**Thẻ thống kê mức sẵn sàng** (đề xuất): Selector . Hiển thị thống kê trạng thái của nhóm phụ trách."
    }
  ],
  "expected_points": [
    {
      "statement": "Đáp án B",
      "supported": false,
      "evidence": ""
    },
    {
      "statement": "Tỷ lệ sẵn sàng là tỷ trọng sinh viên thuộc nhóm trạng thái sẵn sàng trong tập đang thống kê",
      "supported": true,
      "evidence": "Đây là tỷ trọng sinh viên thuộc nhóm trạng thái sẵn sàng trong tập sinh viên đang được thống kê."
    },
    {
      "statement": "Xem cùng tổng số sinh viên và tiêu chí trạng thái hiển thị",
      "supported": true,
      "evidence": "Xem cùng tổng số và tiêu chí trạng thái hiển thị;"
    },
    {
      "statement": "Tỷ lệ không phải cam kết tuyển dụng",
      "supported": true,
      "evidence": "tỷ lệ không phải cam kết tuyển dụng."
    }
  ],
  "semantic_relevance": 0.95
}
```

### 15. /advisor/dashboard

**Câu hỏi:** Cố vấn muốn tìm báo cáo chờ nhận xét nhưng không mở được nội dung chi tiết, cần làm gì? A. Chỉ nhìn điểm là được quyền đọc CV. B. Đổi sang tài khoản sinh viên bất kỳ. C. Xem nhóm status=pending và cần sinh viên bật quyền chia sẻ nội dung.

**Đáp án chuẩn:** Đáp án C; Bấm Nhận xét báo cáo hoặc mở /advisor/students?status=pending; Cố vấn thấy số liệu tổng hợp của nhóm phụ trách; Nội dung CV hoặc báo cáo chi tiết cần sinh viên bật quyền chia sẻ tại /student/share.

**Câu trả lời thực tế (grounded_fallback):**

Theo tài liệu hướng dẫn:

**Q: Vì sao tôi thấy điểm nhưng không mở được nội dung CV hoặc báo cáo?**

A: Cố vấn thấy số liệu tổng hợp của nhóm phụ trách. Nội dung chi tiết cần sinh viên bật quyền chia sẻ tại `/student/share`.

Nguồn: [Hướng dẫn bảng tổng quan cố vấn](/advisor/dashboard) — Hướng dẫn bảng tổng quan cố vấn > Câu hỏi thường gặp (FAQ)

5. Bấm **Nhận xét báo cáo** hoặc mở `/advisor/students?status=pending` để tìm sinh viên có báo cáo đang chờ góp ý.

Nguồn: [Hướng dẫn bảng tổng quan cố vấn](/advisor/dashboard) — Hướng dẫn bảng tổng quan cố vấn > Các bước thực hiện

6. Chọn sinh viên và mở hồ sơ `/advisor/students/{id}` để xem tiến bộ, nội dung được chia sẻ và thực hiện nhận xét.

Nguồn: [Hướng dẫn bảng tổng quan cố vấn](/advisor/dashboard) — Hướng dẫn bảng tổng quan cố vấn > Các bước thực hiện

**Relevance scorer:** e5_cosine

**Từ khóa thiếu:** 

| Rank | Chunk ID | Route | Context thực sự retrieve |
|---|---|---|---|
| 1 | e41d6f0765ac48f8203760af53307eb671445e09afe14b93580949c0fb6b2841 | /advisor/dashboard | **Q: Vì sao tôi thấy điểm nhưng không mở được nội dung CV hoặc báo cáo?**  A: Cố vấn thấy số liệu tổng hợp của nhóm phụ trách. Nội dung chi tiết cần sinh viên bật quyền chia sẻ tại `/student/share`. |
| 2 | a681ed626b861bf86903d6d763f1635aa061cefc8c75267cc774e580afa32345 | /advisor/dashboard | 5. Bấm **Nhận xét báo cáo** hoặc mở `/advisor/students?status=pending` để tìm sinh viên có báo cáo đang chờ góp ý. |
| 3 | 43414f454d7d36f9ea94cff4546c5faae81681dac9264570c02d5876cb499f82 | /advisor/dashboard | 6. Chọn sinh viên và mở hồ sơ `/advisor/students/{id}` để xem tiến bộ, nội dung được chia sẻ và thực hiện nhận xét. |

**Context gửi vào generator:**

**Q: Vì sao tôi thấy điểm nhưng không mở được nội dung CV hoặc báo cáo?**

A: Cố vấn thấy số liệu tổng hợp của nhóm phụ trách. Nội dung chi tiết cần sinh viên bật quyền chia sẻ tại `/student/share`.

5. Bấm **Nhận xét báo cáo** hoặc mở `/advisor/students?status=pending` để tìm sinh viên có báo cáo đang chờ góp ý.

6. Chọn sinh viên và mở hồ sơ `/advisor/students/{id}` để xem tiến bộ, nội dung được chia sẻ và thực hiện nhận xét.

**Bằng chứng chấm điểm:**

```json
{
  "claims": [
    {
      "statement": "The advisor sees aggregated data of the group they are responsible for.",
      "supported": true,
      "evidence": "Cố vấn thấy số liệu tổng hợp của nhóm phụ trách."
    },
    {
      "statement": "Detailed content requires the student to enable sharing permission at `/student/share`.",
      "supported": true,
      "evidence": "Nội dung chi tiết cần sinh viên bật quyền chia sẻ tại `/student/share`."
    },
    {
      "statement": "To find students with reports pending feedback, press \"Nhận xét báo cáo\" or open `/advisor/students?status=pending`.",
      "supported": true,
      "evidence": "Bấm **Nhận xét báo cáo** hoặc mở `/advisor/students?status=pending` để tìm sinh viên có báo cáo đang chờ góp ý."
    },
    {
      "statement": "To view progress and shared content and make comments, select a student and open their profile at `/advisor/students/{id}`.",
      "supported": true,
      "evidence": "Chọn sinh viên và mở hồ sơ `/advisor/students/{id}` để xem tiến bộ, nội dung được chia sẻ và thực hiện nhận xét."
    }
  ],
  "expected_points": [
    {
      "statement": "Đáp án C",
      "supported": false,
      "evidence": ""
    },
    {
      "statement": "Bấm Nhận xét báo cáo hoặc mở /advisor/students?status=pending",
      "supported": true,
      "evidence": "Bấm **Nhận xét báo cáo** hoặc mở `/advisor/students?status=pending` để tìm sinh viên có báo cáo đang chờ góp ý."
    },
    {
      "statement": "Cố vấn thấy số liệu tổng hợp của nhóm phụ trách",
      "supported": true,
      "evidence": "Cố vấn thấy số liệu tổng hợp của nhóm phụ trách."
    },
    {
      "statement": "Nội dung CV hoặc báo cáo chi tiết cần sinh viên bật quyền chia sẻ tại /student/share",
      "supported": true,
      "evidence": "Nội dung chi tiết cần sinh viên bật quyền chia sẻ tại `/student/share`."
    }
  ],
  "semantic_relevance": 0.98
}
```
