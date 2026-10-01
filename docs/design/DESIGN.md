# DESIGN.md — CareerX Design System

Tài liệu này là nguồn tham chiếu thiết kế cho Claude Code khi build frontend Next.js của CareerX. Đặt file này ở gốc repo (cạnh `CLAUDE.md` nếu có). Mọi màn hình mới nên tái sử dụng token và component mô tả ở đây thay vì tự đặt màu/khoảng cách mới.

**Nguồn gốc:** các token và component bên dưới được trích từ landing page demo (`CareerX.html` (cùng thư mục `docs/design/`), hướng thiết kế "B", lấy cảm hứng từ ventriloc.ca). Landing page đó là **bản trình diễn tĩnh (HTML/CSS/JS thuần)**, không phải code sản phẩm — nhiệm vụ ở đây là dựng lại đúng ngôn ngữ thiết kế đó bằng component Next.js thật, có thể tái sử dụng cho các màn hình trong Figma (dashboard sinh viên, phân tích CV, phỏng vấn STAR, màn cố vấn...).

---

## 1. Tech stack đề xuất

- **Next.js** (App Router) + TypeScript.
- **Tailwind CSS**, cấu hình token bên dưới thành theme thay vì hardcode màu trong className.
- Font qua `next/font/google` (không dùng `<link>` tới Google Fonts thủ công).
- Nếu cần thư viện component nền (dialog, dropdown, tooltip...), ưu tiên **shadcn/ui** hoặc **Radix UI** rồi restyle theo token ở đây — không kéo nguyên bộ theme có sẵn của thư viện khác.
- Icon: outline, stroke ~1.75–2px, bo góc nhẹ (xem cách vẽ SVG trong bento cards) — có thể dùng `lucide-react` làm bộ icon nền rồi chỉnh stroke-width cho khớp.

Nếu dự án đã chọn stack khác (CSS Modules, styled-components, không dùng Tailwind...), báo lại để chỉnh phần ánh xạ token, phần còn lại vẫn áp dụng nguyên.

---

## 2. Design tokens

### 2.1 Màu sắc — Light mode (mặc định)

| Token | Hex | Vai trò |
|---|---|---|
| `--bg` | `#FFFFFF` | nền trang |
| `--surface` | `#F3F6FC` | nền section xen kẽ, nền pill/badge |
| `--card` | `#FFFFFF` | nền thẻ, dropdown |
| `--ink` | `#0B1B3A` | chữ chính |
| `--ink-2` | `#41506F` | chữ phụ |
| `--ink-3` | `#64708B` | chữ mờ, label, placeholder |
| `--line` | `#E1E8F5` | viền, đường phân cách |
| `--blue` | `#2563EB` | **màu thương hiệu chính**, nút primary, link, focus ring |
| `--blue-soft` | `#E4EDFF` | nền badge/kicker màu xanh |
| `--on-blue` | `#FFFFFF` | chữ trên nền `--blue` |
| `--violet` | `#6741E0` | màu nhấn phụ (gradient tiêu đề, badge thứ hai) |
| `--violet-soft` | `#EEE9FD` | nền badge màu tím |
| `--gold` | `#E0B852` | màu nhấn cao cấp — dùng cho underline nhấn, icon nổi bật, cột tiêu đề trên footer tối |
| `--navy` | `#0B1533` | nền tối (footer, khối CTA tối) |
| `--good` / `--good-soft` | `#12784B` / `#DDF3E7` | trạng thái tích cực (đạt, đã chấp nhận) |
| `--warn` / `--warn-soft` | `#8F4E00` / `#FBEBCF` | trạng thái cảnh báo (thiếu, cần bổ sung) |
| `--bad` / `--bad-soft` | `#B3261E` / `#FBE0DD` | trạng thái lỗi/từ chối |

### 2.2 Màu sắc — Dark mode

| Token | Hex |
|---|---|
| `--bg` | `#070D1B` |
| `--surface` | `#0C1428` |
| `--card` | `#101A32` |
| `--ink` | `#EDF1FA` |
| `--ink-2` | `#B4BFD6` |
| `--ink-3` | `#8894AE` |
| `--line` | `#202C48` |
| `--blue` | `#7C9DFF` |
| `--blue-soft` | `#16234A` |
| `--on-blue` | `#07101F` |
| `--violet` | `#A996FF` |
| `--violet-soft` | `#221D4A` |
| `--good` / `--good-soft` | `#5CD19A` / `#123B2C` |
| `--warn` / `--warn-soft` | `#F0B24D` / `#3A2C12` |
| `--bad` / `--bad-soft` | `#FF8F86` / `#3F1C1A` |

