"""Persistent Chroma collection with explicit embeddings and role filters."""

import json
from pathlib import Path
from typing import Any

import chromadb
from chromadb.config import Settings as ChromaSettings

from src.config import get_settings
from src.services.assistant.chunker import DocChunk
from src.services.assistant.embedding import AssistantEmbeddingService


class AssistantVectorStore:
    def __init__(self, embedding_service: AssistantEmbeddingService | None = None) -> None:
        settings = get_settings()
        self.persist_dir = Path(settings.assistant_chroma_persist_dir)
        self.collection_name = settings.assistant_chroma_collection
        self.embedding_service = embedding_service or AssistantEmbeddingService()
        self.client = chromadb.PersistentClient(
            path=str(self.persist_dir), settings=ChromaSettings(anonymized_telemetry=False)
        )
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name, metadata={"hnsw:space": "cosine"}, embedding_function=None
        )

    def _check_embedding(self) -> None:
        stored = (self.collection.metadata or {}).get("embedding_id")
        if self.collection.count() and stored != self.embedding_service.embedding_id:
            raise ValueError("Assistant embedding model differs from the stored index. Run the indexer again.")

    def _write_chunks(self, chunks: list[DocChunk], vectors: list[list[float]]) -> None:
        self._check_embedding()
        # Chroma rejects distance keys in modify(), even when unchanged.
        # The collection's cosine configuration was set at creation time.
        metadata = {
            key: value for key, value in (self.collection.metadata or {}).items() if not key.startswith("hnsw:")
        }
        metadata["embedding_id"] = self.embedding_service.embedding_id
        self.collection.modify(metadata=metadata)
        batch_size = min(128, self.client.get_max_batch_size())
        for offset in range(0, len(chunks), batch_size):
            batch = chunks[offset : offset + batch_size]
            metadatas = []
            for chunk in batch:
                item = chunk.model_dump(exclude={"chunk_id", "content", "tags", "selector", "ui_targets"})
                item["tags"] = json.dumps(chunk.tags, ensure_ascii=False)
                item["ui_targets"] = json.dumps(chunk.ui_targets, ensure_ascii=False)
                if chunk.selector is not None:
                    item["selector"] = chunk.selector
                metadatas.append(item)
            self.collection.upsert(
                ids=[chunk.chunk_id for chunk in batch],
                documents=[chunk.content for chunk in batch],
                metadatas=metadatas,
                embeddings=vectors[offset : offset + batch_size],
            )

    def add_chunks(self, chunks: list[DocChunk]) -> None:
        if not chunks:
            return
        self._check_embedding()
        vectors = self.embedding_service.embed_documents([chunk.content for chunk in chunks])
        self._write_chunks(chunks, vectors)

    def replace_chunks(self, chunks: list[DocChunk]) -> None:
        """Prepare embeddings before deleting only the configured assistant collection."""
        if not chunks:
            raise ValueError("Refusing to replace the Assistant index with an empty corpus")
        vectors = self.embedding_service.embed_documents([chunk.content for chunk in chunks])
        self.client.delete_collection(self.collection_name)
        self.collection = self.client.create_collection(
            name=self.collection_name, metadata={"hnsw:space": "cosine"}, embedding_function=None
        )
        self._write_chunks(chunks, vectors)

    @staticmethod
    def _record(chunk_id: str, content: str, metadata: dict[str, Any]) -> dict[str, Any]:
        return {
            **metadata,
            "chunk_id": chunk_id,
            "content": content,
            "tags": json.loads(metadata.get("tags", "[]")),
            "ui_targets": json.loads(metadata.get("ui_targets", "[]")),
            "selector": metadata.get("selector"),
        }

    def get_chunks(self) -> list[DocChunk]:
        records = self.collection.get(include=["documents", "metadatas"])
        return [
            DocChunk.model_validate(self._record(chunk_id, content, metadata))
            for chunk_id, content, metadata in zip(records["ids"], records["documents"], records["metadatas"])
        ]

    def search_vector(self, query: str, role: str, top_k: int = 5) -> list[dict[str, Any]]:
        if top_k <= 0 or not query.strip() or not self.collection.count():
            return []
        self._check_embedding()
        vector = self.embedding_service.embed_query(query)
        self._check_embedding()
        result = self.collection.query(
            query_embeddings=[vector],
            where={"role": {"$in": list(dict.fromkeys([role, "all"]))}},
            n_results=min(top_k, self.collection.count()),
            include=["documents", "metadatas", "distances"],
        )
        return [
            {
                **self._record(chunk_id, content, metadata),
                "distance": float(distance),
                "score": 1.0 - float(distance),
            }
            for chunk_id, content, metadata, distance in zip(
                result["ids"][0], result["documents"][0], result["metadatas"][0], result["distances"][0]
            )
        ]
