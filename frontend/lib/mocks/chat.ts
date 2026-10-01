// Tin nhắn SV ↔ cố vấn ở chế độ mock: cùng quy tắc với src/services/messages.py và cùng tin nhắn demo với
// MESSAGES trong src/db/demo_cohort.py (tên người là giả định).

import type { ChatMessage, Role } from "@/lib/types"

export const MAX_MESSAGE_CHARS = 2000

export interface StoredMessage {
  id: string
  from: Role
  body: string
  created_at: string
  /** Lúc người nhận đọc. */
  read_at: string | null
}

const HOUR = 3_600_000

/** (người gửi, số giờ trước, người nhận đã đọc?, nội dung) */
const DEMO_MESSAGES: Record<string, [Role, number, boolean, string][]> = {
  "sv-0151": [
    [
      "advisor",
      70,
      true,
      "Chào Huy, mình đã xem báo cáo buổi 4 của em. Phần Kết quả em thử nêu thêm số liệu đo được, ví dụ thời gian phản hồi API trước và sau khi tối ưu.",
    ],
    ["student", 66, true, "Dạ em cảm ơn ạ. Em sẽ bổ sung số liệu vào câu trả lời và luyện lại trong tuần này."],
  ],
  "sv-0152": [
    [
      "student",
      20,
      false,
      "Em chào cố vấn ạ. Mấy buổi gần đây điểm của em không tăng, nhất là phần Hành động. Em có thể đặt lịch gặp trong giờ tư vấn tuần này không ạ?",
    ],
  ],
  "sv-0158": [
    ["advisor", 140, true, "Hưng chuẩn bị rất tốt. Tuần tới em ghé phòng A2.305 để trao đổi thêm về vị trí PO Assistant nhé."],
    ["student", 5, false, "Dạ vâng ạ. Em ghé vào chiều thứ 5 được không ạ?"],
  ],
}

/** Tin nhắn theo mã SV, cũ → mới. */
export function seedThreads(now = Date.now()): Record<string, StoredMessage[]> {
  return Object.fromEntries(
    Object.entries(DEMO_MESSAGES).map(([studentId, items]) => [
      studentId,
      items.map(([from, hours, read, body], i) => ({
        id: `msg_${studentId.slice(3)}_${i + 1}`,
        from,
        body,
        created_at: new Date(now - hours * HOUR).toISOString(),
        read_at: read ? new Date(now - (hours - 1) * HOUR).toISOString() : null,
      })),
    ]),
  )
}

export function toChatMessage(message: StoredMessage, viewer: Role): ChatMessage {
  return {
    id: message.id,
    body: message.body,
    created_at: message.created_at,
    mine: message.from === viewer,
    read_at: message.read_at,
  }
}

/** Tin người kia gửi mà người xem chưa đọc. */
export const unreadFor = (messages: StoredMessage[], viewer: Role) =>
  messages.filter((m) => m.from !== viewer && !m.read_at).length
