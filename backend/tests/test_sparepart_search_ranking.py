"""
Pencarian sparepart: hasil yang awalannya cocok tampil lebih dulu, dan pencarian
tidak peka huruf besar/kecil. Data test memakai kode unik dan dihapus di akhir.
"""
import uuid
from decimal import Decimal

from app.database import SessionLocal
from app.models.bengkel import SparePart
from app.services.spare_part_service import SparePartService


def _part(db, nama):
    sp = SparePart(
        kode=f"TST-RNK-{uuid.uuid4().hex[:8]}",
        nama=nama,
        satuan="pcs",
        stok=Decimal("5"),
        stok_minimum=1,
        harga_beli=Decimal("1000"),
        harga_jual=Decimal("2000"),
    )
    db.add(sp)
    db.flush()
    return sp


def test_awalan_cocok_tampil_di_atas_dan_case_insensitive():
    db = SessionLocal()
    dibuat = []
    try:
        dibuat = [
            _part(db, "Kampas Rem Depan"),      # cocok di awal kata kedua
            _part(db, "Rem Cakram Belakang"),   # cocok di awal nama
            _part(db, "Sabuk Trem Kecil"),      # cocok di tengah kata
            _part(db, "REM Tromol"),            # huruf kapital, awal nama
        ]
        db.commit()
        ids = [p.id for p in dibuat]
        service = SparePartService(db)

        for q in ("rem", "REM", "Rem"):
            hasil = [p.id for p in service.search_for_transaction(q, limit=50) if p.id in ids]
            assert hasil[:2] == [dibuat[1].id, dibuat[3].id] or hasil[:2] == [dibuat[3].id, dibuat[1].id], q
            assert hasil.index(dibuat[0].id) < hasil.index(dibuat[2].id), q
            assert set(hasil) == set(ids), q

        # Pencarian daftar (master data / pembelian) memakai aturan yang sama.
        daftar = service.get_list(limit=500, search="rem")["data"]
        urut = [p.id for p in daftar if p.id in ids]
        assert set(urut[:2]) == {dibuat[1].id, dibuat[3].id}
        assert urut.index(dibuat[0].id) < urut.index(dibuat[2].id)
    finally:
        db.rollback()
        for p in dibuat:
            db.query(SparePart).filter(SparePart.id == p.id).delete(synchronize_session=False)
        db.commit()
        db.close()
