# P-131 — Trợ lý Nghề nghiệp X (EDU-17): Architecture Diagrams

> Được tạo tự động từ source code — cập nhật lần cuối: 2026-10-04

---

## 1. System Architecture (High-Level)

```mermaid
graph TB
    subgraph CLIENT["🌐 Client Layer"]
        BROWSER["Browser"]
    end

    subgraph FRONTEND["⚛️ Frontend — Next.js 14 (App Router)"]
        direction TB
        STUDENT_PAGES["Student Pages\n/student/*"]
        ADVISOR_PAGES["Advisor Pages\n/advisor/*"]
        SHELL["App Shell\n(nav, topbar, breadcrumb)"]
        LIB["lib/ (API client, types, utils)"]
    end

    subgraph BACKEND["🐍 Backend — FastAPI"]
        direction TB
        ROUTER["API Router\n/api/v1/*"]
        DEPS["Deps / Auth\n(X-Demo-Role header)"]
        API_ROUTES["API Routes\ncv · analysis · interview\noptimizer · advisor · messages\nfeedback · sharing · students"]
        SERVICES["Services Layer\ngap_analysis · interview · cv_files\ncv_optimizer · progress · advisor\nsharing · messages · rag · llm"]
        AGENTS["LangGraph Agents\ngap_analysis_agent · interview_agent"]
        GUARDRAILS["Guardrails\n(output validation)"]
    end

    subgraph DATA["🗄️ Data Layer"]
        direction TB
        SQLITE[("SQLite\napp.db")]
        CHROMA[("ChromaDB\nVector Store\n./data/chroma")]
        FILES["File Storage\n./data/uploads\n(CV PDF/DOCX)"]
    end

    subgraph EXTERNAL["☁️ External Services"]
        LLM_API["LLM API\nGroq / OpenRouter / OpenAI"]
        LANGSMITH["LangSmith\n(Tracing & Observability)"]
    end

    BROWSER --> FRONTEND
    FRONTEND -->|"HTTP REST /api/v1"| BACKEND
    ROUTER --> DEPS --> API_ROUTES
    API_ROUTES --> SERVICES
    SERVICES --> AGENTS
    SERVICES --> SQLITE
    SERVICES --> FILES
    AGENTS --> LLM_API
    AGENTS --> CHROMA
    AGENTS --> GUARDRAILS
    AGENTS -.->|traces| LANGSMITH
    SERVICES -.->|traces| LANGSMITH
```

---

## 2. Frontend Component Tree

```mermaid
graph TD
    subgraph APP["app/ (Next.js App Router)"]
        ROOT_LAYOUT["layout.tsx\n(ThemeProvider, Fonts)"]
        ROOT_PAGE["page.tsx\n(role-based redirect)"]

        subgraph STUDENT_APP["app/student/"]
            S_WORKSPACE["(workspace)/\n(AppShell + StudentShell nav)"]
            S_FOCUS["(focus)/\n(no nav - interview session)"]
            S_OV["page.tsx — Tổng quan"]
            S_CV["cv/ — CV của tôi"]
            S_ANALYSIS["analysis/ — Phân tích CV & JD"]
            S_INTERVIEW["interview/ — Luyện phỏng vấn"]
            S_HISTORY["history/ — Lịch sử & Tiến bộ"]
            S_SHARE["share/ — Chia sẻ với Cố vấn"]
            S_SETTINGS["settings/ — Cài đặt"]
        end

        subgraph ADVISOR_APP["app/advisor/"]
            A_LAYOUT["layout.tsx (AdvisorShell nav)"]
            A_OV["page.tsx — Tổng quan"]
            A_STUDENTS["students/ — Sinh viên phụ trách"]
            A_PROFILE["students/[id]/ — Hồ sơ SV"]
        end
    end

    subgraph COMPONENTS["components/"]
        subgraph STUDENT_COMP["student/"]
            SC_OVERVIEW["overview/"]
            SC_CV["cv/\ncv-sections.tsx"]
            SC_ANALYSIS["analysis/\nanalysis-result.tsx\nanalysis-result-sections.tsx"]
            SC_INTERVIEW["interview/"]
            SC_HISTORY["history/\nstudent-history.tsx\nhistory-sections.tsx"]
            SC_OPTIMIZER["optimizer/\ncv-optimizer.tsx"]
            SC_SHARE["share/\nshare-with-advisor.tsx\nshare-sections.tsx"]
            SC_SETTINGS["settings/\nstudent-settings.tsx\nsettings-sections.tsx"]
        end

        subgraph ADVISOR_COMP["advisor/"]
            AC_OVERVIEW["overview/\nadvisor-overview.tsx"]
            AC_STUDENTS["students/\nstudent-list.tsx"]
            AC_PROFILE["profile/\nstudent-profile.tsx\nprofile-cv-tab.tsx\nprofile-interview-tab.tsx\nprofile-notes-tab.tsx"]
            AC_PROGRESS["progress-blocks.tsx"]
        end

        subgraph SHELL["shell/"]
            SH_APPSHELL["app-shell.tsx"]
            SH_NAV["nav-config.ts\n(studentShell, advisorShell)"]
        end

        subgraph COMMON["common/"]
            CM_PANEL["panel.tsx"]
            CM_HINT["hint-popover.tsx"]
        end

        CHAT["chat/\nchat-panel.tsx"]
        INTERVIEW_CHAT["InterviewChat.tsx"]
        FEEDBACK["FeedbackWidget.tsx"]
    end

    ROOT_LAYOUT --> STUDENT_APP
    ROOT_LAYOUT --> ADVISOR_APP
    S_WORKSPACE --> S_OV & S_CV & S_ANALYSIS & S_INTERVIEW & S_HISTORY & S_SHARE & S_SETTINGS
    S_FOCUS --> S_INTERVIEW
    A_LAYOUT --> A_OV & A_STUDENTS & A_PROFILE

    S_OV --> SC_OVERVIEW
    S_CV --> SC_CV
    S_ANALYSIS --> SC_ANALYSIS
    S_INTERVIEW --> SC_INTERVIEW
    S_HISTORY --> SC_HISTORY
    S_SHARE --> SC_SHARE
    S_SETTINGS --> SC_SETTINGS
    SC_ANALYSIS -->|after analysis| SC_OPTIMIZER

    A_OV --> AC_OVERVIEW
    A_STUDENTS --> AC_STUDENTS
    A_PROFILE --> AC_PROFILE

    SH_APPSHELL --> SH_NAV
    SH_APPSHELL --> CM_PANEL & CM_HINT
```

