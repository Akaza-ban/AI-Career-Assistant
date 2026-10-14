# DESIGN.md — CareerX Design System (v2)

Nguồn tham chiếu thiết kế cho mọi màn hình của ứng dụng CareerX (sinh viên và cố vấn). Khi dựng hoặc sửa giao diện, dùng token và component trong tài liệu này thay vì tự đặt màu, khoảng cách hay hiệu ứng mới.

- Bố cục và luồng của từng màn: [`WIREFRAMES.md`](WIREFRAMES.md).
- Bản mẫu tương tác (canvas gồm mọi màn của sinh viên và 4 màn cố vấn: Tổng quan, Sinh viên phụ trách, Hồ sơ sinh viên, Nhận xét buổi phỏng vấn): https://claude.ai/artifact/Qk4gymtBzk5Eg9BXB6phbc. Link ở chế độ riêng tư; chủ sở hữu cần chia sẻ thì người khác mới mở được. Khi tài liệu và bản mẫu lệch nhau, **bản mẫu là chuẩn về hình ảnh**, tài liệu này là chuẩn về token và quy tắc.

**Phạm vi:** v2 thay thế hướng "B" (ventriloc.ca) của bản trước cho cả ứng dụng và landing page. `CareerX.html` là landing cũ, chỉ còn để tham khảo nội dung; landing mới theo mục 4.1 và 7.

---

## 1. Hướng thiết kế

**Màu sắc nhẹ nhàng kiểu Family, component kiểu dashboard Stripe, tổng thể nghiêm túc.**

| Lấy từ | Lấy gì | Không lấy |
|---|---|---|
| **Family** (family.co) | Nền trắng và xám rất nhạt, nút dạng pill, góc bo mềm, bóng đổ nhẹ, chuyển động lò xo, sheet trượt từ dưới lên | Minh hoạ hoạt hình, màu kẹo ngọt, giọng văn đùa vui |
| **Stripe** (dashboard và trang giới thiệu) | Thanh tìm kiếm xám, panel xám chứa thẻ, hàng chỉ số ngăn bằng đường kẻ mảnh, biểu đồ đường mảnh, badge có chấm tròn, link "Xem thêm", dải màu pastel cắt chéo ở đầu trang | Khối gradient lớn, đậm; hình minh hoạ kiểu landing page trong dashboard |

**Nguyên tắc**
1. **Nền trung tính là mặc định.** Nội dung đặt trên nền trắng hoặc xám rất nhạt. Màu chỉ dùng cho tín hiệu (link, trạng thái, biểu đồ).
2. **Màu đen cho hành động và vị trí hiện tại.** Nút chính, mục đang chọn trên sidebar, segmented control đang chọn đều dùng `--ink`.
3. **Dải pastel chỉ nằm ở đầu trang**, phía sau nội dung (mục 4). Không đặt khối gradient lơ lửng giữa trang.
4. **Dashboard không phải landing page.** Không có thẻ minh hoạ nổi, không có ảnh chụp màn hình khác nằm trong thẻ. Mỗi thẻ hiện dữ liệu thật và một hành động.
5. **Ít chữ.** Phần chào hỏi gồm một câu, một dòng phụ và nút bấm. Mỗi thẻ có một tiêu đề, một dòng thông tin phụ và một hành động.
6. **Trung thực với dữ liệu.** Không hiện con số khi con số chưa đủ tin cậy (mục 8).

---

## 2. Tech stack

- **Next.js 16** (App Router) + TypeScript + **Tailwind CSS v4**. Token khai báo trong `frontend/app/globals.css`.
- **shadcn/ui** trên nền Radix UI, restyle theo token.
- Font qua `next/font/google`.
- Icon: **`lucide-react`**, nét outline, `strokeWidth` 1.75. **Không dùng emoji.**
- Biểu đồ: `recharts`, đường mảnh 2px màu `--accent`.
- Toast: `sonner`.

**Đề xuất thêm (cần nhóm duyệt trước khi cài):** `motion` (chuyển động lò xo, pill trượt, sheet kéo được) và `cmdk` (bảng lệnh Ctrl K).

---

## 3. Design tokens

### 3.1 Màu trung tính

| Token | Hex | Vai trò |
|---|---|---|
| `--bg` | `#FFFFFF` | nền trang |
| `--surface` | `#F4F4F5` | nút phụ, segmented control, hover, nền ô tìm kiếm |
| `--panel` | `#F7F7F9` | panel chứa thẻ ("Việc nên làm tiếp", "Phù hợp nhất với CV"), khối thông tin phụ |
| `--card` | `#FFFFFF` | thẻ, popover, sheet, dialog |
| `--ink` | `#18181B` | chữ chính, nút chính, mục đang chọn, logo |
| `--ink-2` | `#52525B` | chữ phụ |
| `--ink-3` | `#6B6B74` | nhãn, chú thích, placeholder (đạt ≥ 4.5:1 trên `--bg` và `--surface`) |
| `--line` | `#ECECEF` | đường kẻ, viền thẻ |
| `--line-strong` | `#DEDEE3` | viền ô nhập, viền badge |

