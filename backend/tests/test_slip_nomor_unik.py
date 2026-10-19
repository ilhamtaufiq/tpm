"""
Bulk pembuatan slip dalam satu batch harus memberi nomor unik per slip.
Dulu semua slip satu batch mendapat nomor yang sama, sehingga commit gagal
dan tidak ada slip yang tersimpan.
"""
import uuid
from datetime import date
from decimal import Decimal

import pytest

from app.database import SessionLocal
from app.models.karyawan import Absensi, Karyawan, SlipGaji
from app.services.slip_gaji_service import SlipGajiService
from app.utils.constants import EmployeeStatus


@pytest.fixture
def karyawan_ids():
    db = SessionLocal()
    ids = []
    try:
        for i in range(3):
            k = Karyawan(kode=f"TST-SLP-{uuid.uuid4().hex[:6]}", nama=f"Slip Test {i}", jabatan="UJI",
                         tanggal_bergabung=date(2026, 1, 1), gaji_pokok=Decimal("300000"),
                         status=EmployeeStatus.AKTIF)
            db.add(k)
            db.commit()
            ids.append(k.id)
        yield ids
    finally:
        db.rollback()
        db.query(SlipGaji).filter(SlipGaji.karyawan_id.in_(ids)).delete(synchronize_session=False)
        db.query(Absensi).filter(Absensi.karyawan_id.in_(ids)).delete(synchronize_session=False)
        db.query(Karyawan).filter(Karyawan.id.in_(ids)).delete(synchronize_session=False)
        db.commit()
        db.close()


def test_bulk_range_memberi_nomor_slip_unik(karyawan_ids):
    db = SessionLocal()
    try:
        # Periode lampau (sebelum cutoff akrual) agar tidak bergantung pada tanggal hari ini.
        mulai, akhir = date(2026, 7, 20), date(2026, 7, 25)
        items = [{"karyawan_id": kid, "jumlah_hadir": 0, "potongan_kasbon": 0, "uang_lembur": 0} for kid in karyawan_ids]
        result = SlipGajiService(db).create_bulk_by_range(mulai, akhir, 30, 2026, items, None)
        assert result["created"] == len(karyawan_ids)

        db.expire_all()
        nomor = [s.nomor_slip for s in db.query(SlipGaji).filter(SlipGaji.karyawan_id.in_(karyawan_ids)).all()]
        assert len(nomor) == len(karyawan_ids)
        assert len(set(nomor)) == len(nomor), f"nomor slip duplikat: {nomor}"
    finally:
        db.rollback()
        db.close()
