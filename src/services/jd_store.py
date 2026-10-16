"""Quản lý Vector Document Store cho dữ liệu Job Description (JD)."""

import json
import logging
from pathlib import Path
from typing import Any

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_openai import OpenAIEmbeddings

from src.config import get_settings

logger = logging.getLogger(__name__)


class LocalChromaEmbeddings(Embeddings):
    """
    Embedding function cục bộ sử dụng FastEmbed (BAAI/bge-small-en-v1.5) hoặc Chromadb Default.
    Chạy offline 100%, tốc độ cao trên CPU, không tốn chi phí API và không bị chậm tải mạng.
    """

    def __init__(self):
        try:
            from fastembed import TextEmbedding

            self._model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
            self._is_fastembed = True
        except Exception:
            from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

            self._ef = DefaultEmbeddingFunction()
            self._is_fastembed = False

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if self._is_fastembed:
            return [vec.tolist() for vec in self._model.embed(texts)]
        return self._ef(texts)

    def embed_query(self, text: str) -> list[float]:
        if self._is_fastembed:
            return list(self._model.embed([text]))[0].tolist()
        return self._ef([text])[0]


def _get_embedding_function() -> Embeddings:
    """
    Khởi tạo embedding model tối ưu cho Chroma:
    1. Ưu tiên OpenAIEmbeddings nếu có OPENAI_API_KEY hợp lệ.
    2. Fallback tự động sang LocalChromaEmbeddings (sẵn có trong chromadb).
    """
    settings = get_settings()
    openai_key = settings.openai_api_key

    # Kiểm tra nếu có API key OpenAI hợp lệ (không phải giá trị placeholder)
    is_valid_openai = bool(
        openai_key and not openai_key.startswith("sk-your_") and not openai_key.startswith("sk-dummy")
    )

    if is_valid_openai:
        try:
            return OpenAIEmbeddings(
                model="text-embedding-3-small",
                api_key=openai_key,
                base_url=settings.llm_base_url if "openai.com" in (settings.llm_base_url or "") else None,
            )
        except Exception as e:
            logger.warning("Không thể khởi tạo OpenAIEmbeddings, chuyển sang LocalChromaEmbeddings: %s", e)

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

        self.embeddings = embeddings or _get_embedding_function()
        self._vector_store: Chroma | None = None

    def _get_vector_store(self) -> Chroma:
        """Lazy load Chroma vector store."""
        if self._vector_store is None:
            Path(self.persist_dir).mkdir(parents=True, exist_ok=True)
            self._vector_store = Chroma(
                collection_name=self.collection_name,
                embedding_function=self.embeddings,
                persist_directory=self.persist_dir,
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
        store.add_documents(documents=docs, ids=ids)
        return len(docs)

    def index_items(self, items: list[dict[str, Any]]) -> int:
        """Nạp / cập nhật các JD (cùng dạng phần tử fixture) theo id cố định."""
        if not items:
            return 0
        store = self._get_vector_store()
        store.add_documents(documents=[self.build_jd_document(i) for i in items], ids=[i["id"] for i in items])
        return len(items)

    def remove(self, ids: list[str]) -> None:
        """Bỏ JD khỏi kho (JD bị ẩn khỏi thư viện)."""
        if ids:
            self._get_vector_store().delete(ids=ids)

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