### 3.2 Màu nhấn và trạng thái

| Token | Hex | Vai trò |
|---|---|---|
| `--accent` | `#5B5BD6` | link, biểu đồ, thanh tiến độ, focus ring, chấm báo tin mới |
| `--accent-strong` | `#4A4AB0` | chữ trên nền `--accent-soft`, link khi hover |
| `--accent-soft` | `#EFEFFC` | nền badge "Khá", từ khoá JD được đánh dấu, ô icon trong thẻ công việc |
| `--good` / `--good-soft` / `--good-line` | `#15803D` / `#EBF7EF` / `#CDEBD7` | đã đáp ứng, đã áp dụng, mức "Cao" |
| `--warn` / `--warn-soft` / `--warn-line` | `#9A5B00` / `#FFF6E6` / `#F5E1B8` | còn thiếu, chỗ cần tự điền số liệu, đồng hồ sắp hết giờ |
| `--bad` / `--bad-soft` | `#B42318` / `#FEF0EE` | lỗi, xoá, kết thúc sớm, đồng hồ dưới 10 giây |
| `--gold` / `--gold-soft` | `#E0B852` / `#FFF7DD` | dòng CV có gợi ý trong Trình tối ưu |
| `--night` | `#0E1020` | **chỉ dùng ở landing page:** nền dải tối "Cam kết" (mục 4.1). Chữ trắng, chữ phụ `#A3A6BE`, đường kẻ `rgba(255,255,255,.09)` |

Màu nhấn có thể đổi về sau (bản mẫu có Tweaks thử teal, cam, đen). Chỉ cần đổi `--accent`; `--accent-strong` = trộn 18% đen, `--accent-soft` = trộn 91% trắng.

### 3.3 Dải pastel (aurora)

| Token | Giá trị |
|---|---|
| `--au-1` | `#FFB59E` (đào) |
| `--au-2` | `#FF9FCB` (hồng) |
| `--au-3` | `#B8A4FF` (tím nhạt) |
| `--au-4` | `#9ED4FF` (xanh trời) |
| Chiều cao | **460px** trên desktop, **260px** trên điện thoại |
| Mép dưới | **không có mép**: tan dần xuống nền trắng bằng `mask-image` hơi nghiêng (176°), không dùng `clip-path` cắt chéo |
| Chuyển động | trôi chậm 16 giây, qua lại |

### 3.4 Typography

- **Một font duy nhất cho cả tiêu đề và nội dung: `Hanken Grotesk`** (grotesk thẳng, gần Söhne của Stripe, có dấu tiếng Việt). Nạp qua `next/font/google` trong `app/layout.tsx`.
- **Tránh "cái nhìn AI":** không ghép 2 font, không dùng weight 800, không giãn chữ quá sát. Tiêu đề tối đa weight 600–700, `letter-spacing` không chặt hơn `-0.02em`. Không dùng Inter, Geist, Plus Jakarta Sans (font mặc định của rất nhiều sản phẩm do AI dựng).
- Mọi con số dùng `font-variant-numeric: tabular-nums`.

| Cấp | Weight | Cỡ / line-height | Dùng cho |
|---|---|---|---|
| `display` | 600, `-0.025em` | 40 / 46 (điện thoại 30 / 36) | câu chào trên Tổng quan: "Chào buổi sáng/trưa/chiều/tối, {tên}!" + một câu bên dưới; 2 nút đặt đối diện bên phải, căn đáy |
| `h1` | 600, `-0.025em` | 40 / 46 (điện thoại 30 / 36) | tiêu đề trang (`PageHeader`): **cùng cỡ và bố cục với lời chào Tổng quan** — một dòng mô tả 17px bên dưới, nút/bộ chọn đặt đối diện bên phải, căn đáy |
| `h2` | 600–700 | 22–26 / 28–32 | tiêu đề khu vực ("Tiến độ của bạn", "Tất cả vị trí") |
| `h3` | 600 | 16–17 / 22–24 | tiêu đề thẻ |
| `metric` | 400 | 26 / 32 | số liệu trong hàng chỉ số (không in đậm, theo Stripe) |
| `body` | 400 | 15 / 24 | nội dung |
| `small` | 500 | 13 / 20 | thông tin phụ, nhãn |
| `micro` | 500 | 12 / 16 | badge, tiêu đề nhóm trên sidebar |

Trên điện thoại: `display` 32/38, `h1` 26/32. Tiêu đề dùng `text-wrap: balance`.

### 3.5 Bo góc

| Token | Giá trị | Dùng cho |
|---|---|---|
| — | 6px | badge |
| — | 10px | mục sidebar, ô tìm kiếm, ô nhập nhỏ |
| `--r-md` | 12px | ô nhập, thẻ nhỏ |
| `--r-card` | 16px | thẻ |
| `--r-xl` | 22px | panel, dialog, mép trên của sheet |
| pill | 999px | nút, segmented control, avatar |

### 3.6 Khoảng cách và bố cục

