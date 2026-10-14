# 🏗️ Kiến trúc RAG Chatbot + UI Agent — Trợ lý Nghề nghiệp X (P-131)

> **Feature:** Chatbot hỏi-đáp hướng dẫn sử dụng + Agent thao tác trực tiếp trên UI  
> **Scope:** Cả Sinh viên & Cố vấn, context-aware theo role  
> **Agent Level:** Full automation (navigate, highlight, click, fill form, submit)  
> **Constraints:** Open-source first, self-hosted → migrate AWS khi cần

---

## Mục lục

- [1. Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
- [2. Document Pipeline — Auto-generate Knowledge Base](#2-document-pipeline)
- [3. Chunking Strategy](#3-chunking-strategy)
- [4. Embedding Model](#4-embedding-model)
- [5. Vector Store Architecture](#5-vector-store-architecture)
- [6. RAG Retrieval Pipeline](#6-rag-retrieval-pipeline)
- [7. UI Agent Architecture](#7-ui-agent-architecture)
- [8. Storage Architecture](#8-storage-architecture)
- [9. Frontend Integration](#9-frontend-integration)
- [10. Phasing & Migration Path](#10-phasing--migration-path)

---

## 1. Tổng quan kiến trúc

```mermaid
graph TB
    subgraph USER_LAYER["👤 User Layer"]
        SV["Sinh viên"]
        ADV["Cố vấn"]
    end

    subgraph FE["⚛️ Frontend — Next.js"]
        CHAT_WIDGET["ChatBot Widget<br/>(floating panel)"]
        UI_BRIDGE["UI Agent Bridge<br/>(DOM introspection<br/>+ Action executor)"]
        PAGE_CONTEXT["Page Context Provider<br/>(current route, role,<br/>visible elements)"]
    end

    subgraph BACKEND["🐍 Backend — FastAPI"]
        direction TB
        CHAT_API["POST /api/v1/assistant/chat"]
        AGENT_ROUTER["LangGraph Agent Router<br/>(intent classification)"]

        subgraph RAG_PIPE["RAG Pipeline"]
            RETRIEVER["Hybrid Retriever<br/>(Vector + BM25)"]
            RERANKER["Cross-Encoder Reranker<br/>(optional)"]
            CONTEXT_BUILDER["Context Builder<br/>(role-aware filtering)"]
        end

        subgraph UI_AGENT["UI Agent"]
            INTENT_PARSER["Intent Parser<br/>(NLU → structured action)"]
            ACTION_PLANNER["Action Planner<br/>(route + element + params)"]
            ACTION_SCHEMA["Action Schema Registry<br/>(available actions per page)"]
        end

        subgraph GENERATION["Generation"]
            LLM_CLIENT["LLM Client<br/>(ChatOpenAI / Groq)"]
            RESPONSE_SYNTH["Response Synthesizer<br/>(answer + citations<br/>+ optional screenshots)"]
        end
    end

    subgraph DATA_LAYER["🗄️ Data Layer"]
        VSTORE[("Vector Store<br/>ChromaDB → pgvector")]
        DOC_STORE[("Document Store<br/>SQLite → PostgreSQL")]
        CONV_STORE[("Conversation Store<br/>SQLite")]
        ANALYTICS_STORE[("Analytics Store<br/>SQLite")]
        MEDIA_STORE["Media Storage<br/>(screenshots, videos)<br/>local → S3"]
    end

    subgraph PIPELINE["⚙️ Offline Pipeline"]
        CODE_CRAWLER["Source Code Crawler<br/>(components, routes, APIs)"]
        UI_SCREENSHOTTER["UI Screenshotter<br/>(Playwright)"]
        DOC_GENERATOR["Doc Generator<br/>(LLM summarization)"]
        CHUNKER["Intelligent Chunker"]
        EMBEDDER["Embedding Pipeline"]
    end

    SV & ADV --> CHAT_WIDGET
    CHAT_WIDGET --> CHAT_API
    CHAT_WIDGET <-.-> UI_BRIDGE
    PAGE_CONTEXT --> CHAT_WIDGET

    CHAT_API --> AGENT_ROUTER
    AGENT_ROUTER -->|"intent: question"| RAG_PIPE
    AGENT_ROUTER -->|"intent: action"| UI_AGENT

    RAG_PIPE --> GENERATION
    UI_AGENT --> GENERATION
    GENERATION --> LLM_CLIENT

    RETRIEVER --> VSTORE
    CONTEXT_BUILDER --> DOC_STORE
    RESPONSE_SYNTH --> MEDIA_STORE
    CHAT_API --> CONV_STORE
    CHAT_API --> ANALYTICS_STORE

    CODE_CRAWLER --> DOC_GENERATOR
    UI_SCREENSHOTTER --> DOC_GENERATOR
    DOC_GENERATOR --> CHUNKER
    CHUNKER --> EMBEDDER
    EMBEDDER --> VSTORE
    EMBEDDER --> DOC_STORE

    style RAG_PIPE fill:#4f46e5,color:#fff
    style UI_AGENT fill:#059669,color:#fff
    style PIPELINE fill:#d97706,color:#fff
```

### Lý do kiến trúc này phù hợp

| Quyết định | Lý do |
|---|---|
| **Tách RAG vs UI Agent thành 2 nhánh** | Intent khác nhau hoàn toàn: hỏi đáp cần retrieval → generation, thao tác cần NLU → action planning. Router phân loại trước giúp giảm latency và tăng accuracy |
| **LangGraph Agent Router** | Tận dụng LangGraph đã có trong project, consistent với gap_analysis agent và interview agent |
| **Hybrid Retriever (Vector + BM25)** | Vector search giỏi semantic similarity nhưng kém exact match (tên nút, tên route). BM25 bù đắp bằng keyword matching. Kết hợp = tốt nhất cho domain-specific Q&A |
| **UI Agent Bridge ở Frontend** | Agent backend không thể trực tiếp thao tác DOM. Bridge pattern: backend trả structured action → frontend execute. An toàn hơn so với cho backend remote control browser |
| **Offline Pipeline tách biệt** | Tránh bottleneck real-time. Document indexing nặng (screenshot, LLM summarization) chạy async, không ảnh hưởng user experience |

---

## 2. Document Pipeline — Auto-generate Knowledge Base {#2-document-pipeline}

Bạn muốn **auto-generate từ source code + UI screenshots**, đây là pipeline chi tiết:

```mermaid
graph LR
    subgraph SOURCES["📂 Sources"]
        SRC_CODE["Source Code<br/>frontend/app/**<br/>frontend/components/**<br/>src/api/**"]
        UI_LIVE["Running App<br/>localhost:3000"]
        EXISTING_DOCS["Existing Docs<br/>README.md<br/>docs/*.md"]
    end

    subgraph CRAWLERS["🕷️ Crawlers"]
        ROUTE_CRAWLER["Route Crawler<br/>—<br/>Parse Next.js App Router<br/>→ extract all routes<br/>+ page metadata"]
        COMPONENT_CRAWLER["Component Crawler<br/>—<br/>Parse TSX files<br/>→ extract props, events,<br/>interactive elements"]
        API_CRAWLER["API Crawler<br/>—<br/>Parse FastAPI routes<br/>→ extract endpoints<br/>+ Pydantic schemas"]
        SCREENSHOT_BOT["Screenshot Bot<br/>—<br/>Playwright crawl<br/>→ screenshot each route<br/>per role (SV/ADV)"]
    end

    subgraph GENERATOR["📝 Doc Generator"]
        LLM_SUMMARIZE["LLM Summarization<br/>—<br/>Per page: combine route<br/>+ components + screenshot<br/>→ user guide section"]
        TEMPLATE_ENGINE["Template Engine<br/>—<br/>Structured output:<br/>• Page purpose<br/>• Key elements<br/>• Step-by-step flow<br/>• Troubleshooting"]
    end

    subgraph OUTPUT["📦 Output"]
        MD_DOCS["Markdown Docs<br/>(structured, per page)"]
        META_INDEX["Metadata Index<br/>(route ↔ doc mapping)"]
        SCREENSHOTS["Annotated Screenshots<br/>(with element labels)"]
    end

    SRC_CODE --> ROUTE_CRAWLER & COMPONENT_CRAWLER & API_CRAWLER
    UI_LIVE --> SCREENSHOT_BOT
    EXISTING_DOCS --> LLM_SUMMARIZE

    ROUTE_CRAWLER & COMPONENT_CRAWLER & API_CRAWLER --> LLM_SUMMARIZE
    SCREENSHOT_BOT --> LLM_SUMMARIZE
    LLM_SUMMARIZE --> TEMPLATE_ENGINE
    TEMPLATE_ENGINE --> MD_DOCS & META_INDEX & SCREENSHOTS
```

### Crawler chi tiết

| Crawler | Input | Output | Tool |
|---|---|---|---|
| **Route Crawler** | `frontend/app/**/page.tsx` | Route map: path, layout group, params | AST parser (ts-morph / custom regex) |
| **Component Crawler** | `frontend/components/**/*.tsx` | Component registry: name, props, interactive elements (buttons, forms, links) | ts-morph / react-docgen-typescript |
| **API Crawler** | `src/api/**/*.py` + Swagger `/docs` | Endpoint catalog: method, path, params, response schema | FastAPI OpenAPI schema (`/openapi.json`) |
| **Screenshot Bot** | Running app (localhost:3000) | Per-route screenshots, 2 variants (student role, advisor role) | Playwright + `X-Demo-Role` header |

### Generated Document Structure

```
docs/user-guide/
├── _meta.json                    # Route ↔ doc mapping
├── student/
│   ├── overview.md               # Trang tổng quan SV
│   ├── cv-management.md          # Upload, xem, xoá CV
│   ├── gap-analysis.md           # Phân tích khoảng cách CV-JD
│   ├── cv-optimizer.md           # Tối ưu CV
│   ├── mock-interview.md         # Luyện phỏng vấn STAR
│   ├── history.md                # Lịch sử & Tiến bộ
│   ├── share-with-advisor.md     # Chia sẻ với cố vấn
│   └── settings.md               # Cài đặt
├── advisor/
│   ├── dashboard.md              # Tổng quan cố vấn
│   ├── student-list.md           # Danh sách SV
│   └── student-profile.md        # Hồ sơ chi tiết SV
├── common/
│   ├── navigation.md             # Điều hướng chung
│   ├── chat.md                   # Tính năng chat
│   └── faq.md                    # Câu hỏi thường gặp
└── screenshots/
    ├── student/                  # Screenshots per page
    └── advisor/
```

---

## 3. Chunking Strategy {#3-chunking-strategy}

### Chiến lược: **Hierarchical Semantic Chunking**

```mermaid
graph TD
    DOC["Full Document<br/>(e.g. gap-analysis.md)"] --> L1["Level 1: Page Chunk<br/>—<br/>Toàn bộ page summary<br/>Metadata: route, role, title<br/>~500 tokens"]
    
    DOC --> L2A["Level 2: Section Chunk<br/>—<br/>Mỗi heading section<br/>Metadata: section_id, parent_page<br/>~200-400 tokens"]
    DOC --> L2B["Level 2: Section Chunk"]
    DOC --> L2C["Level 2: Section Chunk"]
    
    L2A --> L3A["Level 3: Element Chunk<br/>—<br/>Mô tả từng UI element<br/>(nút, form field, dropdown)<br/>~50-150 tokens"]
    L2A --> L3B["Level 3: Element Chunk"]
    
    DOC --> L4["Level 4: FAQ Chunk<br/>—<br/>Q&A pairs<br/>~100-200 tokens"]

    style L1 fill:#4f46e5,color:#fff
    style L2A fill:#7c3aed,color:#fff
    style L2B fill:#7c3aed,color:#fff
    style L2C fill:#7c3aed,color:#fff
    style L3A fill:#9333ea,color:#fff
    style L3B fill:#9333ea,color:#fff
    style L4 fill:#059669,color:#fff
```

### Chi tiết chunking

| Level | Nội dung | Chunk size | Overlap | Metadata enrichment |
|---|---|---|---|---|
| **L1 — Page** | Summary toàn trang + purpose | 400-600 tokens | 0 | `route`, `role`, `title`, `screenshot_path` |
| **L2 — Section** | Heading + content block (steps, descriptions) | 200-400 tokens | 50 tokens | `section_id`, `parent_page`, `heading` |
| **L3 — Element** | Mô tả UI element (vị trí, chức năng, cách dùng) | 50-150 tokens | 0 | `element_type`, `element_id`, `css_selector`, `page_route` |
| **L4 — FAQ** | Question-Answer pairs | 100-200 tokens | 0 | `question`, `category`, `related_pages` |

### Lý do chọn Hierarchical Chunking

> [!IMPORTANT]
> **Tại sao không dùng fixed-size chunking?**
> - User guide có cấu trúc rõ ràng (page → section → element). Fixed-size sẽ cắt ngang logic, mất context.
> - Hierarchical cho phép retrieval ở nhiều granularity: hỏi tổng quan → trả L1, hỏi cụ thể nút → trả L3.
> - Metadata enrichment ở mỗi level giúp filter theo role, route → tăng precision đáng kể.

### Parent-Child Linking

```python
# Mỗi chunk có parent_id để reconstruct context khi cần
chunk_schema = {
    "chunk_id": "student/gap-analysis#step-3-view-results",
    "parent_id": "student/gap-analysis",       # → có thể fetch parent chunk để bổ sung context
    "level": 2,
    "content": "Sau khi phân tích hoàn tất, kết quả hiển thị gồm...",
    "metadata": {
        "route": "/student/analysis",
        "role": "student",
        "section": "Xem kết quả phân tích",
        "related_elements": ["match-score-badge", "skill-gap-table", "suggestion-list"],
        "screenshot": "screenshots/student/analysis-result.png"
    }
}
```

---

## 4. Embedding Model {#4-embedding-model}

### Lựa chọn: **`sentence-transformers/multilingual-e5-large`** (Primary) + **fallback Gemini Embedding**

| Tiêu chí | multilingual-e5-large | OpenAI text-embedding-3-small | Gemini text-embedding-004 |
|---|---|---|---|
| **Vietnamese support** | ✅ Excellent (trained on CC100-vi) | ⚠️ Good but not optimized | ✅ Very good |
| **Cost** | 🟢 Free (self-hosted) | 🔴 $0.02/1M tokens | 🟡 Free tier limited |
| **Dimension** | 1024 | 1536 | 768 |
| **Self-hosted** | ✅ Yes (HuggingFace) | ❌ API only | ❌ API only |
| **Latency (local)** | ~50ms/query | ~200ms/query (network) | ~150ms/query (network) |
| **MTEB-vi rank** | Top 5 | Top 10 | Top 3 |

### Lý do chọn

> [!TIP]
> **`multilingual-e5-large`** là lựa chọn tối ưu vì:
> 1. **Free, self-hosted** — phù hợp constraint tối ưu chi phí
> 2. **Multilingual xuất sắc** — trained trên 100+ languages bao gồm Vietnamese
> 3. **1024 dimensions** — balance giữa quality và storage
> 4. **Instruction-aware** — support prefix `query:` và `passage:` để phân biệt query vs document, tăng recall
> 5. **Chạy được trên CPU** — không cần GPU cho inference (important cho dev local)

### Cấu hình embedding

```python
# config
EMBEDDING_CONFIG = {
    "model_name": "intfloat/multilingual-e5-large",
    "device": "cpu",                    # hoặc "cuda" nếu có GPU
    "batch_size": 32,                   # batch indexing
    "query_prefix": "query: ",          # E5 instruction prefix
    "passage_prefix": "passage: ",
    "normalize": True,
    "dimension": 1024,
    # Fallback cho cloud deployment
    "fallback_provider": "gemini",      # text-embedding-004
    "fallback_api_key_env": "GEMINI_EMBEDDING_KEY",
}
```

### Migration path sang AWS

```
Local (dev):     multilingual-e5-large on CPU (~50ms/query)
     ↓
AWS (prod):      Option A: Same model trên EC2 g5.xlarge (GPU) → ~5ms/query
                 Option B: Amazon Titan Embeddings v2 (managed, $0.02/1M tokens)
                 Option C: Gemini text-embedding-004 (cross-cloud, free tier)
```

---

## 5. Vector Store Architecture {#5-vector-store-architecture}

### Phase 1 (Dev): ChromaDB — Phase 2 (Prod): pgvector

```mermaid
graph TB
    subgraph PHASE1["Phase 1: Local Dev"]
        CHROMA[("ChromaDB<br/>./data/chroma_assistant<br/>—<br/>Persistent local<br/>~50-200 docs<br/>Good enough")]
    end

    subgraph PHASE2["Phase 2: AWS Prod"]
        PG[("PostgreSQL + pgvector<br/>RDS/Aurora<br/>—<br/>Single DB cho cả<br/>relational + vector<br/>Cost-effective")]
    end

    PHASE1 -->|"migrate"| PHASE2

    style PHASE1 fill:#059669,color:#fff
    style PHASE2 fill:#4f46e5,color:#fff
```

### Tại sao ChromaDB → pgvector, không phải Pinecone/Weaviate?

| Factor | ChromaDB (Phase 1) | pgvector (Phase 2) | Pinecone/Weaviate |
|---|---|---|---|
| **Cost** | 🟢 Free | 🟢 Included with PostgreSQL | 🔴 Paid ($70+/mo) |
| **Self-hosted** | ✅ | ✅ | ⚠️ Weaviate yes, Pinecone no |
| **Already in stack** | ✅ (đang dùng cho JD) | ✅ (SQLite → PG là migration tự nhiên) | ❌ Thêm dependency mới |
| **Hybrid search** | ⚠️ Limited | ✅ (SQL + vector cùng query) | ✅ |
| **Scale 50-200 docs** | ✅ Perfect | ✅ Overkill but future-proof | 🔴 Overkill |
| **Operational burden** | 🟢 Zero | 🟡 Manage PG | 🟡-🔴 |

> [!NOTE]
> **ChromaDB đủ tốt cho Phase 1** với quy mô 50-200 trang docs. Khi deploy AWS, migrate sang pgvector vì:
> 1. SQLite → PostgreSQL là migration path tự nhiên cho relational data
> 2. pgvector nằm cùng PostgreSQL → **1 database, 0 extra infra** cho cả relational + vector
> 3. AWS RDS PostgreSQL có pgvector extension built-in

### Collection Schema (ChromaDB / pgvector table)

```python
# ChromaDB collection cho Phase 1
assistant_docs_collection = {
    "name": "assistant_knowledge",
    "metadata": {"hnsw:space": "cosine"},
    "schema": {
        "id": str,              # "student/gap-analysis#step-3"
        "embedding": list[float],  # 1024-dim
        "document": str,        # chunk content
        "metadata": {
            "level": int,       # 1-4 (page, section, element, faq)
            "route": str,       # "/student/analysis"
            "role": str,        # "student" | "advisor" | "all"
            "page_title": str,
            "section": str,
            "parent_id": str,
            "element_ids": list[str],
            "screenshot_path": str,
            "updated_at": str,  # ISO timestamp
            "source": str,      # "auto-generated" | "manual"
            "language": str,    # "vi" | "en"
        }
    }
}
```

```sql
-- pgvector table cho Phase 2
CREATE TABLE assistant_chunks (
    id              TEXT PRIMARY KEY,
    content         TEXT NOT NULL,
    embedding       vector(1024),
    level           SMALLINT NOT NULL,          -- 1-4
    route           TEXT,
    role            TEXT DEFAULT 'all',         -- student | advisor | all
    page_title      TEXT,
    section_heading TEXT,
    parent_id       TEXT REFERENCES assistant_chunks(id),
    element_ids     TEXT[],
    screenshot_path TEXT,
    source          TEXT DEFAULT 'auto-generated',
    language        TEXT DEFAULT 'vi',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    -- BM25 search support
    content_tsv     tsvector GENERATED ALWAYS AS (
        to_tsvector('simple', content)
    ) STORED
);

CREATE INDEX idx_chunks_embedding ON assistant_chunks
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);
CREATE INDEX idx_chunks_role ON assistant_chunks(role);
CREATE INDEX idx_chunks_route ON assistant_chunks(route);
CREATE INDEX idx_chunks_bm25 ON assistant_chunks USING gin(content_tsv);
```

---

## 6. RAG Retrieval Pipeline {#6-rag-retrieval-pipeline}

### LangGraph Agent Flow

```mermaid
graph LR
    START([START]) --> CLASSIFY["classify_intent<br/>—<br/>Question vs Action<br/>vs Greeting/Smalltalk"]
    
    CLASSIFY -->|"question"| ENRICH["enrich_query<br/>—<br/>Add role context<br/>+ current page<br/>+ conversation history"]
    
    CLASSIFY -->|"action"| ACTION_FLOW["→ UI Agent Flow<br/>(Section 7)"]
    
    CLASSIFY -->|"smalltalk"| DIRECT["direct_response<br/>—<br/>No retrieval needed"]
    
    ENRICH --> RETRIEVE["hybrid_retrieve<br/>—<br/>Vector search (top 10)<br/>+ BM25 search (top 10)<br/>→ RRF merge"]
    
    RETRIEVE --> FILTER["role_filter<br/>—<br/>Keep only chunks<br/>matching user role<br/>+ 'all' chunks"]
    
    FILTER --> RERANK["rerank<br/>—<br/>Cross-encoder or<br/>LLM-based reranking<br/>→ top 5"]
    
    RERANK --> PARENT["parent_expand<br/>—<br/>If L3/L4 chunk,<br/>fetch parent L1/L2<br/>for context"]
    
    PARENT --> GENERATE["generate_answer<br/>—<br/>LLM with context<br/>+ citations<br/>+ screenshot refs"]
    
    GENERATE --> MEMORY["save_to_memory<br/>—<br/>Store Q&A pair<br/>+ analytics"]
    
    MEMORY --> END_N([END])

    style CLASSIFY fill:#4f46e5,color:#fff
    style RETRIEVE fill:#7c3aed,color:#fff
    style RERANK fill:#9333ea,color:#fff
    style GENERATE fill:#c026d3,color:#fff
    style ACTION_FLOW fill:#059669,color:#fff
```

### Hybrid Retrieval: Vector + BM25 + RRF

```python
# Reciprocal Rank Fusion (RRF) — kết hợp 2 retriever
def reciprocal_rank_fusion(
    vector_results: list[str],
    bm25_results: list[str],
    k: int = 60  # RRF constant
) -> list[tuple[str, float]]:
    """
    RRF score = Σ 1/(k + rank_i)
    
    Ví dụ: chunk xuất hiện rank 1 trong vector, rank 3 trong BM25:
    → score = 1/(60+1) + 1/(60+3) = 0.0164 + 0.0159 = 0.0323
    """
    scores = {}
    for rank, doc_id in enumerate(vector_results):
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
    for rank, doc_id in enumerate(bm25_results):
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
    
    return sorted(scores.items(), key=lambda x: x[1], reverse=True)
```

### Role-Aware Filtering

```python
def role_filter(chunks: list[Chunk], user_role: str) -> list[Chunk]:
    """
    Filter chunks theo role:
    - student chỉ thấy chunks role='student' hoặc 'all'
    - advisor chỉ thấy chunks role='advisor' hoặc 'all'
    
    → Tránh leak thông tin advisor-only cho student
    """
    return [c for c in chunks if c.metadata["role"] in (user_role, "all")]
```

### Generation Prompt Template

```
Bạn là trợ lý hướng dẫn sử dụng app "Trợ lý Nghề nghiệp X".
Vai trò hiện tại của người dùng: {role}
Trang hiện tại: {current_route}

Dựa trên các tài liệu tham khảo sau:
{retrieved_context}

Trả lời câu hỏi của người dùng. Quy tắc:
1. Chỉ trả lời dựa trên tài liệu được cung cấp. Nếu không tìm thấy, nói rõ.
2. Nếu có screenshot liên quan, đính kèm link screenshot.
3. Nếu câu hỏi liên quan đến thao tác, mô tả step-by-step.
4. Trích dẫn nguồn: [Tên trang](route).
5. Trả lời bằng {language}.
6. Nếu user hỏi về tính năng của role khác, giải thích nhưng lưu ý quyền truy cập.

Lịch sử hội thoại:
{conversation_history}

Câu hỏi: {user_question}
```

---

## 7. UI Agent Architecture {#7-ui-agent-architecture}

> Đây là phần phức tạp nhất — cho phép agent **thực sự thao tác** trên UI thay user.

### Kiến trúc: Backend → Structured Action → Frontend Execute

```mermaid
sequenceDiagram
    actor User
    participant Widget as Chat Widget
    participant API as Backend /assistant/chat
    participant Agent as LangGraph UI Agent
    participant LLM as LLM
    participant Bridge as UI Agent Bridge
    participant DOM as Browser DOM

    User->>Widget: "mở chi tiết lịch sử<br/>phỏng vấn backend tối 6/10"
    Widget->>API: POST {message, page_context}
    
    Note over API: page_context includes:<br/>current_route, role,<br/>available_actions

    API->>Agent: classify → intent: "action"
    Agent->>LLM: Parse intent → structured action
    LLM-->>Agent: {<br/>  action: "navigate_and_select",<br/>  steps: [<br/>    {navigate: "/student/history"},<br/>    {filter: {type: "interview", keyword: "backend"}},<br/>    {click: {element: "interview-row", match: "6/10"}}<br/>  ]<br/>}
    
    Agent->>Agent: Validate actions against<br/>Action Schema Registry
    Agent-->>API: ActionPlan + explanation text
    
    API-->>Widget: {<br/>  type: "action",<br/>  plan: [...steps...],<br/>  explanation: "Tôi sẽ mở trang Lịch sử,<br/>  lọc phỏng vấn backend ngày 6/10..."<br/>}
    
    Widget->>Widget: Show confirmation dialog<br/>"Cho phép thao tác này?"
    User->>Widget: Confirm ✅
    
    Widget->>Bridge: Execute action plan
    Bridge->>DOM: router.push("/student/history")
    Bridge->>DOM: Set filter = {type: "interview"}
    Bridge->>DOM: Find & click matching row
    Bridge-->>Widget: Action completed ✅
    
    Widget->>User: "Đã mở chi tiết phỏng vấn<br/>Backend Developer ngày 6/10 🎯"
```

### Action Schema Registry

Mỗi page đăng ký các actions khả dụng:

```typescript
// frontend/lib/agent-actions/registry.ts

export interface AgentAction {
  id: string;
  description: string;           // Mô tả cho LLM hiểu
  route: string;                 // Route chứa action
  roles: ("student" | "advisor")[];
  params: Record<string, {
    type: "string" | "number" | "date" | "enum";
    description: string;
    required: boolean;
    enum_values?: string[];
  }>;
  execute: (params: Record<string, any>) => Promise<ActionResult>;
}

// Ví dụ actions cho student
export const studentActions: AgentAction[] = [
  {
    id: "navigate_to_page",
    description: "Chuyển đến một trang cụ thể trong ứng dụng",
    route: "*",
    roles: ["student", "advisor"],
    params: {
      target_route: {
        type: "enum",
        description: "Route đích",
        required: true,
        enum_values: [
          "/student", "/student/cv", "/student/analysis",
          "/student/interview", "/student/history",
          "/student/share", "/student/settings",
        ],
      },
    },
    execute: async ({ target_route }) => {
      router.push(target_route);
      return { success: true };
    },
  },
  {
    id: "view_interview_detail",
    description: "Xem chi tiết một buổi phỏng vấn cụ thể. Có thể tìm theo tên vị trí, ngày, hoặc điểm số.",
    route: "/student/history",
    roles: ["student"],
    params: {
      keyword: { type: "string", description: "Từ khoá tìm kiếm (vị trí, tên JD)", required: false },
      date: { type: "date", description: "Ngày phỏng vấn (YYYY-MM-DD)", required: false },
      session_id: { type: "string", description: "ID buổi phỏng vấn nếu biết", required: false },
    },
    execute: async ({ keyword, date, session_id }) => {
      // 1. Navigate to history page if not there
      // 2. Apply filters
      // 3. Find matching session
      // 4. Click to open detail
    },
  },
  {
    id: "start_gap_analysis",
    description: "Bắt đầu phân tích khoảng cách CV-JD. Cần chọn CV và JD trước.",
    route: "/student/analysis",
    roles: ["student"],
    params: {
      cv_id: { type: "string", description: "ID của CV (nếu không chỉ định, dùng CV active)", required: false },
      jd_keyword: { type: "string", description: "Từ khoá tìm JD", required: false },
    },
    execute: async ({ cv_id, jd_keyword }) => { /* ... */ },
  },
  {
    id: "upload_cv",
    description: "Upload file CV mới (PDF hoặc DOCX)",
    route: "/student/cv",
    roles: ["student"],
    params: {},
    execute: async () => {
      // Navigate to CV page and trigger file picker
    },
  },
  // ... more actions
];
```

### Page Context Provider

```typescript
// frontend/components/assistant/page-context-provider.tsx

"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo } from "react";

interface PageContext {
  route: string;
  role: "student" | "advisor";
  pageTitle: string;
  availableActions: string[];    // Action IDs available on current page
  visibleElements: string[];     // Element IDs currently visible
}

export const PageContextCtx = createContext<PageContext | null>(null);

export function PageContextProvider({ children, role }: { children: React.ReactNode; role: string }) {
  const pathname = usePathname();
  
  const context = useMemo<PageContext>(() => ({
    route: pathname,
    role: role as "student" | "advisor",
    pageTitle: getPageTitle(pathname),
    availableActions: getAvailableActions(pathname, role),
    visibleElements: [], // populated by IntersectionObserver
  }), [pathname, role]);

  return (
    <PageContextCtx.Provider value={context}>
      {children}
    </PageContextCtx.Provider>
  );
}
```

### Safety Layer

> [!CAUTION]
> **UI Agent thao tác trực tiếp rất nguy hiểm nếu không có safeguard.** Thiết kế bao gồm:

| Safety measure | Mô tả |
|---|---|
| **Confirmation dialog** | Mọi action phải được user confirm trước khi execute (trừ navigate) |
| **Action allowlist** | Agent CHỈ có thể thực hiện actions đã đăng ký trong Registry. Không có DOM manipulation tự do |
| **Rate limiting** | Max 5 actions/minute, max 3 actions/session liên tiếp |
| **Undo support** | Mỗi action có `undo()` method. Agent giữ action history để rollback |
| **Role validation** | Backend double-check action permission vs user role |
| **Audit log** | Mọi agent action được log: timestamp, user, action, params, result |

---

## 8. Storage Architecture {#8-storage-architecture}

### Tổng quan: Cần gì, để đâu

```mermaid
graph TB
    subgraph STORES["Storage Architecture"]
        subgraph RELATIONAL["📊 Relational Store"]
            direction TB
            REL_1["conversations<br/>(session_id, user_id, started_at)"]
            REL_2["conversation_turns<br/>(turn_id, session_id, role,<br/>message, action_plan, created_at)"]
            REL_3["agent_action_logs<br/>(action_id, user_id, action_type,<br/>params, result, created_at)"]
            REL_4["feedback<br/>(turn_id, rating, comment)"]
            REL_5["analytics_events<br/>(event_type, query, chunks_used,<br/>latency_ms, created_at)"]
        end

        subgraph VECTOR["🔍 Vector Store"]
            direction TB
            VEC_1["assistant_knowledge<br/>(user guide chunks + embeddings)"]
            VEC_2["faq_pairs<br/>(Q&A pairs + embeddings)"]
        end

        subgraph FILE_STORE["📁 File Store"]
            direction TB
            FILE_1["screenshots/<br/>(annotated UI screenshots)"]
            FILE_2["generated_docs/<br/>(markdown user guides)"]
        end
    end

    REL_1 & REL_2 & REL_3 & REL_4 & REL_5 ---|"SQLite (dev)<br/>PostgreSQL (prod)"| DB_ICON[("DB")]
    VEC_1 & VEC_2 ---|"ChromaDB (dev)<br/>pgvector (prod)"| VEC_ICON[("VDB")]
    FILE_1 & FILE_2 ---|"Local FS (dev)<br/>S3 (prod)"| FS_ICON[("FS")]
```

### Cần Lakehouse không?

> [!NOTE]
> **Không cần Lakehouse cho feature này.** Lý do:
> 
> | Tiêu chí | Lakehouse (Delta Lake, Iceberg) | Setup hiện tại |
> |---|---|---|
> | **Data volume** | Tối ưu cho TB+ data | 50-200 docs + vài nghìn conversations → MB level |
> | **Analytics pattern** | Complex OLAP, time-travel, schema evolution | Simple aggregation queries (top questions, coverage gaps) |
> | **Operational cost** | Cần Spark/Presto/Trino cluster | Overkill |
> | **When to consider** | Khi có 10K+ users, millions of conversations, cần ML pipeline trên interaction data | Chưa tới giai đoạn đó |
>
> **Thay vào đó:** Analytics queries chạy trực tiếp trên SQLite/PostgreSQL là đủ. Nếu sau này cần advanced analytics (e.g. clustering user questions, finding knowledge gaps), export data sang Parquet files + DuckDB cho ad-hoc analysis.

### Database Schema mới (bổ sung vào SQLite hiện tại)

```sql
-- Bảng conversations cho chatbot
CREATE TABLE assistant_conversations (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    title       TEXT,                          -- auto-generated từ first message
    started_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_msg_at TIMESTAMP,
    turn_count  INTEGER DEFAULT 0,
    metadata    TEXT                           -- JSON: {route, role, device}
);

-- Bảng lưu từng lượt hội thoại
CREATE TABLE assistant_turns (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES assistant_conversations(id),
    role            TEXT NOT NULL,              -- 'user' | 'assistant'
    content         TEXT NOT NULL,
    content_type    TEXT DEFAULT 'text',        -- 'text' | 'action_plan' | 'error'
    action_plan     TEXT,                       -- JSON: structured action nếu có
    chunks_used     TEXT,                       -- JSON: list of chunk_ids used
    latency_ms      INTEGER,
    model_name      TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng log agent actions
CREATE TABLE agent_action_logs (
    id          TEXT PRIMARY KEY,
    turn_id     TEXT REFERENCES assistant_turns(id),
    user_id     TEXT NOT NULL REFERENCES users(id),
    action_type TEXT NOT NULL,                  -- action_id from registry
    params      TEXT,                           -- JSON
    result      TEXT NOT NULL,                  -- 'success' | 'failed' | 'cancelled'
    error_msg   TEXT,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng feedback cho từng câu trả lời
CREATE TABLE assistant_feedback (
    id          TEXT PRIMARY KEY,
    turn_id     TEXT NOT NULL REFERENCES assistant_turns(id),
    user_id     TEXT NOT NULL REFERENCES users(id),
    rating      INTEGER CHECK (rating BETWEEN 1 AND 5),
    is_helpful  BOOLEAN,                       -- thumbs up/down
    comment     TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng analytics aggregation (materialized view equivalent)
CREATE TABLE assistant_analytics (
    id              TEXT PRIMARY KEY,
    date            DATE NOT NULL,
    total_queries   INTEGER DEFAULT 0,
    unique_users    INTEGER DEFAULT 0,
    avg_latency_ms  REAL,
    top_questions   TEXT,                       -- JSON: top 10 questions
    unanswered      TEXT,                       -- JSON: questions with no good chunks
    avg_rating      REAL,
    action_count    INTEGER DEFAULT 0,
    UNIQUE(date)
);
```

---

## 9. Frontend Integration {#9-frontend-integration}

### Chat Widget Component

```mermaid
graph TD
    subgraph WIDGET["💬 Chat Widget"]
        direction TB
        TRIGGER["Floating Button<br/>(bottom-right corner)"]
        PANEL["Slide-up Panel<br/>(400px × 600px)"]
        
        subgraph PANEL_CONTENT["Panel Content"]
            HEADER["Header<br/>(title + minimize + close)"]
            MESSAGES["Message List<br/>(scrollable, auto-scroll)"]
            ACTIONS["Action Cards<br/>(expandable, with confirm)"]
            INPUT["Input Bar<br/>(text + send + voice?)"]
            CONTEXT_BAR["Context Bar<br/>(showing current page)"]
        end
    end

    TRIGGER -->|click| PANEL
    PANEL --> PANEL_CONTENT

    style TRIGGER fill:#4f46e5,color:#fff
    style PANEL fill:#1e1b4b,color:#fff
```

### Component Integration Points

```
frontend/
├── components/
│   ├── assistant/                    # ← NEW
│   │   ├── chat-widget.tsx          # Floating widget + panel
│   │   ├── chat-messages.tsx        # Message rendering
│   │   ├── action-card.tsx          # UI action confirmation card
│   │   ├── page-context-provider.tsx # Current page context
│   │   └── ui-agent-bridge.tsx      # Action executor
│   ├── shell/
│   │   └── app-shell.tsx            # ← ADD: ChatWidget here
│   └── ...
├── lib/
│   ├── assistant/                    # ← NEW
│   │   ├── api.ts                   # API client for /assistant/*
│   │   ├── actions-registry.ts      # Available actions
│   │   ├── types.ts                 # TypeScript types
│   │   └── use-assistant.ts         # React hook
│   └── ...
```

### Backend API Endpoints mới

```python
# src/api/assistant.py — NEW

@router.post("/assistant/chat")
async def chat(request: AssistantChatRequest, user=Depends(get_current_user)):
    """Main chat endpoint. Handles both Q&A and action requests."""
    ...

@router.get("/assistant/conversations")
async def list_conversations(user=Depends(get_current_user)):
    """List user's past conversations."""
    ...

@router.get("/assistant/conversations/{id}")
async def get_conversation(id: str, user=Depends(get_current_user)):
    """Get full conversation history."""
    ...

@router.post("/assistant/feedback")
async def submit_feedback(request: AssistantFeedbackRequest, user=Depends(get_current_user)):
    """Submit feedback on an assistant response."""
    ...

@router.get("/assistant/analytics")
async def get_analytics(user=Depends(get_current_user)):
    """Get chatbot usage analytics (advisor only)."""
    ...

# ---- Admin / Pipeline endpoints ----

@router.post("/assistant/admin/reindex")
async def trigger_reindex():
    """Trigger document re-indexing pipeline."""
    ...

@router.get("/assistant/admin/coverage")
async def get_coverage_report():
    """Show which pages/features have docs vs not."""
    ...
```

---

## 10. Phasing & Migration Path {#10-phasing--migration-path}

### Roadmap 3 phases

```mermaid
gantt
    title Implementation Roadmap
    dateFormat  YYYY-MM-DD
    
    section Phase 1 — RAG Core
    Document Pipeline (crawlers + generator)     :p1a, 2026-10-07, 5d
    Chunking + Embedding Pipeline                :p1b, after p1a, 3d
    ChromaDB collection setup                    :p1c, after p1b, 1d
    RAG retrieval (vector + BM25 + RRF)         :p1d, after p1c, 3d
    Chat API endpoint                            :p1e, after p1d, 2d
    Chat Widget (frontend)                       :p1f, after p1c, 5d
    Conversation memory                          :p1g, after p1e, 2d
    
    section Phase 2 — UI Agent
    Action Schema Registry                       :p2a, after p1f, 3d
    Intent classifier (question vs action)       :p2b, after p2a, 2d
    UI Agent Bridge (frontend)                   :p2c, after p2a, 4d
    Action planner (LangGraph)                   :p2d, after p2b, 3d
    Safety layer (confirm, undo, audit)          :p2e, after p2c, 2d
    Integration testing                          :p2f, after p2d, 3d
    
    section Phase 3 — Polish & Deploy
    Analytics dashboard                          :p3a, after p2f, 3d
    Feedback loop + RAG improvement              :p3b, after p3a, 3d
    Multi-language support                       :p3c, after p3a, 2d
    AWS migration (PG + pgvector + S3)           :p3d, after p3b, 5d
    Load testing + optimization                  :p3e, after p3d, 3d
```

### Phase 1: RAG Core (~3 tuần)

| Component | Tool/Tech | Effort |
|---|---|---|
| Document Pipeline | Python scripts + Playwright + LLM | 5 days |
| Chunking | Custom hierarchical chunker | 3 days |
| Embedding | `multilingual-e5-large` via sentence-transformers | 1 day |
| Vector Store | ChromaDB (tận dụng infra có sẵn) | 1 day |
| Retrieval | LangGraph StateGraph + BM25 lib | 3 days |
| Chat API | FastAPI endpoint | 2 days |
| Chat Widget | React component (shadcn/ui dialog) | 5 days |

### Phase 2: UI Agent (~2 tuần)

| Component | Tool/Tech | Effort |
|---|---|---|
| Action Registry | TypeScript registry pattern | 3 days |
| Intent Classifier | LLM-based (prompt engineering) | 2 days |
| UI Bridge | React + Next.js router integration | 4 days |
| Action Planner | LangGraph extension | 3 days |
| Safety | Confirmation UI + audit logging | 2 days |

### Phase 3: Polish + AWS Deploy (~2 tuần)

| Component | Tool/Tech | Effort |
|---|---|---|
| Analytics | SQL queries + dashboard component | 3 days |
| Feedback loop | Rating → re-weight chunks, flag gaps | 3 days |
| Multi-lang | i18n in prompts + docs | 2 days |
| AWS migration | RDS PostgreSQL + pgvector + S3 | 5 days |
| Load testing | Locust + optimization | 3 days |

---

## Appendix: Technology Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| **Embedding Model** | `multilingual-e5-large` | Free, self-hosted, excellent Vietnamese, instruction-aware |
| **Vector Store (dev)** | ChromaDB | Already in project, zero setup |
| **Vector Store (prod)** | pgvector on PostgreSQL | Single DB for relational + vector, cost-effective on AWS RDS |
| **Retrieval Strategy** | Hybrid (Vector + BM25 + RRF) | Best accuracy for domain-specific Q&A with exact terms |
| **Agent Framework** | LangGraph | Consistent with existing agents, StateGraph pattern |
| **UI Agent Pattern** | Backend action plan → Frontend execute | Secure, controllable, auditable |
| **Chunking** | Hierarchical 4-level semantic | Matches document structure, enables multi-granularity retrieval |
| **Doc Generation** | Auto from source + screenshots | Reduces maintenance, stays in sync with code |
| **Lakehouse** | ❌ Not needed | Data volume too small, simple analytics suffice |
| **Conversation Store** | SQLite (→ PostgreSQL) | Relational queries for history, analytics, co-located with app DB |
| **File Store** | Local FS (→ S3) | Screenshots + generated docs, simple → scalable |
| **Reranker** | LLM-based (cost-effective) or cross-encoder | Optional but significant quality boost |
| **Multi-modal** | Screenshot references in responses | Embedded in chunks as metadata, rendered in chat widget |
