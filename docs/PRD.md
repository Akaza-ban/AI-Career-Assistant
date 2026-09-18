# PRD — Trợ lý nghề nghiệp X (EDU-17)

## Tóm tắt điều hành
Chúng tôi xây dựng **Trợ lý nghề nghiệp X**, một AI agent phân tích khoảng cách CV–JD và tổ chức phỏng vấn thử có chấm điểm, dành cho sinh viên năm cuối Trường X đang chuẩn bị ứng tuyển nhưng CV chưa khớp vị trí và thiếu cơ hội luyện phỏng vấn thực tế. Ở Gate 1 (Basic), hệ thống hỗ trợ 1 vị trí ứng tuyển: tối ưu cách trình bày CV dựa trên kinh nghiệm thật (tuyệt đối không bịa), mock interview theo rubric STAR, và cố vấn hướng nghiệp giám sát tiến độ qua dashboard (HITL). Mục tiêu đo lường: ≥60% SV trong nhóm thử nghiệm sử dụng, CSAT ≥4/5, và cải thiện điểm phỏng vấn trung bình theo thời gian (metric giá trị chính, không chỉ adoption).

## 1. Personas & User Stories

# Persona: Sinh viên (SV)

Năm cuối Trường X, chuẩn bị ứng tuyển, CV chưa chắc khớp vị trí mong muốn, ít cơ hội luyện phỏng vấn thực tế.

## US-SV-01: Tải lên CV

**As a** Sinh viên năm cuối Trường X đã đăng nhập hệ thống

**I want to** tải lên file CV định dạng PDF hoặc DOCX để hệ thống lưu và chuẩn bị phân tích

**So that** tôi có một bản CV gốc trong hệ thống làm cơ sở cho các bước tối ưu và phân tích khoảng cách tiếp theo

### Metadata
- **Epic**: Gap Analysis
- **Priority**: Must
- **Estimate**: 3 SP
- **Dependencies**: Không
- **Assumptions**: Ngưỡng dung lượng file (10MB) là giả định kỹ thuật, cần PO xác nhận

### INVEST Self-check
| Tiêu chí | ✅/⚠️ | Ghi chú |
|---|---|---|
| Independent | ✅ | Không phụ thuộc story khác, chạy được độc lập |
| Negotiable | ✅ | Không cố định công nghệ parser cụ thể |
| Valuable | ✅ | Tiền đề bắt buộc cho toàn bộ luồng gap analysis |
| Estimable | ✅ | Phạm vi rõ, giới hạn 2 định dạng file |
| Small | ✅ | 1 hành động duy nhất (upload + parse) |
| Testable | ✅ | Có thể viết test case từ AC bên dưới |

### Acceptance Criteria

**AC1: Tải lên thành công**
- **Given** SV đã đăng nhập và đang ở màn hình tải CV, chưa có CV nào trong phiên hiện tại
- **When** SV chọn 1 file PDF hoặc DOCX dung lượng ≤ 10MB và bấm "Tải lên"
- **Then** hệ thống lưu file và tạo bản ghi CV phiên bản 1 (version = 1) gắn với tài khoản SV
- **And** hệ thống hiển thị trạng thái "Tải lên thành công" kèm tên file và thời điểm tải lên

**AC2: File đúng định dạng nhưng không trích xuất được nội dung (VD: bản scan ảnh)**
- **Given** SV tải lên 1 file PDF là bản scan ảnh, không có lớp văn bản
- **When** hệ thống thử trích xuất nội dung CV từ file
- **Then** hệ thống trả về trạng thái "Không trích xuất được nội dung CV" và không tạo bản ghi version mới
- **And** yêu cầu SV tải lại 1 bản CV có lớp văn bản (không phải ảnh scan thuần)

**AC3: Sai định dạng hoặc vượt dung lượng**
- **Given** SV chọn 1 file không phải PDF/DOCX, hoặc dung lượng > 10MB
- **When** SV bấm "Tải lên"
- **Then** hệ thống từ chối upload và hiển thị thông báo nêu rõ định dạng/dung lượng cho phép
- **And** không có bản ghi CV mới nào được tạo


---

## US-SV-02: Chọn vị trí ứng tuyển và xem kết quả phân tích khoảng cách CV–JD

**As a** Sinh viên đã có ít nhất 1 bản CV trong hệ thống

**I want to** nhập hoặc chọn 1 JD làm vị trí ứng tuyển mục tiêu và xem kết quả so sánh CV của mình với JD đó

