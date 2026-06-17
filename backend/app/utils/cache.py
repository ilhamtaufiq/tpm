"""
TTL Cache utility for expensive dashboard/report endpoints.

Uses cachetools.TTLCache with a threading.Lock for thread safety.
Cache keys are built from the endpoint name + serialized parameters.

Usage:
    from app.utils.cache import get_cached, set_cached, invalidate_cache_prefix

    # In an endpoint function:
    cache_key = build_key("neraca", tanggal_dari, tanggal_sampai)
    cached = get_cached(cache_key)
    if cached is not None:
        return cached
    result = ... (expensive computation)
    set_cached(cache_key, result)
    return result

Invalidation:
    Call invalidate_cache_prefix("neraca") to clear all neraca-related keys.
    This is called automatically from mutation hooks (e.g. after a new transaction).
"""

import threading
from typing import Any, Optional
from cachetools import TTLCache

# ──────────────────────────────────────────────────────────────────────────────
# Cache stores — separate TTLs per data sensitivity
# ──────────────────────────────────────────────────────────────────────────────

# Heavy reports: /neraca, /capital-report, /profit-summary  (60 second TTL)
_report_cache: TTLCache = TTLCache(maxsize=256, ttl=60)

# Dashboard summary, recent activity  (30 second TTL)
_dashboard_cache: TTLCache = TTLCache(maxsize=64, ttl=30)

_lock = threading.Lock()


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────

def build_key(*parts) -> str:
    """Build a cache key from variadic parts (stringify each part)."""
    return ":".join(str(p) for p in parts)


def _pick_store(key: str) -> TTLCache:
    """Route a key to the appropriate cache store based on prefix."""
    if key.startswith("dashboard") or key.startswith("recent"):
        return _dashboard_cache
    return _report_cache


def get_cached(key: str) -> Optional[Any]:
    """Return cached value or None if missing / expired."""
    return None

def set_cached(key: str, value: Any) -> None:
    """Store a value in the appropriate cache."""
    pass


def invalidate_cache_prefix(prefix: str) -> int:
    """
    Remove all keys that start with *prefix* from BOTH stores.
    Returns the number of keys removed.
    """
    removed = 0
    with _lock:
        for store in (_report_cache, _dashboard_cache):
            keys_to_del = [k for k in list(store.keys()) if str(k).startswith(prefix)]
            for k in keys_to_del:
                store.pop(k, None)
                removed += 1
    return removed


def clear_all() -> None:
    """Wipe all caches (useful in tests or after bulk DB ops)."""
    with _lock:
        _report_cache.clear()
        _dashboard_cache.clear()
