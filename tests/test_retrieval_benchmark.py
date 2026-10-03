"""Test benchmark tự động đánh giá chỉ số Retrieval (Recall@k, Precision@k, NDCG@k)."""

from scripts.run_retrieval_benchmark import BENCHMARK_TEST_CASES
from src.services.benchmark import evaluate_retrieval_benchmark
from src.services.jd_recommendation import recommend_top_jds_from_cv
from src.services.jd_store import get_jd_store


def test_retrieval_benchmark_metrics():
    """Kiểm tra chỉ số chất lượng Retrieval đạt ngưỡng yêu cầu của BTC (Recall@3 >= 80%)."""
    store = get_jd_store()
    store.index_from_fixtures()

    queries_data = []
    for tc in BENCHMARK_TEST_CASES:
        recs = recommend_top_jds_from_cv(tc["cv"], top_n=5)
        retrieved_ids = [r["jd_id"] for r in recs]
        queries_data.append({"retrieved": retrieved_ids, "ground_truth": tc["ground_truth"]})

    results = evaluate_retrieval_benchmark(queries_data, k_list=[1, 3, 5])

    # Tiêu chí: Recall@3 phải đạt tối thiểu 80% (0.8)
    recall_at_3 = results["top_3"]["Recall@3"]
    assert recall_at_3 >= 0.8, f"Recall@3 quá thấp: {recall_at_3}"

    # Tiêu chí: NDCG@3 phản ánh mức độ xếp hạng chuẩn xác
    ndcg_at_3 = results["top_3"]["NDCG@3"]
    assert ndcg_at_3 >= 0.8, f"NDCG@3 quá thấp: {ndcg_at_3}"
