"""Akrual gaji karyawan dari absensi (beban gaji + hutang gaji).

Aturan:
- Absensi HADIR / SETENGAH_HARI bertanggal >= GAJI_AKRUAL_MULAI langsung diakui
  sebagai beban gaji dan hutang gaji (Dr Beban Gaji / Cr Hutang Gaji).
  Nilai harian = gaji_pokok / 6 x faktor (HADIR 1, SETENGAH_HARI 0.5), dibulatkan
  ke Rupiah per baris.
- Slip gaji periode >= GAJI_AKRUAL_MULAI memakai gaji_pokok = jumlah akrual absensi
  periode tersebut. Slip yang dicairkan mengurangi hutang gaji (bukan beban lagi).
- Absensi yang sudah tercakup slip (apa pun statusnya) tidak boleh diubah/dihapus,
  supaya akrual tidak berubah diam-diam setelah slip dibuat.
- Slip periode sebelum cutoff tetap pakai aturan lama (beban saat dicairkan).
"""
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.karyawan import Absensi, Karyawan, SlipGaji
from app.utils.constants import AttendanceStatus, PaymentStatus

# Senin pertama setelah go-live akrual. Absensi/slip sebelum tanggal ini tidak berubah.
GAJI_AKRUAL_MULAI = date(2026, 10, 12)

_FAKTOR_HADIR = {
    AttendanceStatus.HADIR: Decimal("1"),
    AttendanceStatus.SETENGAH_HARI: Decimal("0.5"),
}


def faktor_hadir(status_absensi) -> Decimal:
    return _FAKTOR_HADIR.get(status_absensi, Decimal("0"))


def nilai_harian(gaji_pokok, status_absensi) -> Decimal:
    """Gaji harian per baris absensi, dibulatkan ke Rupiah."""
    faktor = faktor_hadir(status_absensi)
    if faktor == 0:
        return Decimal("0")
    return (Decimal(str(gaji_pokok)) / Decimal("6") * faktor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def _rows_absensi(
    db: Session,
    dari: Optional[date],
    sampai: Optional[date],
    karyawan_id: Optional[int] = None,
):
    """Baris absensi berstatus hadir dalam rentang, mulai dari cutoff akrual."""
    start = GAJI_AKRUAL_MULAI if dari is None or dari < GAJI_AKRUAL_MULAI else dari
    query = (
        db.query(Absensi.status, Karyawan.gaji_pokok, Absensi.karyawan_id, Absensi.tanggal)
        .join(Karyawan, Karyawan.id == Absensi.karyawan_id)
        .filter(
            Absensi.tanggal >= start,
            Absensi.status.in_(list(_FAKTOR_HADIR.keys())),
        )
    )
    if sampai is not None:
        query = query.filter(Absensi.tanggal <= sampai)
    if karyawan_id is not None:
        query = query.filter(Absensi.karyawan_id == karyawan_id)
    return query.all()


def akrual_gaji_periode(
    db: Session,
    dari: Optional[date],
    sampai: Optional[date],
    karyawan_id: Optional[int] = None,
) -> Decimal:
    """Beban gaji yang diakui dari absensi dalam rentang tanggal absensi."""
    rows = _rows_absensi(db, dari, sampai, karyawan_id)
    return sum((nilai_harian(gp, st) for st, gp, _, _ in rows), Decimal("0"))


def hadir_dan_gaji_slip(
    db: Session,
    karyawan_id: int,
    tanggal_mulai: date,
    tanggal_akhir: date,
) -> Tuple[Decimal, Decimal]:
    """Jumlah hadir (0.5 per setengah hari) dan gaji_pokok periode slip dari absensi."""
    rows = _rows_absensi(db, tanggal_mulai, tanggal_akhir, karyawan_id)
    hadir = sum((faktor_hadir(st) for st, _, _, _ in rows), Decimal("0"))
    gaji = sum((nilai_harian(gp, st) for st, gp, _, _ in rows), Decimal("0"))
    return hadir, gaji


def hutang_gaji_asof(db: Session, as_of: date) -> Decimal:
    """Hutang gaji per tanggal: akrual absensi s/d as_of dikurangi gaji_pokok slip
    akrual yang sudah dicairkan s/d as_of."""
    if as_of < GAJI_AKRUAL_MULAI:
        return Decimal("0")
    diakui = akrual_gaji_periode(db, None, as_of)
    dicairkan = (
        db.query(func.coalesce(func.sum(SlipGaji.gaji_pokok), 0))
        .filter(
            SlipGaji.status == PaymentStatus.LUNAS,
            SlipGaji.tanggal_mulai >= GAJI_AKRUAL_MULAI,
            SlipGaji.tanggal_bayar.isnot(None),
            SlipGaji.tanggal_bayar <= as_of,
        )
        .scalar()
    )
    return diakui - Decimal(str(dicairkan or 0))


def pastikan_absensi_belum_di_slip(db: Session, karyawan_id: int, tanggal: date) -> None:
    """Tolak perubahan absensi (>= cutoff) yang tanggalnya sudah tercakup slip gaji."""
    if tanggal < GAJI_AKRUAL_MULAI:
        return
    slip = (
        db.query(SlipGaji.id, SlipGaji.nomor_slip)
        .filter(
            SlipGaji.karyawan_id == karyawan_id,
            SlipGaji.tanggal_mulai <= tanggal,
            SlipGaji.tanggal_akhir >= tanggal,
        )
        .first()
    )
    if slip is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Absensi {tanggal} sudah masuk slip gaji {slip.nomor_slip}. Hapus slip yang belum dicairkan dulu.",
        )
