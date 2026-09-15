"""In-stock first, then nama A-Z. Mirrors get_list(sort_by='stok_nama')."""
from decimal import Decimal


def stok_nama_key(stok, nama: str):
    has_stock = 0 if stok is not None and Decimal(str(stok)) > 0 else 1
    return (has_stock, (nama or "").lower())


rows = [
    {"nama": "Zebra", "stok": 0},
    {"nama": "Baut", "stok": 5},
    {"nama": "Aki", "stok": 0},
    {"nama": "Oli", "stok": Decimal("999999")},
    {"nama": "Kampas", "stok": 2},
]
ordered = [r["nama"] for r in sorted(rows, key=lambda r: stok_nama_key(r["stok"], r["nama"]))]
assert ordered == ["Baut", "Kampas", "Oli", "Aki", "Zebra"], ordered
print("ok")
