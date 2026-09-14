"""Lacak Nomor — satu endpoint untuk semua prefix dokumen.

Sebelumnya dashboard hanya mengenal KAS/PTG/HTG; 10 prefix lain
(BGL, MBL, JAS, PGL, PBL, GJI, KSB, AST, KRY, ABS) selalu "tidak ditemukan".
Pemetaan prefix → tabel dilakukan di sini agar penambahan modul cukup
menambah satu baris di PREFIX_MAP.
"""
from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from fastapi import APIRouter, HTTPException
from sqlalchemy import inspect as sa_inspect, or_

from app.api.deps import DBSession, CurrentUser
from app.models.bengkel import PembelianSparePart, PengeluaranBengkel, TransaksiPenjualanBengkel
from app.models.jasa_angkut import MuatanJasaAngkut
from app.models.karyawan import Karyawan, KasbonKaryawan, SlipGaji
from app.models.keuangan import (
    Aset,
    HutangUsaha,
    KasBank,
    PembayaranHutang,
    PembayaranPiutang,
    PiutangUsaha,
)
from app.models.mobil import TransaksiPenjualanMobil
from app.utils.constants import TRANSACTION_PREFIXES

router = APIRouter(prefix="/lacak", tags=["Lacak Nomor"])

# Kolom yang tidak berguna untuk penelusuran (audit / token / FK mentah).
_SKIP = {"created_by", "updated_at", "deleted_at", "public_receipt_token", "created_at"}


def _hide(col: str) -> bool:
    return col in _SKIP or col.endswith("_id")


def _val(v):
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    if isinstance(v, Enum):
        return v.value
    return v


def _serialize(obj) -> dict:
    """Semua kolom publik entitas, urut sesuai definisi tabel."""
    return {
        c.key: _val(getattr(obj, c.key))
        for c in sa_inspect(type(obj)).mapper.columns
        if not _hide(c.key)
    }


# prefix → (model, kolom nomor, kategori pembayaran | None)
PREFIX_MAP: dict[str, tuple[type, str, str | None]] = {
    TRANSACTION_PREFIXES["kas_bank"]: (KasBank, "nomor_transaksi", None),
    TRANSACTION_PREFIXES["piutang"]: (PiutangUsaha, "nomor_piutang", "piutang"),
    TRANSACTION_PREFIXES["hutang"]: (HutangUsaha, "nomor_hutang", "hutang"),
    TRANSACTION_PREFIXES["bengkel"]: (TransaksiPenjualanBengkel, "nomor_transaksi", None),
    TRANSACTION_PREFIXES["mobil"]: (TransaksiPenjualanMobil, "nomor_transaksi", None),
    TRANSACTION_PREFIXES["jasa_angkut"]: (MuatanJasaAngkut, "nomor_transaksi", None),
    TRANSACTION_PREFIXES["pengeluaran"]: (PengeluaranBengkel, "nomor_transaksi", None),
    TRANSACTION_PREFIXES["pembelian"]: (PembelianSparePart, "nomor_transaksi", None),
    TRANSACTION_PREFIXES["slip_gaji"]: (SlipGaji, "nomor_slip", None),
    TRANSACTION_PREFIXES["kasbon"]: (KasbonKaryawan, "nomor_kasbon", None),
    TRANSACTION_PREFIXES["aset"]: (Aset, "kode", None),
    TRANSACTION_PREFIXES["karyawan"]: (Karyawan, "kode", None),
}

# Prefix cocok terpanjang menang agar tak salah tebak (mis. KSB vs KAS).
_PREFIXES = sorted(PREFIX_MAP, key=len, reverse=True)


def _payments(db, kategori: str, doc) -> list[dict]:
    """Mutasi pembayaran. Hanya piutang/hutang yang punya tabel pembayaran."""
    if kategori == "piutang":
        rows = db.query(PembayaranPiutang).filter(PembayaranPiutang.piutang_id == doc.id).all()
    elif kategori == "hutang":
        rows = db.query(PembayaranHutang).filter(PembayaranHutang.hutang_id == doc.id).all()
    else:
        return []
    return [_serialize(r) for r in rows]


def _search_keterangan(db, key: str) -> list[dict]:
    """Cari dokumen berdasarkan pencocokan teks keterangan/catatan/nama."""
    results = []
    pattern = f"%{key}%"
    for prefix, (model, field, _) in PREFIX_MAP.items():
        cols = [c for c in ["keterangan", "catatan", "nama_aset", "nama"] if hasattr(model, c)]
        if not cols:
            continue
        conditions = [getattr(model, c).ilike(pattern) for c in cols]
        rows = db.query(model).filter(or_(*conditions)).limit(20).all()
        for r in rows:
            fields = _serialize(r)
            desc = fields.get("keterangan") or fields.get("catatan") or fields.get("nama_aset") or fields.get("nama") or "-"
            tgl = fields.get("tanggal") or fields.get("tanggal_beli") or fields.get("tanggal_bergabung") or fields.get("created_at")
            nominal = fields.get("total") or fields.get("nominal") or fields.get("jumlah") or fields.get("gaji_bersih") or fields.get("total_biaya") or 0
            results.append({
                "kind": prefix,
                "nomor": getattr(r, field),
                "tanggal": tgl,
                "keterangan": str(desc),
                "nominal": float(nominal) if isinstance(nominal, Decimal) else (nominal if isinstance(nominal, (int, float)) else 0),
            })
    return results


@router.get("/{nomor}")
def lacak_nomor(nomor: str, db: DBSession, current_user: CurrentUser):
    """Cari dokumen berdasarkan nomor atau keterangan (KAS/PTG/HTG/BGL/MBL/JAS/PGL/PBL/GJI/KSB/AST/KRY)."""
    key = (nomor or "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="Kata kunci pencarian kosong")

    key_upper = key.upper()
    prefix = next((p for p in _PREFIXES if key_upper.startswith(p)), None)

    if prefix:
        model, field, kategori = PREFIX_MAP[prefix]
        doc = db.query(model).filter(getattr(model, field) == key_upper).first()
        if doc:
            fields = _serialize(doc)
            return {
                "kind": prefix,
                "nomor": key_upper,
                "tanggal": fields.get("tanggal") or fields.get("tanggal_beli") or fields.get("tanggal_bergabung"),
                "fields": fields,
                "payments": _payments(db, kategori, doc),
            }

    # Jika pencarian exact nomor tidak ketemu (atau query adalah teks keterangan)
    search_results = _search_keterangan(db, key)
    if search_results:
        return {
            "kind": "SEARCH",
            "nomor": key,
            "results": search_results,
        }

    raise HTTPException(
        status_code=404,
        detail=f"Nomor atau keterangan '{key}' tidak ditemukan",
    )
