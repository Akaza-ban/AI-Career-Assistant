import json
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.services.benchmark import evaluate_retrieval_benchmark
from src.services.jd_recommendation import recommend_top_jds_from_cv
from src.services.jd_store import get_jd_store

BENCHMARK_TEST_CASES = [
    {
        "role": "Backend Developer",
        "ground_truth": ["jd-be-intern"],
        "cv": (
            "Nguyễn Văn Backend - Kỹ sư phần mềm\n"
            "Kỹ năng: Python, FastAPI, REST API, SQL, PostgreSQL, Docker, Git, Redis, Linux\n"
            "Kinh nghiệm: 2 năm phát triển hệ thống backend bán lẻ RESTful microservices với Python và Docker."
        ),
    },
    {
        "role": "Data Analyst",
        "ground_truth": ["jd-da-intern"],
        "cv": (
            "Trần Thị Data - Phân tích dữ liệu\n"
            "Kỹ năng: SQL, Excel nâng cao, Pivot Table, Power BI, DAX, Python Pandas, Trực quan hoá dữ liệu, Thống kê\n"
            "Kinh nghiệm: Xây dựng và duy trì dashboard báo cáo doanh số bán hàng đa kênh trên Power BI."
        ),
    },
    {
        "role": "Business Analyst",
        "ground_truth": ["jd-ba-intern"],
        "cv": (
            "Lê Văn BA - Chuyên viên phân tích nghiệp vụ\n"
            "Kỹ năng: Phân tích yêu cầu, Viết tài liệu BRD/SRS, BPMN 2.0, Sơ đồ quy trình, Agile/Scrum, SQL, Jira\n"
            "Kinh nghiệm: Thu thập và phân tích yêu cầu từ phòng ban, viết BRD và vẽ BPMN cho phần mềm ERP."
        ),
    },
    {
        "role": "Marketing Analyst",
        "ground_truth": ["jd-mkt-analyst"],
        "cv": (
            "Phạm Thị Marketing - Phân tích Marketing\n"
            "Kỹ năng: Google Analytics GA4, Excel, Báo cáo hiệu quả chiến dịch, A/B Testing, Looker Studio, Facebook Ads, KPI ROI\n"
            "Kinh nghiệm: Theo dõi và lập báo cáo hiệu quả chiến dịch quảng cáo đa kênh theo KPI."
        ),
    },
    {
        "role": "Nhân viên Xuất Nhập Khẩu",
        "ground_truth": ["jd-xnk-fresher"],
        "cv": (
            "Hoàng Văn Logistics - Chuyên viên Xuất nhập khẩu\n"
            "Kỹ năng: Chứng từ xuất nhập khẩu, Bill of Lading, Packing list, Commercial Invoice, Incoterms 2020, FOB, CIF, Thủ tục hải quan ECUS, Tiếng Anh thương mại\n"
            "Kinh nghiệm: Soạn thảo và kiểm tra bộ chứng từ xuất nhập khẩu, làm thủ tục hải quan thông quan hàng hóa."
        ),
    },
]


def run_benchmark():
    # Khởi tạo và nạp dữ liệu JD
    store = get_jd_store()
    store.index_from_fixtures()

    queries_data = []
    print("=" * 70)
    print("🚀 BẮT ĐẦU CHẠY BENCHMARK RETRIEVAL (TOP-K JD GỢI Ý TỪ CV)")
    print("=" * 70)

    for tc in BENCHMARK_TEST_CASES:
        recs = recommend_top_jds_from_cv(tc["cv"], top_n=5)
        retrieved_ids = [r["jd_id"] for r in recs]
        queries_data.append({"retrieved": retrieved_ids, "ground_truth": tc["ground_truth"]})

        hit = tc["ground_truth"][0] in retrieved_ids[:3]
        status = "✅ PASS" if hit else "❌ FAIL"
        top1_id = retrieved_ids[0] if retrieved_ids else "None"
        print(f"[{status}] Role: {tc['role']:<25} | Top-1: {top1_id:<15} | Ground Truth: {tc['ground_truth']}")

    metrics = evaluate_retrieval_benchmark(queries_data, k_list=[1, 3, 5])
    print("\n" + "=" * 70)
    print("📊 KẾT QUẢ ĐÁNH GIÁ (EVALUATION METRICS):")
    print(json.dumps(metrics, indent=2))
    print("=" * 70)
    return metrics


if __name__ == "__main__":
    run_benchmark()
