# WIREFRAMES.md — CareerX (v2)

Wireframe ASCII cho từng màn của ứng dụng. Mô tả **bố cục, luồng thao tác và trạng thái**. Màu, font, bo góc và chuyển động lấy từ [`DESIGN.md`](DESIGN.md).

**Trạng thái:** A0, A1, A2 và B2 đã cập nhật theo bản mẫu đã duyệt. Sáu màn có artboard trong bản mẫu (Tổng quan, Thư viện JD, Kết quả phân tích, Thư viện JD trên điện thoại, Phòng phỏng vấn, Trình tối ưu CV) lấy **bản mẫu làm chuẩn về hình ảnh**; wireframe ở đây giữ vai trò mô tả luồng và trạng thái. Các màn còn lại dựng theo wireframe kết hợp quy tắc của DESIGN.md v2.

## Ký hiệu

| Ký hiệu | Nghĩa |
|---|---|
| `░` | dải pastel ở đầu trang, nằm sau nội dung (DESIGN.md mục 4) |
| `▓` | *(ký hiệu cũ, ở các màn chưa cập nhật)* khu vực kết quả nổi bật. Theo v2 dựng bằng **thẻ trắng**, không dùng khối gradient |
| `◆` | chuyển động hoặc micro-interaction (DESIGN.md mục 3.8) |
| `[ Nút ]` | nút chính (nền đen, pill) |
| `( Nút )` | nút phụ, pill, chip |
| `(▌Mục )` | mục đang chọn trong segmented control, tab hoặc sidebar |
| `●` `◐` `○` | kỹ năng: đã đáp ứng · chỉ mới liệt kê · còn thiếu |
| `(● Cao)` `(● Khá)` `(● Trung bình)` | badge mức phù hợp (DESIGN.md mục 8.2). Ở các màn chưa cập nhật còn ghi `(●●● Cao)`, hiểu là cùng badge này |
| `★` | nằm trong Top gợi ý của CV đang chọn |
| `♡` / `♥` | chưa lưu / đã lưu vị trí |
| `✎` | JD tự dán |
| `▒` | skeleton đang tải |

**Quy tắc điểm số:** màn gợi ý chỉ hiện nhãn; màn phân tích và so sánh hiện "điểm · nhãn" (ví dụ `72 · Khá`); phỏng vấn hiện `x.x / 5`.

---

# A. Desktop

## A0. Khung ứng dụng

```
┌────────────────────┬──────────────────────────────────────────────────────────────┐
│ ✕ CareerX          │░░░[⌕ Tìm vị trí, thao tác…   Ctrl K]░░░░░░░░░░░░░░ (✉•) (◎) (AN)
│                    │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ▌Tổng quan         │░░  breadcrumb / thao tác riêng của trang (dòng riêng, nếu có) ░│
│                    │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░       │
│ Hồ sơ              │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                         │
│   CV của tôi       │░░░░░░░░░░░░░░░░░░░░░░    dải pastel 440px, cắt chéo,          │
│   Thư viện JD      │                          nằm sau header và phần đầu nội dung  │
│ Luyện tập          │                                                               │
│   Phân tích CV & JD│                                                               │
│   Luyện phỏng vấn  │                                                               │
│   Tiến bộ          │                                                               │
│ Tài khoản          │                                                               │
│   Chia sẻ với cố vấn                                                                 │
│   Cài đặt          │                                                               │
└────────────────────┴──────────────────────────────────────────────────────────────┘
  ✕ = hình chữ X của logo, màu đen, không khung · ▌ = mục đang chọn: nền đen, chữ trắng
  header giống hệt nhau trên mọi trang · không có thẻ cố vấn ở cuối sidebar
```

## A1. Tổng quan sinh viên — `/student`

```
 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
 ░  Chào An,                                                                        ░
 ░  sẵn sàng cho buổi tiếp theo?                    ← display 46px, chỉ có chữ      ░
 ░  CV gần nhất khớp 81% với Data Analyst Intern.     không có thẻ minh hoạ nổi     ░
 ░  [ Xem kết quả › ]   ( Luyện phỏng vấn )                                          ░
 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
 ┌ Việc nên làm tiếp ──────────────────────────────────────────────────── panel xám ┐
 │ ┌───────────────────────────┐ ┌───────────────────────────┐ ┌─────────────────────┐│
 │ │ [▤] Trình tối ưu CV       │ │ [◎] Phỏng vấn thử         │ │ ⫴ Xem vị trí hợp  › ││
 │ │ Tối ưu CV cho Data Analyst│ │ Business Analyst Intern   │ ├─────────────────────┤│
 │ │ Đã xử lý 4/7 · còn 3      │ │ Dừng ở câu 3/5 · còn 2 lượt│ │ ⇪ Tải lên CV mới  › ││
 │ │ ━━━━━━━━━━░░░░░░          │ │ ━━ ━━ ━━ ░░ ░░            │ ├─────────────────────┤│
 │ │ Mở lần cuối hôm qua [Tiếp tục]│ Đã lưu câu trả lời [Tiếp tục câu 3]│ ✉ Nhắn tin cố vấn ›││
 │ └───────────────────────────┘ └───────────────────────────┘ └─────────────────────┘│
 └──────────────────────────────────────────────────────────────────────────────────┘
   thẻ công việc hiện dữ liệu thật, không chứa ảnh chụp màn hình khác
 Tiến độ của bạn                                                          Xem tất cả
 ─────────────────────────────────────────────────────────────────────────────────────
 Độ khớp CV gần nhất        Điểm STAR trung bình         Buổi phỏng vấn tuần này
 81%  72% ở v2.0            3.6 / 5  3.2 buổi trước      2 / 3  3 tuần trước
 ╱‾‾‾‾‾‾‾‾‾‾‾               ╱‾‾‾‾‾‾‾‾‾‾                  ╱╲__╱
 Xem thêm     Cập nhật 08/10 Xem thêm    Cập nhật 07/10  Xem thêm        Còn 1 lượt
 Vị trí hợp với bạn       theo CV v2.1     Kỹ năng nên học thêm
 Data Analyst Intern            (● Cao)     Thống kê          ━━━━━━  thiếu ở 3 vị trí
 Marketing Analyst              (● Khá)     Google Analytics  ━━━━░░  thiếu ở 2 vị trí
 Business Analyst Intern        (● Khá)     A/B Testing       ━━░░░░  thiếu ở 1 vị trí
 Mở Thư viện JD →
```

## A2. Thư viện JD — `/student/library` (mới)

