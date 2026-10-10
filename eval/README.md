# RAG Evaluation

Bộ chuẩn gồm 15 câu trắc nghiệm A/B/C bằng tiếng Việt, mỗi nhóm trang có 3 câu:
CV, Gap Analysis, Mock Interview, History và Dashboard Cố vấn. Đáp án và từ khóa
bám sát `docs/user-guide/`. Các ý trong `expected_answer` được phân cách bằng `;`
để Completeness có mẫu số cố định.

Chạy từ thư mục gốc, trong môi trường Python đã cài `requirements.txt`:

```powershell
.venv\Scripts\Activate.ps1
python -m eval.run_rag_eval
```

Nếu chưa có index Assistant, tạo index trước:

```powershell
python -m src.services.assistant.indexer
```

Script đọc cấu hình qua `get_settings()`, gọi `AssistantAgent.respond()` với role
và route của mỗi mẫu, ghi lại chính lượt retrieval trong agent. Không cần khởi động
FastAPI, không ghi lịch sử chat vào database và không thực thi UI actions.
Script dùng index hiện có và không tự xây dựng lại index.
Scorer tự retry tối đa 3 lần khi structured output không hợp lệ hoặc lỗi tạm thời;
lỗi xác thực và model không tồn tại được báo ngay.

| Metric | Cách đo |
|---|---|
| Faithfulness | LLM tách các ý thực tế trong câu trả lời và kiểm tra từng ý dựa trên snippets thực sự gửi vào generator. Tỷ lệ ý có bằng chứng hỗ trợ. Trích dẫn phải xuất hiện trong context mới được tính. |
| Relevance | Cosine similarity giữa embedding E5 của question và answer, giới hạn trong [0, 1]. Nếu embedding của ứng dụng chuyển sang hashing, dùng đánh giá ngữ nghĩa của LLM; không gọi hashing là semantic similarity. |
| Completeness | LLM kiểm tra từng ý chuẩn được câu trả lời bao phủ đúng hay chưa. Trích dẫn phải có trong câu trả lời thực tế. |
| Context Recall | Tỷ lệ từ khóa chuẩn xuất hiện trong nội dung top chunks thực tế, chuẩn hóa Unicode, hoa/thường và dấu gạch. Không tính từ khóa chỉ nằm trong metadata. |
| Context Precision | Nghịch đảo thứ hạng chunk đúng `expected_route` có nhiều từ khóa chuẩn nhất. Đồng hạng ưu tiên chunk đứng trước. Top 1 = 1, top 2 = 0.5, top 3 = 1/3, không có bằng chứng = 0. |

Context Precision ở đây là reciprocal rank theo yêu cầu, không phải precision@k.
Cột Coverage cho biết chunk tốt nhất chứa bao nhiêu phần của bộ từ khóa.
Retriever hiện tại áp dụng ngưỡng relevance và giới hạn tối đa 3 citation chunks,
kể cả khi `assistant_top_k` bằng 5. Báo cáo phản ánh hành vi thực tế này.

Các điểm là chỉ báo tự động: cosine không phát hiện mâu thuẫn và LLM judge có thể
chấm khác nhau giữa các lần chạy. Báo cáo lưu câu trả lời, context, danh sách ý và
bằng chứng để kiểm tra lại. Mẫu trắc nghiệm gửi cả phương án nhiễu vào pipeline.

Kết quả được in thành bảng Markdown và lưu tại `eval/eval_results.md`. Báo cáo ghi
chế độ sinh câu trả lời (`llm`, fallback hoặc từ chối đầu vào), model thực tế và số mẫu có điểm của
từng metric. Khi scorer lỗi, điểm là `N/A`; script trả exit code 1 và vẫn lưu báo cáo.
Không thay điểm thiếu bằng 0 hoặc dùng đáp án chuẩn làm câu trả lời giả.

Có thể đổi dataset, nơi lưu báo cáo và giới hạn retrieval:

```powershell
python -m eval.run_rag_eval --dataset eval/rag_golden_dataset.json --output eval/eval_results.md --top-k 3
python -m pytest eval/test_run_rag_eval.py -q
python -m ruff check eval
```

Nếu provider báo model không khả dụng, chọn model mà endpoint của tài khoản hỗ trợ.
Có thể ghi đè `MODEL_NAME` cho riêng terminal chạy thử; không cần sửa `.env`:

```powershell
$env:MODEL_NAME = 'openai/gpt-oss-20b'
python -m eval.run_rag_eval
Remove-Item Env:MODEL_NAME
```

Có thể chọn riêng model chấm điểm và giãn nhịp gọi API khi bị rate limit, giữ nguyên
generator được cấu hình của ứng dụng:

```powershell
python -m eval.run_rag_eval --judge-model openai/gpt-oss-120b --request-delay 15
```

Lần chạy thử trong repository dùng judge trên sau khi truy vấn endpoint Groq xác
nhận khả dụng. Generator mặc định `llama-3.3-70b-versatile` trả lỗi
`OpenAIModelNotFoundError` trong môi trường chạy thử, nên kết quả đánh giá câu trả
lời dự phòng của ứng dụng. Timeout được tăng cho riêng tiến trình chạy thử bằng
`ASSISTANT_LLM_TIMEOUT_SECONDS=120` để có thời gian retry khi bị rate limit.
Hãy kiểm tra lại quyền truy cập model của tài khoản khi chạy ở môi trường khác.