**So that** tôi biết CV hiện tại đang thiếu hoặc lệch điểm nào so với yêu cầu vị trí, được phân loại rõ giữa lỗi trình bày và lỗi thiếu năng lực thật

### Metadata
- **Epic**: Gap Analysis
- **Priority**: Must
- **Estimate**: 5 SP
- **Dependencies**: US-SV-01
- **Assumptions**: Gate 1 chỉ hỗ trợ 1 vị trí ứng tuyển/SV (theo PRD); ngưỡng "JD tối thiểu 50 từ" là giả định kỹ thuật, cần PO xác nhận

### INVEST Self-check
| Tiêu chí | ✅/⚠️ | Ghi chú |
|---|---|---|
| Independent | ⚠️ | Phụ thuộc US-SV-01 (cần có CV trước) — chấp nhận được vì là phụ thuộc tuần tự tự nhiên, không phải circular |
| Negotiable | ✅ | Chưa cố định UI chọn JD (dropdown mẫu hay paste text) |
| Valuable | ✅ | Giá trị cốt lõi của sản phẩm — biết CV lệch gì |
| Estimable | ✅ | Rõ input/output |
| Small | ✅ | 1 luồng chính, có thể hoàn thành trong 1 sprint |
| Testable | ✅ | AC đo lường được qua 2 nhóm kết quả rõ ràng |

### Acceptance Criteria

**AC1: Phân tích thành công**
- **Given** SV đã có CV phiên bản mới nhất trong hệ thống
- **And** SV chọn 1 JD từ danh sách mẫu hoặc dán nội dung JD dạng text có tối thiểu 50 từ
- **When** SV bấm "Phân tích khoảng cách"
- **Then** hệ thống trả về kết quả gồm 2 nhóm riêng biệt: "Khoảng cách trình bày" và "Khoảng cách năng lực", mỗi nhóm liệt kê các mục cụ thể nếu có phát hiện
- **And** kết quả được gắn với đúng cặp (CV version, JD) để tra cứu lại sau

**AC2: JD quá ngắn / thiếu thông tin**
- **Given** SV dán nội dung JD dưới 50 từ
- **When** SV bấm "Phân tích khoảng cách"
- **Then** hệ thống không thực hiện phân tích và hiển thị thông báo yêu cầu bổ sung JD đầy đủ hơn (tối thiểu 50 từ)

**AC3: Chưa có CV**
- **Given** tài khoản SV chưa có bản CV nào
- **When** SV cố truy cập màn hình chọn JD / phân tích khoảng cách
- **Then** hệ thống chặn thao tác và điều hướng SV quay lại bước tải CV, kèm thông báo lý do

### Notes
- Dependencies: US-SV-01
- Liên quan trực tiếp US-SV-03 (gợi ý trình bày) và US-SV-05 (cảnh báo năng lực) — cả 2 đều tiêu thụ kết quả của story này

---

## US-SV-03: Nhận gợi ý diễn đạt lại CV theo khoảng cách trình bày

**As a** Sinh viên đã có kết quả phân tích khoảng cách CV-JD với ít nhất 1 mục "khoảng cách trình bày"

**I want to** nhận gợi ý cụ thể để diễn đạt lại kinh nghiệm thật của mình sao cho khớp JD hơn, và áp dụng nếu đồng ý

**So that** tôi tăng cơ hội CV qua vòng lọc hồ sơ mà không cần bịa hay thổi phồng thông tin

### Metadata
- **Epic**: Gap Analysis
- **Priority**: Must
- **Estimate**: 5 SP
- **Dependencies**: US-SV-02

### INVEST Self-check
| Tiêu chí | ✅/⚠️ | Ghi chú |
|---|---|---|
| Independent | ⚠️ | Phụ thuộc kết quả US-SV-02 — phụ thuộc tuần tự tự nhiên |
| Negotiable | ✅ | Không cố định cách sinh gợi ý (prompt/model cụ thể) |
| Valuable | ✅ | Giá trị khác biệt cốt lõi: tối ưu CV không bịa |
| Estimable | ✅ | Rõ input (mục gap) / output (gợi ý + version mới) |
| Small | ✅ | 1 luồng: xem gợi ý → áp dụng hoặc bỏ qua |
| Testable | ✅ | AC kiểm tra được qua trạng thái version CV |

### Acceptance Criteria