```
 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
 ░ Thư viện JD                                   Gợi ý theo [CV_PhanTichDuLieu v2.1 ▾]
 ░ 8 vị trí đã chuẩn hoá yêu cầu theo mức Bắt buộc, Ưu tiên và Cộng thêm.        ░
 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
 ┌ Phù hợp nhất với CV của bạn   Ước tính nhanh theo kỹ năng     Xem cả 5 gợi ý ┐ panel xám
 │ ┌────────────────────────┐ ┌────────────────────────┐ ┌────────────────────────┐ │
 │ │ (● Cao) #1           ♡ │ │ (● Khá) #2           ♥ │ │ (● Khá) #3           ♡ │ │
 │ │ Data Analyst Intern    │ │ Marketing Analyst      │ │ Business Analyst Intern│ │
 │ │ Công ty TMĐT B · TT    │ │ Công ty Truyền thông D │ │ Công ty Công nghệ A    │ │
 │ │ Còn thiếu Thống kê, GA │ │ Còn thiếu GA, A/B Test │ │ Còn thiếu BRD/SRS, BPMN│ │
 │ │ Xem chi tiết →         │ │ Xem chi tiết →         │ │ Xem chi tiết →         │ │
 │ └────────────────────────┘ └────────────────────────┘ └────────────────────────┘ │
 │ ┌──────────────────────────────────────────────────────────────── thẻ trắng ──┐ │
 │ │ [◌] Lời khuyên cho Data Analyst Intern. CV mạnh về SQL, Excel, Power BI;     │ │
 │ │     còn thiếu bằng chứng về thống kê.   Xem kế hoạch 3 bước ⌄               │ │
 │ └─────────────────────────────────────────────────────────────────────────────┘ │
 └─────────────────────────────────────────────────────────────────────────────────┘
   lưới 3 thẻ, không cuộn ngang; "Xem cả N gợi ý" mở rộng tới tối đa 6 (giới hạn backend)
   lời khuyên nằm trong panel, nền trắng trung tính, vì LLM chỉ viết cho vị trí #1
   ([◌] = icon bóng đèn của lucide)
 Tất cả vị trí                                                              8 vị trí
 ─────────────────────────────────────────────────────────────────────────────────────
 [⌕ Tìm vị trí, công ty, kỹ năng…     ]  Ngành [Tất cả ngành ▾]   (▌Tất cả)( Đã lưu 2)
 VỊ TRÍ                          CÔNG TY                    CẤP BẬC   MỨC PHÙ HỢP
 ★ Data Analyst Intern           Công ty Thương mại điện tử B Thực tập (● Cao)        ♡
   SQL · Excel · Power BI
 ★ Marketing Analyst             Công ty Truyền thông D     Fresher   (● Khá)         ♥
   Google Analytics · Excel · Báo cáo hiệu quả chiến dịch
   Backend Developer Intern      Công ty Phần mềm G         Thực tập  —               ♡
   Python · REST API · SQL
   vị trí ngoài Top gợi ý hiện "—"; xem mức phù hợp trong trang chi tiết
```

## A3. Chi tiết vị trí — `/student/library/[id]` (mới)

```
 Thư viện JD / Data Analyst
 ┌─────────────────────────────────────────────┐ ┌ Mức phù hợp với CV của bạn ──┐
 │ Data Analyst                             ♡  │ │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
 │ FPT Software · Junior · Công nghệ · HN      │ │░ (●●● Cao)      ★ Gợi ý #1  ░│
 │ (Tổng quan)(▌Mô tả)(Yêu cầu)(Quyền lợi)     │ │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
 │ ─────────────────────────────────────────── │ │ ● SQL ● Python ● Excel       │
 │ Mô tả công việc                             │ │ ◐ Tableau                    │
 │ • Xây dựng dashboard theo dõi doanh thu…    │ │ ○ Power BI ○ Statistics      │
 │ • Phối hợp với team Sales…                  │ │ Ước tính nhanh theo kỹ năng. │
 │                                             │ │ Xem điểm chi tiết khi phân   │
 │ Yêu cầu ứng viên                            │ │ tích.                        │
 │  Bắt buộc   (SQL)(Python)(Excel)            │ │ CV: [CV_DataAnalyst v2.1 ▾]  │
 │  Ưu tiên    (Power BI)(Tableau)             │ │──────────────────────────────│
 │  Cộng thêm  (Statistics)                    │ │ [ Phân tích chi tiết → ]     │
 │                                             │ │ ( + Thêm vào so sánh )       │
 │ Quyền lợi                                   │ │ ( Luyện phỏng vấn )          │
 │ • …                                         │ └──────────────────────────────┘
 └─────────────────────────────────────────────┘
   tab bên trái là mục neo: cuộn đến đâu thì pill tự trượt theo ◆ · thẻ phải dính khi cuộn
   vị trí ngoài Top gợi ý: thẻ phải hiện ( Xem mức phù hợp ) thay cho nhãn
```

## A4. Phân tích CV & JD, chế độ 1 vị trí — `/student/analysis/new`

```
 Phân tích CV & JD
 ( ▌So với 1 vị trí )  ( So với nhiều vị trí )                    ◆ pill trượt
 CV   [PDF] CV_DataAnalyst.pdf · v2.1 · Đang dùng                 ( Đổi CV )
 ─────────────────────────────────────────────────────────────────────────
 Chọn vị trí    ( ▌Gợi ý & Đã lưu )  ( Dán JD )
 ┌──────────────────────────────────────────────────────────────────────┐
 │ ★ Data Analyst · FPT · Junior                     (●●● Cao)    (●) │
 │ ★ BI Developer · VNG · Junior                     (●●○ Khá)    ( ) │
 │ ♥ Marketing Executive · Unilever                                ( ) │
 │ ♥ Backend Intern · Tiki                                         ( ) │
 │                                ( Tìm thêm trong Thư viện JD → )      │
 └──────────────────────────────────────────────────────────────────────┘
                                                [ Bắt đầu phân tích → ]  thanh dính đáy
```

**Tab "Dán JD"** (dùng chung cho cả 2 chế độ):
```
 ┌ Tổng quan ───────────────────────────────────────────────────────────┐
 │ Vị trí*  [Data Analyst          ]   Công ty  [FPT Software         ] │
 │ Cấp bậc  [Junior ▾]                 Ngành    [Công nghệ ▾]           │
 ├ Mô tả công việc* ────────────────────────────────────────────────────┤
 │ [Dán phần mô tả công việc…                                         ] │
 ├ Yêu cầu ứng viên* ───────────────────────────────────────────────────┤
 │ [Dán phần yêu cầu…                                                 ] │
 ├ ⌄ Quyền lợi · Thông tin khác (không bắt buộc) ───────────────────────┤ ◆ thu gọn mặc định
 └──────────────────────────────────────────────────────────────────────┘
   [✓] Lưu JD này vào "Đã lưu" để dùng lại
```

## A5. Phân tích CV & JD, chế độ nhiều vị trí

```
 ( So với 1 vị trí )  ( ▌So với nhiều vị trí )
 CV   [PDF] CV_DataAnalyst.pdf · v2.1                                ( Đổi CV )
 ─────────────────────────────────────────────────────────────────────────
 Vị trí so sánh  2 / 3
 ┌──────────────────────────────────────────────────────────────────────┐
 │ 1  ★ Data Analyst · FPT                         (●●● Cao)          ✕ │
 │ 2  ✎ Marketing Exec · Công ty ABC               JD tự dán  ( Sửa ) ✕ │
 │ 3  ( + Thêm vị trí )                                                 │
 └──────────────────────────────────────────────────────────────────────┘
          │  bấm "+ Thêm vị trí" → khung mở ngay dưới ô đó ◆
          ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │ ( ▌Gợi ý & Đã lưu )  ( Dán JD )                                    ✕ │
 │  ★ BI Developer · VNG               (●●○ Khá)          ( + Chọn )    │
 │  ♥ Backend Intern · Tiki                               ( + Chọn )    │
 │   tab "Dán JD" dùng form ở A4, nút cuối là [ Thêm ]                  │
 └──────────────────────────────────────────────────────────────────────┘
                                                  [ So sánh 3 vị trí → ]
   tối thiểu 2, tối đa 3 vị trí (giới hạn của backend); đủ 3 thì ẩn ô "+ Thêm vị trí"
```

## A6. Kết quả so sánh