---

## 3. Backend API Routes Map

```mermaid
graph LR
    subgraph API["/api/v1"]
        direction TB
        HEALTH["GET /health\n(system)"]
        STATUS["GET /status\n(agent status)"]
        ME["GET /me\n(auth profile)"]
        CHAT["POST /chat\n(general chat)"]

        subgraph CV_R["CV Routes"]
            CV1["GET /cv — list CVs"]
            CV2["POST /cv/upload — upload file"]
            CV3["GET /cv/{id} — get CV"]
            CV4["DELETE /cv/{id} — delete"]
            CV5["POST /cv/{id}/restore — restore version"]
            CV6["GET /cv/export/{id} — export CV"]
            CV7["POST /cv/export/{id}/confirm — confirm integrity"]
        end

        subgraph ANALYSIS_R["Analysis Routes"]
            AN1["POST /analysis — start analysis"]
            AN2["GET /analysis/{id} — get result"]
            AN3["GET /analysis — list analyses"]
        end

        subgraph INTERVIEW_R["Interview Routes"]
            IN1["POST /interviews — start session"]
            IN2["POST /interviews/{id}/answer — submit answer"]
            IN3["GET /interviews/{id} — get session"]
            IN4["GET /interviews/{id}/report — get report"]
            IN5["POST /interviews/{id}/pause — pause"]
            IN6["POST /interviews/{id}/resume — resume"]
        end

        subgraph OPTIMIZER_R["Optimizer Routes"]
            OP1["GET /optimizer/{analysis_id}"]
            OP2["PATCH /optimizer/{analysis_id}/decision"]
            OP3["POST /optimizer/{analysis_id}/finalize"]
            OP4["PATCH /optimizer/{analysis_id}/capability"]
        end

        subgraph ADVISOR_R["Advisor Routes"]
            AD1["GET /advisor/overview"]
            AD2["GET /advisor/students"]
            AD3["GET /advisor/students/{id}"]
            AD4["GET /advisor/students/{id}/cv"]
            AD5["GET /advisor/students/{id}/interviews"]
            AD6["POST /advisor/reviews"]
            AD7["GET/PUT /advisor/notes/{student_id}"]
        end

        subgraph OTHER_R["Other Routes"]
            FB["POST /feedback — thumb/csat"]
            SH["GET/POST /sharing — share grants"]
            MSG["GET/POST /messages — messaging"]
            STU["GET /students — student list"]
        end
    end
```

---

## 4. LangGraph Agent Flows

### 4a. Gap Analysis Agent

