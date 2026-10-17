// Dựng CV mẫu hư cấu cho bộ đo đọc CV (eval/ocr): mỗi mẫu xuất PDF có chữ + ảnh PNG trang đầu + đáp án
// (chữ hiển thị và các tiêu đề mục). Ảnh scan / ảnh chụp và DOCX do make_samples.py tạo từ đây.
// Chạy: node eval/ocr/render_samples.cjs <thư mục ra>   (dùng playwright có sẵn trong frontend/node_modules)
const fs = require("fs")
const path = require("path")
// PLAYWRIGHT_DIR: dùng playwright ở chỗ khác (ví dụ worktree chưa cài frontend)
const { chromium } = require(process.env.PLAYWRIGHT_DIR || path.join(__dirname, "..", "..", "frontend", "node_modules", "playwright"))

const out = process.argv[2] || path.join(__dirname, "samples")
fs.mkdirSync(out, { recursive: true })

const base = `*{box-sizing:border-box} body{margin:0;width:794px;color:#111} ul{margin:2px 0 4px;padding-left:20px}
.r{display:flex;justify-content:space-between;gap:12px} h2{margin:12px 0 4px}`

const SAMPLES = {
  // Một cột kiểu Harvard, ngày căn phải, câu dài xuống dòng
  en_harvard: {
    css: `body{font-family:"Times New Roman",serif;font-size:11pt;line-height:1.25;padding:40px 56px}
h1{text-align:center;font-size:20pt;margin:0} .c{text-align:center} h2{font-size:12pt;text-transform:uppercase;border-bottom:1px solid #000}`,
    body: `<h1>Daniel Tran</h1><div class="c">Ho Chi Minh City | daniel.tran@example.com | +84 901 234 567 | github.com/dtran</div>
<h2>Summary</h2><div>Final-year Computer Science student with hands-on experience building REST APIs and data pipelines, looking for a backend engineering internship where I can grow with a strong team.</div>
<h2>Education</h2><div class="r"><b>University of Information Technology</b><span>Sep 2021 – Jun 2025</span></div><i>B.Sc. in Computer Science, GPA 3.5/4.0</i>
<h2>Work Experience</h2><div class="r"><b>Acme Software | Backend Intern</b><span>Jun 2024 – Present</span></div><b><i>Technologies: Python, FastAPI, PostgreSQL, Docker</i></b>
<ul><li>Built 12 REST endpoints for the order management module and wrote integration tests, cutting regression bugs by 30% over two releases.</li>
<li>Migrated nightly reports from cron scripts to Celery tasks.</li></ul>
<h2>Personal Projects</h2><div class="r"><b>Campus Library System</b><span>03/2023 – 06/2023</span></div>
<ul><li>Designed the database schema and implemented book reservation with email reminders for more than 500 student users.</li></ul>
<h2>Technical Skills</h2><div><b>Languages:</b> Python, Java, SQL</div><div><b>Tools:</b> Git, Docker, Linux</div>
<h2>Certifications</h2><div class="r"><span><b>AWS Cloud Practitioner</b> – Amazon Web Services</span><span>08/2024</span></div>
<h2>Languages</h2><div>English (IELTS 7.0), Vietnamese (native)</div>`,
  },
  // Tiếng Việt một cột, tiêu đề mục chữ hoa
  vi_onecol: {
    css: `body{font-family:Arial,sans-serif;font-size:10.5pt;line-height:1.35;padding:40px 52px}
h1{font-size:20pt;margin:0} h2{font-size:12pt;color:#1d4e89;text-transform:uppercase;border-bottom:2px solid #1d4e89}`,
    body: `<h1>Lê Thu Hà</h1><div>Đà Nẵng | lethuha@example.com | 0935 123 456</div>
<h2>Mục tiêu nghề nghiệp</h2><div>Sinh viên năm cuối ngành Marketing, mong muốn trở thành chuyên viên Digital Marketing, áp dụng kinh nghiệm chạy quảng cáo và phân tích dữ liệu để tăng trưởng thương hiệu.</div>
<h2>Học vấn</h2><div class="r"><b>Trường Đại học Kinh tế – Đại học Đà Nẵng</b><span>09/2021 – 06/2025</span></div><i>Cử nhân Marketing, GPA 3.3/4.0</i>
<h2>Kinh nghiệm làm việc</h2><div class="r"><b>Công ty TNHH Truyền thông Biển Xanh</b><span>01/2024 – 06/2024</span></div><i>Thực tập sinh Digital Marketing</i>
<ul><li>Lên kế hoạch và chạy 15 chiến dịch quảng cáo Facebook cho 3 khách hàng bán lẻ, giảm chi phí mỗi khách hàng tiềm năng xuống 25% sau hai tháng.</li>
<li>Viết báo cáo tuần bằng Google Data Studio.</li></ul>
<h2>Dự án</h2><div class="r"><b>Chiến dịch "Xanh cùng Đà Nẵng"</b><span>09/2023 – 12/2023</span></div><b><i>Công cụ: Canva, Meta Ads, Google Analytics</i></b>
<ul><li>Phụ trách nội dung fanpage, tăng 4.000 lượt theo dõi trong ba tháng nhờ chuỗi video ngắn về hoạt động tình nguyện.</li></ul>
<h2>Kỹ năng</h2><div><b>Marketing:</b> Facebook Ads, SEO cơ bản, viết nội dung</div><div><b>Phân tích:</b> Excel, Google Analytics</div>
<h2>Ngoại ngữ</h2><div>Tiếng Anh (TOEIC 750)</div>`,
  },
  // Hai cột: cột bên trái màu (liên hệ, kỹ năng có thanh mức độ), cột chính bên phải
  en_sidebar: {
    css: `body{font-family:Arial,sans-serif;font-size:10.5pt;display:flex;min-height:1123px}
.l{width:250px;background:#eef2f7;padding:30px 18px}.m{flex:1;padding:30px 26px} h1{font-size:17pt;margin:0}
h2{font-size:11.5pt;letter-spacing:.04em} .bar{height:6px;background:#cfd8e3;border-radius:3px;margin:3px 0 8px}.bar i{display:block;height:6px;background:#2f6db5;border-radius:3px}`,
    body: `<div class="l"><h1>Pham Quang Huy</h1><div>Data Analyst Intern</div><h2>CONTACT</h2><div>huy.pham@example.com</div><div>0987 654 321</div><div>Hanoi, Vietnam</div>
<h2>SKILLS</h2><div>Python</div><div class="bar"><i style="width:80%"></i></div><div>SQL</div><div class="bar"><i style="width:70%"></i></div><div>Power BI</div><div class="bar"><i style="width:60%"></i></div>
<h2>LANGUAGES</h2><div>English - IELTS 6.5</div></div>
<div class="m"><h2>SUMMARY</h2><div>Third-year Data Science student who enjoys turning messy business data into clear dashboards and decisions for operations teams.</div>
<h2>EXPERIENCE</h2><div class="r"><b>Beta Retail JSC</b><span>Jul 2024 – Present</span></div><i>Data Analyst Intern</i>
<ul><li>Built a weekly sales dashboard in Power BI used by 30 store managers across northern Vietnam.</li><li>Cleaned 2 million transaction rows with Python and SQL.</li></ul>
<h2>PROJECTS</h2><div class="r"><b>Churn Prediction</b><span>2023</span></div><ul><li>Trained a logistic regression model that flagged churn risk with 81% recall on a telecom dataset.</li></ul>
<h2>EDUCATION</h2><div class="r"><b>National Economics University</b><span>2022 – 2026</span></div><i>B.Sc. Data Science</i></div>`,
  },
  // Bố cục lai: nửa trên một cột, nửa dưới hai ô song song (Học vấn | Kỹ năng)
  vi_hybrid: {
    css: `body{font-family:Arial,sans-serif;font-size:10.5pt;line-height:1.35;padding:36px 48px}
h1{font-size:19pt;margin:0} h2{font-size:12pt;text-transform:uppercase;color:#7a3e9d} .cols{display:flex;gap:40px}.cols>div{flex:1}`,
    body: `<h1>Trần Anh Tuấn</h1><div>Video Editor | tuan.tran@example.com | 0901 222 333 | TP Hồ Chí Minh</div>
<h2>Kinh nghiệm làm việc</h2><div class="r"><b>Công ty Sáng tạo Truyền thông Ánh Dương | Thực tập sinh Dựng phim</b><span>08/2023 – 05/2024</span></div>
<ul><li>Hỗ trợ chuyên viên chính cắt ghép dữ liệu quay thô và đồng bộ âm thanh cho 20 video quảng cáo mỗi tháng.</li>
<li>Tìm kiếm, chọn lọc và quản lý kho tài nguyên âm nhạc không vi phạm bản quyền.</li></ul>
<div class="cols"><div><h2>Học vấn</h2><b>Trường Cao đẳng Nghệ thuật Sài Gòn</b><div>Chuyên ngành Dựng phim, 2021 – 2024</div><div>Tập trung vào tư duy dựng phim, kỹ thuật cắt cảnh và quy trình xuất tệp chất lượng cao.</div></div>
<div><h2>Kỹ năng</h2><div><b>Phần mềm:</b> Premiere Pro, After Effects, DaVinci Resolve</div><div><b>Chuyên môn:</b> Cắt dựng video ngắn, phối màu cơ bản</div><div><b>Ngoại ngữ:</b> Tiếng Anh giao tiếp</div></div></div>`,
  },
  // Kiểu Canva: dải tiêu đề màu, hai cột, dự án chia hai ô lồng trong một cột, chữ xám nhỏ
  vi_canva: {
    css: `body{font-family:"Times New Roman",serif;font-size:10.5pt;line-height:1.3;color:#333}
.top{background:#1f6f5c;color:#fff;padding:26px 40px} .top h1{margin:0;font-size:22pt} .wrap{display:flex;gap:28px;padding:22px 40px}
.l{width:42%}.m{flex:1} h2{color:#1f6f5c;font-size:12pt;text-transform:uppercase;border-bottom:1px solid #9cc} .grid{display:flex;gap:12px}.grid>div{flex:1}
.date{color:#666}`,
    body: `<div class="top"><h1>Võ Minh Châu</h1><div>Chuyên viên Phân tích Dữ liệu</div></div>
<div class="wrap"><div class="l"><h2>Thông tin liên hệ</h2><div>chau.vo@example.com</div><div>0912 888 777</div><div>Quận 7, TP Hồ Chí Minh</div>
<h2>Mục tiêu</h2><div>Không ngừng học hỏi, phát triển kỹ năng phân tích và xây dựng báo cáo hỗ trợ ra quyết định.</div>
<h2>Kỹ năng</h2><div>Microsoft Excel</div><div>SQL Server và Power BI</div><div>Python cho phân tích dữ liệu</div>
<h2>Dự án cá nhân</h2><div class="grid"><div><b>Phân tích bán lẻ</b> – Làm sạch dữ liệu đơn hàng và xây dựng báo cáo doanh thu theo vùng.</div><div><b>Khảo sát sinh viên</b> – Thu thập 300 phiếu khảo sát và phân tích bằng SPSS.</div></div></div>
<div class="m"><h2>Học vấn</h2><div class="date">09/2016 – 06/2020</div><b>Đại học Kinh tế TP Hồ Chí Minh</b><div>Chuyên ngành: Tài chính</div>
<h2>Kinh nghiệm</h2><div class="date">06/2021 – 11/2022</div><b>Công ty Dữ liệu Phương Nam</b><div>Nhân viên Phân tích Dữ liệu</div><div>Xây dựng báo cáo BI cho kho dữ liệu và xử lý yêu cầu dữ liệu nội bộ.</div>
<div class="date">10/2020 – 03/2021</div><b>Trung tâm Anh ngữ Sao Mai</b><div>Trợ giảng</div>
<h2>Ngoại ngữ</h2><div>IELTS 6.5 – Tiếng Anh nâng cao</div></div></div>`,
  },
  // Chữ nhỏ, dày đặc, nhiều dự án, chứng chỉ có ngày căn phải
  en_dense: {
    css: `body{font-family:Arial,sans-serif;font-size:9pt;line-height:1.3;padding:34px 46px} h1{text-align:center;font-size:16pt;margin:0}
.c{text-align:center;color:#555} h2{font-size:10pt;text-transform:uppercase;border-bottom:1px solid #333}`,
    body: `<h1>Hoang Minh Khoa</h1><div class="c">Ho Chi Minh City • khoa.hoang@example.com • linkedin.com/in/khoa-hoang</div>
<div>Fresh graduated Data Science student with a solid foundation in machine learning and data manipulation, experienced in building LLM-based applications and predictive models.</div>
<h2>Education</h2><div class="r"><b>Bachelor of Data Science</b><b>Oct 2021 - Nov 2025</b></div><div>International University - VNU HCMC</div>
<div><b>Relevant Coursework:</b> Regression Analysis, Big Data Technology, Database Management, Data Structures and Algorithms.</div>
<h2>Projects</h2><div><b>Depression Factors Classification | Team Project (4 members)</b></div><div><b><i>Python, Java, Weka, scikit-learn</i></b></div>
<ul><li>Evaluated and compared 6 classification algorithms: SVM, Logistic Regression, Naive Bayes and J48.</li><li>Performed hyperparameter optimization using GridSearchCV.</li></ul>
<div><b>RAG-based Real Estate Chatbot</b></div><div><b><i>Python, Selenium, Milvus, Docker, Streamlit</i></b></div>
<ul><li>Implemented a hybrid retrieval system combining dense vectors in Milvus and BM25 lexical search.</li><li>Integrated 4 local LLMs via Ollama for Vietnamese language queries.</li></ul>
<h2>Skills</h2><div><b>ML/DL Libraries:</b> pandas, NumPy, scikit-learn, transformers, PyTorch</div><div><b>MLOps &amp; Tools:</b> Docker, Git, Streamlit, Ollama</div>
<h2>Certifications</h2><div class="r"><span>TOEIC 780 by IIG Viet Nam</span><span>May 2024</span></div><div class="r"><span>SQL Intermediate Certificate by HackerRank</span><span>Nov 2023</span></div>
<div class="r"><span>Data Science Job Simulation by Forage</span><span>Sep 2023</span></div>`,
  },
}

;(async () => {
  const b = await chromium.launch({ channel: "msedge" })
  const p = await b.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 })
  const truth = {}
  for (const [name, s] of Object.entries(SAMPLES)) {
    await p.setContent(`<!doctype html><html lang="vi"><meta charset="utf-8"><style>${base}${s.css}</style><body>${s.body}</body></html>`)
    await p.pdf({ path: path.join(out, `${name}.pdf`), width: "794px", height: "1123px", printBackground: true, pageRanges: "1" })
    await p.screenshot({ path: path.join(out, `${name}.png`), clip: { x: 0, y: 0, width: 794, height: 1123 } })
    truth[name] = await p.evaluate(() => ({
      text: document.body.innerText,
      name: document.querySelector("h1").innerText,
      headings: [...document.querySelectorAll("h2")].map((h) => h.innerText),
    }))
  }
  fs.writeFileSync(path.join(out, "truth.json"), JSON.stringify(truth, null, 2))
  await b.close()
  console.log("ok", Object.keys(SAMPLES).length, "mẫu")
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