```
 So sánh 3 vị trí  ·  CV_DataAnalyst.pdf v2.1                 ( Đổi CV )
 ┌▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┐
 │▓                       #1              #2              #3          ▓│
 │▓                       Data Analyst    BI Developer    Product An. ▓│
 │▓                       ◯ 82 · Cao      ◯ 74 · Khá      ◯ 61 · Khá  ▓│ ◆ vòng điểm chạy
 └▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┘   lần lượt
 ── Kỹ năng ─────────────────────────────────────────────────────────
 SQL                          ●               ●               ●
 Python                       ●               ◐               ●
 Tableau                      ◐               ●               ○
 Power BI                     ○               ●               ○
 Statistics                   ○               ○               ○
 ● đã đáp ứng   ◐ chỉ liệt kê   ○ còn thiếu       hàng tiêu đề dính khi cuộn
 ┌ Thiếu ở cả 3 vị trí ─────────────────────────────────────────────┐
 │ (Statistics)  (A/B Testing)          → nên ưu tiên học trước      │
 └───────────────────────────────────────────────────────────────────┘
 Nhận xét của AI    ⌄ Data Analyst   ⌄ BI Developer   ⌄ Product Analyst
 [ Phân tích sâu Data Analyst → ]                 ( Luyện phỏng vấn )
```

## A7. Kết quả phân tích 1 vị trí — `/student/analysis/[id]`

```
 ── Đang xử lý (status = processing) ────────────────────────────────
 ┌──────────────────────────────────────────────────────────────────┐
 │  Đang phân tích CV với Data Analyst…                             │
 │  ✓ Đọc CV        ✓ Tìm ngữ cảnh JD    ● So khớp kỹ năng    ○ Kiểm chứng
 │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░    ◆     │
 └──────────────────────────────────────────────────────────────────┘
 ── Khi xong ────────────────────────────────────────────────────────
 ┌▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┐
 │▓   ╭───╮   72 / 100 · Khá                                       ▓│
 │▓   │72 │   Bắt buộc 80  ·  Ưu tiên 65  ·  Cộng thêm 40          ▓│
 │▓   ╰───╯   CV_DataAnalyst v2.1  ×  Data Analyst · FPT           ▓│
 └▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┘
 ( Tất cả 12 ) ( ● Đã đáp ứng 6 ) ( ◐ Chỉ liệt kê 3 ) ( ○ Còn thiếu 3 )  ◆ lọc
 ┌ Bằng chứng trong CV ──────────────┐ ┌ Gợi ý cải thiện ─────────────┐
 │ ● SQL                             │ │ 1  Thêm số liệu cho dự án…   │
 │   "Xây dashboard doanh thu bằng   │ │ 2  Nêu rõ công cụ BI đã dùng │
 │    SQL cho 3 chi nhánh…"          │ │ 3  …                         │
 │ ◐ Tableau  (chỉ ở mục Kỹ năng)    │ └──────────────────────────────┘
 │ ○ Power BI                        │
 └───────────────────────────────────┘
 ╭──────────────────────────────────────────────────────────────────────────╮
 │ Hữu ích không? ( Có )( Chưa )        ( Luyện PV )  [ Mở trình tối ưu → ] │ thanh dính đáy
 ╰──────────────────────────────────────────────────────────────────────────╯
```

## A8. CV của tôi — `/student/cv`

```
 CV của tôi                                (không có nút tải lên: dùng vùng kéo thả)
 Quản lý các phiên bản CV theo từng vị trí ứng tuyển.
 ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
 ╎   Kéo thả file PDF / DOCX vào đây  ·  hoặc ( Chọn file ) ( Google Drive )  ╎ ◆ viền sáng lên
 └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘   khi kéo file vào
 [Tìm CV…                    ]                                (Lưới ▦)(Danh sách ≡)
 ┌────────────────────────┐ ┌────────────────────────┐ ┌────────────────────────┐
 │ ┌──────┐  ĐANG DÙNG    │ │ ┌──────┐               │ │ ┌──────┐               │
 │ │ ≡≡≡≡ │               │ │ │ ≡≡≡≡ │               │ │ │ ≡≡≡≡ │               │ ← ảnh thu nhỏ
 │ │ ≡≡   │               │ │ │ ≡≡   │               │ │ │ ≡≡   │               │   trang 1
 │ └──────┘               │ │ └──────┘               │ │ └──────┘               │
 │ CV_DataAnalyst.pdf     │ │ CV_BA.pdf              │ │ CV_Backend.docx        │
 │ v2.1 · 3 phiên bản     │ │ v1.0                   │ │ v1.2                   │
 │ Gần nhất: 72 · Khá     │ │ Chưa phân tích         │ │ Gần nhất: 48 · Tr.bình │
 │ Data Analyst · FPT     │ │ ( Phân tích ngay → )   │ │ Backend Intern · Tiki  │
 │                    ⋯   │ │                    ⋯   │ │                    ⋯   │ ◆ ⋯: đặt làm đang
 └────────────────────────┘ └────────────────────────┘ └────────────────────────┘   dùng / tải / xoá
 ┌ Mẹo tối ưu CV cho sinh viên ⌄ ────────────────────────────────────────┐  thu gọn mặc định
```

## A9. Chi tiết CV — `/student/cv/[id]`

```
 CV của tôi / CV_DataAnalyst.pdf
 ┌──────────────────────────────────────────────┐ ┌ Lịch sử phiên bản ──────────┐
 │ CV_DataAnalyst.pdf   v2.1  ĐANG DÙNG         │ │ ● v2.1  Hiện tại   09/10    │
 │ ( Tải file gốc ) ( Đặt làm đang dùng ) ( ⋯ ) │ │ │   Tối ưu cho Data Analyst │
 │ ──────────────────────────────────────────── │ │ │   +4 câu đã sửa           │
 │   NGUYỄN VĂN AN                              │ │ ○ v2.0            02/10    │
 │   Data Analyst · an@email.com                │ │ │   ( Xem ) ( Khôi phục )   │ ◆ chọn bản cũ thì
 │                                              │ │ ○ v1.0  Bản gốc   20/09    │   khung trái đổi
 │   KINH NGHIỆM                                │ ├ Độ khớp qua các phiên bản ──┤   sang bản đó, gắn
 │   • Xây dashboard doanh thu bằng SQL…        │ │  v1.0 ▁▁   51               │   nhãn "Đang xem v2.0"
 │   • …                                        │ │  v2.0 ▃▃▃  64               │
 │                                              │ │  v2.1 ▅▅▅▅ 72 · Khá         │
 │   bản xem dạng văn bản, giấy trắng nổi       │ ├─────────────────────────────┤
 │   trên nền surface                           │ │ [ Phân tích với vị trí → ]  │
 └──────────────────────────────────────────────┘ │ ( Xem vị trí gợi ý cho CV ) │ → Thư viện JD,
                                                  └─────────────────────────────┘   lọc theo CV này
```

## A10. Trình tối ưu CV — `/student/analysis/[id]/optimize`