- Thang 4px: `4 · 8 · 12 · 16 · 20 · 24 · 28 · 32 · 40 · 56`.
- Sidebar rộng 252px. **Nội dung trải hết chiều rộng còn lại, không giới hạn max-width**; chỉ có lề 16px (điện thoại), 24px (máy tính bảng), 40px (desktop), 48px (≥ 1280px). Trên màn rộng, tăng số cột thay vì để trống hai bên.
- **Bố cục vùng và khối kiểu dashboard Stripe (không dùng thẻ chứa):**
  - **Vùng** (`Zone`): tiêu đề 26px weight 600 + link bên phải, đường kẻ `--line` ngay dưới, nội dung cách 28px. Các vùng cách nhau 56–64px.
  - **Khối** trong vùng: tiêu đề 16px weight 600, **không phụ đề**; các dòng kẻ mảnh (tên dòng weight 500, dòng phụ 13px `--ink-3`); **dòng chân** (`WidgetFooter`): link bên trái + ghi chú nhỏ bên phải, luôn nằm ở đáy khối để các khối cạnh nhau thẳng hàng.
  - Chỉ số (`MetricColumn`): tiêu đề + badge thay đổi (+22,3 xanh / âm màu cảnh báo), số 26px, đường biểu đồ mảnh, dòng chân.
  - Thẻ chỉ dùng cho việc cần hành động ("Việc nên làm tiếp"), không bọc danh sách hay chỉ số.
- Breakpoint: `< 760` điện thoại · `760–1024` máy tính bảng · `≥ 1024` desktop.
- Vùng chạm tối thiểu 44 × 44px.

### 3.7 Bóng đổ

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--shadow-xs` | `0 1px 2px rgba(24,24,27,.05)` | ô tìm kiếm, pill đang chọn |
| `--shadow-sm` | `0 1px 3px rgba(24,24,27,.06), 0 1px 2px rgba(24,24,27,.03)` | thẻ |
| `--shadow-md` | `0 12px 28px -12px rgba(24,24,27,.16)` | thẻ khi hover |
| `--shadow-lg` | `0 24px 60px -20px rgba(24,24,27,.3)` | dialog, lớp phủ |

### 3.8 Chuyển động

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` | xuất hiện, mở rộng |
| `--ease-spring` | `cubic-bezier(.34,1.4,.64,1)` | pill trượt, sheet, dialog |
| — | 120ms | nhấn nút (`scale(.97)`) |
| — | 220–380ms | hover thẻ, pill, sheet |
| — | 1100ms | đếm số và vẽ vòng điểm khi xuất hiện lần đầu |

Tôn trọng `prefers-reduced-motion`: tắt chuyển động, dải pastel đứng yên, số hiện ngay giá trị cuối.

---

## 4. Dải pastel: dùng ở đâu

- **Có dải:** đầu mọi trang có sidebar (Tổng quan, Thư viện JD, Kết quả phân tích, Trình tối ưu CV…) và trang tương ứng trên điện thoại. Dải nằm **phía sau** header, tiêu đề và phần đầu nội dung.
- **Không có dải:** chế độ tập trung (Phòng chờ, Phòng phỏng vấn), dialog, sheet.
- **Không bao giờ:** khối gradient giữa trang, nền gradient cho thẻ, banner gradient. Lời khuyên AI, nhận xét AI và các khối thông tin khác dùng nền trung tính (`--card` có viền, hoặc `--panel`).
- Trên nền dải, ô tìm kiếm và nút phụ dùng nền trắng mờ `rgba(255,255,255,.7)` kèm `backdrop-filter: blur(8px)`.

```css
/* frontend/app/globals.css: .aurora-band */
.aurora-band{position:absolute;inset:0 0 auto 0;height:460px;z-index:0;pointer-events:none;
  background:radial-gradient(42% 90% at 6% 8%,var(--au-4) 0%,transparent 62%),
             radial-gradient(38% 95% at 34% -6%,var(--au-3) 0%,transparent 62%),
             radial-gradient(40% 95% at 66% 4%,var(--au-2) 0%,transparent 62%),
             radial-gradient(40% 100% at 98% 22%,var(--au-1) 0%,transparent 62%);
  background-size:150% 150%;
  mask-image:linear-gradient(176deg,#000 0%,#000 30%,transparent 92%); /* tan dần, không lộ mép dưới */
  animation:aurora-drift 16s ease-in-out infinite alternate}
@keyframes aurora-drift{from{background-position:0% 0%}to{background-position:100% 60%}}
```

Ngoại lệ có chủ đích: vòng điểm ở Kết quả phân tích tô gradient pastel (`#7FC4FF → #9F86FF → #FF8FB8`), thanh "Đang phân tích…" chạy gradient pastel.

### 4.1 Landing page: một dải tối làm điểm dừng