```mermaid
graph LR
    START([START]) --> PARSE["parse\nparse_cv_node\n—\nExtract CV lines\n& sections"]
    PARSE --> RETRIEVE["retrieve\nretrieve_context_node\n—\nFetch JD skills\nfrom ChromaDB\n& taxonomy"]
    RETRIEVE --> COMPARE["compare\ncompare_gap_node\n—\nSkill matching\n& scoring\nMatch Score 0–100"]
    COMPARE --> GENERATE["generate\ngenerate_suggestions_node\n—\nLLM rewrites\nwith evidence_span"]
    GENERATE --> VERIFY["verify_grounding\nverify_grounding_node\n—\nOutput Guardrail\ngroundedness check\n→ audit_log"]
    VERIFY --> END_N([END])

    style PARSE fill:#4f46e5,color:#fff
    style RETRIEVE fill:#7c3aed,color:#fff
    style COMPARE fill:#9333ea,color:#fff
    style GENERATE fill:#c026d3,color:#fff
    style VERIFY fill:#db2777,color:#fff
```

**State:** `cv_raw` · `jd_raw` → `cv_lines` · `requirements` → `assessments` · `match_score` → `suggestions` (with `evidence_span`) → `grounding_results` · `is_grounded`

### 4b. Mock Interview Agent (STAR Rubric)

```mermaid
graph LR
    START2([START]) -->|"route_interview_entry()"| COND{{"has user_answer?"}}
    COND -->|"Yes → score first"| SCORE["score_answer\nscore_answer_node\n—\nSTAR scoring\nS/T/A/R 0–5\n+ feedback_text\n(retry 1×)"]
    COND -->|"No → first question"| ASK["ask_question\nask_question_node\n—\nGenerate next question\nbased on JD + CV\n+ chat_history"]
    SCORE --> ASK
    ASK --> END2([END])

    style SCORE fill:#059669,color:#fff
    style ASK fill:#0284c7,color:#fff
```

**State:** `job_role` · `cv_summary` · `jd_context` · `current_round` / `total_rounds` (3–4) → `situation_score` · `task_score` · `action_score` · `result_score` · `feedback_text` · `next_question`

---

## 5. Database Schema (ERD)

```mermaid
erDiagram
    users {
        string id PK
        string role "student | advisor"
        string full_name
        string email
        string student_code
        string major
        string cohort
        string title
        string office
    }

    advisor_assignments {
        string id PK
        string advisor_id FK
        string student_id FK
        datetime assigned_at
    }

    share_grants {
        string id PK
        string owner_id FK
        string kind "cv | interview"
        string item_id
        datetime shared_at
        datetime advisor_viewed_at
    }

    advisor_reviews {
        string id PK
        string advisor_id FK
        string student_id FK
        string session_id
        string comment
        datetime seen_at
    }

    advisor_notes {
        string id PK
        string advisor_id FK
        string student_id FK
        string body
        json tags
        bool pinned
    }

    messages {
        string id PK
        string advisor_id FK
        string student_id FK
        string sender_id FK
        string body
        datetime read_at
    }

    cv_versions {
        string id PK
        string owner_id FK
        string family_id
        int version
        int major
        int minor
        string file_name
        string file_type
        string content_text
        string origin "upload | optimized | restored"
        bool is_active
        bool is_draft
        json developing_skills
    }

    job_descriptions {
        string id PK
        string source "library | pasted"
        string owner_id FK
        string title
        string company
        string level "intern | fresher | junior"
        string content
        json skills
    }

    gap_analyses {
        string id PK
        string owner_id FK
        string cv_version_id
        string jd_id FK
        string status "processing | completed | failed"
        string current_step
        float match_score
        json result
        int llm_calls
    }

    cv_optimizations {
        string id PK
        string analysis_id
        string owner_id FK
        string status "draft | finalized"
        json decisions
        json capability_answers
        string result_cv_version_id
    }

    cv_edit_audit {
        string id PK
        string owner_id FK
        string analysis_id
        string suggestion_id
        string action "accept | edit | reject | undo"
        string original_content
        string ai_suggestion
        string final_content
        string evidence_text
    }

    cv_exports {
        string id PK
        string owner_id FK
        string cv_version_id
        string format "docx | print | text"
        datetime integrity_confirmed_at
    }

    interview_sessions {
        string id PK
        string owner_id FK
        string jd_id FK
        string cv_version_id
        string status "in_progress | completed"
        int current_index
        float overall_score
        json star "S/T/A/R averages"
        bool pause_used
    }

    interview_turns {
        string id PK
        string session_id FK
        int index
        string question
        string answer
        float situation
        float task
        float action
        float result
        float score
        string feedback
    }

    feedback {
        string id PK
        string user_id FK
        string response_id
        string kind "thumb | csat"
        int value
        string activity
        bool would_reuse
    }

    users ||--o{ advisor_assignments : "advisor has"
    users ||--o{ advisor_assignments : "student assigned to"
    users ||--o{ cv_versions : "owns"
    users ||--o{ gap_analyses : "runs"
    users ||--o{ interview_sessions : "starts"
    users ||--o{ share_grants : "grants"
    users ||--o{ advisor_notes : "written by advisor"
    users ||--o{ advisor_reviews : "written by advisor"
    users ||--o{ messages : "sends"
    users ||--o{ feedback : "submits"
    users ||--o{ cv_optimizations : "owns"

    cv_versions ||--o{ gap_analyses : "analyzed by"
    gap_analyses ||--o| cv_optimizations : "triggers"
    cv_optimizations ||--o{ cv_edit_audit : "logs decisions"
    cv_versions ||--o{ cv_exports : "exported as"

    job_descriptions ||--o{ gap_analyses : "compared with"
    job_descriptions ||--o{ interview_sessions : "used in"
    interview_sessions ||--o{ interview_turns : "contains"
```