```
 Kết quả phân tích / Trình tối ưu CV         Data Analyst · FPT       Đã xử lý 3 / 7
 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
 ┌ Bản xem trước CV ─────────────────────────┐ ┌ Gợi ý tối ưu ────────── (Còn lại 4 ▾)┐
 │ KINH NGHIỆM                               │ │ ┌───────────────────────────────────┐│
 │ • Xây dashboard doanh thu bằng SQL…       │ │ │ 2 / 7 · Kinh nghiệm · Thêm số liệu ││
 │▌• Phân tích dữ liệu bán hàng hằng tuần ◀──┼─┼─│ Cũ   Phân tích dữ liệu bán hàng    ││ ◆ dòng đang xét tô
 │ • …                                       │ │ │      hằng tuần                     ││   vàng; bấm dòng
 │                                           │ │ │ Mới  Phân tích dữ liệu bán hàng    ││   bên trái thì cuộn
 │ DỰ ÁN                                     │ │ │      hằng tuần cho [số] chi nhánh, ││   tới gợi ý
 │▌• Sales Dashboard (Tableau)               │ │ │      rút ngắn báo cáo [x] giờ      ││
 │                                           │ │ │ ⓘ AI không tự đặt số liệu. Điền số ││
 │ dòng tô vàng = có gợi ý                   │ │ │   thật của bạn vào [ ].            ││
 │                                           │ │ │ [ Áp dụng ] ( Sửa ) ( Bỏ qua )     ││
 └───────────────────────────────────────────┘ │ └───────────────────────────────────┘│
                                               │ ┌ Kỹ năng JD cần mà CV chưa có ─────┐│
                                               │ │ Power BI                           ││
                                               │ │ Bạn đã từng dùng Power BI chưa?    ││
                                               │ │ ( Có, đã dùng ) ( Đang học )       ││
                                               │ │ ( Chưa có kinh nghiệm )            ││ ◆ trả lời xong
                                               │ └───────────────────────────────────┘│   thẻ thu gọn
                                               │ ⌄ Gợi ý đã xử lý (3)                 │
                                               └──────────────────────────────────────┘
 ╭────────────────────────────────────────────────────────────────────────────────────╮
 │ 3 áp dụng · 1 bỏ qua · 1 kỹ năng đang học               [ Hoàn tất & tạo v2.2 → ]   │
 ╰────────────────────────────────────────────────────────────────────────────────────╯
   khi áp dụng: dòng bên trái đổi chữ có hiệu ứng ◆, thanh tiến trình nhích lên
```

## A11. Xuất CV — `/student/analysis/[id]/export`

```
 Trình tối ưu CV / Xuất CV
 ┌▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┐
 │▓  Phiên bản v2.2 đã sẵn sàng                                           ▓│
 │▓  4 câu đã sửa · 1 kỹ năng đang phát triển · 0 thông tin tự thêm       ▓│
 └▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┘
 ┌ Các câu đã sửa ───────────────────────────────┐ ┌ Cam kết liêm chính ────────┐
 │ Tìm câu cũ trong file CV và thay bằng câu mới.│ │ [ ] Mọi thông tin trong CV │
 │ ┌───────────────────────────────────────────┐ │ │     là sự thật và do tôi   │
 │ │ 1 Cũ  Phân tích dữ liệu bán hàng hằng tuần│ │ │     tự xác nhận.           │
 │ │   Mới Phân tích dữ liệu bán hàng hằng tuần│ │ │────────────────────────────│
 │ │       cho 3 chi nhánh…           ( Chép ) │ │ │ [ Tải bản văn bản (.txt) ] │ ← chỉ bật khi đã
 │ └───────────────────────────────────────────┘ │ │ ( Chép toàn bộ )           │   tick cam kết
 │ ┌ 2 … ──────────────────────────────────────┐ │ ├ Bước tiếp theo ────────────┤
 │ Thêm mục "Kỹ năng đang phát triển":           │ │ → Phân tích lại với v2.2   │
 │   Power BI (đang học)                ( Chép ) │ │ → Luyện phỏng vấn          │
 └───────────────────────────────────────────────┘ └────────────────────────────┘
   ◆ bấm "Chép": nút đổi thành "Đã chép" trong 1,5 giây
```

## A12. Thiết lập phỏng vấn và Phòng chờ — `/student/interview/new`, `/start`

```
 Luyện phỏng vấn                                        Còn 2 / 3 buổi tuần này
 ┌ Chọn vị trí & CV ────────────────────────────────┐ ┌ Tóm tắt buổi phỏng vấn ────┐
 │ Vị trí   ( ▌Gợi ý & Đã lưu ) ( Đã phân tích )    │ │ Data Analyst · FPT         │
 │   (●) ★ Data Analyst · FPT          (●●● Cao)    │ │ CV_DataAnalyst v2.1        │
 │   ( ) ★ BI Developer · VNG          (●●○ Khá)    │ │ 5 câu · khoảng 20 phút     │
 │   ( ) ♥ Backend Intern · Tiki                    │ │ Chấm theo STAR             │
 │ CV       [CV_DataAnalyst v2.1 ▾]                 │ │────────────────────────────│
 └──────────────────────────────────────────────────┘ │ [ Vào phòng chờ → ]        │
 ┌ Buổi gần đây ────────────────────────────────────┐ └────────────────────────────┘
 │ Data Analyst · 3.6 / 5 · 05/10      ( Báo cáo → )│
 │ ◐ BA · đang dở câu 3/5              ( Tiếp tục → )│
 └──────────────────────────────────────────────────┘

 ── Phòng chờ (chế độ tập trung, không sidebar) ─────────────────────────
              ╭──────╮
              │  AI  │  AI Career Coach · Người phỏng vấn
              ╰──────╯
     Trước khi bắt đầu
     ○ 5 câu, mỗi câu có đồng hồ riêng     ○ Được tạm dừng 1 lần
     ○ Điểm không hiện trong lúc phỏng vấn ○ Giọng nói không được lưu
     ( Xem hướng dẫn 5 bước )          [ Sẵn sàng ]   ← đồng hồ câu 1 chỉ chạy sau khi bấm
```

## A13. Phòng phỏng vấn — `/student/interview/[id]`

```
 (← Rời phòng)          Data Analyst · Câu 3 / 5            ⏱ 04:12  ( ‖ )
 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░░░░░░░   ● ● ◉ ○ ○
                                  không sidebar, nền trắng, nhiều khoảng trống
        ┌──────────────────────────────────────────────────────┐
        │  Hãy kể về một lần bạn dùng dữ liệu để thuyết phục   │
        │  người khác thay đổi quyết định.                     │  chữ lớn, căn giữa
        └──────────────────────────────────────────────────────┘
        (S Bối cảnh) (T Nhiệm vụ) (A Hành động) (R Kết quả)     4 ô hướng dẫn tĩnh,
                                                                  không phản ứng theo câu trả lời
                                                                  (không chấm điểm trong lúc phỏng vấn)
        ┌──────────────────────────────────────────────────────┐
        │ Câu trả lời của bạn…                                 │
        │                                                      │
        └──────────────────────────────────────────────────────┘
        124 từ                                     [ Gửi câu trả lời → ]
```

## A14. Báo cáo phỏng vấn — `/student/interview/[id]/report`

```
 Luyện phỏng vấn / Báo cáo
 ┌▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┐
 │▓  ╭─────╮  3.8 / 5                 ▲ +0.4 so với buổi trước             ▓│
 │▓  │ 3.8 │  Data Analyst · FPT · 09/10 · 5 câu · 18 phút                 ▓│ ◆ vòng điểm chạy
 │▓  ╰─────╯                                                              ▓│
 └▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┘
 ┌ Điểm theo tiêu chí STAR ───────────────────┐ ┌ Hướng dẫn cải thiện ──────────┐
 │ S Tình huống   ████████████░░  4.2         │ │ 1 Nêu kết quả bằng số liệu    │
 │ T Nhiệm vụ     ███████████░░░  4.0         │ │ 2 Tách rõ vai trò của bạn     │
 │ A Hành động    ██████████░░░░  3.8         │ │ Hệ thống chỉ gợi ý cách trình │
 │ R Kết quả      ███████░░░░░░░  3.1 Yếu nhất│ │ bày, không viết sẵn câu trả lời│
 └────────────────────────────────────────────┘ └───────────────────────────────┘
 Chi tiết từng câu
 ┌ 1  Hãy kể về một lần bạn dùng dữ liệu để thuyết phục…        4.0   ⌄ ┐ ◆ accordion
 │    Câu trả lời của bạn · Nhận xét AI · điểm S T A R từng chữ          │
 ┌ 2  …                                                         3.2   ⌄ ┐
 ┌ Nhận xét của cố vấn ─────────────────────────────────────────────────┐
 │ (CL) Cô Lan · 10/10 · "Câu 3 cần nêu rõ kết quả đo được…"            │
 │ Điểm AI giữ nguyên; nhận xét giúp bạn biết nên luyện gì tiếp.        │
 └──────────────────────────────────────────────────────────────────────┘
 [ Luyện lại vị trí này → ]  ( Chia sẻ với cố vấn )
```

