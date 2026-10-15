"""Offline calibrated route classifier and content-addressed artifact loader."""

from __future__ import annotations

import hashlib
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib

LOGGER = logging.getLogger(__name__)
_MISSING_LOGGED: set[str] = set()


@lru_cache(maxsize=8)
def load_classifier(path: str | Path) -> Any | None:
    """Load a trusted, versioned local artifact; missing files disable stage 3."""
    artifact_path = Path(path)
    if artifact_path.is_dir():
        candidates = sorted(artifact_path.glob("router-v[12]-*.joblib"))
        artifact_path = candidates[-1] if candidates else artifact_path / "router-v1-missing.joblib"
    try:
        artifact = joblib.load(artifact_path)
        if artifact.get("format") not in {"careerx-router-v1", "careerx-router-v2"} or not artifact.get("train_sha256"):
            raise ValueError("Unsupported router artifact")
        return artifact["pipeline"]
    except FileNotFoundError:
        key = str(artifact_path)
        if key not in _MISSING_LOGGED:
            LOGGER.warning("Router classifier artifact is missing; stage 3 is disabled")
            _MISSING_LOGGED.add(key)
        return None
    except (OSError, ValueError, KeyError, TypeError, EOFError) as exc:
        LOGGER.warning("Router classifier artifact could not be loaded; stage 3 is disabled: %s", type(exc).__name__)
        return None


def verify_artifact(path: str | Path, train_path: str | Path) -> bool:
    """Verify the source digest against the exact train.jsonl bytes."""
    artifact = joblib.load(path)
    digest = hashlib.sha256(Path(train_path).read_bytes()).hexdigest()
    return artifact.get("train_sha256") == digest


def predict_probabilities(pipeline: Any, text: str) -> list[tuple[str, float]]:
    probabilities = pipeline.predict_proba([text])[0]
    return sorted(zip(pipeline.classes_, probabilities, strict=True), key=lambda item: item[1], reverse=True)