Trang giới thiệu dài và chủ yếu nền trắng, nên có **đúng một** dải nền `--night` kéo hết chiều ngang (phần "Cam kết") để chia nhịp trang, theo cách Stripe dùng các mảng tối. Quy tắc:
- Nền đặc `--night`, không gradient lớn; chỉ có 1–2 quầng sáng mờ (blur 60px, độ mờ ≤ 0,35) ở góc.
- Thẻ trên nền tối: `rgba(255,255,255,.05)` + viền `rgba(255,255,255,.09)`. Đường nối trong sơ đồ dùng gradient pastel của dải aurora.
- Không dùng nền tối trong ứng dụng (sinh viên, cố vấn) và các trang đăng nhập / đăng ký.

---

## 5. Khung ứng dụng

### 5.1 Logo

- Chỉ dùng **hình chữ X** của logo cũ (khiên, chữ X, mũi tên, ngôi sao), màu `--ink`, nền trong suốt, **không có khung**.
- Bên cạnh là chữ "CareerX" (Jakarta 800, 20px, `-0.04em`). Không có dòng phụ.
- File: `frontend/public/brand/careerx-glyph.png` (tạo từ `careerx-mark.png`).

### 5.2 Sidebar (desktop)

- Rộng 252px, nền trắng, viền phải `--line`. Không có thẻ cố vấn hay thẻ quảng bá ở cuối.
- Chia nhóm, tiêu đề nhóm cỡ `micro`, màu `--ink-3`:

| Nhóm | Mục |
|---|---|
| (không tiêu đề) | Tổng quan |
| Hồ sơ | CV của tôi · Thư viện JD |
| Luyện tập | Phân tích CV & JD · Luyện phỏng vấn · Tiến bộ |
| Tài khoản | Chia sẻ với cố vấn · Cài đặt |

- Mục thường: chữ `--ink-2`, hover nền `--surface`. **Mục đang chọn: nền `--ink`, chữ trắng, weight 600.**
- Cố vấn: Tổng quan · Sinh viên phụ trách (cùng kiểu).

### 5.3 Header (mọi trang desktop)

Giống nhau trên mọi trang, không thay đổi theo trang. **Header dính trên cùng khi cuộn** (`sticky top-0`): ở đầu trang trong suốt để thấy dải pastel; cuộn xuống thì nền trắng mờ `bg-background/85` + `backdrop-blur` và đường kẻ dưới `--line`.
- Trái: ô tìm kiếm rộng tối đa 520px, nền trắng mờ, placeholder "Tìm vị trí, thao tác…", phím tắt `Ctrl K`.
- Phải: tin nhắn (chấm `--accent` khi có tin mới), thông báo, avatar tròn nền `--ink`. Menu avatar chỉ có tên và "Đổi vai trò"; **Cài đặt chỉ nằm trên sidebar**, không lặp lại ở menu avatar.
- Breadcrumb và thao tác riêng của trang nằm ở một dòng riêng ngay dưới header.

**Bảng nổi của header** (menu avatar, thông báo, tin nhắn) dùng chung một kiểu (`floatingSurface` trong `components/shell/notification-menu.tsx`): nền `--card`, bo 18px, `--shadow-md` (class `shadow-float`), viền `ring-1 --line`. Không dùng icon màu, không viết hoa tiêu đề nhóm.
- **Menu avatar** (rộng 288px): đầu menu có avatar 40px, tên và một dòng phụ; bên dưới chỉ có "Đổi vai trò". Mục bo 8px, hover nền `--panel`.
- **Thông báo** (rộng 400px): tiêu đề + "N chưa đọc", segmented `sm` Tất cả / Chưa đọc; nhóm "Hôm nay" / "Trước đó". Icon trung tính trong vòng tròn `--surface`, chỉ cảnh báo liêm chính dùng `--bad`. Chưa đọc: chấm `--accent` trên icon, tiêu đề weight 500. **Cả dòng là một link**; bấm vào thì mở trang liên quan và **đánh dấu đã đọc ngay** (không chờ tải lại). Cuối bảng có "Đánh dấu tất cả đã đọc" khi còn tin chưa đọc.
- **Tin nhắn** (bảng trượt rộng 400px, `--shadow-lg`): tiêu đề không icon màu, dòng giờ trực nền `--panel`, tin của mình nền `--ink` chữ trắng, ô soạn bo 14px viền `--line-strong`, focus viền `--ink`.

### 5.4 Điện thoại (< 760px)

- **Thanh tab dưới đáy, 5 mục:** Tổng quan · Thư viện · Phân tích · Phỏng vấn · Tôi. Mục đang chọn màu `--ink` kèm vạch nhỏ trên đầu. "Tôi" mở sheet: CV của tôi, Tiến bộ, Chia sẻ, Cài đặt, Đăng xuất.
- Header gồm tiêu đề trang, nút tìm kiếm và avatar.
- **Không hiện thanh cuộn, không cuộn ngang.** Khung trang vừa đúng màn hình; danh sách xếp dọc.
- Bố cục 2 cột đổi thành 1 cột. Thông tin phụ mở bằng sheet.

### 5.5 Chế độ tập trung (Phòng chờ, Phòng phỏng vấn)