**AC1: Áp dụng gợi ý — tạo version CV mới**
- **Given** hệ thống đã trả về ít nhất 1 gợi ý diễn đạt lại cho 1 mục "khoảng cách trình bày"
- **When** SV chọn "Áp dụng gợi ý" cho mục đó
- **Then** hệ thống tạo 1 bản CV phiên bản mới (version = version hiện tại + 1), không ghi đè bản cũ
- **And** bản CV mới lưu rõ phần nội dung đã thay đổi so với bản trước, để SV xem lại lịch sử

**AC2: Nội dung nghi ngờ không nhất quán (thiếu ngữ cảnh hỗ trợ)**
- **Given** hệ thống phát hiện 1 số liệu hoặc thành tích trong CV không có ngữ cảnh/chứng cứ hỗ trợ đi kèm
- **When** hệ thống chuẩn bị sinh gợi ý diễn đạt lại cho mục này
- **Then** hệ thống không tự động sửa hoặc kết luận SV nói dối, mà yêu cầu SV bổ sung ngữ cảnh/chứng cứ trước khi đưa ra gợi ý cụ thể

**AC3: SV từ chối áp dụng gợi ý**
- **Given** hệ thống đã hiển thị 1 gợi ý diễn đạt lại
- **When** SV chọn "Bỏ qua" thay vì áp dụng
- **Then** hệ thống giữ nguyên CV ở phiên bản hiện tại, không tạo version mới
- **And** gợi ý bị bỏ qua được đánh dấu "Đã bỏ qua", không hiển thị lặp lại cho cùng mục trong cùng phiên phân tích

### Notes
- HITL: SV là người quyết định áp dụng hay không và chịu trách nhiệm với bản CV cuối cùng nộp đi (ràng buộc liêm chính trong Brief)
- Dependencies: US-SV-02

---

## US-SV-04: Luyện phỏng vấn thử có chấm điểm theo rubric STAR

**As a** Sinh viên đã chọn 1 vị trí ứng tuyển (JD) trong hệ thống

**I want to** bắt đầu 1 vòng phỏng vấn thử theo vị trí đã chọn và nhận điểm chấm theo rubric STAR sau khi hoàn thành

**So that** tôi biết năng lực trả lời phỏng vấn hiện tại của mình theo tiêu chí cụ thể, làm cơ sở luyện tập cải thiện qua các vòng

### Metadata
- **Epic**: Mock Interview
- **Priority**: Must
- **Estimate**: 8 SP
- **Dependencies**: US-SV-02
- **Assumptions**: Giới hạn 3 vòng chấm điểm/SV/vị trí/tuần (theo NFR); admin/cố vấn có thể cấp thêm

### INVEST Self-check
| Tiêu chí | ✅/⚠️ | Ghi chú |
|---|---|---|
| Independent | ⚠️ | Phụ thuộc US-SV-02 (cần JD đã chọn) |
| Negotiable | ✅ | Chưa cố định số lượng câu hỏi/vòng |
| Valuable | ✅ | Giá trị chính của sản phẩm (metric KPI chính là score delta) |
| Estimable | ⚠️ | Cần làm rõ cấu trúc rubric STAR chi tiết trước khi estimate chính xác — đề xuất Spike story riêng cho rubric |
| Small | ✅ | 1 vòng phỏng vấn = 1 đơn vị công việc rõ ràng |
| Testable | ✅ | Điểm số là kết quả đo lường được |

### Acceptance Criteria

**AC1: Hoàn thành 1 vòng phỏng vấn**
- **Given** SV đã chọn JD và còn ít nhất 1 lượt phỏng vấn có chấm điểm trong tuần (giới hạn 3 vòng/vị trí/tuần)
- **When** SV trả lời đầy đủ các câu hỏi trong 1 vòng và bấm "Nộp"
- **Then** hệ thống chấm điểm theo rubric STAR cho từng câu trả lời và trả về điểm tổng của vòng đó
- **And** điểm của vòng được lưu gắn với SV, JD, và số thứ tự vòng để phục vụ theo dõi tiến bộ

**AC2: Bỏ trống câu hỏi**
- **Given** SV đang trong 1 vòng phỏng vấn và bỏ trống ít nhất 1 câu hỏi
- **When** SV bấm "Nộp"
- **Then** hệ thống yêu cầu SV hoàn thành đủ toàn bộ câu hỏi của vòng trước khi cho phép nộp và chấm điểm

**AC3: Hết quota vòng phỏng vấn trong tuần**
- **Given** SV đã dùng hết 3/3 vòng phỏng vấn có chấm điểm cho vị trí đang chọn trong tuần hiện tại
- **When** SV cố bắt đầu 1 vòng phỏng vấn mới có chấm điểm
- **Then** hệ thống chặn thao tác và hiển thị thông báo đã đạt giới hạn tuần, kèm hướng dẫn liên hệ cố vấn/admin để xin cấp thêm lượt

