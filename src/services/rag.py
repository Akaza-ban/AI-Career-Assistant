import json
import re
from pathlib import Path
from typing import Any

# Tập dữ liệu tiêu chuẩn ATS và tiêu chí đánh giá hồ sơ mặc định
DEFAULT_ATS_CRITERIA = [
    {
        "id": "ats-01",
        "title": "Action Verbs & Impact Quantification",
        "content": (
            "Tiêu chuẩn ATS: Sử dụng động từ hành động mạnh (Built, Architected, Optimized, Deployed) "
            "kèm theo số liệu định lượng (RPS, %, latency, throughput, số lượng người dùng). "
            "Ràng buộc: Không bịa số liệu, chỉ lượng hóa các kết quả có thật từ kinh nghiệm đã làm."
        ),
        "category": "ats_rubric",
    },
    {
        "id": "ats-02",
        "title": "Keyword Density & Alignment",
        "content": (
            "Tiêu chuẩn ATS: Đảm bảo các từ khóa công nghệ chính trong JD (VD: FastAPI, Docker, PostgreSQL) "
            "xuất hiện tự nhiên trong các gạch đầu dòng mô tả dự án và kỹ năng kỹ thuật của CV."
        ),
        "category": "keyword_matching",
    },
    {
        "id": "ats-03",
        "title": "Clear Section Hierarchy & Readability",
        "content": (
            "Tiêu chuẩn ATS: Bố cục CV phân tách rõ ràng giữa Kỹ năng (Technical Skills), "
            "Kinh nghiệm (Work Experience), và Dự án (Projects) để parser bóc tách chính xác."
        ),
        "category": "format",
    },
    {
        "id": "ats-04",
        "title": "STAR Method in Project Bullets",
        "content": (
            "Tiêu chuẩn ATS: Mô tả dự án theo cấu trúc STAR (Bối cảnh, Nhiệm vụ, Hành động, Kết quả). "
            "Nhấn mạnh giải pháp kỹ thuật đã chọn và lý do lựa chọn."
        ),
        "category": "writing_style",
    },
    {
        "id": "ats-05",
        "title": "Honesty & Grounding Constraint",
        "content": (
            "Nguyên tắc cốt lõi: Tuyệt đối không thổi phồng hoặc bịa đặt kỹ năng chưa từng sử dụng. "
            "Chỉ tối ưu hóa cách trình bày (Presentation) trên cơ sở kinh nghiệm thật."
        ),
        "category": "integrity",
    },
]


class RAGService:
    """Service tích hợp Vector DB / Qdrant và Semantic Retrieval cho JD & ATS Criteria."""

    def __init__(
        self,
        collection_name: str = "skills_knowledge",
        host: str = "localhost",
        port: int = 6333,
    ):
        self.collection_name = collection_name
        self.host = host
        self.port = port
        self._documents: list[dict[str, Any]] = []
        self._load_initial_knowledge()

    def _load_initial_knowledge(self) -> None:
        """Nạp dữ liệu ATS criteria và các mẫu JD từ thư mục data/."""
        # Nạp ATS criteria
        self._documents.extend(DEFAULT_ATS_CRITERIA)

        # Nạp JD mẫu nếu có file jd_samples.json
        jd_file = Path("data/jd_samples.json")
        if jd_file.exists():
            try:
                with open(jd_file, encoding="utf-8") as f:
                    jds = json.load(f)
                    for item in jds:
                        self._documents.append(
                            {
                                "id": item.get("id", f"jd-{len(self._documents)}"),
                                "title": item.get("title", "JD Sample"),
                                "content": f"{item.get('title', '')}: {item.get('description', '')} - Kỹ năng: {', '.join(item.get('required_skills', []))}",
                                "category": "jd_sample",
                                "required_skills": item.get("required_skills", []),
                            }
                        )
            except Exception:
                pass

    def retrieve_context(self, query: str, top_k: int = 3) -> list[dict[str, Any]]:
        """
        Truy xuất top-k (3-5) tài liệu ngữ cảnh liên quan nhất từ Qdrant / Knowledge Base.
        Hỗ trợ fallback tìm kiếm tương đồng từ khóa ngữ nghĩa nếu không có server Qdrant ngoài.
        """
        # Đảm bảo top_k nằm trong khoảng từ 3 đến 5 theo yêu cầu đề bài
        k = max(3, min(top_k, 5))

        if not query.strip() or not self._documents:
            return self._documents[:k]

        query_terms = set(re.findall(r"\w+", query.lower()))

        scored_docs = []
        for doc in self._documents:
            doc_text = f"{doc.get('title', '')} {doc.get('content', '')}".lower()
            doc_terms = set(re.findall(r"\w+", doc_text))
            overlap = query_terms.intersection(doc_terms)
            score = len(overlap) / (len(query_terms) + 1e-5)
            scored_docs.append((score, doc))

        # Sắp xếp theo điểm tương đồng giảm dần
        scored_docs.sort(key=lambda x: x[0], reverse=True)

        results = []
        for score, doc in scored_docs[:k]:
            item = dict(doc)
            item["score"] = round(float(score), 3)
            results.append(item)

        return results


_rag_service: RAGService | None = None


def get_rag_service() -> RAGService:
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