- Không sidebar, không dải pastel. Thanh trên cao 64px: "Rời phòng" · logo + tên buổi · đồng hồ · Tạm dừng.
- "Rời phòng" mở `ConfirmDialog` (kiểu nguy hiểm) rồi **quay về trang Luyện phỏng vấn** (`/student/interview/new`), không về Tổng quan.
- Nội dung một cột, rộng tối đa 820px.
- *Thiết kế Phòng phỏng vấn đang tạm chốt; có thể làm lại khi có ý tưởng tốt hơn.*

---

## 6. Component

| Component | Quy cách |
|---|---|
| `Button` | `primary`: nền `--ink`, chữ trắng, pill, cao 44–46px · `secondary`: nền `--surface` · `ghost`: không nền · `danger`: nền `--bad` · `link`: chữ `--accent`, weight 600 |
| `Badge` | bo 6px, viền 1px, cỡ 12px, chấm tròn 6px màu chữ. Biến thể theo token trạng thái |
| `MatchLabel` | badge mức phù hợp, xem mục 8.2 |
| `SegmentedControl` | nền `--surface`, pill trượt nền trắng + `--shadow-xs`; chữ đang chọn `--ink`, còn lại `--ink-3`. Ba cỡ: `sm` cao 32px (lọc trong khối, bảng nổi) · `md` cao 36px (mặc định) · `lg` cao 40px, chữ 15px (chuyển chế độ chính của trang: tab hồ sơ sinh viên, "So với 1 / nhiều vị trí"). Không ghi đè cỡ bằng class riêng |
| `ConfirmDialog` | xác nhận trước thao tác quan trọng. Rộng 460px, bo 22px, không nút đóng góc. Icon tròn · tiêu đề 20px · **một câu mô tả** · (tuỳ chọn) **một hàng thông tin** nền `--panel` chia cột bằng đường kẻ (ví dụ "Đã trả lời 2 / 5 câu" · "Báo cáo: Không có") · 2 nút pill. Kiểu nguy hiểm: icon và nút chính màu `--bad`. Không viết đoạn giải thích dài |
| `Accordion` (danh sách câu) | chỉ **một mục mở cùng lúc**; mở mục khác thì mục đang mở đóng lại. Mục đầu mở sẵn |
| `Panel` | nền `--panel`, bo `--r-xl`, padding 24–28px, chứa các thẻ trắng |
| `TaskCard` | thẻ "Việc nên làm tiếp": ô icon nền `--accent-soft` + loại việc · tiêu đề · dòng thông tin · thanh tiến độ · dòng cuối có thông tin phụ và nút `primary` nhỏ |
| `QuickLink` | dòng trắng có icon, nhãn và mũi tên, dùng cho lối tắt |
| `MetricColumn` | nhãn · số (`metric`) + số so sánh nhỏ · đường biểu đồ mảnh · "Xem thêm" và thời gian cập nhật. Các cột cách nhau, phía trên có tiêu đề khu vực kèm đường kẻ |
| `ListRow` / `Table` | dòng ngăn bằng `--line`, hover nền `--panel`, tiêu đề cột chữ hoa 12px `--ink-3` |
| `RecCard` | thẻ vị trí gợi ý: badge mức phù hợp, hạng, nút lưu, tiêu đề, công ty, "Còn thiếu", link "Xem chi tiết" |
| `AdviceRow` | lời khuyên AI: thẻ trắng viền `--line`, icon bóng đèn trên nền `--surface`, một câu tóm tắt, nút mở kế hoạch, chú thích "Do AI tạo" |
| `ScoreCard` | thẻ trắng: vòng điểm gradient pastel · badge mức + một câu nhận xét · 3 thanh điểm theo mức yêu cầu |
| `SkillRow` | tên kỹ năng · bằng chứng trích từ CV · badge trạng thái (Đã đáp ứng / Chỉ liệt kê / Còn thiếu) |
| `CvPaper` | bản CV trên thẻ trắng; dòng có gợi ý: nền `--gold-soft` + vạch trái `--gold`; đang xét: thêm viền `--ink`; đã áp dụng: nền `--good-soft` + tag |
| `SuggestionCard` | loại gợi ý (badge) · câu gốc (nền `--panel`) · đề xuất (chỗ cần điền số: nền `--warn-soft` viền gạch; từ khoá JD: nền `--accent-soft`) · Áp dụng / Sửa / Bỏ qua · Hoàn tác |
| `CapabilityCheck` | câu hỏi kinh nghiệm + 3 lựa chọn pill (Có, đã dùng / Đang học / Chưa có) |
| `AuroraBand` | mục 4 |
| `StickyActionBar` | dính đáy, nền trắng mờ, viền trên `--line`; trái là tóm tắt, phải là nút chính |
| `Sheet` / `Dialog` | bo `--r-xl`, `--shadow-lg`, nền mờ phía sau `rgba(24,24,27,.3)` |
| `AiProgress` | các bước có tên + thanh gradient pastel chạy |
| `Skeleton` · `EmptyState` · `ErrorBlock` · `FallbackBanner` · `Toast` | mục 9 |

---

## 7. Mẫu bố cục đã chốt

