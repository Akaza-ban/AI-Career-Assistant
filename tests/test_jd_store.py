"""Tests cho module quản lý Vector Document Store (JDDocumentStore)."""

import tempfile
from pathlib import Path

from langchain_core.embeddings import Embeddings

from src.services.jd_store import JDDocumentStore


class MockFastEmbeddings(Embeddings):
    """Embedding giả lập cho unit test, không phụ thuộc mạng hay mô hình nặng."""

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [[float(len(t) % 10 + idx) for idx in range(8)] for t in texts]

    def embed_query(self, text: str) -> list[float]:
        return [float(len(text) % 10 + idx) for idx in range(8)]


def test_build_jd_document():
    store = JDDocumentStore(collection_name="test_build", embeddings=MockFastEmbeddings())
    sample_jd = {
        "id": "jd-test-1",
        "title": "Backend Python Intern",
        "company": "Tech Corp",
        "industry": "Công nghệ",
        "level": "intern",
        "content": "Tuyển thực tập sinh Python làm việc với FastAPI và Docker.",
        "skills": [
            {"name": "Python", "importance": "required"},
            {"name": "FastAPI", "importance": "required"},
            {"name": "Docker", "importance": "preferred"},
        ],
    }

    doc = store.build_jd_document(sample_jd)
    assert doc.metadata["jd_id"] == "jd-test-1"
    assert doc.metadata["title"] == "Backend Python Intern"
    assert "Python, FastAPI" in doc.page_content
    assert "Docker" in doc.page_content


def test_index_and_search_candidates():
    # Sử dụng collection và thư mục tạm cho test
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp_dir:
        store = JDDocumentStore(
            collection_name="test_indexing",
            embeddings=MockFastEmbeddings(),
        )
        store.persist_dir = tmp_dir

        fixture_file = Path("src/db/fixtures/jd_library.json")
        if not fixture_file.exists():
            return

        count = store.index_from_fixtures(str(fixture_file))
        assert count > 0

        # Tìm kiếm ứng viên cho kỹ sư phần mềm Python
        results = store.search_candidates("Lập trình viên backend Python FastAPI", top_k=3)
        assert len(results) > 0

        top_doc, score = results[0]
        assert "jd_id" in top_doc.metadata
        assert top_doc.metadata["title"] != ""
