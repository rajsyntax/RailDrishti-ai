from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
import asyncio

class BaseTrainStore(ABC):
    @abstractmethod
    async def set_train_state(self, train_id: str, state: Dict[str, Any]) -> None:
        """Store or update train live state."""
        pass

    @abstractmethod
    async def get_train_state(self, train_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve live state for a given train_id."""
        pass

    @abstractmethod
    async def get_all_train_states(self) -> List[Dict[str, Any]]:
        """Retrieve live state for all active trains."""
        pass

    @abstractmethod
    async def reset(self) -> None:
        """Clear/reset train states."""
        pass


class InMemoryTrainStore(BaseTrainStore):
    """
    In-memory live state store with asyncio synchronization lock.
    Designed with a clean interface for easy swapping with Redis or PostgreSQL.
    """
    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def set_train_state(self, train_id: str, state: Dict[str, Any]) -> None:
        async with self._lock:
            self._store[train_id] = state

    async def get_train_state(self, train_id: str) -> Optional[Dict[str, Any]]:
        async with self._lock:
            state = self._store.get(train_id)
            return dict(state) if state else None

    async def get_all_train_states(self) -> List[Dict[str, Any]]:
        async with self._lock:
            return [dict(s) for s in self._store.values()]

    async def reset(self) -> None:
        async with self._lock:
            self._store.clear()

# Global store singleton instance
train_store: BaseTrainStore = InMemoryTrainStore()
