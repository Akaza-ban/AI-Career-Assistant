# Repository Agent Guidelines (AGENTS.md)

> File này là chỉ dẫn cốt lõi (Harness & Instructions) dành cho tất cả AI Coding Agents (Codex, Cursor, Claude Code, Antigravity) khi làm việc trên repository **AI20K-P-131 (Trợ lý nghề nghiệp X / EDU-17)**.

---

## 1. Tổng quan Kiến trúc & Tech Stack

Dự án là một hệ thống **Trợ lý nghề nghiệp cá nhân hoá kết hợp Cố vấn học tập (HITL)**, bao gồm 2 phần chính:

### Backend (`/src`)
- **Ngôn ngữ & Runtime:** Python >= 3.11
- **Web Framework:** FastAPI (RESTful API, SSE streaming, Pydantic v2 schemas)
- **Database:** SQLite (`data/app.db`) qua SQLAlchemy 2.0 (Sync ORM Session qua `SessionLocal` & dependency `get_db`)
- **AI / Agent Framework:** LangChain >= 0.3.0, LangGraph >= 0.2.0, OpenAI/Groq/OpenRouter qua `ChatOpenAI`
- **Vector Store & Retrieval:** ChromaDB (`./data/chroma`, `./data/chroma_assistant`), Sentence Transformers (`multilingual-e5-small`), Rank-BM25
- **Linting & Testing:** Ruff (`ruff.toml`), Pytest (`pytest-asyncio`, `httpx`)

### Frontend (`/frontend`)
- **Framework:** Next.js 16.3.6 (App Router, Server & Client Components)
- **UI Library & CSS:** React 19.2.8, Tailwind CSS v4, Lucide React, Sonner (Toasts)
- **Package Manager:** npm

---

## 2. Quy tắc lập trình & Tiêu chuẩn Code (Coding Standards)

### Backend (Python)
1. **Luôn chạy module từ thư mục gốc (Root):**
   - ĐÚNG: `python -m src.main` hoặc `pytest tests/`
   - SAI: `cd src && python main.py`
2. **Pydantic v2:** Sử dụng syntax Pydantic v2 (`model_dump()`, `model_validate()`, `Field(default=...)`). KHÔNG dùng `.dict()`.
3. **Database Sessions:**
   - Dùng dependency `db: Session = Depends(get_db)` trong API routes.
   - Khi chạy script độc lập (CLI/indexer), dùng context manager hoặc `SessionLocal()` và đảm bảo `try ... finally db.close()`.
4. **Type Annotations:** Viết type hints đầy đủ cho hàm và endpoints (`def func(param: str) -> dict[str, Any]:`).
5. **Config & Secrets:**
   - Mọi cấu hình đọc qua `get_settings()` từ `src/config.py`.
   - KHÔNG hardcode API keys hoặc secrets vào code.
6. **Code Style:** Tuân thủ cấu hình Ruff có sẵn (`ruff check src`, `ruff format src`).

### Frontend (TypeScript / Next.js)
1. **App Router & Client Components:**
   - Các components có tương tác UI, hooks (`useState`, `useEffect`, `useRouter`, `usePathname`) PHẢI có directive `'use client';` ở dòng đầu tiên.
2. **Tailwind CSS v4:** Sử dụng class Tailwind trực tiếp hoặc hàm `cn(...)` từ `frontend/lib/utils.ts`.
3. **Icons:** Sử dụng icon từ `lucide-react`.
4. **Type Safety:** Định nghĩa TypeScript interface / type rõ ràng trong `frontend/types/` hoặc ngay trong component file nếu cục bộ. Không dùng `any` bừa bãi.

---

## 3. Lệnh vận hành & Kiểm thử (Commands)

### Backend
```bash
# Kích hoạt venv
# Windows: .venv\Scripts\activate
# Linux/Mac: source .venv/bin/activate

# Cài đặt thư viện
pip install -r requirements.txt

# Chạy server development
uvicorn src.main:app --reload --port 8000

# Chạy linting
ruff check src tests

# Chạy tests
pytest tests/
```

### Frontend
```bash
cd frontend
# Cài đặt packages
npm install

# Chạy dev server (port 3000)
npm run dev

# Kiểm tra kiểu dữ liệu
npm run typecheck

# Linting
npm run lint
```

---

## 4. Bảo vệ Hệ thống Logging & Hooks (`.codex`, `.agents`)

- Dự án có hệ thống tự động ghi nhật ký AI logs phục vụ chấm điểm (`scripts/log_hook.py`, `.codex/hooks.json`, `.agents/rules/ai-log-hook.md`).
- **NGHIÊM CẤM:** Xoá hoặc sửa đổi file `.codex/hooks.json` và thư mục `.ai-log/`.
- Nếu commit code qua git, tuân thủ conventional commits (`feat: ...`, `fix: ...`, `docs: ...`).

---

## 5. Tài liệu Đặc tả Tính năng Assistant RAG & UI Agent

Khi thực hiện tính năng Chatbot RAG & UI Automation Agent, AI Agent BẮT BUỘC phải đọc các tài liệu đặc tả chi tiết sau trước khi code:
1. **Master Spec & Action Protocol:** `docs/specs/assistant/00_PRD_AND_ACTION_CONTRACT.md`
2. **Day 1 Backend Spec:** `docs/specs/assistant/01_DAY1_BACKEND_RAG_SPEC.md`
3. **Day 2 Frontend Chat Widget Spec:** `docs/specs/assistant/02_DAY2_FRONTEND_CHAT_SPEC.md`
4. **Day 3 UI Agent Action Execution Spec:** `docs/specs/assistant/03_DAY3_UI_AGENT_ACTIONS_SPEC.md`
5. **Prompt Task Runner:** `docs/specs/assistant/CODEX_PROMPTS.md`
