"""
app/services/alert_store.py

In-memory alert store with a clean interface.
Alerts are keyed by alert_id. The store is capped to prevent unbounded growth.
"""

import uuid
import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

MAX_ALERTS = 200  # Ring-buffer cap


class AlertStore:
    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def push(self, alert: Dict[str, Any]) -> str:
        """Add an alert and return its id. Evicts oldest when cap hit."""
        async with self._lock:
            alert_id = str(uuid.uuid4())
            alert["alert_id"] = alert_id
            alert.setdefault("created_at", datetime.now(timezone.utc).isoformat())
            alert.setdefault("is_read", False)
            self._store[alert_id] = alert
            # Evict oldest if over cap
            if len(self._store) > MAX_ALERTS:
                oldest = next(iter(self._store))
                del self._store[oldest]
            return alert_id

    async def get_all(
        self,
        active_only: bool = True,
        category: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        async with self._lock:
            items = list(self._store.values())

        if active_only:
            items = [a for a in items if a.get("is_active", True)]
        if category:
            items = [a for a in items if a.get("category") == category]

        # newest first
        items.sort(key=lambda a: a.get("created_at", ""), reverse=True)
        return items[:limit]

    async def mark_read(self, alert_id: str) -> bool:
        async with self._lock:
            if alert_id in self._store:
                self._store[alert_id]["is_read"] = True
                return True
            return False

    async def clear(self) -> None:
        async with self._lock:
            self._store.clear()


# Global singleton
alert_store = AlertStore()