`--gold` và `--navy` giữ nguyên ở cả hai theme (không đảo màu).

### 2.3 Typography

- **Heading font:** `Plus Jakarta Sans` (weight 500/600/700/800), fallback `Be Vietnam Pro, system-ui, sans-serif`.
- **Body font:** `Be Vietnam Pro` (weight 400/500/600), fallback `system-ui, -apple-system, 'Segoe UI', sans-serif`.
- Cả hai đều hỗ trợ tiếng Việt có dấu — bắt buộc giữ, không đổi sang font không hỗ trợ dấu.
- Type scale:
  - `h1`: weight 800, `clamp(2.3rem, 4.5vw, 3.75rem)`, line-height 1.06, `letter-spacing: -0.025em`
  - `h2`: weight 700, `clamp(1.85rem, 3.5vw, 2.75rem)`, line-height 1.12
  - `h3`: weight 700, `1.125rem`, line-height 1.3
  - body: weight 400, `1rem`, line-height 1.6
  - lede/intro text: `clamp(1.02rem, 1.4vw, 1.15rem)`, màu `--ink-2`
  - fine print: `0.8125rem`, màu `--ink-3`
- Heading dùng `text-wrap: balance` để tránh xuống dòng lẻ chữ.
- Gradient chữ (dùng cho từ khoá nhấn trong `h1`): `linear-gradient(95deg, var(--blue), var(--violet))` + `background-clip: text` + `color: transparent`.

Next.js setup gợi ý:
```ts
import { Plus_Jakarta_Sans, Be_Vietnam_Pro } from 'next/font/google'

const heading = Plus_Jakarta_Sans({
  subsets: ['latin', 'vietnamese'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-head',
})
const body = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
})
```

### 2.4 Bo góc, khoảng cách, đổ bóng

- Bo góc: nút `12px`, thẻ/card `20px`, badge/pill/nút tròn `999px` (full), khung ảnh nhỏ trong CTA `16px`.
- Khoảng cách section: `padding-block: clamp(56px, 8vw, 104px)`.
- Container: `max-width: 1180px`, `padding-inline: clamp(16px, 4vw, 40px)`.
- Shadow:
  - `--shadow`: `0 1px 2px rgba(11,27,58,.05), 0 16px 36px -16px rgba(37,99,235,.3)` — dùng cho card nổi bật, dropdown mở.
  - `--shadow-sm`: `0 1px 2px rgba(11,27,58,.06), 0 6px 16px -8px rgba(11,27,58,.16)` — dùng cho card thường, nút soft.
  - Ở dark mode, cả hai đổi sang bóng đen: `0 1px 2px rgba(0,0,0,.4), 0 16px 36px -16px rgba(0,0,0,.7)` (shadow-sm tương tự với `-8px`).
- Breakpoint chính: mobile mặc định → `760px` (bento chuyển sang lưới) → `960px` (layout 2 cột cho vai trò/CTA) → `1000px` (pill nav + dropdown hiện, burger ẩn).

---

## 3. Component inventory

Dựng mỗi mục dưới đây thành **một component Next.js dùng lại được**, không viết lại style mỗi lần dùng.