### Notes
- ⚠️ Estimable cần Spike: cấu trúc rubric STAR (bao nhiêu tiêu chí, thang điểm) chưa được PRD mô tả chi tiết — đề xuất làm rõ với PO trước khi dev estimate
- Dependencies: US-SV-02

---

## US-SV-05: Nhận cảnh báo khoảng cách năng lực thật (capability gap)

**As a** Sinh viên đã có kết quả phân tích khoảng cách CV-JD

**I want to** được cảnh báo rõ ràng khi JD yêu cầu 1 kỹ năng mà tôi thực sự chưa có

**So that** tôi biết cần bổ sung năng lực gì trước khi ứng tuyển, thay vì chỉ sửa câu chữ CV mà không giải quyết gốc rễ

### Metadata
- **Epic**: Gap Analysis
- **Priority**: Must
- **Estimate**: 3 SP
- **Dependencies**: US-SV-02

### INVEST Self-check
| Tiêu chí | ✅/⚠️ | Ghi chú |
|---|---|---|
| Independent | ⚠️ | Phụ thuộc kết quả phân loại của US-SV-02 |
| Negotiable | ✅ | Không cố định thuật toán phân loại |
| Valuable | ✅ | Tránh SV chỉ sửa câu chữ mà bỏ qua vấn đề gốc |
| Estimable | ✅ | Rõ input/output |
| Small | ✅ | Chỉ là hiển thị + gắn nhãn, không xử lý phức tạp |
| Testable | ✅ | Kiểm tra được qua nhãn phân loại |

### Acceptance Criteria

**AC1: Có khoảng cách năng lực**
- **Given** kết quả phân tích có ít nhất 1 mục thuộc nhóm "khoảng cách năng lực"
- **When** SV xem trang kết quả phân tích
- **Then** hệ thống hiển thị mục đó ở nhóm riêng "Khoảng cách năng lực", kèm ghi chú hệ thống không tự sửa mục này bằng câu chữ
- **And** mục này đồng thời hiển thị trên dashboard của cố vấn phụ trách SV đó (US-ADV-03)

**AC2: Không có khoảng cách năng lực nào**
- **Given** kết quả phân tích không phát hiện mục nào thuộc nhóm "khoảng cách năng lực"
- **When** SV xem trang kết quả phân tích
- **Then** hệ thống hiển thị rõ trạng thái "Không phát hiện khoảng cách năng lực", không để trống mục này gây hiểu nhầm

**AC3: Không đủ tin cậy để phân loại 1 mục**
- **Given** hệ thống không đủ tin cậy để phân loại 1 mục là "trình bày" hay "năng lực"
- **When** hệ thống trả kết quả phân tích
- **Then** mục đó được gắn nhãn "Cần SV xem xét thủ công" thay vì tự ý xếp vào 1 trong 2 nhóm

### Notes
- Constraint minh bạch (NFR): hệ thống không xác minh được tính xác thực của kinh nghiệm tự khai — cần hiển thị disclaimer này ở màn hình kết quả
- Dependencies: US-SV-02

---

## US-SV-06: Đánh giá trải nghiệm (CSAT) sau mỗi lượt sử dụng

**As a** Sinh viên vừa hoàn thành 1 lượt phân tích khoảng cách CV-JD hoặc 1 vòng phỏng vấn có chấm điểm

**I want to** được mời đánh giá trải nghiệm bằng thang điểm 1-5 sao ngay sau khi hoàn thành

**So that** tôi có thể phản hồi nhanh về chất lượng công cụ, giúp đội phát triển cải thiện sản phẩm

### Metadata
- **Epic**: Feedback / Metrics
- **Priority**: Must
- **Estimate**: 2 SP
- **Dependencies**: US-SV-02, US-SV-04

### INVEST Self-check
| Tiêu chí | ✅/⚠️ | Ghi chú |
|---|---|---|
| Independent | ⚠️ | Cần có 1 lượt hoạt động hoàn tất trước (SV-02 hoặc SV-04) để trigger |
| Negotiable | ✅ | Chưa cố định vị trí hiển thị khảo sát trên UI |
| Valuable | ✅ | Phục vụ trực tiếp KPI CSAT ≥ 4/5 |
| Estimable | ✅ | Phạm vi nhỏ, rõ ràng |
| Small | ✅ | 1 thao tác chọn sao + lưu |
| Testable | ✅ | Điểm CSAT lưu được là bằng chứng test |

