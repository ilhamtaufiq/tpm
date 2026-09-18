"""Rate limiter in-process untuk endpoint otentikasi.

Batas per (scope, IP) dengan sliding window. Cukup untuk deployment satu
proses; kalau nanti dijalankan multi-worker/multi-node, ganti `_hits` dengan
Redis — lihat catatan di `check`.
"""
import threading
import time
from typing import Dict, List, Tuple

from fastapi import HTTPException, Request, status

_hits: Dict[Tuple[str, str], List[float]] = {}
_lock = threading.Lock()


def client_ip(request: Request) -> str:
    """IP pemanggil.

    Di VPS, nginx/Cloudflare ada di depan, jadi `request.client.host` selalu
    localhost. `X-Forwarded-For` diambil dari elemen pertama (klien asli).
    Header ini bisa dipalsukan — kalau app diekspos langsung tanpa proxy,
    lebih aman pakai `request.client.host` saja.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.headers.get("cf-connecting-ip"):
        return request.headers["cf-connecting-ip"].strip()
    return request.client.host if request.client else "unknown"


def check(request: Request, scope: str, limit: int, window_seconds: int) -> None:
    """Rekam satu percobaan; tolak dengan 429 kalau melewati `limit`/`window`.

    Catatan skala: state disimpan di memori proses. Satu uvicorn tanpa
    `--workers` aman; dengan N worker tiap worker punya penghitung sendiri
    (efektif limit x N). Pindah ke Redis kalau worker > 1.
    """
    key = (scope, client_ip(request))
    now = time.monotonic()
    cutoff = now - window_seconds

    with _lock:
        timestamps = [t for t in _hits.get(key, ()) if t > cutoff]
        if len(timestamps) >= limit:
            _hits[key] = timestamps
            retry_after = int(timestamps[0] + window_seconds - now) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "Terlalu banyak percobaan. "
                    f"Coba lagi dalam {retry_after} detik."
                ),
                headers={"Retry-After": str(retry_after)},
            )
        timestamps.append(now)
        _hits[key] = timestamps

        # Bersihkan entri basi supaya dict tidak tumbuh tanpa batas.
        if len(_hits) > 2048:
            for stale in [k for k, v in _hits.items() if not v or v[-1] <= cutoff]:
                _hits.pop(stale, None)


def reset() -> None:
    """Kosongkan state — dipakai test."""
    with _lock:
        _hits.clear()