| Component | Biến thể | Ghi chú hành vi |
|---|---|---|
| `Button` | `primary` (nền `--blue`), `soft` (viền + nền `--card`), `dark` (nền `--ink`/`--navy`, đổi theo tông header) | min-height 46px, bo góc 12px, hover nhấc nhẹ `translateY(-2px)` |
| `Badge` / `Kicker` | mặc định (xanh), `violet`, trạng thái `good/warn/bad` | pill nhỏ, chữ 13px weight 600, nền `-soft` tương ứng màu chữ |
| `PillNav` + `Dropdown` | menu ngang dạng pill, có submenu dropdown khi hover/click | header dùng, xem mục 4 |
| `Card` (`BentoCard`) | 2 cột hoặc 3 cột tuỳ nội dung (`span 2` / `span 3` trên lưới 6 cột) | icon nhỏ trong badge tròn, tiêu đề, mô tả, minh hoạ phía dưới |
| `WindowMock` | khung "giao diện minh hoạ" | titlebar giả macOS: 3 chấm tròn 11px màu đỏ `#EC6A5E`, vàng `#F4BE4F`, xanh `#61C554`, cộng nhãn text bên phải; nội dung minh hoạ UI thật bên trong |
| `Stepper` (pinned steps) | 4 bước, có rail tiến trình dọc | xem mục 5 — hành vi cuộn ghim |
| `RoleTabs` | chuyển giữa 2 vai trò (Sinh viên / Cố vấn) | dùng `role="tablist"`/`role="tab"`, điều hướng bằng phím mũi tên |
| `TrustStat` (KPI) | số liệu lớn + nhãn | dùng cho mục tiêu/độ tin cậy, không trình bày như kết quả đã đạt nếu là mục tiêu (`≥ 60%` ghi rõ "mục tiêu") |
| `FaqAccordion` | `<details>` nhóm loại trừ lẫn nhau | mở câu này tự đóng câu trước — xem mục 5 |
| `CtaCard` | khối CTA có minh hoạ, checklist, underline nhấn màu vàng | dùng ở cuối trang / cuối flow |
| `Header` | logo, pill nav, nút ngôn ngữ, nút CTA — **các phần tử tách rời, không nằm trong một khối nền** | xem mục 4 |
| `Footer` | nền `--navy`, cột liên kết tiêu đề màu `--gold`, block ngôn ngữ | luôn dùng tông chữ sáng |

---

## 4. Hành vi Header (quan trọng, dễ làm sai)

- Header `position: fixed`, **nền mặc định trong suốt** — logo/nav/nút là các phần tử riêng lẻ nổi trên nội dung, không bọc trong một thanh nền.
- Chỉ `PillNav` và nút tròn (burger, ngôn ngữ) có nền riêng (nền mờ dạng kính: `background-color` bán trong suốt + `backdrop-filter: blur(12px)`) để chữ luôn đọc được dù nội dung phía sau là gì.
- Mỗi section khai báo nó "tối hay sáng" (ví dụ `data-hbg="bg" | "surface" | "navy"`); khi phần giữa header đi qua ranh giới của section nào, `Header` đổi màu chữ/nút theo tông của section đó (đặc biệt: chuyển sang tông sáng khi đè lên footer nền `--navy`).
- Header ẩn khi cuộn xuống, hiện lại khi cuộn lên (giống ventriloc.ca) — vô hiệu hoá ẩn khi đang mở dropdown/menu mobile hoặc đang ở gần đầu trang.
- Trên mobile (`<1000px`): pill nav + dropdown ẩn, thay bằng nút burger mở menu full-width.

---

## 5. Chuyển động & tương tác

- **Reveal khi cuộn:** các khối nội dung (section, card, FAQ item, footer) ẩn (mờ + dịch xuống nhẹ) khi ngoài khung nhìn, hiện lại khi cuộn tới, và **ẩn lại khi cuộn qua khỏi** (hai chiều, không chỉ hiện một lần). Dùng `IntersectionObserver`, threshold thấp, `rootMargin` âm nhẹ để không giật khi ở sát mép màn hình. Tôn trọng `prefers-reduced-motion: reduce` — tắt hết hiệu ứng, hiển thị ngay.
- **Section cuộn ghim (pinned steps):** riêng phần theo dạng "4 bước" — tiêu đề đứng yên (`position: sticky`) trong lúc người dùng cuộn qua một track cao, nội dung từng bước và khung minh hoạ bên phải đổi theo tiến trình cuộn (không phải bấm tab để chuyển). Bản thân khối này cũng tuân theo quy tắc "ẩn khi chưa cuộn tới, hiện khi cuộn vào, ẩn khi cuộn qua" như các section khác — chỉ khác là trong lúc hiện, nó bị ghim thay vì cuộn tự do.
- **FAQ:** accordion loại trừ lẫn nhau — mở câu nào thì câu đang mở trước đó tự đóng lại.
- **Card hover:** nhấc nhẹ (`translateY(-4px)`) kèm đổi shadow từ `-sm` sang `--shadow`.

