# SPEC-01: Day 1 — Backend RAG & Retrieval Pipeline

> **Mục tiêu Ngày 1:** Xây dựng hoàn chỉnh Backend RAG Pipeline end-to-end. Có thể test qua `curl` và `pytest`, nhận về câu trả lời chính xác kèm trích dẫn nguồn và danh sách Actions được sinh ra từ LLM.

---

## Task 1.1: Thêm Dependencies

### File mục tiêu: `requirements.txt`
Bổ sung các packages sau vào `requirements.txt` nếu chưa có:
```text
chromadb>=0.5.0
sentence-transformers>=3.0.0
rank-bm25>=0.2.2
```
*Lệnh chạy:*
```bash
pip install -r requirements.txt
```
*Definition of Done (DoD):*
Chạy lệnh kiểm tra sau không báo lỗi:
```bash
python -c "import chromadb, sentence_transformers, rank_bm25; print('Deps OK')"
```

---

## Task 1.2: Cấu hình Assistant Settings

### File mục tiêu: `src/config.py`
Thêm các trường cấu hình sau vào class `Settings`:
```python
# Assistant & Knowledge Base RAG
assistant_chroma_collection: str = "assistant_knowledge"
assistant_chroma_persist_dir: str = "./data/chroma_assistant"
assistant_embedding_model: str = "intfloat/multilingual-e5-small"
assistant_embedding_device: str = "cpu"
assistant_docs_dir: str = "./docs/user-guide"
assistant_top_k: int = 5
```
*DoD:*
`python -c "from src.config import get_settings; print(get_settings().assistant_chroma_collection)"` in ra `assistant_knowledge`.

---

## Task 1.3: Database Models & Tables

### File mục tiêu: `src/db/models.py`
Thêm 4 ORM classes vào `src/db/models.py`:
1. `AssistantConversation`:
   - `id: str` (UUID string, primary_key=True)
   - `user_id: str` (nullable=True, index=True)
   - `role: str` (default="student")
   - `title: str` (default="Cuộc trò chuyện mới")
   - `created_at: datetime` (default=func.now())
   - `updated_at: datetime` (default=func.now(), onupdate=func.now())
   - Quan hệ: `turns = relationship("AssistantTurn", back_populates="conversation", cascade="all, delete-orphan")`
2. `AssistantTurn`:
   - `id: str` (UUID string, primary_key=True)
   - `conversation_id: str` (ForeignKey("assistant_conversations.id", ondelete="CASCADE"), index=True)
   - `user_message: str`
   - `assistant_message: str`
   - `intent: str` (e.g. "qa", "action", "hybrid")
   - `context_json: dict | list` (JSON column)
   - `sources_json: dict | list` (JSON column)
   - `created_at: datetime` (default=func.now())
   - Quan hệ: `actions = relationship("AgentActionLog", back_populates="turn", cascade="all, delete-orphan")`
3. `AgentActionLog`:
   - `id: str` (UUID string, primary_key=True)
   - `turn_id: str` (ForeignKey("assistant_turns.id", ondelete="CASCADE"), index=True)
   - `action_type: str`
   - `params_json: dict` (JSON column)
   - `status: str` (default="pending", values: "pending", "confirmed", "executed", "rejected", "failed")
   - `error_message: str | None` (nullable=True)
   - `client_executed_at: datetime | None` (nullable=True)
   - `created_at: datetime` (default=func.now())
4. `AssistantFeedback`:
   - `id: str` (UUID string, primary_key=True)
   - `turn_id: str` (ForeignKey("assistant_turns.id", ondelete="CASCADE"), index=True)
   - `rating: int` (1 hoặc -1)
   - `comment: str | None` (nullable=True)
   - `created_at: datetime` (default=func.now())

*DoD:*
Khởi động app hoặc chạy `python -c "from src.db.database import init_db; init_db()"` -> không lỗi, các bảng xuất hiện trong SQLite.

---

## Task 1.4: Knowledge Base Seed Documents

