# Codex Task Execution Prompts (Prompt Runner)

> Tài liệu này chứa toàn bộ các prompt mẫu chuẩn hóa, được thiết kế để bạn copy và paste trực tiếp cho **OpenAI Codex / Codex CLI / Cursor / Coding Agent** thực thi từng bước mà không lo bị hallucination hay lạc đề.

---

## 📌 Hướng dẫn sử dụng cho Codex

1. Đảm bảo file [AGENTS.md](file:///d:/DATA/IT/AIA/P-131/AGENTS.md) tại thư mục gốc repository đang tồn tại.
2. Cung cấp prompt cho Codex theo thứ tự từ **Giai đoạn 1 (Day 1)** đến **Giai đoạn 3 (Day 3)**.
3. Sau mỗi prompt, yêu cầu Codex chạy lệnh kiểm thử (test/verification) trước khi chuyển sang prompt tiếp theo.

---

## 🟢 GIAI ĐOẠN 1: BACKEND RAG & RETRIEVAL (DAY 1)

### Prompt 1.1: Dependencies & Assistant Config & Database Models
```text
Bạn là AI Developer làm việc trên repository này. Hãy tuân thủ nghiêm ngặt các quy tắc trong AGENTS.md.
Nhiệm vụ: Thực hiện các Task 1.1, Task 1.2 và Task 1.3 theo tài liệu đặc tả `docs/specs/assistant/01_DAY1_BACKEND_RAG_SPEC.md`:

1. Cập nhật `requirements.txt`: Bổ sung `chromadb>=0.5.0`, `sentence-transformers>=3.0.0`, `rank-bm25>=0.2.2`.
2. Cập nhật `src/config.py`: Bổ sung các settings cấu hình cho assistant:
   - assistant_chroma_collection: str = "assistant_knowledge"
   - assistant_chroma_persist_dir: str = "./data/chroma_assistant"
   - assistant_embedding_model: str = "intfloat/multilingual-e5-small"
   - assistant_embedding_device: str = "cpu"
   - assistant_docs_dir: str = "./docs/user-guide"
   - assistant_top_k: int = 5
3. Cập nhật `src/db/models.py`: Bổ sung 4 ORM model classes với SQLAlchemy 2.0:
   - `AssistantConversation`
   - `AssistantTurn`
   - `AgentActionLog`
   - `AssistantFeedback`
   Cập nhật `init_db()` trong `src/db/database.py` nếu cần để đảm bảo các bảng này tự động được tạo khi khởi động.

Sau khi hoàn tất, hãy chạy lệnh kiểm tra:
python -c "from src.config import get_settings; from src.db.database import init_db; init_db(); print('DB & Settings OK')"
```

---

### Prompt 1.2: Knowledge Base Seed Documents
```text
Dựa trên tài liệu đặc tả `docs/specs/assistant/01_DAY1_BACKEND_RAG_SPEC.md` (Task 1.4), hãy tạo tối thiểu 7 file tài liệu Markdown hướng dẫn sử dụng trong thư mục `docs/user-guide/`:
1. `docs/user-guide/student/cv_upload.md`
2. `docs/user-guide/student/gap_analysis.md`
3. `docs/user-guide/student/mock_interview.md`
4. `docs/user-guide/student/history.md`
5. `docs/user-guide/student/sharing.md`
6. `docs/user-guide/advisor/dashboard.md`
7. `docs/user-guide/advisor/student_review.md`

Yêu cầu:
- Mỗi file phải có YAML Frontmatter chuẩn với `route`, `role`, `title`, `tags`.
- Có đầy đủ các mục: Tổng quan, Các bước thực hiện, Các nút và thành phần giao diện (kèm selector `data-agent-target`), và Câu hỏi thường gặp (FAQ).
```

---

### Prompt 1.3: Chunker, Embedding & Hybrid Search (ChromaDB + BM25)
```text
Thực hiện Task 1.5, Task 1.6 và Task 1.7 trong `docs/specs/assistant/01_DAY1_BACKEND_RAG_SPEC.md`:

1. Tạo `src/services/assistant/embedding.py`: Triển khai `AssistantEmbeddingService` sử dụng model `multilingual-e5-small` qua `sentence-transformers` với prefix `query: ` và `passage: `.
2. Tạo `src/services/assistant/chunker.py`: Triển khai `MarkdownDocChunker` để bóc tách frontmatter và chia nhỏ Markdown theo cấu trúc heading, trích xuất được `selector` từ các mục mô tả nút bấm.
3. Tạo `src/services/assistant/vector_store.py`: Triển khai `AssistantVectorStore` lưu trữ embedding vào ChromaDB tại `./data/chroma_assistant`.
4. Tạo `src/services/assistant/hybrid_search.py`: Triển khai `AssistantHybridRetriever` kết hợp ChromaDB và `rank_bm25` bằng thuật toán Reciprocal Rank Fusion (RRF).
5. Tạo `src/services/assistant/indexer.py`: Viết script CLI quét `docs/user-guide/**/*.md`, chunking, và nạp vào vector store + bm25 index.

Sau khi hoàn thành, hãy chạy lệnh build index và xác nhận:
python -m src.services.assistant.indexer
```

---

### Prompt 1.4: LangGraph Agent Workflow, FastAPI Router & Tests
```text
Thực hiện Task 1.8 và Task 1.9 trong `docs/specs/assistant/01_DAY1_BACKEND_RAG_SPEC.md`:

1. Tạo `src/services/assistant/agent.py`:
   - Xây dựng Agent xử lý hội thoại (LangGraph hoặc chain) phân loại ý định (QA, ACTION, HYBRID).
   - Truy xuất thông tin từ `AssistantHybridRetriever`.
   - Sinh câu trả lời kèm danh sách `actions` tuân thủ strict Action Protocol schema trong `docs/specs/assistant/00_PRD_AND_ACTION_CONTRACT.md`.
2. Tạo `src/api/assistant.py` và đăng ký router vào `src/api/routes.py`:
   - `POST /api/v1/assistant/chat`
   - `POST /api/v1/assistant/action/confirm`
   - `POST /api/v1/assistant/feedback`
   - `POST /api/v1/assistant/reindex`
3. Viết unit & integration tests trong `tests/test_assistant_rag.py`.

Sau khi hoàn tất, hãy chạy kiểm thử:
pytest tests/test_assistant_rag.py -v
```

---

## 🟡 GIAI ĐOẠN 2: FRONTEND CHAT WIDGET & MEMORY (DAY 2)

### Prompt 2.1: Types, API Client & State Provider
```text
Chuyển sang thư mục `frontend/`. Hãy đọc kỹ `docs/specs/assistant/02_DAY2_FRONTEND_CHAT_SPEC.md` và `AGENTS.md`.
Thực hiện Task 2.1 và Task 2.2:

1. Tạo `frontend/types/assistant.ts` định nghĩa toàn bộ interface: `AgentAction`, `ActionType`, `ChatMessage`, `ClientPageContext`, `ChatRequestPayload`, `ChatResponsePayload`.
2. Tạo `frontend/lib/assistant-api.ts` chứa các hàm gọi API sang Backend FastAPI (`/api/v1/assistant/*`).
3. Tạo `frontend/components/assistant/assistant-provider.tsx` cung cấp `AssistantContext`:
   - Quản lý trạng thái mở/đóng widget, tin nhắn, loading state, active action.
   - Tự động lấy `pathname` qua `usePathname()` và detect `user_role`.
   - Cung cấp hàm `sendMessage`, `clearChat`, `toggleChat`.

Sau khi hoàn thành, chạy kiểm tra kiểu dữ liệu:
npm run typecheck
```

---

### Prompt 2.2: Chat Trigger Button & Chat Panel Component
```text
Thực hiện Task 2.3, 2.4 và 2.5 trong `docs/specs/assistant/02_DAY2_FRONTEND_CHAT_SPEC.md`:

1. Tạo `frontend/components/assistant/chat-trigger.tsx`:
   - Nút nổi ở góc phải dưới (`fixed bottom-6 right-6 z-40`), có animation gradient mượt mà, hỗ trợ phím tắt `Ctrl + K`.
2. Tạo `frontend/components/assistant/chat-panel.tsx`:
   - Hộp thoại chat kích thước `420px x 600px` với header, message list, suggestion chips, input textarea tự dãn nở.
   - Render Markdown cho tin nhắn của bot, component hiển thị nguồn tài liệu (`SourceAccordion`), và các badge hành động.
3. Tích hợp `AssistantProvider`, `ChatTrigger`, `ChatPanel` vào `frontend/app/layout.tsx`.

Sau khi hoàn tất, kiểm tra linting và type:
npm run typecheck && npm run lint
```

---

## 🔴 GIAI ĐOẠN 3: UI AGENT ACTIONS & DOM HIGHLIGHTER (DAY 3)

### Prompt 3.1: DOM Highlighter, Action Dispatcher & Data Attributes
```text
Đọc tài liệu đặc tả `docs/specs/assistant/03_DAY3_UI_AGENT_ACTIONS_SPEC.md`.
Thực hiện Task 3.1, Task 3.2 và Task 3.4:

1. Tạo `frontend/components/assistant/element-highlighter.tsx`: Quản lý spotlight overlay bao quanh phần tử DOM có selector chỉ định, tự cuộn tới màn hình và tự tắt sau 5s.
2. Cập nhật các trang chính (`/student/cv`, `/student/analysis`, `/student/interview`, `/student/history`) để gắn thuộc tính `data-agent-target` vào các nút bấm và form quan trọng.
3. Tạo `frontend/lib/action-dispatcher.ts`: Xử lý 8 hành động chuẩn (`NAVIGATE_PAGE`, `HIGHLIGHT_ELEMENT`, `FILL_FILTER`, `OPEN_MODAL`, `SCROLL_TO`, `RESET_VIEW`...) và báo cáo trạng thái `executed` về backend.

Sau khi hoàn tất, chạy:
npm run typecheck
```

---

### Prompt 3.2: Human-in-the-Loop Confirmation Dialog & E2E Polish
```text
Thực hiện Task 3.3 và hoàn thiện Day 3 theo `docs/specs/assistant/03_DAY3_UI_AGENT_ACTIONS_SPEC.md`:

1. Tạo `frontend/components/assistant/action-confirmation-dialog.tsx`:
   - Modal hiển thị khi có action `requires_confirmation: true` (ví dụ `START_ANALYSIS`).
   - Có 2 nút "Đồng ý" và "Huỷ bỏ", xử lý xác nhận và gửi trạng thái `confirmed`/`rejected` về backend.
2. Kết nối `ActionConfirmationDialog` và `ElementHighlighter` vào `AssistantProvider`.
3. Kiểm tra kịch bản hoàn chỉnh: Khi user chat "Mở trang phân tích CV và chỉ tôi nút bắt đầu", bot vừa chuyển trang vừa làm sáng nút `btn-start-analysis`.

Chạy toàn bộ kiểm thử để nghiệm thu:
cd frontend && npm run typecheck && npm run build
```
