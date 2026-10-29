"""Slip gaji boleh dibuat untuk periode yang lintas minggu (mis. gajian hari Kamis).
Periode Kamis s/d Rabu melewati dua minggu ISO; karyawan tetap harus muncul di preview
dan slipnya harus tersimpan.
"""
import uuid
from datetime import date
from decimal import Decimal

import pytest

from app.database import SessionLocal
from app.models.karyawan import Karyawan, SlipGaji
from app.services.slip_gaji_service import SlipGajiService
from app.utils.constants import EmployeeStatus

# Kamis 23 Juli 2026 s/d Rabu 29 Juli 2026: Kamis-Sabtu minggu 30, Senin-Rabu minggu 31.
MULAI = date(2026, 7, 23)
AKHIR = date(2026, 7, 29)


@pytest.fixture
def karyawan_ids():
    db = SessionLocal()
    ids = []
    try:
        for i in range(2):
            k = Karyawan(kode=f"TST-LM-{uuid.uuid4().hex[:6]}", nama=f"Lintas Minggu {i}", jabatan="UJI",
                         tanggal_bergabung=date(2026, 1, 1), gaji_pokok=Decimal("300000"),
                         status=EmployeeStatus.AKTIF)
            db.add(k)
            db.commit()
            ids.append(k.id)
        yield ids
    finally:
        db.rollback()
        db.query(SlipGaji).filter(SlipGaji.karyawan_id.in_(ids)).delete(synchronize_session=False)
        db.query(Karyawan).filter(Karyawan.id.in_(ids)).delete(synchronize_session=False)
        db.commit()
        db.close()


def test_preview_range_lintas_minggu_memunculkan_karyawan(karyawan_ids):
    db = SessionLocal()
    try:
        preview = SlipGajiService(db).get_preview_by_range(MULAI, AKHIR)
        ids_preview = {item["karyawan_id"] for item in preview["items"]}
        assert set(karyawan_ids) <= ids_preview
    finally:
        db.rollback()
        db.close()


def test_bulk_range_lintas_minggu_membuat_slip(karyawan_ids):
    db = SessionLocal()
    try:
        items = [{"karyawan_id": kid, "jumlah_hadir": 0, "potongan_kasbon": 0, "uang_lembur": 0} for kid in karyawan_ids]
        result = SlipGajiService(db).create_bulk_by_range(MULAI, AKHIR, 30, 2026, items, None)
        assert result["created"] == len(karyawan_ids), result
    finally:
        db.rollback()
        db.close()