### Acceptance Criteria

**AC1: Gửi đánh giá CSAT**
- **Given** SV vừa hoàn thành 1 lượt gap analysis hoặc 1 vòng phỏng vấn có chấm điểm
- **When** hệ thống hiển thị màn hình kết quả kèm khảo sát CSAT (thang 1-5 sao)
- **Then** khi SV chọn 1 mức sao và xác nhận, hệ thống lưu điểm CSAT gắn với SV, loại hoạt động (gap analysis/phỏng vấn), và thời điểm

**AC2: SV bỏ qua khảo sát**
- **Given** khảo sát CSAT đang hiển thị sau 1 lượt sử dụng
- **When** SV rời màn hình mà không chọn mức sao nào
- **Then** hệ thống không chặn SV tiếp tục sử dụng các chức năng khác
- **And** lượt đó không được tính vào điểm CSAT trung bình

**AC3: Gửi trùng đánh giá cho cùng 1 lượt hoạt động**
- **Given** SV đã gửi đánh giá CSAT cho 1 lượt hoạt động cụ thể
- **When** hệ thống cố hiển thị lại khảo sát cho đúng lượt hoạt động đó (VD do tải lại trang)
- **Then** hệ thống không cho gửi đánh giá lần 2 cho cùng 1 lượt hoạt động, chỉ hiển thị lại mức sao đã chọn trước đó (nếu có)

### Notes
- Metric liên quan: CSAT ≥ 4/5 (KPI, PRD mục 6)
- Dependencies: US-SV-02, US-SV-04

---

# Persona: Cố vấn hướng nghiệp

Hỗ trợ nhiều SV cùng lúc, không đủ thời gian tư vấn 1-1 sâu cho từng người.

## US-ADV-01: Xem báo cáo tiến bộ của SV được phân công

**As a** Cố vấn hướng nghiệp đã đăng nhập hệ thống

**I want to** xem báo cáo điểm phỏng vấn trước/sau của các SV nằm trong danh sách được phân công cho tôi

**So that** tôi biết SV nào đang tiến bộ, SV nào đang gặp khó khăn để ưu tiên hỗ trợ đúng người

### Metadata
- **Epic**: Advisor Dashboard
- **Priority**: Must
- **Estimate**: 5 SP
- **Dependencies**: US-SV-04

### INVEST Self-check
| Tiêu chí | ✅/⚠️ | Ghi chú |
|---|---|---|
| Independent | ⚠️ | Cần dữ liệu điểm từ US-SV-04 để có nội dung hiển thị |
| Negotiable | ✅ | Chưa cố định cách trình bày báo cáo (bảng/biểu đồ) |
| Valuable | ✅ | Giải quyết đúng pain point: cố vấn không đủ nguồn lực rà soát thủ công |
| Estimable | ✅ | Rõ input/output |
| Small | ✅ | 1 màn hình danh sách + số liệu |
| Testable | ✅ | Số liệu delta kiểm tra được |

### Acceptance Criteria

**AC1: Xem báo cáo có đủ dữ liệu**
- **Given** cố vấn đã đăng nhập và có ít nhất 1 SV được phân công có từ 2 vòng phỏng vấn đã chấm điểm trở lên
- **When** cố vấn mở màn hình báo cáo tiến bộ
- **Then** hệ thống hiển thị danh sách SV được phân công kèm điểm vòng đầu tiên, điểm vòng gần nhất, và mức chênh lệch (delta) cho mỗi SV

**AC2: SV chưa đủ dữ liệu để tính delta**
- **Given** 1 SV được phân công chỉ mới hoàn thành 1 vòng phỏng vấn hoặc chưa có vòng nào
- **When** cố vấn xem báo cáo tiến bộ
- **Then** hệ thống hiển thị SV đó với trạng thái "Chưa đủ dữ liệu" thay vì hiển thị số delta gây hiểu nhầm

**AC3: Cố vấn cố xem SV không thuộc danh sách được phân công**
- **Given** cố vấn cố truy cập báo cáo tiến bộ của 1 SV không nằm trong danh sách được phân công cho mình (VD qua URL trực tiếp)
- **When** cố vấn gửi yêu cầu xem báo cáo của SV đó
- **Then** hệ thống từ chối truy vấn ở tầng backend và trả về lỗi không có quyền truy cập, không trả về bất kỳ dữ liệu nào của SV đó

