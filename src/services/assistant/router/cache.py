"""Bounded, thread-safe in-process LRU+TTL for confident decisions only."""

import hashlib
import time
from collections import OrderedDict
from collections.abc import Callable
from threading import RLock

from src.services.assistant.router.models import RouterDecision


def cache_key(folded_text: str, role: str, page_route_id: str | None) -> str:
    return hashlib.sha256(f"{folded_text}|{role}|{page_route_id or ''}".encode()).hexdigest()


class DecisionCache:
    def __init__(
        self,
        *,
        maxsize: int,
        ttl_s: float,
        threshold: float,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        if maxsize < 1 or ttl_s <= 0 or not 0 <= threshold <= 1:
            raise ValueError("Invalid decision cache limits")
        self.maxsize = maxsize
        self.ttl_s = ttl_s
        self.threshold = threshold
        self._clock = clock
        self._items: OrderedDict[str, tuple[float, RouterDecision]] = OrderedDict()
        self._lock = RLock()

    def get(self, key: str) -> RouterDecision | None:
        with self._lock:
            item = self._items.get(key)
            if item is None:
                return None
            expires, decision = item
            if self._clock() >= expires:
                del self._items[key]
                return None
            self._items.move_to_end(key)
            return decision.model_copy(deep=True)

    def put(self, key: str, decision: RouterDecision) -> None:
        if decision.source not in {"rules", "classifier"} or decision.confidence < self.threshold:
            return
        if decision.card_target is not None:
            return  # The section 5.3 key deliberately has no conversation context.
        with self._lock:
            now = self._clock()
            for expired in [key for key, (expires, _) in self._items.items() if now >= expires]:
                del self._items[expired]
            self._items[key] = (now + self.ttl_s, decision.model_copy(deep=True))
            self._items.move_to_end(key)
            while len(self._items) > self.maxsize:
                self._items.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()

    def __len__(self) -> int:
        with self._lock:
            return len(self._items)