## A15. Lịch sử & Tiến bộ — `/student/history`

```
 Lịch sử & Tiến bộ                         ( ▌Tất cả ) ( Phỏng vấn ) ( Phân tích CV )
 ┌ Tiến bộ phỏng vấn ────────────────────────┐ ┌ Tiến bộ CV ───────────────────────┐
 │ 5 ┤                         ●             │ │ 100┤                              │
 │ 4 ┤              ●────●───╱               │ │  75┤─ ─ ─ ─ ─ ─ ─ ─ ─ ─ Cao ─ ─ ─ │
 │ 3 ┤    ●───●───╱                          │ │  50┤      ●────●────●  72         │
 │   └──────────────────────────             │ │    └──v1.0──v2.0──v2.1            │
 │ Vị trí [Data Analyst ▾]  điểm chỉ so      │ │ CV [CV_DataAnalyst ▾]             │
 │ sánh trong cùng vị trí                    │ │                                   │
 └───────────────────────────────────────────┘ └───────────────────────────────────┘
 Dòng thời gian
 ── Tháng 10 ───────────────────────────────────────────────────────────
  09/10  ◎ Phỏng vấn   Data Analyst              3.8 / 5          ( Báo cáo → )
  08/10  ▣ Phân tích   CV v2.1 × Data Analyst    72 · Khá         ( Xem → )
  05/10  ◎ Phỏng vấn   Data Analyst              3.4 / 5  ✉ có nhận xét cố vấn
 ── Tháng 9 ────────────────────────────────────────────────────────────
  …                                                       ( Tải thêm )
   gộp 2 danh sách cũ thành 1 dòng thời gian; bộ lọc pill ở trên để tách
```

## A16. Chia sẻ với Cố vấn — `/student/share`

```
 Chia sẻ với Cố vấn
 ┌ Cố vấn phụ trách ─────────────────────────────────────────────────────┐
 │ (CL) Cô Trần Thị Lan · Phòng Hướng nghiệp      [ Nhắn tin ] (✉ 1 mới)  │
 └───────────────────────────────────────────────────────────────────────┘
 Chọn những gì cô Lan được xem          Mặc định: không chia sẻ
 ┌ CV ───────────────────────────────────────────────────────────────────┐
 │ CV_DataAnalyst v2.1   ĐANG DÙNG                              [  ●] Bật│ ◆ công tắc lò xo
 │ CV_BA v1.0            Bản nháp                               [○  ] Tắt│
 ├ Phỏng vấn thử ────────────────────────────────────────────────────────┤
 │ Data Analyst · 09/10 · 3.8 / 5                 ✉ đã nhận xét  [  ●] Bật│
 │ BA · 01/10 · 3.0 / 5                                          [○  ] Tắt│
 └───────────────────────────────────────────────────────────────────────┘
 ┌ Cố vấn xem được những gì? ──────────┐ ┌ Gần đây ─────────────────────────┐
 │ Chỉ thấy khi bạn bật: CV, buổi PV   │ │ 10/10 Cô Lan nhận xét buổi PV DA │
 │ Luôn thấy: số liệu tổng hợp (số     │ │ 09/10 Bạn bật chia sẻ CV v2.1    │
 │ buổi, điểm trung bình)              │ └──────────────────────────────────┘
 └─────────────────────────────────────┘
```

## A17. Cài đặt & Quyền riêng tư — `/student/settings`

```
 Cài đặt & Quyền riêng tư
 ┌──────────────┐ ┌───────────────────────────────────────────────────────┐
 │ ▌Tài khoản   │ │ Tài khoản                                             │
 │  Quyền riêng │ │ Họ tên   [Nguyễn Văn An        ]                      │
 │  tư          │ │ Email    an@email.com  (không đổi được)               │
 │  Thông báo   │ │ ( Đổi mật khẩu )                                      │
 │  Dữ liệu     │ ├───────────────────────────────────────────────────────┤
 │              │ │ Quyền riêng tư & chia sẻ                              │
 │ ◆ mục neo,   │ │ Đóng góp dữ liệu ẩn danh để cải thiện gợi ý   [○  ]   │
 │ cuộn tới đâu │ │ Đồng ý xử lý dữ liệu & cam kết liêm chính  ✓ 20/09    │
 │ chỉ báo trượt│ │                              ( Rút lại sự đồng ý )    │
 │ theo đến đó  │ ├───────────────────────────────────────────────────────┤
 │              │ │ Thông báo & Lời nhắc                                  │
 │              │ │ Khi cố vấn để lại nhận xét mới                [  ●]   │
 │              │ │ Khi báo cáo sẵn sàng                          [  ●]   │
 │              │ │ Nhắc luyện tập hằng tuần                      [○  ]   │
 │              │ │ Gửi thêm qua email                            [○  ]   │
 │              │ ├───────────────────────────────────────────────────────┤
 │              │ │ Dữ liệu cá nhân                                       │
 │              │ │ ( Tải toàn bộ dữ liệu )                               │
 │              │ │ ┌ Vùng nguy hiểm ─────────────────── viền đỏ nhạt ──┐ │
 │              │ │ │ Xoá toàn bộ dữ liệu. Không thể hoàn tác. ( Xoá… ) │ │
 │              │ │ └────────────────────────────────────────────────────┘ │
 └──────────────┘ └───────────────────────────────────────────────────────┘
   công tắc lưu ngay, kèm toast "Đã lưu" ◆; không có nút Lưu chung
```

## A18. Bảng lệnh ⌘K

```
              ┌──────────────────────────────────────────────┐
              │ ⌕  powe|                                     │
              ├──────────────────────────────────────────────┤
              │ Vị trí                                       │
              │  ▌BI Developer · VNG      (cần Power BI)  ↵  │
              │   Data Analyst · FPT      (cần Power BI)     │
              │ Thao tác                                     │
              │   Phân tích CV với 1 vị trí                  │
              │   So sánh nhiều vị trí                       │
              │   Luyện phỏng vấn                            │
              │ Đi tới                                       │
              │   CV của tôi · Tiến bộ · Cài đặt             │
              ├──────────────────────────────────────────────┤
              │ ↑↓ chọn   ↵ mở   esc đóng                    │
              └──────────────────────────────────────────────┘
```

## A19. Tổng quan cố vấn — `/advisor`