### Notes
- Constraint bảo mật: RBAC enforce ở tầng backend/query, không chỉ ẩn ở UI (theo NFR)
- Dependencies: US-SV-04

---

## US-ADV-02: Nhận thông báo tự động khi SV không cải thiện điểm sau 2 vòng liên tiếp (auto-escalate)

**As a** Cố vấn hướng nghiệp đang phụ trách 1 nhóm SV được phân công

**I want to** được hệ thống tự động gắn cờ khi 1 SV trong danh sách phụ trách có điểm phỏng vấn không tăng (bằng hoặc giảm) sau 2 vòng chấm điểm liên tiếp

**So that** tôi có thể can thiệp hỗ trợ kịp thời, thay vì phải tự rà soát thủ công tiến độ từng SV

### Metadata
- **Epic**: Advisor Dashboard
- **Priority**: Must
- **Estimate**: 5 SP
- **Dependencies**: US-SV-04, US-ADV-01

### INVEST Self-check
| Tiêu chí | ✅/⚠️ | Ghi chú |
|---|---|---|
| Independent | ⚠️ | Phụ thuộc dữ liệu điểm (US-SV-04) và dashboard hiển thị (US-ADV-01) |
| Negotiable | ✅ | Chưa cố định kênh thông báo (in-app/email) |
| Valuable | ✅ | Thay thế việc cố vấn phải rà soát thủ công — giải quyết đúng pain point |
| Estimable | ✅ | Rule tính toán rõ ràng theo PRD |
| Small | ✅ | 1 rule tính toán + 1 hành vi gắn cờ |
| Testable | ✅ | Rule "2 vòng liên tiếp" kiểm tra được bằng số liệu cụ thể |

### Acceptance Criteria

**AC1: Gắn cờ khi đủ điều kiện**
- **Given** 1 SV được phân công có điểm vòng thứ N bằng hoặc thấp hơn điểm vòng N-1, và điểm vòng N-1 cũng bằng hoặc thấp hơn điểm vòng N-2 (2 vòng liên tiếp không tăng)
- **When** hệ thống hoàn tất chấm điểm vòng thứ N của SV đó
- **Then** hệ thống tự động gắn cờ "Cần chú ý" cho SV đó trên dashboard của đúng cố vấn phụ trách
- **And** cờ hiển thị kèm thời điểm phát sinh và số vòng liên quan

**AC2: SV cải thiện điểm sau khi đã bị gắn cờ**
- **Given** 1 SV đã bị gắn cờ "Cần chú ý" từ vòng trước
- **When** SV hoàn thành 1 vòng phỏng vấn mới có điểm cao hơn vòng liền trước
- **Then** hệ thống gỡ cờ "Cần chú ý" khỏi dashboard của cố vấn cho SV đó

**AC3: Chưa đủ 2 vòng để đánh giá xu hướng**
- **Given** 1 SV mới có 1 vòng phỏng vấn được chấm điểm
- **When** hệ thống kiểm tra điều kiện gắn cờ sau vòng đó
- **Then** hệ thống không gắn cờ "Cần chú ý" do chưa đủ dữ liệu 2 vòng liên tiếp để so sánh

### Notes
- Rule chính xác lấy từ PRD (Functional Requirements): "sau 2 vòng liên tiếp điểm không tăng (hoặc giảm) → gắn cờ trên advisor dashboard"
- Dependencies: US-SV-04 (nguồn dữ liệu điểm), US-ADV-01 (dashboard hiển thị)

---

## US-ADV-03: Xem CV và JD mục tiêu của SV được phân công

**As a** Cố vấn hướng nghiệp đang xem hồ sơ 1 SV thuộc danh sách được phân công

**I want to** xem bản CV mới nhất và JD mà SV đó đang nhắm tới ứng tuyển

**So that** tôi có đủ bối cảnh để tư vấn định hướng nghề nghiệp phù hợp, thay vì chỉ dựa vào báo cáo điểm số tự động

### Metadata
- **Epic**: Advisor Dashboard
- **Priority**: Should
- **Estimate**: 3 SP
- **Dependencies**: US-SV-01, US-SV-02, US-ADV-01

### INVEST Self-check
| Tiêu chí | ✅/⚠️ | Ghi chú |
|---|---|---|
| Independent | ⚠️ | Phụ thuộc dữ liệu CV/JD đã có từ phía SV |
| Negotiable | ✅ | Chưa cố định layout hiển thị |
| Valuable | ✅ | Tránh cố vấn tư vấn "mù" chỉ dựa vào điểm số |
| Estimable | ✅ | Phạm vi rõ: hiển thị dữ liệu đã có sẵn |
| Small | ✅ | Chỉ là màn hình xem, không có logic tính toán mới |
| Testable | ✅ | Kiểm tra được qua nội dung hiển thị đúng SV |