### Thư mục: `docs/user-guide/**/*.md`
Tạo tối thiểu 6-8 files tài liệu Markdown hướng dẫn sử dụng với Frontmatter chuẩn:

1. `docs/user-guide/student/cv_upload.md`: Hướng dẫn tải lên và quản lý CV, nút "Tải lên CV" (`[data-agent-target="btn-upload-cv"]`), các định dạng PDF/DOCX.
2. `docs/user-guide/student/gap_analysis.md`: Hướng dẫn phân tích khoảng cách CV-JD, nút "Bắt đầu phân tích" (`[data-agent-target="btn-start-analysis"]`), ý nghĩa Match Score (0-100%).
3. `docs/user-guide/student/mock_interview.md`: Hướng dẫn phỏng vấn thử STAR, nút "Bắt đầu phỏng vấn" (`[data-agent-target="btn-start-interview"]`), các vòng câu hỏi.
4. `docs/user-guide/student/history.md`: Xem lại lịch sử phỏng vấn và phân tích, bộ lọc theo ngày, chi tiết từng phiên.
5. `docs/user-guide/student/sharing.md`: Chia sẻ kết quả cho Cố vấn học tập (Advisor).
6. `docs/user-guide/advisor/dashboard.md`: Hướng dẫn xem thống kê tỷ lệ sẵn sàng, danh sách sinh viên nguy cơ cao (at-risk).
7. `docs/user-guide/advisor/student_review.md`: Duyệt và để lại nhận xét (Feedback/Note) cho sinh viên.

*Mỗi file phải chứa cấu trúc Frontmatter chuẩn:*
```markdown
---
route: /student/analysis
role: student
title: Hướng dẫn Phân tích khoảng cách CV - JD
tags: [cv, jd, analysis, match-score]
---

# Hướng dẫn Phân tích khoảng cách CV - JD

## Tổng quan
...
## Các thành phần giao diện & Nút bấm
- **Nút "Bắt đầu phân tích"**: Selector `[data-agent-target="btn-start-analysis"]`, nằm ở thanh công cụ phía trên...
...
## Câu hỏi thường gặp (FAQ)
**Q: Match score 70% có ý nghĩa gì?**
A: Nghĩa là CV của bạn đáp ứng 70% các kỹ năng yêu cầu trong JD...
```

*DoD:* Có ít nhất 7 files Markdown trong `docs/user-guide/`.

---

## Task 1.5: Embedding Service & Hierarchical Chunker

### File: `src/services/assistant/embedding.py`
Tạo singleton class `AssistantEmbeddingService`:
- Sử dụng `sentence_transformers.SentenceTransformer("intfloat/multilingual-e5-small")`.
- `embed_query(query: str) -> list[float]`: Tự động thêm prefix `"query: "`.
- `embed_documents(texts: list[str]) -> list[list[float]]`: Tự động thêm prefix `"passage: "`.
- Hỗ trợ fallback: Nếu tải model offline hoặc lỗi, fallback sang phương pháp hashing hoặc default embedding an toàn.

### File: `src/services/assistant/chunker.py`
Tạo class `MarkdownDocChunker`:
- Nhận nội dung Markdown + parse Frontmatter (route, role, title, tags).
- Phân tích cây cấu trúc (Heading H1, H2, H3, FAQ list, UI Elements list).
- Chia nhỏ thành các chunks có ý nghĩa ngữ nghĩa (200 - 500 ký tự) kèm metadata phong phú:
  ```python
  class DocChunk(BaseModel):
      chunk_id: str
      content: str
      route: str
      role: str
      title: str
      section: str
      selector: str | None = None
  ```
- Nếu chunk thuộc mục UI element (`- **Nút X**: Selector ...`), tự động trích xuất `selector` vào metadata!

*DoD:*
Test thử 1 file markdown -> sinh ra danh sách `DocChunk` có `selector` và `route` chuẩn xác.

---

## Task 1.6: Vector Store & Hybrid Search (BM25 + ChromaDB)