```
 ┌▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┐
 │▓  Chào cô Lan,                                                         ▓│
 │▓  3 sinh viên cần chú ý  ·  4 buổi phỏng vấn chờ nhận xét              ▓│
 │▓  [ Xem buổi chờ nhận xét → ]                                          ▓│
 └▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┘
 ┌ Sinh viên ─────┐ ┌ Điểm PV TB ────┐ ┌ Đang tiến bộ ──┐ ┌ Chờ nhận xét ──┐
 │ 24             │ │ 3.5 ▲ +0.3     │ │ 15 / 24        │ │ 4              │
 └────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘
 ┌ Sinh viên cần chú ý ──────────────────────┐ ┌ Điểm PV trung bình theo tuần ─┐
 │ (BH) Bùi Hà     ▼ giảm 2 buổi liên tiếp →│ │      ●───●                    │
 │ (TM) Trần Minh  14 ngày không hoạt động  →│ │ ●───╱     ╲●──●               │
 │ (LK) Lê Khoa    Chưa tải CV              →│ └───────────────────────────────┘
 └───────────────────────────────────────────┘
 ┌ Tiêu chí STAR cả nhóm ──┐ ┌ Phân bố mức tiến bộ ──┐ ┌ Tiến bộ nhiều nhất ─────┐
 │ S ████████ T ███████    │ │ ███████ Tăng   15     │ │ Phạm An   2.8 → 4.1     │
 │ A ██████   R ████ Yếu   │ │ ███     Giữ     6     │ │ Võ Nhi    3.0 → 3.9     │
 └─────────────────────────┘ │ █       Giảm    3     │ └─────────────────────────┘
                             └───────────────────────┘
 ┌ Nhận xét đã gửi gần đây ─────────────────────────────────────────────────┐
```

## A20. Sinh viên phụ trách — `/advisor/students`

```
 Sinh viên phụ trách                      [Tìm sinh viên…        ]
 ( ▌Tất cả 24 ) ( Cần chú ý 3 ) ( Chờ nhận xét 4 ) ( Đang tiến bộ 15 )   ◆ pill trượt
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ Sinh viên        Vị trí đang luyện   Điểm đầu → gần nhất  Trạng thái  Hoạt động│
 ├──────────────────────────────────────────────────────────────────────────────┤
 │ (PA) Phạm An     Data Analyst        2.8 → 4.1  ▁▃▅▇      Tiến bộ     2 giờ   ⌄│
 │ (BH) Bùi Hà      BA                  3.4 → 2.9  ▇▅▃       Cần chú ý   1 ngày  ⌄│
 │  ┌ STAR: R yếu nhất · CV: 51 → 64 · Gợi ý buổi tới: luyện câu tình huống ┐   │ ◆ mở rộng
 │  │ ( Mở hồ sơ → )  ( Nhắn tin )                                          │   │   tại chỗ
 │  └───────────────────────────────────────────────────────────────────────┘   │
 │ (LK) Lê Khoa     Chưa chọn vị trí    —                    Chưa đủ dữ liệu  —  ⌄│
 └──────────────────────────────────────────────────────────────────────────────┘
```

## A21. Hồ sơ sinh viên — `/advisor/students/[id]`

```
 Sinh viên phụ trách / Phạm An
 ┌─────────────────────────────────────────────────────────────────────────┐
 │ (PA) Phạm An · K66 CNTT          Tiến bộ      [ Nhắn tin ] ( Ghi chú )  │
 │ Đang nhắm: Data Analyst · BI Developer                                  │
 └─────────────────────────────────────────────────────────────────────────┘
 ( ▌Phỏng vấn ) ( CV ) ( Ghi chú 3 )                                  ◆ pill trượt
 ── Tab Phỏng vấn ─────────────────────────────────────────────────────────
 ┌ Tiến bộ theo vị trí ──────────────────┐ ┌ Tiêu chí STAR ───────────────┐
 │ Data Analyst  2.8 ─ 3.4 ─ 3.8 ─ 4.1   │ │ S 4.2  T 4.0  A 3.8  R 3.1   │
 │ điểm chỉ so sánh trong cùng vị trí    │ │                     Yếu nhất │
 └───────────────────────────────────────┘ └──────────────────────────────┘
 Các buổi phỏng vấn thử   ( ▌Tất cả ) ( Chờ nhận xét 1 )
 │ 09/10 Data Analyst  4.1  Chờ nhận xét                   [ Nhận xét → ] │ → dialog: trái là
 │ 05/10 Data Analyst  3.8  ✓ Đã nhận xét                  ( Xem )        │   báo cáo, phải là
 ── Tab CV ────────────────────────────────────────────────────────────────   ô nhận xét
 │ CV đang dùng · Độ khớp qua các phiên bản · Vị trí đang nhắm ·            │
 │ Kết quả phân tích gần nhất (72 · Khá)                                    │
 ── Tab Ghi chú ───────────────────────────────────────────────────────────
 │ [Thêm ghi chú…                         ] Gắn thẻ: (Kỹ năng)(Thái độ)    │
 │ Gợi ý cho buổi tư vấn tiếp theo (do hệ thống tổng hợp)                   │
```

---

# B. Mobile (< 760px, vẽ ở 375px)

## B0. Khung ứng dụng và thanh tab

```
┌────────────────────────────────────────┐
│ Thư viện JD                   (⌕) (AN) │ ← (⌕) thay cho ⌘K
├────────────────────────────────────────┤
│                                        │
│              nội dung                  │
│                                        │
├────────────────────────────────────────┤
│  ▣      ◇       ▤       ◎       ≡      │
│ Tổng ▌Thư viện Phân tích Phỏng  Tôi    │ ◆ chỉ báo mục đang chọn
│ quan                    vấn            │   trượt kiểu lò xo
└────────────────────────────────────────┘
 "Tôi" mở sheet: CV của tôi · Tiến bộ · Chia sẻ với cố vấn (✉ 1) · Cài đặt · Đăng xuất
```

## B1. Tổng quan

```
┌────────────────────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓ Chào An,                             ▓│
│▓ CV khớp 72% với Data Analyst.        ▓│
│▓ Còn 3 kỹ năng nữa là đạt mức Cao.    ▓│
│▓ [ Tối ưu CV ngay → ]                 ▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│ ┌ 72% ▲8 ┐ ┌ 3.6 ▲.4 ┐ ┌ 2/3 ┐  →      │ ← KPI cuộn ngang
│ └ Độ khớp┘ └ STAR TB ┘ └ PV  ┘         │
│ Đang dở                                │
│ ◐ Tối ưu CV · Data Analyst    60%  →   │
│ Vị trí hợp với bạn          Xem tất cả │
│ ★ Data Analyst · FPT       (●●● Cao)   │
│ ★ BI Developer · VNG       (●●○ Khá)   │
│ Bước tiếp theo nên làm                 │
│ 1  Thêm số liệu cho dự án Sales Dash.  │
└────────────────────────────────────────┘
```

## B2. Thư viện JD

```
┌────────────────────────────────────────┐
│░Thư viện JD░░░░░░░░░░░░░░░░░░░ (⌕) (AN)│ ← dải pastel 240px nằm sau header
│░(Gợi ý theo CV_PhanTichDuLieu v2.1 ▾)░░│
│░┌ Phù hợp nhất với CV  Ước tính nhanh ┐│ ← thẻ trắng, danh sách dọc
│ │ (1) Data Analyst Intern     (● Cao) ││
│ │     Thiếu: Thống kê, Google Analytics││
│ │ (2) Marketing Analyst       (● Khá) ││
│ │ (3) Business Analyst Intern (● Khá) ││
│ └─────────────────────────────────────┘│
│ [⌕ Tìm vị trí, kỹ năng…        ] (⫶)   │ ← nút lọc mở sheet
│ (▌Tất cả        )( Đã lưu 1       )    │
│ ★ Data Analyst Intern    (● Cao)    ♡  │
│   Công ty TMĐT B · Thực tập            │
│ ────────────────────────────────────── │
│   Backend Developer Intern          ♡  │
│   Công ty Phần mềm G · Thực tập        │
├────────────────────────────────────────┤
│  Tổng quan ▌Thư viện Phân tích … Tôi   │
└────────────────────────────────────────┘
  không hiện thanh cuộn, không cuộn ngang · chạm một vị trí mở sheet mức phù hợp (B3)
```

