"""Struk digital untuk piutang dan hutang.

Struk memakai token publik (kolom `public_receipt_token`) yang dibuat saat pertama kali
dibagikan. Token tidak dibuat saat piutang/hutang dicatat, supaya data lama tidak perlu
dibackfill. Halaman publik hanya membaca data, tidak bisa mengubah apa pun.
"""
import secrets
from decimal import Decimal
from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.keuangan import HutangUsaha, PiutangUsaha

SUMBER_PIUTANG_LABEL = {
    "BENGKEL": "Bengkel",
    "JASA_ANGKUT": "Jasa Angkut",
    "JUAL_BELI_MOBIL": "Jual Beli Mobil",
    "KASBON_KARYAWAN": "Kasbon Karyawan",
    "LAINNYA": "Lainnya",
}

SUMBER_HUTANG_LABEL = {
    "PEMBELIAN_PART": "Pembelian Part",
    "PEMBELIAN_MOBIL": "Pembelian Mobil",
    "JUAL_BELI_MOBIL": "Jual Beli Mobil",
    "UANG_MUKA_PENJUALAN": "Uang Muka Penjualan",
    "LAINNYA": "Lainnya",
}

STATUS_LABEL = {
    "BELUM_LUNAS": "BELUM BAYAR",
    "SEBAGIAN": "BELUM LUNAS",
    "LUNAS": "LUNAS",
    "BATAL": "BATAL",
}


def _enum_value(value: Any) -> str:
    return str(getattr(value, "value", value) or "")


def _nilai(value: Any) -> float:
    return float(value or 0)


def buat_atau_ambil_token(db: Session, obj: PiutangUsaha | HutangUsaha) -> str:
    """Token publik untuk satu piutang/hutang. Dibuat sekali, lalu dipakai ulang."""
    if not obj.public_receipt_token:
        obj.public_receipt_token = secrets.token_urlsafe(32)
        db.commit()
        db.refresh(obj)
    return obj.public_receipt_token


def _riwayat_pembayaran(pembayaran) -> list:
    return [
        {
            "tanggal": p.tanggal.isoformat() if p.tanggal else None,
            "nominal": _nilai(p.nominal),
            "metode": _enum_value(p.metode_bayar).upper(),
            "catatan": p.catatan,
        }
        for p in sorted(pembayaran or [], key=lambda x: (x.tanggal, x.id))
    ]


def _bangun_struk(
    *,
    jenis: str,
    nomor: str,
    tanggal,
    pihak: str,
    pihak_label: str,
    keterangan_item: str,
    nominal: Decimal,
    total_dibayar: Decimal,
    sisa: Decimal,
    status_value: str,
    catatan: Optional[str],
    pembayaran,
) -> Dict[str, Any]:
    total = _nilai(nominal)
    return {
        "receiptKind": jenis,
        "transactionNumber": nomor,
        "date": tanggal.isoformat() if tanggal else None,
        "customerName": pihak,
        "counterpartyLabel": pihak_label,
        "items": [
            {
                "description": keterangan_item,
                "quantity": 1,
                "unitPrice": total,
                "subtotal": total,
            }
        ],
        "services": [],
        "parts": [],
        "subtotal": total,
        "tax": 0,
        "discount": 0,
        "showDiscount": False,
        "total": total,
        "paid": _nilai(total_dibayar),
        "remaining": _nilai(sisa),
        "paymentStatus": STATUS_LABEL.get(status_value, status_value),
        "paymentMethod": None,
        "paymentMethods": [],
        "payments": _riwayat_pembayaran(pembayaran),
        "notes": catatan,
        "companyName": "Tiga Putra Motor",
        "companyAddress": "Cianjur, Jawa Barat",
        "companyPhone": "+62 856 5999 4407",
    }


def get_piutang_receipt(db: Session, token: str) -> Dict[str, Any]:
    piutang = db.query(PiutangUsaha).filter(PiutangUsaha.public_receipt_token == token).first()
    if piutang is None:
        raise HTTPException(status_code=404, detail="Receipt not found")
    sumber = SUMBER_PIUTANG_LABEL.get(_enum_value(piutang.sumber), _enum_value(piutang.sumber))
    keterangan = f"Piutang {sumber}"
    if piutang.nomor_referensi:
        keterangan += f" ({piutang.nomor_referensi})"
    return _bangun_struk(
        jenis="PIUTANG",
        nomor=piutang.nomor_piutang,
        tanggal=piutang.tanggal,
        pihak=piutang.nama_debitur,
        pihak_label="Debitur",
        keterangan_item=keterangan,
        nominal=piutang.nominal_piutang,
        total_dibayar=piutang.total_dibayar,
        sisa=piutang.sisa_piutang,
        status_value=_enum_value(piutang.status),
        catatan=piutang.catatan,
        pembayaran=piutang.pembayaran,
    )


def get_hutang_receipt(db: Session, token: str) -> Dict[str, Any]:
    hutang = db.query(HutangUsaha).filter(HutangUsaha.public_receipt_token == token).first()
    if hutang is None:
        raise HTTPException(status_code=404, detail="Receipt not found")
    sumber = SUMBER_HUTANG_LABEL.get(_enum_value(hutang.sumber), _enum_value(hutang.sumber))
    keterangan = f"Hutang {sumber}"
    if hutang.nomor_referensi:
        keterangan += f" ({hutang.nomor_referensi})"
    return _bangun_struk(
        jenis="HUTANG",
        nomor=hutang.nomor_hutang,
        tanggal=hutang.tanggal,
        pihak=hutang.nama_kreditur,
        pihak_label="Kreditur",
        keterangan_item=keterangan,
        nominal=hutang.nominal_hutang,
        total_dibayar=hutang.total_dibayar,
        sisa=hutang.sisa_hutang,
        status_value=_enum_value(hutang.status),
        catatan=hutang.catatan,
        pembayaran=hutang.pembayaran,
    )
