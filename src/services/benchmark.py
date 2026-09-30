import math


def calculate_recall_at_k(retrieved: list[str], ground_truth: list[str], k: int) -> float:
    """Tính toán chỉ số Recall@k."""
    if not ground_truth:
        return 1.0
    top_k_retrieved = retrieved[:k]
    hits = len(set(top_k_retrieved) & set(ground_truth))
    return hits / len(ground_truth)


def calculate_precision_at_k(retrieved: list[str], ground_truth: list[str], k: int) -> float:
    """Tính toán chỉ số Precision@k."""
    if k == 0:
        return 0.0
    top_k_retrieved = retrieved[:k]
    hits = len(set(top_k_retrieved) & set(ground_truth))
    return hits / k


def calculate_dcg_at_k(retrieved: list[str], ground_truth: list[str], k: int) -> float:
    """Tính Discounted Cumulative Gain (DCG@k)."""
    dcg = 0.0
    for i, item in enumerate(retrieved[:k]):
        if item in ground_truth:
            dcg += 1.0 / math.log2(i + 2)
    return dcg


def calculate_ndcg_at_k(retrieved: list[str], ground_truth: list[str], k: int) -> float:
    """Tính Normalized Discounted Cumulative Gain (NDCG@k)."""
    if not ground_truth:
        return 1.0
    dcg = calculate_dcg_at_k(retrieved, ground_truth, k)
    ideal_hits = min(len(ground_truth), k)
    idcg = sum(1.0 / math.log2(i + 2) for i in range(ideal_hits))
    if idcg == 0.0:
        return 0.0
    return dcg / idcg


def evaluate_retrieval_benchmark(
    queries_data: list[dict[str, list[str]]], k_list: list[int] = [1, 3, 5, 10]
) -> dict[str, dict[str, float]]:
    """
    Chạy đánh giá benchmark retrieval trên tập dữ liệu mẫu.
    queries_data định dạng: [{"retrieved": [...], "ground_truth": [...]}, ...]
    """
    results: dict[str, dict[str, float]] = {}

    for k in k_list:
        total_recall = 0.0
        total_ndcg = 0.0
        total_precision = 0.0
        num_queries = len(queries_data)

        if num_queries == 0:
            continue

        for item in queries_data:
            retrieved = item.get("retrieved", [])
            ground_truth = item.get("ground_truth", [])

            total_recall += calculate_recall_at_k(retrieved, ground_truth, k)
            total_precision += calculate_precision_at_k(retrieved, ground_truth, k)
            total_ndcg += calculate_ndcg_at_k(retrieved, ground_truth, k)

        results[f"top_{k}"] = {
            f"Recall@{k}": round(total_recall / num_queries, 4),
            f"Precision@{k}": round(total_precision / num_queries, 4),
            f"NDCG@{k}": round(total_ndcg / num_queries, 4),
        }

    return results