### Acceptance Criteria

**AC1: Xem đủ dữ liệu**
- **Given** SV được phân công đã có ít nhất 1 CV và đã chọn 1 JD mục tiêu
- **When** cố vấn mở hồ sơ chi tiết của SV đó
- **Then** hệ thống hiển thị bản CV phiên bản mới nhất và nội dung JD SV đang nhắm tới, kèm kết quả phân loại khoảng cách trình bày/năng lực gần nhất

**AC2: SV có nhiều phiên bản CV**
- **Given** SV được phân công có từ 2 phiên bản CV trở lên
- **When** cố vấn mở hồ sơ chi tiết của SV đó
- **Then** hệ thống mặc định hiển thị phiên bản CV mới nhất
- **And** cho phép cố vấn xem lại danh sách các phiên bản CV trước đó theo thứ tự thời gian

**AC3: SV chưa chọn JD nào**
- **Given** SV được phân công đã có CV nhưng chưa chọn JD mục tiêu nào
- **When** cố vấn mở hồ sơ chi tiết của SV đó
- **Then** hệ thống hiển thị rõ trạng thái "SV chưa chọn vị trí ứng tuyển", không hiển thị kết quả phân tích khoảng cách trống gây hiểu nhầm

### Notes
- Constraint bảo mật: chỉ xem được SV trong danh sách phân công (RBAC), giống US-ADV-01
- Dependencies: US-SV-01, US-SV-02

## 2. Functional Requirements
- Upload/parse CV (PDF, DOCX)
- Nhập/chọn JD mục tiêu (paste text hoặc chọn từ danh sách mẫu)
- Gap analysis: so sánh CV vs JD, output phân loại rõ 2 nhóm:
  - **Presentation gap** → gợi ý diễn đạt lại (agent xử lý được)
  - **Capability gap** → flag cho SV + cố vấn, không tự "sửa" (agent không xử lý)
- Lưu CV theo phiên bản (versioned), không ghi đè — mỗi lần tối ưu tạo bản mới, giữ lịch sử
- Mock interview: nhiều vòng, theo vị trí đã chọn, chấm điểm theo rubric STAR
- Auto-escalate: sau 2 vòng liên tiếp điểm không tăng (hoặc giảm) → gắn cờ trên advisor dashboard
- Advisor dashboard: xem SV được assign, lịch sử điểm, CV/JD đang theo dõi
- Khảo sát CSAT ngay sau mỗi lượt dùng (1-5 sao)

## 3. Non-Functional Requirements
- **Bảo mật**: CV là dữ liệu cá nhân, mã hoá lưu trữ, RBAC ở tầng query (không chỉ ẩn ở UI)
- **Fairness**: rubric chấm điểm và gợi ý tối ưu áp dụng nhất quán, không thiên vị theo ngành/hồ sơ
- **Minh bạch giới hạn**: hệ thống nêu rõ "không đảm bảo trúng tuyển", "không xác minh được tính xác thực của kinh nghiệm tự khai"
- **Kiểm soát chi phí**: giới hạn 3 vòng phỏng vấn có chấm điểm/SV/vị trí/tuần (admin/cố vấn có thể cấp thêm)
- **Hiệu năng**: phản hồi gap analysis trong thời gian chấp nhận được cho một phiên tương tác (không yêu cầu real-time streaming bắt buộc ở Basic)

## 4. Kiến trúc kỹ thuật (đề xuất)
- Backend: FastAPI
- Frontend: Next.js (trang upload CV, phòng phỏng vấn, advisor dashboard)
- AI orchestration: LangGraph cho agent phân tích gap CV-JD
- Retrieval: RAG với Qdrant lưu JD mẫu + tiêu chí ATS + template câu hỏi phỏng vấn, kèm reranker
- Eval: LLM-as-Judge cho chất lượng gợi ý + STAR scoring cho mock interview
- Lưu trữ CV: versioned records (không phải single-row overwrite)
- Triển khai: Docker + cloud

