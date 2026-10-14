# SPEC-02: Day 2 — Frontend Chat Widget, Memory & Streaming

> **Mục tiêu Ngày 2:** Tích hợp giao diện Chat Widget hiện đại vào Next.js App Router. Người dùng ở bất kỳ trang nào cũng có thể bật widget, đặt câu hỏi hướng dẫn sử dụng, nhận câu trả lời dạng Markdown, xem nguồn trích dẫn, và kích hoạt hành động chuyển trang mượt mà.

---

## Task 2.1: TypeScript Interfaces & API Client

### File: `frontend/types/assistant.ts`
Định nghĩa các kiểu dữ liệu cho toàn bộ hệ thống Assistant trên Frontend:
```typescript
export type UserRole = "student" | "advisor";

export type ActionType =
  | "NAVIGATE_PAGE"
  | "HIGHLIGHT_ELEMENT"
  | "FILL_FILTER"
  | "OPEN_MODAL"
  | "START_ANALYSIS"
  | "SELECT_STUDENT"
  | "SCROLL_TO"
  | "RESET_VIEW";

export interface AgentAction {
  id: string;
  action_type: ActionType;
  params: Record<string, any>;
  requires_confirmation: boolean;
  confirmation_message?: string;
  description_vi: string;
}

export interface SourceCitation {
  title: string;
  route?: string;
  section?: string;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  content: string;
  created_at: string;
  actions?: AgentAction[];
  sources?: SourceCitation[];
  is_streaming?: boolean;
}

export interface ClientPageContext {
  current_url: string;
  route: string;
  user_role: UserRole;
  user_id?: string;
  selected_cv_id?: string;
  page_state?: Record<string, any>;
}

export interface ChatRequestPayload {
  message: string;
  conversation_id?: string;
  context: ClientPageContext;
}

export interface ChatResponsePayload {
  conversation_id: string;
  turn_id: string;
  message: string;
  intent: "qa" | "action" | "hybrid";
  actions: AgentAction[];
  sources: SourceCitation[];
}
```

### File: `frontend/lib/assistant-api.ts`
Cung cấp các hàm gọi API sang FastAPI backend:
- `sendMessage(payload: ChatRequestPayload): Promise<ChatResponsePayload>`
- `confirmAction(actionId: string, status: "executed" | "rejected" | "failed"): Promise<void>`
- `submitFeedback(turnId: string, rating: number, comment?: string): Promise<void>`
- `getConversationHistory(conversationId: string): Promise<ChatMessage[]>`

---

## Task 2.2: Assistant Context & State Management

### File: `frontend/components/assistant/assistant-provider.tsx`
Tạo React Context `AssistantContext` quản lý toàn bộ vòng đời của trợ lý:
- State:
  - `isOpen: boolean`: Bật / tắt khung chat.
  - `messages: ChatMessage[]`: Danh sách tin nhắn trong phiên.
  - `conversationId: string | null`: Lưu ID phiên (lưu cache vào `localStorage`).
  - `isThinking: boolean`: Trạng thái đang tải/suy nghĩ của trợ lý.
  - `activeAction: AgentAction | null`: Action đang chờ xác nhận (Confirmation Dialog).
- Hooks & Auto-Context:
  - Tự động lấy `pathname = usePathname()`.
  - Nhận diện `user_role` dựa trên URL path (`/advisor/*` -> "advisor", ngược lại -> "student").
- Các hàm cung cấp:
  - `sendMessage(text: string): Promise<void>`
  - `clearChat(): void`
  - `toggleChat(): void`
  - `executeAction(action: AgentAction): void`

---

## Task 2.3: Nút Bật Chat Nổi (Floating Trigger Button)

### File: `frontend/components/assistant/chat-trigger.tsx`
- Vị trí: Cố định góc dưới bên phải màn hình (`fixed bottom-6 right-6 z-40`).
- Thiết kế:
  - Icon Bot hoặc Sparkles từ `lucide-react`.
  - Hiệu ứng gradient tinh tế (e.g. `bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700`).
  - Badge thông báo hoặc tooltip: "Cần trợ giúp? Bấm hoặc nhấn Ctrl + K".
  - Hỗ trợ phím tắt toàn cục: `Ctrl + K` hoặc `Cmd + K` để mở/đóng nhanh.

---

## Task 2.4: Khung Chat Widget (Chat Panel)

### File: `frontend/components/assistant/chat-panel.tsx`
Giao diện hộp chat nổi bật hoặc Slide-over Panel (`fixed bottom-24 right-6 w-[420px] max-w-[95vw] h-[600px] max-h-[80vh] shadow-2xl rounded-2xl border bg-card flex flex-col z-50 overflow-hidden`):

1. **Header:**
   - Avatar AI, Tiêu đề "Trợ lý hướng dẫn EDU-17".
   - Badge hiển thị ngữ cảnh hiện tại (e.g. `Trang: /student/analysis`).
   - Nút "Xoá lịch sử", nút "Thu nhỏ", nút "Đóng".
2. **Message List:**
   - Render tin nhắn người dùng và trợ lý.
   - Hỗ trợ Markdown rendering (Bold, Bullet points, Code blocks).
   - Component trích dẫn nguồn `SourceAccordion`: Hiển thị danh sách các trang tài liệu tham khảo kèm liên kết.
   - Component danh sách Actions `ActionBadges`:
     - Nếu có action `NAVIGATE_PAGE`: hiển thị nút "👉 Bấm để chuyển đến trang này ngay".
     - Nếu có action `HIGHLIGHT_ELEMENT`: hiển thị nút "🎯 Nhấn để xem vị trí nút".
3. **Suggestion Chips:**
   - Gợi ý các câu hỏi nhanh theo trang hiện tại:
     - Khi ở `/student/analysis`: "Match score tính thế nào?", "Nút phân tích ở đâu?".
     - Khi ở `/student/interview`: "Cách trả lời theo chuẩn STAR?", "Xem lịch sử các phiên".
4. **Input Area:**
   - Textarea tự co giãn chiều cao theo nội dung nhập.
   - Nút gửi (Send icon) kích hoạt khi có text hoặc phím `Enter` (Shift + Enter để xuống dòng).

---

## Task 2.5: Tích hợp vào Root Layout

### File: `frontend/app/layout.tsx`
Bọc toàn bộ ứng dụng bên trong `AssistantProvider` và render `ChatTrigger` cùng `ChatPanel`:
```tsx
import { AssistantProvider } from "@/components/assistant/assistant-provider";
import { ChatTrigger } from "@/components/assistant/chat-trigger";
import { ChatPanel } from "@/components/assistant/chat-panel";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <AssistantProvider>
          {children}
          <ChatTrigger />
          <ChatPanel />
        </AssistantProvider>
      </body>
    </html>
  );
}
```

---

## Task 2.6: Kiểm thử Frontend (DoD Ngày 2)

- [ ] Mở trình duyệt tại `http://localhost:3000/student/analysis`.
- [ ] Thấy nút Chat nổi ở góc phải dưới. Bấm mở hộp chat.
- [ ] Bấm vào gợi ý hoặc nhập "Làm sao để bắt đầu phân tích CV?".
- [ ] Nhận được câu trả lời giải thích chi tiết, có định dạng Markdown đẹp mắt, có trích dẫn nguồn tài liệu.
- [ ] Nhập "Chuyển tôi sang trang lịch sử" -> Chatbot trả lời xác nhận và tự động điều hướng trình duyệt sang `/student/history`.
- [ ] Chạy `cd frontend && npm run typecheck && npm run lint` -> Không có lỗi.