---

## 6. Nguyên tắc nội dung (áp dụng khi dựng UI có dữ liệu)

- Đây là sản phẩm tối ưu CV **không tự bịa thông tin**: mọi chỗ hiển thị gợi ý sửa CV phải có UI thể hiện rõ "gợi ý ← có thể chấp nhận/sửa/bỏ qua", không tự động áp dụng.
- Số liệu chưa đạt được (mục tiêu KPI, benchmark) phải ghi rõ là mục tiêu/ước tính, không trình bày như kết quả đã có.
- Trạng thái quyền riêng tư (chia sẻ với cố vấn hay không) cần có toggle rõ ràng trên từng tài liệu, không mặc định bật.
- **Không dùng emoji** (👋, 🎉, 🔥...) trong giao diện, kể cả khi Figma có. Cần biểu tượng thì dùng icon outline (`lucide-react`) theo mục 1 để giữ tính thẩm mĩ và nhất quán.

---

## 7. File tham chiếu cho Claude Code

Khi giao việc dựng từng màn hình, đính kèm cho agent:
1. File landing page demo này (`CareerX.html` (cùng thư mục `docs/design/`)) — để đọc token/CSS gốc.
2. `DESIGN.md` này.
3. Ảnh export của đúng frame Figma đang làm (đặt tên theo route, ví dụ `sinh-vien_phan-tich-cv.png`), kèm mô tả ngắn: mục đích màn hình, phần nào tĩnh/động, trạng thái loading/rỗng/lỗi nếu có.

Quy tắc làm việc với agent:
- Giao từng màn hình/component một, không yêu cầu dựng toàn bộ frontend trong một prompt.
- Yêu cầu agent dùng token và component đã có ở `DESIGN.md`, không tự chế màu/khoảng cách mới.
- Sau khi agent code xong một màn hình, chụp lại và so với ảnh Figma gốc để agent tự sửa chỗ lệch trước khi sang màn tiếp theo.

---

## 8. Việc cần xác nhận thêm (chưa có trong landing demo)

- Bộ input/form (text field, upload file, select, checkbox, toggle) — landing demo chưa có, cần thiết kế thêm dựa theo tông màu/bo góc ở trên khi build các màn hình dashboard.
- Empty state, loading state, error state cho từng màn hình dữ liệu thật.
- Dark mode: landing demo đã có đủ token dark, nhưng cần xác nhận sản phẩm có bật toggle theme cho người dùng hay theo hệ điều hành.

---

## 9. Token đã được triển khai ở đâu trong `frontend/`

- Toàn bộ token ở mục 2 nằm trong `frontend/app/globals.css`: biến gốc (`--bg`, `--ink`, `--blue`...) cho light mode trong `:root` và dark mode trong `.dark`.
- Token được ánh xạ sang biến của shadcn/ui (`--primary` = `--blue`, `--border` = `--line`, `--muted` = `--surface`...), nên component shadcn tự nhận màu thương hiệu.
- Class Tailwind dùng trực tiếp tên token: `bg-surface`, `text-ink-2`, `text-ink-3`, `border-line`, `bg-blue-soft text-blue`, `bg-good-soft text-good`, `bg-warn-soft text-warn`, `bg-bad-soft text-bad`, `bg-navy`, `text-gold`. Bóng đổ: `shadow-card` (= `--shadow-sm`) và `shadow-float` (= `--shadow`). Font tiêu đề: `font-heading`. Chữ gradient: `text-grad`.
- Dark mode (trả lời câu hỏi cuối mục 8): **tạm tắt**. Giai đoạn đầu luôn dùng bảng màu sáng dù hệ điều hành ở chế độ nào, để dễ theo dõi và bắt lỗi. Token tối vẫn giữ nhưng đang comment trong `globals.css`. Khi làm tính năng đổi sáng/tối: bỏ comment khối `.dark` và bỏ `forcedTheme="light"` trong `frontend/components/theme-provider.tsx` (dùng `next-themes`, class `.dark` trên `<html>`), rồi thêm nút đổi theme.
- Chức năng ngoài phạm vi Gate 1 bật/tắt qua `frontend/lib/features.ts`.