## 5. Guardrails
- **Chống bịa kinh nghiệm**: agent chỉ phát hiện *sự không nhất quán nội bộ* trong văn bản CV (số liệu không có ngữ cảnh hỗ trợ, giọng văn/từ vựng không khớp cấp bậc, cụm từ ấn tượng nhưng mơ hồ). Khi phát hiện, agent yêu cầu SV bổ sung chứng cứ/ngữ cảnh — **không tự chặn, không tự kết luận SV nói dối**. Giới hạn nêu rõ trong hệ thống: agent không xác minh được sự thật của kinh nghiệm tự khai.
- **HITL**: mọi gợi ý tối ưu CV là đề xuất; SV là người quyết định áp dụng hay không và chịu trách nhiệm với bản CV cuối cùng nộp đi.
- **RBAC**: cố vấn chỉ truy vấn được dữ liệu của SV nằm trong danh sách được phân công, enforce ở tầng backend/query, không chỉ ẩn trên UI.
- **Cost control**: giới hạn số vòng mock interview có chấm điểm/tuần như trên.

## 6. KPI & cách đo
- **Usage rate** = (số SV active trong giai đoạn thử nghiệm) / (tổng số SV trong giai đoạn thử nghiệm) × 100%. "Active" = có ít nhất 1 lượt gap-analysis hoặc 1 vòng mock interview hoàn thành trong giai đoạn đo.
- **CSAT** = điểm trung bình khảo sát thang 1-5, thu ngay sau mỗi lượt dùng (mỗi lần hoàn thành gap analysis hoặc 1 vòng phỏng vấn), tính trung bình cộng toàn bộ khảo sát trong giai đoạn.
- **Metric chính (value, không phải adoption)**: Interview score delta = điểm trung bình rubric STAR của (N vòng cuối) − điểm trung bình của (N vòng đầu), tính theo từng SV rồi lấy trung bình toàn nhóm thử nghiệm. Đây là bằng chứng công cụ có tác dụng thật, mạnh hơn CSAT/usage.

## 7. Nguồn dữ liệu dự kiến cho RAG (Gate 1: chỉ liệt kê, chưa build pipeline thật)

**JD mẫu:** thu thập thủ công/crawl có kiểm soát từ các nền tảng tuyển dụng phổ biến tại Việt Nam — TopCV, VietnamWorks, ITviec (nhóm ngành CNTT), LinkedIn Jobs VN — để có JD sát thực tế thị trường theo từng ngành.

**Tiêu chí ATS:** tổng hợp từ các hướng dẫn công khai về từ khoá/định dạng CV thân thiện ATS (screening keyword matching, format parsing) do các nền tảng tuyển dụng và các bài viết chuyên môn về ATS công bố, biên soạn thành checklist nội bộ — không tích hợp trực tiếp một ATS thương mại.

**Giới hạn đã biết:** khối lượng dữ liệu thực tế curate được trong 3 tuần là **open question** — cần team thử nghiệm và báo cáo số liệu thật trước khi khẳng định đây là differentiator trong PRD chính thức.

## 8. Roadmap sau Gate 1 (Advanced)
- Multi-position ATS optimization (một CV tối ưu cho nhiều vị trí song song)
- Multi-round mock interview nâng cao với feedback chi tiết hơn theo từng câu hỏi
- Đo lường chất lượng phản hồi ở quy mô lớn hơn (LLM-as-Judge mở rộng) + đánh giá đạt KPI (usage ≥60%, CSAT ≥4/5)
- Advisor dashboard theo dõi tiến bộ nhiều SV cùng lúc, có thể thêm số lượt tư vấn cố vấn tiết kiệm được (nếu cố vấn hợp tác log được)
- Guardrail chống bịa kinh nghiệm mở rộng + tối ưu chi phí AI ở quy mô lớn hơn

## Phụ lục — Open Questions & Assumptions

**Open questions:**
- Khối lượng JD/ATS thật có thể curate trong 3 tuần là bao nhiêu? (quyết định RAG có phải differentiator thật hay chỉ aspirational — cần team thử nghiệm và báo cáo trước Gate 1)

**Assumptions (chưa xác nhận với stakeholder ngoài team):**
- Giả định "presentation gap" phổ biến hơn "capability gap" trong nhóm SV mục tiêu — chưa có dữ liệu xác nhận tỷ lệ này.
- Giả định cố vấn hướng nghiệp của trường sẵn sàng dùng dashboard và phản hồi cảnh báo escalate kịp thời — chưa xác nhận với phía nhà trường.
- Giả định 3 vòng phỏng vấn/tuần là đủ để SV thấy tiến bộ nhưng không vượt ngân sách AI — chưa có số liệu chi phí thực tế để kiểm chứng.