---

## 6. Data Flow — 3 Core User Journeys

### 6a. Gap Analysis Flow (US-SV-02)

```mermaid
sequenceDiagram
    actor SV as 🎓 Sinh viên
    participant FE as Next.js Frontend
    participant API as FastAPI /api/v1
    participant SVC as gap_analysis service
    participant AGENT as LangGraph\nGap Analysis Agent
    participant LLM as LLM API\n(Groq/OpenRouter)
    participant VDB as ChromaDB\n(JD Vector Store)
    participant DB as SQLite

    SV->>FE: Chọn CV + JD, bấm "Phân tích"
    FE->>API: POST /analysis {cv_version_id, jd_id}
    API->>DB: Tạo GapAnalysis(status=processing)
    API-->>FE: {analysis_id} (immediate)
    Note over FE: Polling GET /analysis/{id}

    API->>SVC: run_gap_analysis(cv_text, jd)
    SVC->>AGENT: ainvoke(GapAnalysisState)

    AGENT->>AGENT: parse_cv_node\n(extract cv_lines)
    AGENT->>VDB: retrieve_context_node\n(fetch JD embeddings)
    VDB-->>AGENT: relevant_chunks
    AGENT->>AGENT: compare_gap_node\n(skill_matching, score)
    AGENT->>LLM: generate_suggestions_node\n(rewrite with evidence)
    LLM-->>AGENT: raw_suggestions
    AGENT->>AGENT: verify_grounding_node\n(guardrail check)

    AGENT-->>SVC: GapAnalysisState (final)
    SVC->>DB: Update GapAnalysis(status=completed, result, match_score)
    FE->>API: GET /analysis/{id}
    API-->>FE: {match_score, suggestions, breakdown}
    FE-->>SV: Hiển thị kết quả phân tích
```

### 6b. Mock Interview Flow (US-SV-04)

```mermaid
sequenceDiagram
    actor SV as 🎓 Sinh viên
    participant FE as Next.js Frontend
    participant API as FastAPI /api/v1
    participant SVC as interview service
    participant AGENT as LangGraph\nInterview Agent
    participant LLM as LLM API

    SV->>FE: Bấm "Bắt đầu phỏng vấn" (CV + JD)
    FE->>API: POST /interviews {jd_id, cv_version_id}
    API->>SVC: start_session()
    SVC->>AGENT: ainvoke(state, user_answer=None)\n→ route: ask_question
    AGENT->>LLM: ask_question_node\n(generate Q1 from JD+CV)
    LLM-->>AGENT: question_1
    AGENT-->>SVC: {current_question: Q1}
    SVC->>DB: Tạo InterviewSession + InterviewTurn(index=1)
    API-->>FE: {session_id, question_1, deadline}
    FE-->>SV: Hiển thị câu hỏi + bộ đếm giờ

    loop Mỗi vòng (3–4 vòng)
        SV->>FE: Gõ & gửi câu trả lời
        FE->>API: POST /interviews/{id}/answer {answer}
        API->>SVC: submit_answer()
        SVC->>AGENT: ainvoke(state, user_answer=answer)\n→ route: score_answer → ask_question
        AGENT->>LLM: score_answer_node\n(STAR scoring + feedback)
        LLM-->>AGENT: S/T/A/R scores + feedback
        AGENT->>LLM: ask_question_node\n(Q_next hoặc kết thúc)
        LLM-->>AGENT: next_question | null
        AGENT-->>SVC: updated state
        SVC->>DB: Update InterviewTurn(scores)\nCreate next InterviewTurn
        API-->>FE: {scores, feedback, next_question}
        FE-->>SV: Hiển thị điểm + câu hỏi tiếp
    end

    SVC->>DB: Update InterviewSession(status=completed, overall_score, star)
    FE-->>SV: Chuyển tới trang Báo cáo
```