### File: `src/services/assistant/vector_store.py`
Class `AssistantVectorStore`:
- Quản lý ChromaDB Client tại `settings.assistant_chroma_persist_dir`.
- Collection: `assistant_knowledge`.
- `add_chunks(chunks: list[DocChunk]) -> None`.
- `search_vector(query: str, role: str, top_k: int = 5) -> list[dict]`: Lọc metadata theo `role in [role, "all"]`.

### File: `src/services/assistant/hybrid_search.py`
Class `AssistantHybridRetriever`:
- Kết hợp ChromaDB Dense Vector Search và `rank_bm25.BM25Okapi` Sparse Search.
- Sử dụng **Reciprocal Rank Fusion (RRF)**:
  $$RRF\_Score(d) = \frac{1}{60 + rank_{vector}(d)} + \frac{1}{60 + rank_{bm25}(d)}$$
- Trả về danh sách Top-K chunks phù hợp nhất kèm điểm số tương đồng.

---

## Task 1.7: Indexer CLI

### File: `src/services/assistant/indexer.py`
- Hàm `build_assistant_index(docs_dir: str = None) -> int`:
  1. Quét toàn bộ `*.md` trong `docs/user-guide/`.
  2. Parse & chunk từng file.
  3. Xoá index cũ và nạp lại vào ChromaDB + lưu BM25 corpus.
  4. In báo cáo số file và số chunks đã index.
- Cho phép chạy độc lập qua CLI:
  ```bash
  python -m src.services.assistant.indexer
  ```
*DoD:* Chạy CLI trên -> in ra "Successfully indexed X chunks from Y files".

---

## Task 1.8: Assistant Orchestrator (LangGraph / LangChain)

### File: `src/services/assistant/agent.py`
Xây dựng workflow xử lý câu hỏi người dùng:
1. **Phân loại Ý định (Intent Classification):**
   - `QA`: Người dùng hỏi thông tin, vị trí nút, định nghĩa, hướng dẫn.
   - `ACTION`: Người dùng ra lệnh thao tác trang ("hãy mở bài phỏng vấn gần nhất", "chuyển sang trang CV").
   - `HYBRID`: Vừa hỏi vừa yêu cầu mở trang ("Làm sao phỏng vấn thử? Mở giúp tôi luôn").
2. **Retrieval Node:**
   - Truy vấn tài liệu qua `AssistantHybridRetriever` với `user_role` và `current_url`.
3. **Generation & Action Extraction Node:**
   - Sử dụng LLM (`get_settings().get_chat_model()`).
   - System prompt hướng dẫn định dạng trả về: Markdown giải thích tiếng Việt thân thiện, rõ ràng + mảng `actions` tuân thủ strict JSON schema của Action Protocol.
   - Ép kiểu output qua Pydantic schema `AssistantResponse`.

---

## Task 1.9: FastAPI Endpoints & Integration Tests

### File: `src/api/assistant.py` & Đăng ký trong `src/api/routes.py`
Endpoints:
1. `POST /api/v1/assistant/chat`:
   - Input: `ChatRequest` (message, conversation_id, context).
   - Output: `ChatResponse` (conversation_id, turn_id, message, intent, actions, sources).
2. `POST /api/v1/assistant/action/confirm`:
   - Ghi nhận trạng thái thực thi action từ client (`action_id`, `status: "executed" | "rejected" | "failed"`).
3. `POST /api/v1/assistant/feedback`:
   - Ghi nhận đánh giá 1 / -1 cho turn.
4. `POST /api/v1/assistant/reindex`:
   - Trigger nạp lại knowledge base.

### File: `tests/test_assistant_rag.py`
Bộ test kiểm tra:
1. Indexer nạp thành công tài liệu.
2. Search tìm đúng chunk khi hỏi về "nút tải CV".
3. API `/api/v1/assistant/chat` trả về câu trả lời có chứa `actions` khi ra lệnh "chuyển sang trang phân tích".

*DoD kết thúc Ngày 1:*
Chạy lệnh sau pass toàn bộ:
```bash
pytest tests/test_assistant_rag.py -v
```