## B3. Chi tiết vị trí

```
┌────────────────────────────────────────┐
│ ←  Data Analyst                     ♡  │
│ FPT Software · Junior · Hà Nội         │
│ (▌Tổng quan)(Mô tả)(Yêu cầu)(Quyền… →  │ ← tab mục neo, dính dưới topbar
│                                        │
│ Mô tả công việc                        │
│ • Xây dựng dashboard theo dõi…         │
│ Yêu cầu ứng viên                       │
│ Bắt buộc  (SQL)(Python)(Excel)         │
│ Ưu tiên   (Power BI)(Tableau)          │
├────────────────────────────────────────┤
│ (●●● Cao) · Thiếu 2 kỹ năng        ⌃   │ ← bấm để mở sheet mức phù hợp
│ ( + So sánh )   [ Phân tích → ]        │
└────────────────────────────────────────┘
        sheet mở ra (◆ trượt lên, nền mờ):
┌────────────────────────────────────────┐
│               ───                      │
│ Mức phù hợp với CV_DataAnalyst v2.1 ▾  │
│ (●●● Cao)  ★ Gợi ý #1                  │
│ ● SQL  ● Python  ● Excel               │
│ ◐ Tableau                              │
│ ○ Power BI  ○ Statistics               │
│ Ước tính nhanh theo kỹ năng.           │
│ [ Phân tích chi tiết → ]               │
└────────────────────────────────────────┘
```

## B4. Phân tích, chế độ nhiều vị trí

```
┌────────────────────────────────────────┐
│ Phân tích CV & JD                      │
│ ( 1 vị trí )(▌Nhiều vị trí )           │
│ CV  CV_DataAnalyst v2.1      ( Đổi )   │
│ Vị trí so sánh  2 / 3                  │
│ ┌────────────────────────────────────┐ │
│ │ 1 ★ Data Analyst · FPT           ✕ │ │
│ │ 2 ✎ Marketing Exec · ABC  (Sửa)  ✕ │ │
│ │ 3 ( + Thêm vị trí )                │ │ → mở sheet toàn màn hình:
│ └────────────────────────────────────┘ │   Gợi ý & Đã lưu / Dán JD
├────────────────────────────────────────┤
│ [ So sánh 2 vị trí → ]                 │
└────────────────────────────────────────┘
  Form "Dán JD" trên mobile: mỗi mục là một bước (Tổng quan → Mô tả → Yêu cầu
  → Khác), thanh tiến trình nhỏ ở trên, nút Tiếp dính đáy.
```

## B5. Kết quả so sánh

```
┌────────────────────────────────────────┐
│ ←  So sánh 3 vị trí                    │
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓  #1 DA      #2 BI       #3 PA        ▓│
│▓  82 Cao     74 Khá      61 Khá       ▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│ Kỹ năng        DA     BI     PA        │ ← hàng tiêu đề dính khi cuộn;
│ SQL            ●      ●      ●         │   tên viết tắt, bấm để xem đầy đủ
│ Python         ●      ◐      ●         │
│ Tableau        ◐      ●      ○         │
│ Power BI       ○      ●      ○         │
│ Statistics     ○      ○      ○         │
│ ● đáp ứng ◐ chỉ liệt kê ○ thiếu        │
│ ┌ Thiếu ở cả 3 vị trí ───────────────┐ │
│ │ (Statistics) (A/B Testing)         │ │
│ └────────────────────────────────────┘ │
│ Nhận xét AI ⌄ DA  ⌄ BI  ⌄ PA           │
├────────────────────────────────────────┤
│ [ Phân tích sâu Data Analyst → ]       │
└────────────────────────────────────────┘
```

## B6. Trình tối ưu CV

```
┌────────────────────────────────────────┐
│ ←  Trình tối ưu CV          3 / 7      │
│ ━━━━━━━━━━━━━━━░░░░░░░░░░░░░░░░░░░░░░░ │
│ (▌Gợi ý 4 ) ( Xem CV )                 │ ← 2 cột thành 2 tab
│ ┌────────────────────────────────────┐ │
│ │ 2 / 7 · Kinh nghiệm                │ │
│ │ Cũ  Phân tích dữ liệu bán hàng…    │ │
│ │ Mới Phân tích dữ liệu bán hàng…    │ │
│ │     cho [số] chi nhánh             │ │
│ │ ⓘ AI không tự đặt số liệu.         │ │
│ │ ( Bỏ qua )( Sửa )  [ Áp dụng ]     │ │
│ └────────────────────────────────────┘ │
│        ◆ vuốt trái/phải để chuyển gợi ý │
│ ( Xem dòng này trong CV ↗ )            │ ← sang tab CV, cuộn tới dòng
├────────────────────────────────────────┤
│ 3 áp dụng · 1 bỏ qua  [ Hoàn tất → ]   │
└────────────────────────────────────────┘
```

## B7. Phòng phỏng vấn

```
┌────────────────────────────────────────┐
│ (←)   Câu 3 / 5        ⏱ 04:12   ( ‖ ) │
│ ━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░░░ │
│                                        │
│ Hãy kể về một lần bạn dùng dữ liệu     │
│ để thuyết phục người khác thay đổi     │
│ quyết định.                            │
│                                        │
│ (S)(T)(A)(R)                           │
│ ┌────────────────────────────────────┐ │
│ │ Câu trả lời của bạn…               │ │ ← ô nhập nở lên khi bàn phím mở;
│ │                                    │ │   câu hỏi thu thành 1 dòng ở trên
│ └────────────────────────────────────┘ │
│ 124 từ              [ Gửi → ]          │
└────────────────────────────────────────┘
```

## B8. Tìm kiếm (thay ⌘K) và Cố vấn

```
┌────────────────────────────────────────┐   ┌────────────────────────────────────────┐
│ (⌕ powe|                     ) Huỷ     │   │ Sinh viên phụ trách           (⌕) (CL) │
│ Vị trí                                 │   │ (▌Tất cả 24)(Cần chú ý 3)(Chờ… →       │
│  BI Developer · VNG                    │   │ ┌────────────────────────────────────┐ │
│  Data Analyst · FPT                    │   │ │ (PA) Phạm An           Tiến bộ     │ │
│ Thao tác                               │   │ │ Data Analyst · 2.8 → 4.1  ▁▃▅▇     │ │
│  Phân tích CV với 1 vị trí             │   │ │ 2 giờ trước                     →  │ │
│  Luyện phỏng vấn                       │   │ └────────────────────────────────────┘ │
│ Gần đây                                │   │ ┌ (BH) Bùi Hà          Cần chú ý  → ┐ │
│  Data Analyst · FPT                    │   │   bảng thành thẻ; mở hồ sơ là trang mới│
└────────────────────────────────────────┘   └────────────────────────────────────────┘
  mở toàn màn hình, bàn phím bật sẵn            Hồ sơ SV: 3 tab dính trên; Nhận xét PV
                                                mở toàn màn hình, nút Gửi dính đáy
```

---

# C. Trạng thái rỗng, đang tải, lỗi

Quy tắc chung ở DESIGN.md mục 9. Phần này là mẫu hình và bảng chi tiết từng màn.

## C1. Mẫu hình