### 6c. Advisor HITL Flow (US-ADV)

```mermaid
sequenceDiagram
    actor SV as 🎓 Sinh viên
    actor ADV as 👩‍🏫 Cố vấn
    participant FE as Next.js Frontend
    participant API as FastAPI /api/v1
    participant DB as SQLite

    SV->>FE: Trang "Chia sẻ với Cố vấn"
    FE->>API: POST /sharing {kind, item_id}
    API->>DB: Tạo ShareGrant(owner, kind, item_id)
    API-->>FE: OK
    FE-->>SV: Đã chia sẻ

    ADV->>FE: Trang "Sinh viên phụ trách"
    FE->>API: GET /advisor/students
    API->>DB: Query AdvisorAssignment + StudentProgress
    API-->>FE: student_list + stats
    FE-->>ADV: Dashboard tổng quan

    ADV->>FE: Xem hồ sơ SV cụ thể
    FE->>API: GET /advisor/students/{id}
    API->>DB: Verify ShareGrant\n+ Get CV, Interviews
    API-->>FE: student profile + shared docs
    FE-->>ADV: Hồ sơ (tab CV, Phỏng vấn, Ghi chú)

    ADV->>FE: Viết nhận xét phỏng vấn
    FE->>API: POST /advisor/reviews {session_id, comment}
    API->>DB: Tạo AdvisorReview
    API-->>FE: OK

    ADV->>FE: Nhắn tin cho SV
    FE->>API: POST /messages {body}
    API->>DB: Tạo Message(advisor_id, student_id)
    API-->>FE: OK

    SV->>FE: Xem nhận xét (trang Lịch sử)
    FE->>API: GET /advisor/reviews?session={id}
    API->>DB: Get AdvisorReview\nUpdate seen_at
    API-->>FE: review
    FE-->>SV: Hiển thị nhận xét cố vấn
```

---

## 7. Deployment Architecture

```mermaid
graph TB
    subgraph DOCKER["🐳 Docker Compose"]
        subgraph FE_C["frontend container\nNode.js 18"]
            FE_APP["Next.js\nnpm run dev / build\n:3000"]
        end

        subgraph BE_C["backend container\nPython 3.11"]
            BE_APP["FastAPI + Uvicorn\n:8000"]
            VENV[".venv"]
        end

        subgraph DATA_C["data volumes"]
            VOL_DB["./data/app.db\n(SQLite)"]
            VOL_CHR["./data/chroma\n(ChromaDB)"]
            VOL_UPL["./data/uploads\n(CV files)"]
        end
    end

    subgraph EXT["External"]
        LLM_E["LLM API\n(Groq / OpenRouter / OpenAI)"]
        LS_E["LangSmith\n(Tracing)"]
    end

    DEV["👨‍💻 Developer\n localhost"] --> FE_C
    FE_C -->|"REST :8000"| BE_C
    BE_C --> DATA_C
    BE_C -->|HTTPS| LLM_E
    BE_C -.->|traces| LS_E
```

---

## 8. Technology Stack Summary

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) + TypeScript | Student & Advisor UI |
| **Styling** | Tailwind CSS + shadcn/ui | Component library |
| **Backend** | FastAPI + Python 3.11 | REST API, async |
| **ORM** | SQLAlchemy 2.0 + Alembic | DB models & migrations |
| **Database** | SQLite (`./data/app.db`) | Persistence |
| **Vector Store** | ChromaDB (`./data/chroma`) | JD embeddings for RAG |
| **AI Orchestration** | LangGraph (StateGraph) | Agent workflows |
| **LLM** | Groq / OpenRouter / OpenAI | Text generation |
| **LLM Client** | `langchain-openai` (ChatOpenAI) | Unified LLM interface |
| **Observability** | LangSmith | AI call tracing |
| **Auth** | `X-Demo-Role` header | Demo-mode role switching |
| **Containerization** | Docker + Docker Compose | Deployment |
| **Validation** | Pydantic v2 | Schema & settings |
| **Config** | `pydantic-settings` + `.env` | Environment management |
