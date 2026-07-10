"""Spare part stock helpers — Always Ready sentinel.

Physical stock can legitimately be 999 (e.g. small fuses). Always Ready
(katalog tanpa stok fisik) therefore uses a distinct sentinel value.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

# Catalog-only / unlimited stock (not physical inventory)
ALWAYS_READY_STOCK = Decimal("999999")


def is_always_ready_stock(stok: Any) -> bool:
    """True when stok is the Always Ready sentinel (999999)."""
    if stok is None or stok == "":
        return False
    try:
        return Decimal(str(stok).strip()) == ALWAYS_READY_STOCK
    except (InvalidOperation, ValueError, TypeError):
        return False