```
 SKELETON (Thư viện JD)                       TÁC VỤ AI (Gợi ý vị trí)
 ┌────────────────────────────────┐          ┌──────────────────────────────────────┐
 │ ▒▒▒▒▒▒▒▒▒▒▒▒▒       ▒▒▒▒▒▒     │          │ Đang tìm vị trí phù hợp với CV…      │
 │ ▒▒▒▒▒▒▒  ▒▒▒▒▒▒▒▒              │          │ ✓ Đọc CV                             │
 ├────────────────────────────────┤          │ ● So khớp với thư viện JD            │
 │ ▒▒▒▒▒▒▒▒▒▒          ▒▒▒▒▒▒     │          │ ○ Viết lời khuyên                    │
 │ ▒▒▒▒▒  ▒▒▒▒▒▒▒                 │          │ ━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░ ◆   │
 └────────────────────────────────┘          │ Bạn có thể rời trang, kết quả sẽ có  │
   ◆ ánh sáng chạy chậm, tắt khi bật         │ trong thông báo.                     │
     chế độ giảm chuyển động                 └──────────────────────────────────────┘

 RỖNG LẦN ĐẦU (CV của tôi)                   LỖI MỘT KHỐI
 ┌────────────────────────────────┐          ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
 │            ┌───┐               │          ╎ ⚠ Không tải được biểu đồ tiến bộ.     ╎
 │            │ ≡ │               │          ╎   ( Thử lại )                        ╎
 │            └───┘               │          └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
 │   Chưa có CV nào               │
 │   Tải CV lên để phân tích,     │          LỖI THAO TÁC (toast)
 │   nhận gợi ý vị trí và luyện   │          ╭──────────────────────────────────────╮
 │   phỏng vấn.                   │          │ ⚠ Chưa lưu được nhận xét. (Thử lại) ✕│
 │   [ Tải CV lên ]               │          ╰──────────────────────────────────────╯
 └────────────────────────────────┘

 CHẾ ĐỘ DỰ PHÒNG
 ┌──────────────────────────────────────────────────────────────────────┐
 │ ⓘ Kết quả được tạo bằng quy tắc, chưa có đánh giá AI chi tiết.       │  nền --warn-soft
 └──────────────────────────────────────────────────────────────────────┘
```

## C2. Bảng trạng thái từng màn

| Màn | Đang tải | Rỗng | Lỗi và trường hợp đặc biệt |
|---|---|---|---|
| **Tổng quan SV** | Skeleton từng khối | **Người mới:** hero đổi thành "Bắt đầu trong 3 bước" (Tải CV → Xem vị trí gợi ý → Phân tích), có checklist, mỗi bước xong có hiệu ứng tick | Lỗi từng khối, hero vẫn hiện |
| **CV của tôi** | Skeleton thẻ | Như mẫu C1 | Tải lên lỗi: thẻ upload báo đỏ tại chỗ, nêu lý do (sai định dạng, quá dung lượng, PDF dạng ảnh không đọc được chữ) |
| **Chi tiết CV** | Skeleton trang giấy | — | CV không tồn tại hoặc đã xoá: trang "Không tìm thấy CV" kèm nút về danh sách |
| **Thư viện JD** | Skeleton thẻ gợi ý và danh sách | **Chưa có CV:** dải gợi ý đổi thành "Tải CV lên để xem vị trí hợp với bạn" kèm nút; danh sách kho vẫn hiện. **Không có gợi ý:** ẩn dải, hiện 1 dòng thông báo. **Đã lưu rỗng:** "Bấm ♡ ở vị trí bất kỳ để lưu" | Gợi ý lỗi: chỉ dải gợi ý báo lỗi, danh sách vẫn dùng được |
| **Chi tiết vị trí** | Skeleton | Chưa có CV: thẻ mức phù hợp đổi thành nút "Tải CV để xem mức phù hợp" | Không tìm thấy vị trí: trang lỗi kèm nút về Thư viện JD |
| **Phân tích: chọn vị trí** | Skeleton danh sách | **Chưa có gợi ý và chưa lưu:** "Chưa có vị trí gợi ý hay đã lưu" kèm `( Mở Thư viện JD )` hoặc `( Dán JD )` | Form Dán JD: lỗi dưới từng ô; ô bắt buộc trống thì nút chính tắt và ghi rõ còn thiếu gì |
| **Kết quả phân tích** | Tác vụ AI 4 bước | — | **Phân tích thất bại:** thẻ lỗi kèm `[ Chạy lại ]`, giữ CV và JD đã chọn. **Chế độ dự phòng:** dải warn ở trên |
| **So sánh** | Tác vụ AI; từng cột điểm hiện dần khi xong | Không có kỹ năng thiếu chung: khối đó đổi thành "Không có kỹ năng nào thiếu ở cả 3 vị trí" | Một JD lỗi: chỉ cột đó báo lỗi |
| **Trình tối ưu** | Skeleton 2 cột | **Không có gợi ý:** "CV đã thể hiện tốt các yêu cầu" kèm nút về kết quả; vẫn hiện phần xác nhận kỹ năng thiếu nếu có | Áp dụng lỗi: thẻ quay về trạng thái cũ kèm toast |
| **Xuất CV** | Skeleton | — | Chưa tick cam kết: nút tải tắt, có chú thích giải thích |
| **Thiết lập PV** | Skeleton | **Chưa có CV:** chặn kèm `[ Tải CV lên ]`. **Hết lượt tuần:** "Đã dùng 3/3 buổi tuần này, mở lại vào thứ Hai" kèm ngày cụ thể | — |
| **Phòng PV** | Chờ câu tiếp theo: "AI đang đọc câu trả lời…" | — | **Mất mạng khi gửi:** giữ câu trả lời, đồng hồ tạm dừng, dải "Mất kết nối, đang thử lại…" |
| **Báo cáo PV** | Tác vụ AI "Đang chấm điểm…" | Chưa có nhận xét cố vấn: "Chia sẻ buổi này để cố vấn nhận xét" kèm nút | Báo cáo lỗi: thẻ lỗi kèm Thử lại; câu trả lời của SV vẫn xem được |
| **Tiến bộ** | Skeleton biểu đồ và dòng thời gian | **Người mới:** biểu đồ mờ kèm "Cần ít nhất 2 buổi để thấy tiến bộ" | Lỗi từng khối |
| **Chia sẻ** | Skeleton | **Chưa có cố vấn:** "Bạn chưa được phân công cố vấn", ẩn công tắc. **Chưa có gì để chia sẻ:** nút dẫn tới tải CV hoặc luyện PV | Bật / tắt lỗi: công tắc bật ngược lại kèm toast |
| **Cài đặt** | Skeleton | — | Đổi mật khẩu sai: lỗi dưới ô. Xoá dữ liệu: dialog bắt gõ "XOÁ" để xác nhận |
| **Cố vấn: Tổng quan** | Skeleton | **Chưa có SV:** "Bạn chưa được phân công sinh viên nào". **SV chưa đủ dữ liệu:** biểu đồ hiện chú thích thay vì để trống | Lỗi từng khối |
| **Cố vấn: Danh sách / Hồ sơ** | Skeleton bảng | Bộ lọc không khớp: dòng chữ kèm Xoá bộ lọc. **SV chưa chia sẻ:** tab ghi "Sinh viên chưa chia sẻ mục này" thay vì ẩn | Gửi nhận xét lỗi: giữ nội dung đã gõ, kèm toast |

## C3. Tác vụ AI chạy lâu

1. 0–15 giây: các bước có tên, thanh gradient chạy.
2. Sau 15 giây: đổi câu chữ thành "Lâu hơn bình thường một chút…".
3. Sau 45 giây: hiện `( Chạy tiếp ở nền )`; khi xong báo qua chuông thông báo. Bước này cần backend có endpoint thông báo (hiện frontend dùng mock).
