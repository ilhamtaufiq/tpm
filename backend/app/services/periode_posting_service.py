"""Posting bulanan: mengunci nota bengkel pada bulan yang sudah diposting.

Aturan:
- Bulan tanpa baris di `periode_posting` = TERBUKA.
- Memposting hanya untuk bulan yang sudah berakhir (bukan bulan berjalan/mendatang).
- Bulan DIPOSTING: nota bertanggal di bulan itu tidak boleh diubah, dibatalkan,
  atau dipindah tanggal. Penambahan item dialihkan menjadi nota tambahan di
  bulan terbuka (lihat TransaksiBengkelService.update).
- Buka kembali hanya admin dan wajib beralasan; keduanya dicatat di riwayat.
"""
import calendar
import json
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.perbaikan_data_log import PerbaikanDataLog
from app.models.periode_posting import STATUS_DIPOSTING, STATUS_TERBUKA, PeriodePosting
from app.utils.helpers import get_jakarta_date, get_jakarta_now

NAMA_BULAN = [
    "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]


def label_periode(tahun: int, bulan: int) -> str:
    return f"{NAMA_BULAN[bulan]} {tahun}"


class PeriodePostingService:
    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Pemeriksaan
    # ------------------------------------------------------------------
    def _row(self, tahun: int, bulan: int) -> Optional[PeriodePosting]:
        return (
            self.db.query(PeriodePosting)
            .filter(PeriodePosting.tahun == tahun, PeriodePosting.bulan == bulan)
            .first()
        )

    def is_posted(self, tanggal: Optional[date]) -> bool:
        from app.config import settings
        if not settings.posting_bulanan_aktif:
            return False
        if tanggal is None:
            return False
        row = self._row(tanggal.year, tanggal.month)
        return bool(row and row.status == STATUS_DIPOSTING)

    def pastikan_terbuka(self, tanggal: Optional[date], aksi: str) -> None:
        """Tolak (409) bila `tanggal` berada di bulan yang sudah diposting."""
        if self.is_posted(tanggal):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"{aksi}: periode {label_periode(tanggal.year, tanggal.month)} sudah diposting. "
                    "Buka kembali periode (admin) bila memang perlu mengubahnya."
                ),
            )

    # ------------------------------------------------------------------
    # Daftar dan status
    # ------------------------------------------------------------------
    def _to_dict(self, tahun: int, bulan: int, row: Optional[PeriodePosting]) -> Dict[str, Any]:
        return {
            "tahun": tahun,
            "bulan": bulan,
            "label": label_periode(tahun, bulan),
            "status": row.status if row else STATUS_TERBUKA,
            "diposting_pada": row.diposting_pada.isoformat() if row and row.diposting_pada else None,
            "diposting_oleh": row.diposting_oleh if row else None,
            "catatan": row.catatan if row else None,
            "dibuka_pada": row.dibuka_pada.isoformat() if row and row.dibuka_pada else None,
            "dibuka_oleh": row.dibuka_oleh if row else None,
            "alasan_buka": row.alasan_buka if row else None,
            "sudah_berakhir": date(tahun, bulan, calendar.monthrange(tahun, bulan)[1]) < get_jakarta_date(),
        }

    def daftar(self, tahun: int) -> List[Dict[str, Any]]:
        rows = {
            r.bulan: r
            for r in self.db.query(PeriodePosting).filter(PeriodePosting.tahun == tahun).all()
        }
        return [self._to_dict(tahun, b, rows.get(b)) for b in range(1, 13)]

    def status_tanggal(self, tanggal: date) -> Dict[str, Any]:
        return self._to_dict(tanggal.year, tanggal.month, self._row(tanggal.year, tanggal.month))

    # ------------------------------------------------------------------
    # Posting dan buka kembali
    # ------------------------------------------------------------------
    @staticmethod
    def _pastikan_aktif() -> None:
        from app.config import settings
        if not settings.posting_bulanan_aktif:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fitur posting bulanan sedang nonaktif",
            )

    @staticmethod
    def _validasi_bulan(tahun: int, bulan: int) -> None:
        if not (1 <= bulan <= 12) or not (2000 <= tahun <= 2100):
            raise HTTPException(status_code=422, detail="Tahun atau bulan tidak valid")

    def _catat(self, jenis: str, tahun: int, bulan: int, ringkasan: str,
               sebelum: Dict[str, Any], sesudah: Dict[str, Any], user_id: Optional[int]) -> None:
        self.db.add(
            PerbaikanDataLog(
                jenis=jenis,
                nomor_referensi=f"{tahun}-{bulan:02d}",
                ringkasan=ringkasan[:255],
                sebelum=json.dumps(sebelum, ensure_ascii=False),
                sesudah=json.dumps(sesudah, ensure_ascii=False),
                user_id=user_id,
            )
        )

    def posting(self, tahun: int, bulan: int, user_id: Optional[int], catatan: Optional[str] = None) -> Dict[str, Any]:
        self._pastikan_aktif()
        self._validasi_bulan(tahun, bulan)
        akhir = date(tahun, bulan, calendar.monthrange(tahun, bulan)[1])
        if akhir >= get_jakarta_date():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Periode {label_periode(tahun, bulan)} belum berakhir, belum bisa diposting.",
            )
        row = self._row(tahun, bulan)
        if row and row.status == STATUS_DIPOSTING:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Periode {label_periode(tahun, bulan)} sudah diposting.",
            )
        sebelum = {"status": row.status if row else STATUS_TERBUKA}
        if row is None:
            row = PeriodePosting(tahun=tahun, bulan=bulan)
            self.db.add(row)
        row.status = STATUS_DIPOSTING
        row.diposting_pada = get_jakarta_now().replace(tzinfo=None)
        row.diposting_oleh = user_id
        row.catatan = (catatan or "").strip() or None
        self._catat(
            "POSTING_PERIODE", tahun, bulan,
            f"Posting periode {label_periode(tahun, bulan)}",
            sebelum, {"status": STATUS_DIPOSTING, "catatan": row.catatan}, user_id,
        )
        self.db.commit()
        self.db.refresh(row)
        return self._to_dict(tahun, bulan, row)

    def buka_kembali(self, tahun: int, bulan: int, user_id: Optional[int], alasan: str) -> Dict[str, Any]:
        self._pastikan_aktif()
        self._validasi_bulan(tahun, bulan)
        alasan = (alasan or "").strip()
        if len(alasan) < 5:
            raise HTTPException(status_code=422, detail="Alasan membuka kembali periode wajib diisi (min. 5 karakter)")
        row = self._row(tahun, bulan)
        if not row or row.status != STATUS_DIPOSTING:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Periode {label_periode(tahun, bulan)} tidak dalam keadaan diposting.",
            )
        row.status = STATUS_TERBUKA
        row.dibuka_pada = get_jakarta_now().replace(tzinfo=None)
        row.dibuka_oleh = user_id
        row.alasan_buka = alasan
        self._catat(
            "BUKA_PERIODE", tahun, bulan,
            f"Buka kembali periode {label_periode(tahun, bulan)}: {alasan}",
            {"status": STATUS_DIPOSTING}, {"status": STATUS_TERBUKA, "alasan": alasan}, user_id,
        )
        self.db.commit()
        self.db.refresh(row)
        return self._to_dict(tahun, bulan, row)
