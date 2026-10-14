"""Quản lý Vector Document Store cho dữ liệu Job Description (JD)."""

import json
from pathlib import Path
from typing import Any

from chromadb.config import Settings as ChromaSettings
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings

from src.config import get_settings
from src.services.providers.gateway import GatewayEmbeddings, LocalChromaEmbeddings, provider_scope


def _get_embedding_function() -> Embeddings:
    """Use gateway-owned OpenAI embeddings or local inference with the same privacy boundary."""
    settings = get_settings()
    openai_key = settings.openai_api_key

    # Kiểm tra nếu có API key OpenAI hợp lệ (không phải giá trị placeholder)
    is_valid_openai = bool(
        openai_key and not openai_key.startswith("sk-your_") and not openai_key.startswith("sk-dummy")
    )

    if is_valid_openai:
        return GatewayEmbeddings()

    return LocalChromaEmbeddings()


class JDDocumentStore:
    def __init__(
        self,
        collection_name: str = "jd_collection",
        embeddings: Embeddings | None = None,
    ):
        self.settings = get_settings()
        self.collection_name = collection_name
        self.persist_dir = self.settings.chroma_persist_dir

        self.embeddings = GatewayEmbeddings(embeddings) if embeddings is not None else _get_embedding_function()
        self._vector_store: Chroma | None = None

    def _get_vector_store(self) -> Chroma:
        """Lazy load Chroma vector store."""
        if self._vector_store is None:
            Path(self.persist_dir).mkdir(parents=True, exist_ok=True)
            self._vector_store = Chroma(
                collection_name=self.collection_name,
                embedding_function=self.embeddings,
                persist_directory=self.persist_dir,
                client_settings=ChromaSettings(anonymized_telemetry=False),
            )
        return self._vector_store

    def build_jd_document(self, jd_item: dict[str, Any]) -> Document:
        """Đóng gói 1 JD thành Document chuẩn kèm enriched text và metadata."""
        skills = jd_item.get("skills", [])
        req_skills = [s["name"] for s in skills if s.get("importance") == "required"]
        pref_skills = [s["name"] for s in skills if s.get("importance") == "preferred"]

        page_content = (
            f"Vị trí: {jd_item.get('title', '')} | Cấp bậc: {jd_item.get('level', '')} | Ngành: {jd_item.get('industry', '')}\n"
            f"Kỹ năng cốt lõi (Required): {', '.join(req_skills)}\n"
            f"Kỹ năng ưu tiên (Preferred): {', '.join(pref_skills)}\n"
            f"Chi tiết công việc và yêu cầu:\n{jd_item.get('content', '')}"
        )

        metadata = {
            "jd_id": jd_item["id"],
            "title": jd_item.get("title", ""),
            "company": jd_item.get("company", ""),
            "industry": jd_item.get("industry", ""),
            "level": jd_item.get("level", ""),
        }
        return Document(page_content=page_content, metadata=metadata)

    def index_from_fixtures(self, fixture_path: str = "src/db/fixtures/jd_library.json") -> int:
        """Nạp và index toàn bộ JD từ file fixture vào Vector Store."""
        path = Path(fixture_path)
        if not path.exists():
            raise FileNotFoundError(f"Không tìm thấy fixture tại: {fixture_path}")

        with open(path, encoding="utf-8") as f:
            jds: list[dict[str, Any]] = json.load(f)

        docs = [self.build_jd_document(item) for item in jds]
        ids = [item["id"] for item in jds]

        store = self._get_vector_store()
        # Thêm documents với ID cố định để tránh duplicate khi re-index
        with provider_scope(origins=tuple(f"jd:{item['id']}" for item in jds)) as scope:
            for item, doc in zip(jds, docs, strict=True):
                scope.prime(doc.page_content, f"jd:{item['id']}")
            store.add_documents(documents=docs, ids=ids)
        return len(docs)

    def search_candidates(self, query_text: str, top_k: int = 6) -> list[tuple[Document, float]]:
        """Truy xuất Top-K JD ứng viên dựa trên độ tương đồng ngữ nghĩa."""
        store = self._get_vector_store()
        try:
            raw_results = store.similarity_search_with_score(query_text, k=top_k)
            # Chuẩn hóa khoảng cách về độ tương đồng [0, 1]
            scored_results = []
            for doc, dist in raw_results:
                sim = 1.0 / (1.0 + max(0.0, float(dist)))
                scored_results.append((doc, round(sim, 4)))
            return scored_results
        except Exception:
            docs = store.similarity_search(query_text, k=top_k)
            return [(doc, 0.5) for doc in docs]


_jd_store_instance: JDDocumentStore | None = None


def get_jd_store() -> JDDocumentStore:
    global _jd_store_instance
    if _jd_store_instance is None:
        _jd_store_instance = JDDocumentStore()
    return _jd_store_instance
