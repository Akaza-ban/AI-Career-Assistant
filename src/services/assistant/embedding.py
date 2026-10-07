"""E5 embeddings with a deterministic, normalized offline fallback."""

import hashlib
import logging
import math
import re
import unicodedata
from threading import RLock
from typing import Any, ClassVar

from src.config import get_settings

logger = logging.getLogger(__name__)


def tokenize(text: str) -> list[str]:
    """Use the same Unicode normalization for hashing and BM25."""
    return re.findall(r"\w+", unicodedata.normalize("NFC", text).casefold())


class AssistantEmbeddingService:
    """One model per process; never silently mix embedding spaces in an index."""

    _instance: ClassVar["AssistantEmbeddingService | None"] = None
    _lock: ClassVar[RLock] = RLock()

    def __new__(cls) -> "AssistantEmbeddingService":
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
            return cls._instance

    def __init__(self) -> None:
        with self._lock:
            if getattr(self, "_initialized", False):
                return
            settings = get_settings()
            self._model: Any = None
            self._used_model = False
            self.model_name = settings.assistant_embedding_model
            self.dimension = 384
            try:
                from sentence_transformers import SentenceTransformer

                self._model = SentenceTransformer(self.model_name, device=settings.assistant_embedding_device)
                dimension = self._model.get_sentence_embedding_dimension()
                if dimension is None:
                    raise ValueError("Embedding model did not report a dimension")
                self.dimension = int(dimension)
            except Exception as exc:
                self._model = None
                logger.warning("E5 unavailable (%s); using deterministic hashing embeddings", type(exc).__name__)
            self._initialized = True

    @property
    def embedding_id(self) -> str:
        """Persist this identifier to reject incompatible queries after a restart."""
        if self._model is None:
            return "hashing-sha256-v1:384"
        return f"e5:{self.model_name}:{self.dimension}"

    def _hash(self, text: str) -> list[float]:
        vector = [0.0] * 384
        words = tokenize(text)
        features = words + [f"{a} {b}" for a, b in zip(words, words[1:])]
        for feature in features:
            digest = hashlib.sha256(feature.encode("utf-8")).digest()
            vector[int.from_bytes(digest[:4], "big") % 384] += 1.0 if digest[4] & 1 else -1.0
        norm = math.sqrt(sum(value * value for value in vector))
        if norm == 0:
            vector[0] = 1.0
            return vector
        return [value / norm for value in vector]

    def _encode(self, texts: list[str], prefix: str) -> list[list[float]]:
        if not texts:
            return []
        with self._lock:
            if self._model is not None:
                try:
                    vectors = self._model.encode(
                        [prefix + text for text in texts],
                        normalize_embeddings=True,
                        convert_to_numpy=True,
                        show_progress_bar=False,
                    )
                    self._used_model = True
                    return vectors.tolist()
                except Exception as exc:
                    if self._used_model:
                        raise RuntimeError(
                            "E5 encoding failed; refusing to mix embeddings. Rebuild the index."
                        ) from exc
                    self._model = None
                    self.dimension = 384
                    logger.warning("E5 encoding unavailable; using deterministic hashing embeddings")
            # Prefixes identify the E5 task; exclude them from lexical hashing.
            return [self._hash(text) for text in texts]

    def embed_query(self, query: str) -> list[float]:
        return self._encode([query], "query: ")[0]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._encode(texts, "passage: ")