- **Tổng quan:** dải pastel · câu chào + một dòng + 2 nút · panel "Việc nên làm tiếp" (2 `TaskCard` + 3 `QuickLink`) · "Tiến độ của bạn" (3 `MetricColumn`) · "Vị trí hợp với bạn" và "Kỹ năng nên học thêm" dạng danh sách.
- **Thư viện JD:** tiêu đề + chọn CV · panel "Phù hợp nhất với CV" (lưới 3 `RecCard`, mở rộng tới 6, `AdviceRow` ở cuối panel) · "Tất cả vị trí" dạng bảng với tìm kiếm, chọn ngành, segmented Tất cả / Đã lưu.
- **Kết quả phân tích:** tên vị trí + CV · `ScoreCard` · "Kỹ năng và bằng chứng" (`SkillRow` theo nhóm mức yêu cầu, segmented lọc) · cột phải "Gợi ý cải thiện" + nhận xét AI · `StickyActionBar`.
- **Trình tối ưu CV:** tiêu đề + tiến độ · `CvPaper` bên trái · `SuggestionCard` và `CapabilityCheck` bên phải · `StickyActionBar` với nút "Hoàn tất & tạo phiên bản".
- **Thiết lập phỏng vấn:** `PageHeader` · vùng "Chọn CV" **trước** vùng "Chọn vị trí" · cột phải tóm tắt buổi + "Vào phòng chờ" · "Buổi gần đây".
- **Phòng chờ:** chế độ tập trung · vị trí và CV trên 2 dòng riêng · luật của buổi · "Sẵn sàng" + "Đổi CV và vị trí" (về Thiết lập, giữ lựa chọn). Không có hướng dẫn 5 bước hay link màu tím.
- **Phòng phỏng vấn:** chế độ tập trung · thanh tiến độ 4 câu · câu hỏi · 4 ô hướng dẫn STAR (tĩnh, không sáng lên theo câu trả lời) · ô trả lời có đếm ký tự.
- **Landing page `/`:** thanh trên dính (Cách hoạt động · Cam kết · Cho cố vấn · Hỏi đáp · Đăng nhập · Tạo tài khoản) · hero căn giữa kiểu Family: tiêu đề hiện lần lượt từng chữ, hai bên là **ô biểu tượng pastel** (icon lucide nét trắng trên nền đổ chéo từ bảng màu aurora, hoặc ô trắng icon `--ink`) bật ra kiểu lò xo rồi trôi nhẹ; không dùng mảnh giao diện hay minh hoạ hoạt hình · hero cao vừa một màn hình · "Bớt đoán, luyện đúng chỗ.": bảng kẻ mảnh so sánh "Tự chuẩn bị" với "Với CareerX" (cột CareerX nền `--panel`), không thẻ, không icon · "Từ CV đến buổi phỏng vấn": cột trái dính, cột phải 4 khung xám hiện dần khi cuộn tới (kiểu "Details that matter" của Family) · dải tối "Cam kết" (mục 4.1) · Cho cố vấn · Hỏi đáp (đóng hết, mở một câu thì câu khác đóng) · lời mời cuối trang · footer 3 cột + dòng "© 2026 CareerX · Thực hiện bởi nhóm T131 · Model Citizens". **Không có nút demo** (nút này chỉ ở trang Đăng nhập).
- **Đăng nhập / Đăng ký / Quên mật khẩu:** thẻ trắng 440–480px giữa trang trên dải pastel. Đăng ký chỉ cho sinh viên: Họ và tên, Ngày sinh, Số điện thoại, Email, Mật khẩu + 2 ô đồng ý (xử lý dữ liệu, cam kết liêm chính); nút tắt tới khi tick đủ. Tài khoản cố vấn do CareerX cấp. Trang Đăng nhập có "Dùng thử bản demo" mở hộp chọn Sinh viên / Cố vấn.
- **Cố vấn, Tổng quan:** dải pastel · câu chào + một dòng + 2 nút · panel "Việc cần làm" (thẻ "Chờ nhận xét" và "Cần chú ý") · "Tình hình nhóm" (4 chỉ số) · "Phân tích nhóm" (điểm theo tuần + tiêu chí STAR) · hàng 3 vùng nhỏ: Mức tiến bộ, Tiến bộ nhiều nhất, Nhận xét gần đây.
- **Cố vấn, Hồ sơ sinh viên:** tên + trạng thái + "Thêm ghi chú" / "Nhắn tin" · 4 chỉ số · segmented `lg` Phỏng vấn / CV / Ghi chú. Nhận xét một buổi mở dialog 2 cột: trái là báo cáo, phải là ô nhận xét trên nền `--panel`.

---

## 8. Nội dung và quy tắc hiển thị

### 8.1 Khi nào hiện điểm số

