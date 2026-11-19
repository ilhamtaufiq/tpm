"""Laporan diskon bengkel: statistik dan daftar transaksi yang memakai diskon."""
from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models.bengkel import SparePart, TransaksiPenjualanBengkel
from app.schemas.bengkel import DetailPartCreate, TransaksiBengkelCreate
from app.services.transaksi_bengkel_service import TransaksiBengkelService
from app.utils.constants import PaymentMethod, WorkshopStatus

PLAT = "UJI-DISKON"


def test_laporan_diskon_memuat_transaksi_berdiskon_dan_statistik():
    db = SessionLocal()
    service = TransaksiBengkelService(db)
    transaksi_id = None
    try:
        sp = db.query(SparePart).filter(SparePart.deleted_at.is_(None), SparePart.stok > 5).first()
        if sp is None:
            pytest.skip("tidak ada sparepart stok cukup")
        t = service.create(
            TransaksiBengkelCreate(
                tanggal=date.today(),
                kategori="umum",
                jenis_kendaraan="UJI DISKON",
                nomor_plat=PLAT,
                detail_parts=[DetailPartCreate(spare_part_id=sp.id, qty=2, harga_jual=Decimal("100000"))],
                detail_services=[],
                diskon=Decimal("20000"),
                status_pengerjaan=WorkshopStatus.SELESAI,
                metode_bayar=PaymentMethod.TUNAI,
                jumlah_bayar=Decimal("180000"),
            ),
            user_id=None,
        )
        transaksi_id = t.id
        hasil = service.laporan_diskon(tanggal_dari=date.today(), tanggal_sampai=date.today())
        baris = next((r for r in hasil["rows"] if r["id"] == transaksi_id), None)
        assert baris is not None
        assert baris["diskon"] == 20000
        assert baris["subtotal"] == 200000
        assert baris["persen"] == 10.0
        assert hasil["summary"]["total_diskon"] >= 20000
        assert any(k["kategori"] == "umum" for k in hasil["per_kategori"])

        # Tanggal di luar rentang tidak ikut
        lewat = service.laporan_diskon(tanggal_dari=date.today() - timedelta(days=400), tanggal_sampai=date.today() - timedelta(days=399))
        assert all(r["id"] != transaksi_id for r in lewat["rows"])

        # Endpoint (butuh login) terdaftar
        client = TestClient(app)
        assert client.get("/api/v1/transaksi-bengkel/diskon").status_code in (401, 403)
    finally:
        if transaksi_id:
            try:
                service.void_transaction(transaksi_id, "Bersihkan uji laporan diskon")
            except Exception:
                pass
            row = db.get(TransaksiPenjualanBengkel, transaksi_id)
            if row is not None:
                db.delete(row)
                db.commit()
        db.close()
