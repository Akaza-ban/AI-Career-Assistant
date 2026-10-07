"""BM25 + vector retrieval using reciprocal rank fusion (k=60)."""

import json
import logging
import tempfile
from pathlib import Path
from typing import Any

from rank_bm25 import BM25Okapi

from src.config import get_settings
from src.services.assistant.chunker import DocChunk
from src.services.assistant.embedding import tokenize
from src.services.assistant.vector_store import AssistantVectorStore

logger = logging.getLogger(__name__)


def corpus_path(store: AssistantVectorStore) -> Path:
    return store.persist_dir / f"{store.collection_name}_bm25.json"


def save_bm25_corpus(store: AssistantVectorStore, chunks: list[DocChunk]) -> None:
    """Persist plain JSON atomically; rebuild BM25 rather than loading pickles."""
    target = corpus_path(store)
    payload = {"version": 1, "chunks": [chunk.model_dump() for chunk in chunks]}
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=target.parent, delete=False) as handle:
        temporary = Path(handle.name)
        json.dump(payload, handle, ensure_ascii=False, indent=2)
    try:
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)


class AssistantHybridRetriever:
    def __init__(self, vector_store: AssistantVectorStore | None = None) -> None:
        self.vector_store = vector_store or AssistantVectorStore()
        # Chroma is authoritative if a previous rebuild stopped before saving JSON.
        actual = self.vector_store.get_chunks()
        path = corpus_path(self.vector_store)
        self.chunks = actual
        if path.exists():
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
                if payload["version"] != 1:
                    raise ValueError("Unsupported BM25 corpus version")
                saved = [DocChunk.model_validate(item) for item in payload["chunks"]]
                if {c.chunk_id: c for c in saved} == {c.chunk_id: c for c in actual}:
                    self.chunks = saved
                else:
                    logger.warning("Stale BM25 corpus; rebuilding sparse retrieval from Chroma")
            except (ValueError, KeyError, TypeError):
                logger.warning("Invalid BM25 corpus; rebuilding sparse retrieval from Chroma")
        self._indexes: dict[str, tuple[list[DocChunk], BM25Okapi | None]] = {}

    def _role_index(self, role: str) -> tuple[list[DocChunk], BM25Okapi | None]:
        if role not in self._indexes:
            chunks = [chunk for chunk in self.chunks if chunk.role in (role, "all")]
            texts = [tokenize(f"{c.title} {c.section} {' '.join(c.tags)} {c.content}") for c in chunks]
            self._indexes[role] = (chunks, BM25Okapi(texts) if chunks else None)
        return self._indexes[role]

    def search(self, query: str, role: str, top_k: int | None = None) -> list[dict[str, Any]]:
        limit = get_settings().assistant_top_k if top_k is None else top_k
        if limit <= 0 or not tokenize(query):
            return []
        candidates = max(limit * 4, 20)
        dense = self.vector_store.search_vector(query, role, candidates)
        chunks, bm25 = self._role_index(role)
        sparse: list[dict[str, Any]] = []
        if bm25 is not None:
            scores = bm25.get_scores(tokenize(query))
            ranked = sorted(range(len(chunks)), key=lambda i: (-float(scores[i]), chunks[i].chunk_id))
            # Zero-score documents must not gain arbitrary reciprocal-rank credit.
            sparse = [
                {**chunks[i].model_dump(), "bm25_score": float(scores[i])} for i in ranked[:candidates] if scores[i] > 0
            ]
        fused: dict[str, dict[str, Any]] = {}
        for name, results in (("vector", dense), ("bm25", sparse)):
            for rank, item in enumerate(results, start=1):
                chunk_id = item["chunk_id"]
                if chunk_id not in fused:
                    fused[chunk_id] = {**item, "score": 0.0}
                record = fused[chunk_id]
                record[f"{name}_rank"] = rank
                if name == "bm25":
                    record["bm25_score"] = item["bm25_score"]
                record["score"] += 1.0 / (60 + rank)
        return sorted(fused.values(), key=lambda item: (-item["score"], item["chunk_id"]))[:limit]

    def retrieve(self, query: str, role: str, top_k: int | None = None) -> list[dict[str, Any]]:
        return self.search(query, role, top_k)