| Nguồn | Cách chấm | Hiển thị |
|---|---|---|
| Gợi ý vị trí (`/jd/recommend`) | Quy tắc, không LLM | **Chỉ nhãn** Cao/Khá/Trung bình, kèm "Ước tính nhanh theo kỹ năng" |
| Phân tích 1 vị trí, So sánh (`/gap-analysis`, `/jd/compare`) | Quy tắc + LLM | **Điểm % kèm nhãn** (ví dụ `72% · Khá`) |
| Phỏng vấn | LLM chấm STAR | `x,x / 5`, không gắn nhãn. **Không hiện điểm trong lúc phỏng vấn** |

Số thập phân dùng dấu phẩy theo tiếng Việt (`3,6 / 5`, `80,6%`).

### 8.2 Nhãn mức phù hợp (toàn hệ thống)

| Điểm | `match_label` | Nhãn | Badge |
|---|---|---|---|
| ≥ 75 | `high` | **Cao** | nền `--good-soft`, viền `--good-line`, chữ `--good` |
| 50–74 | `medium` | **Khá** | nền `--accent-soft`, viền `--line-strong`, chữ `--accent-strong` |
| < 50 | `low` | **Trung bình** | nền `--surface`, viền `--line-strong`, chữ `--ink-2` |

Không dùng màu đỏ cho mức thấp. Bộ nhãn này thay cho "Cao / Trung bình / Thấp" ở các màn hiện tại.

### 8.3 Quy tắc khác

- **Không tự bịa thông tin.** Gợi ý sửa CV phải cho Áp dụng, Sửa, Bỏ qua và Hoàn tác. Chỗ cần số liệu để trống `[số]` và có lời nhắc "AI không tự đặt số liệu". AI không tự thêm kỹ năng còn thiếu; phải qua `CapabilityCheck`.
- **Nội dung do AI tạo** có chú thích "Do AI tạo từ CV và JD; hãy tự kiểm chứng".
- **Không đặt đoạn cảnh báo AI dài** ("Các đánh giá, điểm số và gợi ý được tạo bởi AI chỉ mang tính tham khảo…") ở trang kết quả, báo cáo hay bất kỳ trang nào. Cam kết này nằm trong phần đồng ý xử lý dữ liệu ở Cài đặt và ô cam kết trước khi tải CV.
- **Quyền riêng tư:** chia sẻ với cố vấn mặc định tắt, công tắc riêng cho từng mục.
- **Hỏi ít.** Khảo sát sau buổi phỏng vấn (CSAT) chỉ có số sao và ô nhận xét tuỳ chọn; không hỏi "Bạn có dùng lại không?".
- **Người dùng không gắn với một trường.** Sinh viên đến từ nhiều trường: hồ sơ gồm họ tên, ngày sinh, số điện thoại, email cá nhân. Không hiện email trường, mã sinh viên, khoa, ngành, khoá; không viết "nhà trường phân công" hay "Trường X".
- **Trang giới thiệu không nêu tên người cụ thể**, kể cả tên giả trong dữ liệu mẫu. Dùng "CV của bạn", "Sinh viên A/B/C", "Nguyễn Văn A".
- **Không thêm nút trùng chức năng.** Trang đã có vùng kéo thả thì không đặt thêm nút "Tải lên" ở tiêu đề.
- **Không dùng emoji.** Dùng icon outline của `lucide-react`.
- Giọng văn: ngắn, trực tiếp, xưng "bạn". Nút bắt đầu bằng động từ.

---

## 9. Trạng thái rỗng, đang tải, lỗi

| Loại | Khi nào | Hình thức |
|---|---|---|
| **Tải nhanh** | dưới khoảng 1 giây | `Skeleton` đúng hình nội dung. Không dùng spinner toàn trang |
| **Tác vụ AI** | 3–30 giây | `AiProgress`. Sau 15 giây đổi câu chữ "Lâu hơn bình thường một chút…"; sau 45 giây cho chạy ở nền và báo qua thông báo |
| **Rỗng lần đầu** | chưa có dữ liệu | `EmptyState`: icon trong vòng tròn `--surface`, tiêu đề, một câu, một nút |
| **Rỗng do lọc** | bộ lọc không khớp | một dòng chữ kèm "Xoá bộ lọc" |
| **Lỗi một khối** | một khối không tải được | `ErrorBlock` đúng chỗ khối đó; khối khác vẫn hiện |
| **Lỗi toàn trang** | dữ liệu chính không tải được | thẻ giữa trang, nguyên nhân bằng lời thường, "Thử lại" và "Về Tổng quan" |
| **Lỗi thao tác** | lưu, gửi, xoá thất bại | toast có nút Thử lại; **giữ nguyên dữ liệu đã nhập** |
| **Chế độ dự phòng** | LLM lỗi, backend dùng quy tắc | `FallbackBanner` nền `--warn-soft`: "Kết quả được tạo bằng quy tắc, chưa có đánh giá AI chi tiết." |

Chi tiết từng màn ở `WIREFRAMES.md`, phần C.

---

## 10. Khả năng truy cập

