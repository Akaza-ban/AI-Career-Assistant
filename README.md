# Trợ lý Nghề nghiệp X — P-131 (EDU-17)

> **Sinh viên gặp khó khăn khi tự đánh giá CV và chuẩn bị phỏng vấn** → Hệ thống AI phân tích khoảng cách CV–JD, tối ưu CV, luyện phỏng vấn STAR và kết nối cố vấn theo vòng lặp Human-in-the-Loop.

---

## Mục lục

- [Vấn đề](#vấn-đề)
- [Giải pháp](#giải-pháp)
- [Nguyên tắc sản phẩm](#nguyên-tắc-sản-phẩm)
- [Tính năng chính](#tính-năng-chính)
- [Tech Stack](#tech-stack)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cài đặt nhanh](#cài-đặt-nhanh)
- [Biến môi trường](#biến-môi-trường)
- [Chạy ứng dụng](#chạy-ứng-dụng)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [API — Ví dụ gọi thử](#api--ví-dụ-gọi-thử)
- [Chạy bằng Docker](#chạy-bằng-docker)
- [Kiểm thử](#kiểm-thử)
- [AI Logging & LangSmith](#ai-logging--langsmith)
- [Checklist Deliverables](#checklist-deliverables)
- [Đội nhóm](#đội-nhóm)
- [Tài liệu liên quan](#tài-liệu-liên-quan)

---

## Vấn đề

Sinh viên năm cuối và fresher thường:

- **Không biết CV của mình thiếu gì** so với JD cụ thể — phải tự đọc, tự so, mất 2–4 giờ mỗi lần.
- **Không có môi trường luyện phỏng vấn** sát thực tế: các công cụ hiện tại không chấm điểm theo chuẩn STAR, không cho phản hồi chi tiết.
- **Thiếu kênh phản hồi từ cố vấn** — cố vấn không có dashboard để theo dõi tiến bộ, không thể nhận xét asynchronously.

## Giải pháp

**Trợ lý Nghề nghiệp X** là web app 2 vai:

| Vai | Giao diện | Chức năng |
|---|---|---|
| **Sinh viên** | `/student/*` | Upload CV, phân tích Gap, tối ưu CV, luyện phỏng vấn, chia sẻ với cố vấn |
| **Cố vấn** | `/advisor/*` | Dashboard tổng quan, xem hồ sơ SV, nhận xét phỏng vấn, nhắn tin |

---

## Nguyên tắc sản phẩm

- Gợi ý tối ưu CV chỉ dựa trên thông tin đã có; hệ thống không tự tạo kỹ năng, kinh nghiệm, thành tích hoặc số liệu.
- Sinh viên là người quyết định cuối cùng và có thể **Accept**, **Reject** hoặc **Edit** mọi đề xuất trước khi áp dụng.
- Cố vấn chỉ được truy cập dữ liệu của sinh viên được phân công và can thiệp khi cần theo mô hình Human-in-the-Loop.

Chi tiết phạm vi và guardrail được mô tả trong [Product Requirements Document](docs/PRD.md).

---

## Tính năng chính

### Dành cho Sinh viên

| Tính năng | Mô tả |
|---|---|
| **Gap Analysis** (US-SV-02) | Upload CV (PDF/DOCX, PDF scan được đọc bằng OCR) + chọn JD → AI phân tích khoảng cách, chấm Match Score 0–100, trả về danh sách kỹ năng thiếu + bằng chứng từ CV gốc, kèm link lộ trình học trên roadmap.sh cho kỹ năng CNTT |
| **CV Optimizer** (US-SV-03) | Gợi ý viết lại từng đoạn CV (accept / edit / reject), xuất file DOCX, audit trail đầy đủ |
| **Kỹ năng đang học** (US-SV-05) | Đánh dấu kỹ năng đang phát triển, hiển thị riêng trong CV xuất |
| **Mock Interview** (US-SV-04) | 4 câu hỏi do AI sinh theo vị trí (theo CV hoặc không dùng CV), trả lời bằng cách gõ hoặc nói (Groq Whisper), bộ đếm giờ, chấm điểm S/T/A/R 0–5, báo cáo chi tiết |
| **Lịch sử & Tiến bộ** | Xem lại tất cả lượt phân tích, phỏng vấn, biểu đồ tiến bộ theo thời gian |
| **Chia sẻ với Cố vấn** | Bật/tắt chia sẻ CV và báo cáo phỏng vấn per-item |
| **Phản hồi AI** (US-SV-06) | Thumb up/down + CSAT 1–5 sao cho từng gợi ý |

### Dành cho Cố vấn

| Tính năng | Mô tả |
|---|---|
| **Dashboard Tổng quan** | Số liệu tổng hợp cohort: tổng SV, trung bình match score, lượt phỏng vấn |
| **Danh sách Sinh viên** | Lọc theo tên, ngành, khoá; xem trạng thái từng SV |
| **Hồ sơ Sinh viên** | Xem CV được chia sẻ, báo cáo phỏng vấn, viết nhận xét HITL |
| **Ghi chú nội bộ** | Ghi chú riêng (SV không thấy), gắn tag hành vi/kỹ năng, ghim |
| **Nhắn tin** | Chat text với SV được phân công |

---

## Tech Stack

| Lớp | Công nghệ | Phiên bản |
|---|---|---|
| **Frontend** | Next.js (App Router) + TypeScript | 16.x / React 19 |
| **Styling** | Tailwind CSS v4 + shadcn/ui + Base UI | — |
| **Backend** | FastAPI + Uvicorn | 0.115+ |
| **ORM** | SQLAlchemy 2.0 | — |
| **Database** | SQLite (dev) | `./data/app.db` |
| **Vector Store** | ChromaDB | `./data/chroma` |
| **AI Orchestration** | LangGraph (StateGraph) | 0.2+ |
| **LLM Client** | langchain-openai (ChatOpenAI) | 0.3+ |
| **LLM Providers** | Groq / OpenRouter / OpenAI | configurable |
| **Observability** | LangSmith | — |
| **CV Parsing** | pypdf + python-docx | — |
| **Lint / Format** | ruff | 0.8+ |
| **Test** | pytest + pytest-asyncio + httpx | — |
| **Container** | Docker + Docker Compose | — |
| **CI** | GitHub Actions | — |

---

## Yêu cầu hệ thống

- **Python** 3.11
- **Node.js** 18+ và npm
- **Git**
- **Docker** (tùy chọn, chỉ cần nếu chạy bằng Docker Compose)
- API key của ít nhất một LLM provider: [Groq](https://console.groq.com/), [OpenRouter](https://openrouter.ai/), hoặc [OpenAI](https://platform.openai.com/)

---

## Cài đặt nhanh

### Backend (FastAPI)

```bash
# 1. Tạo và kích hoạt virtual environment
python3.11 -m venv .venv
source .venv/bin/activate          # Linux / macOS
.\.venv\Scripts\Activate.ps1       # Windows PowerShell

# 2. Cài thư viện Python
pip install -r requirements.txt

# 3. Sao chép file biến môi trường
cp .env.example .env
# Mở .env và điền API key (xem phần Biến môi trường bên dưới)

# 4. Khởi động backend
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

Swagger UI sẽ mở tại: **http://localhost:8000/docs**

### Frontend (Next.js)

```bash
cd frontend

# 1. Cài thư viện Node
npm install

# 2. Sao chép biến môi trường frontend
cp .env.example .env.local
# Điền NEXT_PUBLIC_API_URL nếu backend chạy ở cổng khác

# 3. Khởi động dev server
npm run dev
```

Giao diện sẽ mở tại: **http://localhost:3000**

> **Gợi ý:** Mở 2 terminal riêng — một cho backend, một cho frontend.

---

## Biến môi trường

### Backend — `.env` (copy từ `.env.example`)

#### LLM Provider (bắt buộc — điền ít nhất 1 key)

| Biến | Ví dụ | Mô tả |
|---|---|---|
| `LLM_PROVIDER` | `groq` | Provider đang dùng: `groq` / `openrouter` / `openai` / `deepseek` |
| `GROQ_API_KEY` | `gsk_xxx` | API key từ [console.groq.com](https://console.groq.com/) |
| `OPENROUTER_API_KEY` | `sk-or-v1-xxx` | API key từ [openrouter.ai](https://openrouter.ai/) |
| `OPENAI_API_KEY` | `sk-xxx` | API key từ [platform.openai.com](https://platform.openai.com/) |
| `DEEPSEEK_API_KEY` | `sk-xxx` | API key từ [platform.deepseek.com](https://platform.deepseek.com/) |
| `MODEL_NAME` | `llama-3.3-70b-versatile` | Tên model (xem gợi ý bên dưới) |
| `LLM_TEMPERATURE` | `0.7` | Độ ngẫu nhiên (0.0 – 2.0) |
| `LLM_BASE_URL` | *(để trống)* | Custom endpoint nếu dùng proxy |

**Gợi ý model theo provider:**
- **Groq:** `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`
- **OpenRouter:** `meta-llama/llama-3.3-70b-instruct`, `qwen/qwen-2.5-72b-instruct`
- **OpenAI:** `gpt-4o-mini`, `gpt-4o`
- **Gemini** (qua OpenAI-compat): đặt `LLM_PROVIDER=openai`, `OPENAI_API_KEY=<gemini_key>`, `LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/`, `MODEL_NAME=gemini-2.5-flash`

#### Trả lời phỏng vấn bằng giọng nói

Dùng **Groq Whisper** (`whisper-large-v3-turbo`) qua chính `GROQ_API_KEY` ở trên, không cần key riêng. Sinh viên bấm **Nói câu trả lời**, nói xong bấm **Dừng nói**, đoạn ghi âm được chuyển thành chữ trong ô trả lời. Không có key Groq thật thì phòng phỏng vấn ẩn nút này.

**Đọc CV dạng scan (OCR):** chỉ nhận file PDF hoặc DOCX. PDF không có lớp chữ (bản scan, ảnh chụp lưu thành PDF) được đọc tự động bằng RapidOCR, đã có trong `requirements.txt`, không cần cài thêm phần mềm. Mô hình mặc định có thể làm mất dấu tiếng Việt, nên khi tải bản scan giao diện sẽ nhắc sinh viên kiểm tra lại hoặc dùng PDF xuất từ Word / Canva.

#### LangSmith — Observability (tùy chọn)

| Biến | Giá trị | Mô tả |
|---|---|---|
| `LANGCHAIN_TRACING_V2` | `true` / `false` | Bật tracing (chỉ bật khi có key thật) |
| `LANGCHAIN_API_KEY` | `lsv2_pt_xxx` | Key từ [smith.langchain.com](https://smith.langchain.com/) |
| `LANGCHAIN_PROJECT` | `ai20k-p131` | Tên project trên LangSmith |
| `LANGCHAIN_ENDPOINT` | `https://api.smith.langchain.com` | Endpoint (giữ nguyên) |

#### App & Database

| Biến | Mặc định | Mô tả |
|---|---|---|
| `APP_ENV` | `development` | `development` / `production` / `test` |
| `APP_PORT` | `8000` | Cổng backend |
| `CORS_ORIGINS` | `http://localhost:3000` | Domain frontend (nhiều URL cách nhau bởi dấu phẩy) |
| `DATABASE_URL` | `sqlite:///./data/app.db` | URL database |
| `UPLOAD_DIR` | `./data/uploads` | Thư mục lưu file CV gốc |
| `CHROMA_PERSIST_DIR` | `./data/chroma` | Thư mục ChromaDB |
| `SEED_DEMO_COHORT` | `true` | Tự tạo dữ liệu demo cố vấn khi khởi động |
| `LOG_LEVEL` | `INFO` | `DEBUG` / `INFO` / `WARNING` / `ERROR` |

#### AI Hook Logging

| Biến | Mô tả |
|---|---|
| `AI_LOG_API_KEY` | Key cá nhân từ [Phoenix Dashboard](https://phoenix.note.transformerlabs.ai/api-keys) — mỗi thành viên một key riêng |
| `AI_LOG_SERVER` | Endpoint gửi log (giữ nguyên mặc định) |
| `AI_LOG_DIR` | Thư mục log local (`.ai-log/`) |

---

### Frontend — `frontend/.env.local` (copy từ `frontend/.env.example`)

| Biến | Mặc định | Mô tả |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | URL backend |
| `NEXT_PUBLIC_LIVE_APIS` | *(để trống)* | Nhóm API gọi backend thật; để trống = toàn bộ mock. Dùng `all` để bật hết |
| `NEXT_PUBLIC_MOCK_SCENARIO` | `default` | Kịch bản mock: `default` / `new_student` |
| `NEXT_PUBLIC_FEATURE_DRIVE_IMPORT` | `false` | Dòng "nhập từ Google Drive" khi tải CV (chưa có chức năng thật) |

---

## Chạy ứng dụng

### Lệnh `make` (Linux / macOS / Git Bash)

```bash
make run        # Khởi động backend (uvicorn --reload :8000)
make test       # Chạy pytest
make lint       # ruff check
make format     # ruff format
make check      # lint + format + test
make clean      # Xóa __pycache__, .pytest_cache, .ruff_cache
```

### Chạy thủ công (Windows / cross-platform)

```bash
# Backend
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (terminal riêng)
cd frontend && npm run dev

# Typecheck frontend
cd frontend && npm run typecheck

# Test
pytest tests/ -v

# Lint / Format
ruff check src/ tests/
ruff format src/ tests/
```

---

## Cấu trúc thư mục

```
P-131/
├── src/                            # Backend Python (FastAPI)
│   ├── main.py                     # Entry point — khởi động app
│   ├── config.py                   # Pydantic Settings (biến môi trường)
│   ├── api/                        # FastAPI routes
│   │   ├── routes.py               # Router tổng hợp /api/v1/*
│   │   ├── cv.py                   # Upload, list, delete, export CV
│   │   ├── analysis.py             # Bắt đầu & xem kết quả Gap Analysis
│   │   ├── optimizer.py            # Phiên tối ưu CV (decisions, finalize)
│   │   ├── interviews.py           # Bắt đầu, trả lời, báo cáo phỏng vấn
│   │   ├── advisor.py              # Dashboard & hồ sơ cố vấn
│   │   ├── messages.py             # Nhắn tin SV ↔ cố vấn
│   │   ├── feedback.py             # Thumb / CSAT feedback
│   │   ├── sharing.py              # Share grants (bật/tắt chia sẻ)
│   │   ├── students.py             # Danh sách sinh viên
│   │   └── deps.py                 # Dependency injection (auth header)
│   ├── agents/                     # LangGraph Agents
│   │   ├── gap_analysis/
│   │   │   ├── graph.py            # StateGraph: parse→retrieve→compare→generate→verify
│   │   │   ├── state.py            # GapAnalysisState (TypedDict)
│   │   │   └── nodes/              # Node functions
│   │   ├── interview/
│   │   │   ├── graph.py            # Conditional: route→score_answer→ask_question
│   │   │   ├── state.py            # InterviewState (TypedDict)
│   │   │   └── nodes/
│   │   └── graph.py                # General chat agent
│   ├── services/                   # Business logic
│   │   ├── gap_analysis.py         # Orchestrate gap analysis pipeline
│   │   ├── cv_optimizer.py         # Xử lý phiên tối ưu CV
│   │   ├── cv_files.py             # Upload, parse, lưu file CV
│   │   ├── interview.py            # Orchestrate phỏng vấn
│   │   ├── advisor.py              # Truy vấn dữ liệu cố vấn
│   │   ├── progress.py             # Tính toán tiến bộ sinh viên
│   │   ├── rag.py                  # ChromaDB — tìm kiếm embedding JD
│   │   ├── skill_matching.py       # So khớp kỹ năng CV–JD
│   │   ├── guardrails.py           # Output validation (grounding check)
│   │   └── llm.py                  # LLM client wrapper
│   ├── db/
│   │   ├── database.py             # SQLAlchemy engine + session
│   │   ├── models.py               # ORM Models (14 bảng)
│   │   └── seed.py                 # Seed dữ liệu ban đầu
│   └── models/
│       └── schemas.py              # Pydantic schemas (request / response)
│
├── frontend/                       # Frontend Next.js 16 (App Router)
│   ├── app/
│   │   ├── student/
│   │   │   ├── (workspace)/        # Các trang có nav bar
│   │   │   │   ├── cv/             # CV của tôi
│   │   │   │   ├── analysis/       # Phân tích CV & JD
│   │   │   │   ├── interview/      # Luyện phỏng vấn
│   │   │   │   ├── history/        # Lịch sử & Tiến bộ
│   │   │   │   ├── share/          # Chia sẻ với Cố vấn
│   │   │   │   └── settings/       # Cài đặt & Quyền riêng tư
│   │   │   └── (focus)/            # Trang không có nav (session phỏng vấn)
│   │   └── advisor/
│   │       └── students/           # Danh sách & hồ sơ sinh viên
│   ├── components/
│   │   ├── student/                # Components của sinh viên
│   │   ├── advisor/                # Components của cố vấn
│   │   ├── shell/                  # App shell (nav, topbar, breadcrumb)
│   │   ├── common/                 # Panel, HintPopover, ...
│   │   └── ui/                     # shadcn/ui primitives
│   └── lib/                        # Utilities, API client, types
│
├── tests/                          # pytest test suite
├── eval/results/report.md          # Báo cáo evaluation
├── docs/
│   ├── architecture_diagrams.md    # Sơ đồ kiến trúc (8 diagrams Mermaid)
│   └── dev/                        # Ghi chú phát triển nội bộ
├── presentation/                   # Slide và video Demo Day
├── data/                           # Dữ liệu local (gitignored)
│   ├── app.db                      # SQLite database
│   ├── chroma/                     # ChromaDB vector store
│   └── uploads/                    # File CV gốc của sinh viên
├── .env.example                    # Template biến môi trường backend
├── frontend/.env.example           # Template biến môi trường frontend
├── Dockerfile                      # Multi-stage Docker build
├── docker-compose.yml              # Chạy backend bằng Docker
├── Makefile                        # Lệnh tắt
├── requirements.txt                # Python dependencies
├── JOURNAL.md                      # Nhật ký phát triển theo tuần
└── WORKLOG.md                      # Worklog từng thành viên
```

---

## API — Ví dụ gọi thử

> **Auth:** Dùng header `X-Demo-Role: student` hoặc `X-Demo-Role: advisor` (demo mode).  
> Swagger UI đầy đủ tại **http://localhost:8000/docs**

### Kiểm tra sức khỏe hệ thống

```bash
curl http://localhost:8000/health
# {"status":"ok","env":"development","version":"1.0.0"}

curl http://localhost:8000/api/v1/status
# {"status":"ready","llm_provider":"groq","model_name":"llama-3.3-70b-versatile",...}
```

### Xem thông tin người dùng đang đăng nhập

```bash
curl http://localhost:8000/api/v1/me \
  -H "X-Demo-Role: student"
# {"id":"sv-001","role":"student","full_name":"Nguyễn Văn A",...}
```

### Upload CV (PDF/DOCX)

```bash
curl -X POST http://localhost:8000/api/v1/cv/upload \
  -H "X-Demo-Role: student" \
  -F "file=@/path/to/cv.pdf"
# {"id":"cv-xxx","file_name":"cv.pdf","version":1,"major":1,"minor":0,...}
```

### Phân tích Gap — bắt đầu

```bash
curl -X POST http://localhost:8000/api/v1/analysis \
  -H "X-Demo-Role: student" \
  -H "Content-Type: application/json" \
  -d '{"cv_version_id": "cv-xxx", "jd_id": "jd-yyy"}'
# {"id":"ga-zzz","status":"processing","current_step":"parse"}
```

### Phân tích Gap — polling kết quả

```bash
curl http://localhost:8000/api/v1/analysis/ga-zzz \
  -H "X-Demo-Role: student"
# {"id":"ga-zzz","status":"completed","match_score":72.5,"result":{...}}
```

### Bắt đầu phỏng vấn STAR

```bash
curl -X POST http://localhost:8000/api/v1/interviews \
  -H "X-Demo-Role: student" \
  -H "Content-Type: application/json" \
  -d '{"jd_id": "jd-yyy", "cv_version_id": "cv-xxx"}'
# {"id":"sess-aaa","status":"in_progress","current_question":"Hãy kể về...","deadline":"..."}
```

### Gửi câu trả lời phỏng vấn

```bash
curl -X POST http://localhost:8000/api/v1/interviews/sess-aaa/answer \
  -H "X-Demo-Role: student" \
  -H "Content-Type: application/json" \
  -d '{"answer": "Trong dự án X, tôi đã..."}'
# {"situation":4.0,"task":3.5,"action":4.5,"result":3.0,"feedback":"...","next_question":"..."}
```

### Chat tổng quát

```bash
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Tôi cần làm gì để chuẩn bị cho vị trí Backend Developer?"}'
# {"response":"...","conversation_id":"..."}
```

### Dashboard cố vấn

```bash
curl http://localhost:8000/api/v1/advisor/overview \
  -H "X-Demo-Role: advisor"
# {"total_students":12,"avg_match_score":68.3,"total_interviews":45,...}
```

---

## Chạy bằng Docker

```bash
# Build và chạy backend
docker compose up --build

# Chạy nền
docker compose up -d

# Xem log
docker compose logs -f backend

# Dừng
docker compose down
```

> **Lưu ý:** `docker-compose.yml` hiện chỉ bao gồm backend. Frontend chạy riêng bằng `npm run dev` hoặc deploy lên Vercel.

---

## Kiểm thử

```bash
# Chạy toàn bộ test suite
pytest tests/ -v

# Chạy một file cụ thể
pytest tests/test_api.py -v

# Với coverage
pytest tests/ --cov=src --cov-report=html
```

CI tự động chạy `ruff` + `pytest` khi push lên `main`/`develop` và khi mở Pull Request vào `main`.

---

## AI Logging & LangSmith

### AI Usage Logging (Deliverable #4)

Mọi prompt được ghi vào `.ai-log/session.jsonl` và tự động đẩy lên grading server khi `git push`.

```bash
# Cài hook (chạy một lần sau khi clone)
bash scripts/setup_hooks.sh                                       # Linux / macOS
powershell -ExecutionPolicy Bypass -File scripts\setup_hooks.ps1  # Windows
```

| Công cụ | Cấu hình | Thời điểm ghi |
|---|---|---|
| Claude Code | `.claude/settings.json` | Mỗi prompt |
| Cursor | `.cursor/hooks.json` | Mỗi prompt và khi dừng |
| OpenAI Codex CLI | `.codex/hooks.json` | Mỗi prompt |
| Gemini CLI / Antigravity | `.gemini/settings.json` | Mỗi lượt agent |
| GitHub Copilot | `.github/hooks/hooks.json` | Mỗi prompt |

Ghi log thủ công (ChatGPT, Gemini Web, ...):

```bash
python scripts/log_antigravity.py --tool chatgpt --prompt "Prompt bạn đã dùng"
```

### LangSmith Tracing

1. Tạo account tại [smith.langchain.com](https://smith.langchain.com/)
2. Lấy API key và điền vào `.env`:

```env
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=lsv2_pt_your_key_here
LANGCHAIN_PROJECT=ai20k-p131
```

3. Khởi động lại backend — mọi LangGraph agent call sẽ xuất hiện trên dashboard LangSmith.

---

## Checklist Deliverables

Trạng thái ✅ trong bảng dưới đây xác nhận artifact đã tồn tại trong repository; không đồng nghĩa artifact đã được duyệt, sản phẩm đã production-ready hoặc KPI đã đạt. Trạng thái ⬜ nghĩa là chưa có artifact hoàn chỉnh trong repository.

| # | Deliverable | Trạng thái | Vị trí |
|---|---|---|---|
| 1 | Source code | ✅ | `src/`, `frontend/` |
| 2 | README.md | ✅ | `README.md` |
| 3 | Architecture diagram | ✅ | `docs/architecture_diagrams.md` |
| 4 | AI logs | ✅ | LangSmith + `.ai-log/` |
| 5 | Live URL | ⬜ | — |
| 6 | Video demo | ⬜ | `presentation/` |
| 7 | Pitch deck | ⬜ | `presentation/` |
| 8 | Development journal | ✅ | `JOURNAL.md` |
| 9 | Worklog | ✅ | `WORKLOG.md` |
| 10 | Evaluation evidence | ✅ | `eval/eval-evidence.md`, `eval/star-consistency-check.md`, `eval/results/report.md` |

---

## Đội nhóm

| Thành viên | Vai trò | MSSV | GitHub |
|---|---|---|---|
| Đào Trọng Khang | Chưa cập nhật | 2A202602974 | — |
| Vũ Minh Trí | Chưa cập nhật | 2A202602629 | — |
| Trịnh Quốc Hoàng | Chưa cập nhật | 2A202602847 | — |
| Vũ Quốc Bảo | Chưa cập nhật | 2A202602829 | — |

---

## Tài liệu liên quan

- [Project Brief](docs/BRIEF.md)
- [Product Requirements Document](docs/PRD.md)
- [Architecture](ARCHITECTURE.md)
- [Architecture Diagram](docs/architecture_diagram.md)
- [Architecture Diagrams](docs/architecture_diagrams.md)
- [Evaluation Evidence](eval/eval-evidence.md)

---

## License

[MIT](LICENSE) — Dùng tự do cho mục đích giáo dục.
