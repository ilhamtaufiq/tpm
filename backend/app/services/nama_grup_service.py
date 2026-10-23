"""Piutang dan hutang dikelompokkan otomatis per nama (debitur/kreditur).

Pelunasan per nama dialokasikan ke struk tertua dulu. Tiap bagian dicatat sebagai
pembayaran biasa (PembayaranPiutang/PembayaranHutang + kas), jadi rincian dan kas
tetap konsisten. Alokasi berurutan: jika gagal di tengah, bagian yang sudah tercatat
tidak dibatalkan otomatis.
"""
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import func

from app.models.keuangan import HutangUsaha, PiutangUsaha
from app.schemas.keuangan import PaymentDetail, PaymentDetailHutang, PembayaranHutangSplit, PembayaranPiutangSplit
from app.services.hutang_service import HutangService
from app.services.piutang_service import PiutangService
from app.utils.constants import HutangStatus, KasBankJenis, PaymentMethod, PiutangStatus


def _d(x) -> float:
    return float(x or 0)


def _kunci(nama: str) -> str:
    # Nama dicocokkan tanpa spasi tepi dan tanpa membedakan huruf besar/kecil, di daftar maupun detail.
    return nama.strip().lower()


class NamaGrupService:
    def __init__(self, db):
        self.db = db

    # ---------------- PIUTANG ----------------
    def _piutang_nama(self, nama: str):
        return (
            self.db.query(PiutangUsaha)
            .filter(
                func.lower(func.trim(PiutangUsaha.nama_debitur)) == _kunci(nama),
                PiutangUsaha.is_internal == False,  # noqa: E712
                PiutangUsaha.status != PiutangStatus.BATAL,
            )
            .order_by(PiutangUsaha.tanggal, PiutangUsaha.id)
        )

    def piutang_grup(self) -> List[Dict[str, Any]]:
        rows = (
            self.db.query(PiutangUsaha)
            .filter(PiutangUsaha.is_internal == False, PiutangUsaha.status != PiutangStatus.BATAL)  # noqa: E712
            .all()
        )
        grup: Dict[str, Dict[str, Any]] = {}
        for p in rows:
            g = grup.setdefault(_kunci(p.nama_debitur), {"nama": p.nama_debitur.strip(), "jumlah_struk": 0, "total_nominal": 0.0, "total_sisa": 0.0, "belum_lunas": 0})
            g["jumlah_struk"] += 1
            g["total_nominal"] += _d(p.nominal_piutang)
            g["total_sisa"] += _d(p.sisa_piutang)
            if p.status != PiutangStatus.LUNAS:
                g["belum_lunas"] += 1
        return sorted(grup.values(), key=lambda g: -g["total_sisa"])

    def piutang_detail(self, nama: str) -> Dict[str, Any]:
        rows = self._piutang_nama(nama).all()
        if not rows:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Tidak ada piutang atas nama {nama}")
        return {
            "nama": nama,
            "total_sisa": sum(_d(p.sisa_piutang) for p in rows),
            "struk": [
                {
                    "id": p.id,
                    "nomor": p.nomor_piutang,
                    "tanggal": p.tanggal.isoformat(),
                    "nominal": _d(p.nominal_piutang),
                    "total_dibayar": _d(p.total_dibayar),
                    "sisa": _d(p.sisa_piutang),
                    "status": p.status.value,
                    "pembayaran": [
                        {"tanggal": x.tanggal.isoformat(), "nominal": _d(x.nominal), "metode": x.metode_bayar.value if x.metode_bayar else None}
                        for x in sorted(p.pembayaran, key=lambda x: (x.tanggal, x.id))
                    ],
                }
                for p in rows
            ],
        }

    def piutang_bayar(self, nama: str, tanggal: date, metode: PaymentMethod, nominal: Decimal,
                      kas_jenis: Optional[KasBankJenis], catatan: Optional[str], user_id: Optional[int]) -> Dict[str, Any]:
        tersedia = [p for p in self._piutang_nama(nama).all() if p.status != PiutangStatus.LUNAS and (p.sisa_piutang or 0) > 0]
        total = sum((p.sisa_piutang for p in tersedia), Decimal(0))
        if not tersedia:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Tidak ada piutang belum lunas atas nama {nama}")
        if nominal > total:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Nominal melebihi sisa piutang {nama} ({float(total):,.0f})")
        sisa = nominal
        dibayar = []
        for p in tersedia:
            if sisa <= 0:
                break
            bagian = min(sisa, p.sisa_piutang)
            PiutangService(self.db).process_payment_split(
                PembayaranPiutangSplit(
                    piutang_id=p.id, tanggal=tanggal,
                    payments=[PaymentDetail(metode=metode, nominal=bagian, kas_jenis=kas_jenis, catatan=catatan)],
                    catatan=catatan,
                ),
                user_id,
            )
            dibayar.append({"nomor": p.nomor_piutang, "nominal": float(bagian)})
            sisa -= bagian
        return {"nama": nama, "dibayar": dibayar, "total": float(nominal)}

    # ---------------- HUTANG ----------------
    def _hutang_nama(self, nama: str):
        return (
            self.db.query(HutangUsaha)
            .filter(
                func.lower(func.trim(HutangUsaha.nama_kreditur)) == _kunci(nama),
                HutangUsaha.is_internal == False,  # noqa: E712
                HutangUsaha.status != HutangStatus.BATAL,
            )
            .order_by(HutangUsaha.tanggal, HutangUsaha.id)
        )

    def hutang_grup(self) -> List[Dict[str, Any]]:
        rows = (
            self.db.query(HutangUsaha)
            .filter(HutangUsaha.is_internal == False, HutangUsaha.status != HutangStatus.BATAL)  # noqa: E712
            .all()
        )
        grup: Dict[str, Dict[str, Any]] = {}
        for h in rows:
            g = grup.setdefault(_kunci(h.nama_kreditur), {"nama": h.nama_kreditur.strip(), "jumlah_struk": 0, "total_nominal": 0.0, "total_sisa": 0.0, "belum_lunas": 0})
            g["jumlah_struk"] += 1
            g["total_nominal"] += _d(h.nominal_hutang)
            g["total_sisa"] += _d(h.sisa_hutang)
            if h.status != HutangStatus.LUNAS:
                g["belum_lunas"] += 1
        return sorted(grup.values(), key=lambda g: -g["total_sisa"])

    def hutang_detail(self, nama: str) -> Dict[str, Any]:
        rows = self._hutang_nama(nama).all()
        if not rows:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Tidak ada hutang atas nama {nama}")
        return {
            "nama": nama,
            "total_sisa": sum(_d(h.sisa_hutang) for h in rows),
            "struk": [
                {
                    "id": h.id,
                    "nomor": h.nomor_hutang,
                    "tanggal": h.tanggal.isoformat(),
                    "nominal": _d(h.nominal_hutang),
                    "total_dibayar": _d(h.total_dibayar),
                    "sisa": _d(h.sisa_hutang),
                    "status": h.status.value,
                }
                for h in rows
            ],
        }

    def hutang_bayar(self, nama: str, tanggal: date, metode: PaymentMethod, nominal: Decimal,
                     kas_jenis: Optional[KasBankJenis], catatan: Optional[str], user_id: Optional[int]) -> Dict[str, Any]:
        tersedia = [h for h in self._hutang_nama(nama).all() if h.status != HutangStatus.LUNAS and (h.sisa_hutang or 0) > 0]
        total = sum((h.sisa_hutang for h in tersedia), Decimal(0))
        if not tersedia:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Tidak ada hutang belum lunas atas nama {nama}")
        if nominal > total:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Nominal melebihi sisa hutang {nama} ({float(total):,.0f})")
        sisa = nominal
        dibayar = []
        for h in tersedia:
            if sisa <= 0:
                break
            bagian = min(sisa, h.sisa_hutang)
            HutangService(self.db).process_payment_split(
                PembayaranHutangSplit(
                    hutang_id=h.id, tanggal=tanggal,
                    payments=[PaymentDetailHutang(metode=metode, nominal=bagian, kas_jenis=kas_jenis, catatan=catatan)],
                    catatan=catatan,
                ),
                user_id,
            )
            dibayar.append({"nomor": h.nomor_hutang, "nominal": float(bagian)})
            sisa -= bagian
        return {"nama": nama, "dibayar": dibayar, "total": float(nominal)}