- Chữ thường đạt tương phản ≥ 4.5:1, chữ lớn ≥ 3:1.
- Mọi thứ điều khiển được bằng bàn phím; focus ring `--accent` 2px, cách 2px.
- Thông tin không chỉ truyền bằng màu: badge luôn có chữ, dòng CV có gợi ý có thêm vạch trái.
- Segmented control dùng `role="tablist"` / `role="tab"`; lựa chọn kiểu radio dùng `role="radiogroup"`.
- Đồng hồ phỏng vấn có `role="timer"`; kết quả tác vụ AI thông báo qua `aria-live="polite"`.
- Tôn trọng `prefers-reduced-motion`.

---

## 11. Triển khai trong `frontend/`

**Hiện trạng:** token v1 nằm trong `frontend/app/globals.css` (`:root`), ánh xạ sang biến shadcn (`--primary`, `--border`, `--muted`…).

**Thứ tự chuyển sang v2:**
1. Thay token v1 bằng token mục 3 trong `globals.css`. Ánh xạ shadcn: `--primary` = `--ink`, `--ring` = màu nhấn, `--muted` = `--surface`, `--accent` (shadcn) = `--surface`. Thêm utility `aurora-band` và `glass`. *(Đã làm.)*
   **Quy ước tên trong code:** tên `accent` thuộc shadcn, nên màu nhấn iris dùng qua class `blue`: `text-blue`, `bg-blue`, `bg-blue-soft`, chữ đậm hơn là `text-accent-strong`. `navy` giờ là `--ink`. Tên cũ được giữ để các màn chưa làm lại không vỡ.
2. Thêm `frontend/public/brand/careerx-glyph.png`, cập nhật `components/brand/logo.tsx`. *(Đã làm.)*
3. Làm lại khung: `components/shell/` (sidebar chia nhóm theo `nav-config.ts`, header chuẩn, thanh tab điện thoại `mobile-tab-bar.tsx`, dải pastel trong `app-shell.tsx`). *(Đã làm.)*
4. Dựng component mục 6. *(Đã có `Badge` kiểu mới và `MatchBadge`; `SegmentedControl`, `TaskCard`, `MetricColumn`… dựng khi làm màn dùng đến.)*
5. Đổi nhãn mức phù hợp sang Cao/Khá/Trung bình ở mọi nơi hiển thị `match_label`. *(Đã làm, qua `MATCH_LABEL_META` và `MatchBadge`.)*
6. Làm lại từng màn theo bản mẫu và `WIREFRAMES.md`. *(Đã làm mọi màn của sinh viên và 3 màn cố vấn. Còn lại: trang chọn vai trò `/`, bảng lệnh Ctrl K.)*

**Dark mode:** vẫn tạm tắt (`forcedTheme="light"` trong `components/theme-provider.tsx`). Khi bật cần định nghĩa lại bảng màu tối cho v2.

**Tính năng ngoài phạm vi Gate 1** bật/tắt qua `frontend/lib/features.ts`.

---

## 12. Việc cần backend để hoàn thiện thiết kế

| Tính năng | Cần thêm |
|---|---|
| Mức phù hợp của vị trí ngoài Top gợi ý | endpoint chấm nhanh theo quy tắc cho một hoặc nhiều JD (Thư viện hiện ghi "—" cho vị trí ngoài Top) |
| Chi tiết vị trí chia theo mục | JD trong thư viện cần trường riêng cho mô tả, yêu cầu, quyền lợi |
| Gửi email thật | cấu hình `SMTP_*` trong `.env`; chưa cấu hình thì link đặt lại mật khẩu chỉ ghi vào log backend |

**Đã có (frontend nối được bằng `NEXT_PUBLIC_LIVE_APIS`):** tài khoản `auth` (đăng ký, đăng nhập bằng cookie phiên HttpOnly, đăng xuất, quên / đổi mật khẩu, tạm khoá sau 5 lần sai), thông báo (`notifications`, tạo khi có nhận xét mới, báo cáo / phân tích xong, SV chia sẻ buổi mới; tôn trọng công tắc trong Cài đặt), Cài đặt và sửa hồ sơ, xuất / xoá dữ liệu, JD đã lưu, tạo JD tự dán (`POST /jd`), bổ sung số liệu cho gợi ý còn chỗ trống `[ ]` (US-SV-03 AC2), danh sách buổi chờ nhận xét ở Tổng quan cố vấn. Bản demo (header `X-Demo-Role`) vẫn dùng được khi `DEMO_LOGIN_ENABLED=true`.

Ràng buộc hiện tại: gợi ý trả tối đa 6 vị trí; so sánh nhận 2–3 JD; thư viện có 8 JD và chỉ gồm JD đã index vào Chroma.

---

## 13. Quy trình làm việc với agent

Khi giao dựng một màn, đính kèm `DESIGN.md`, phần tương ứng trong `WIREFRAMES.md`, và artboard tương ứng trong bản mẫu (nếu có).

- Giao từng màn hoặc từng component một.
- Chỉ dùng token và component đã có ở đây. Cần cái mới thì bổ sung vào tài liệu này trước.
- Dựng xong một màn thì chạy thử trên trình duyệt ở 375px và 1280px, so với bản mẫu hoặc wireframe rồi mới sang màn tiếp theo.
