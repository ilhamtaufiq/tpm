"""Riwayat (feed dashboard) menampilkan waktu edit terbaru transaksi bengkel, bukan waktu buat/tanggal nota.

Skenario: transaksi bertanggal lama dibuat, lalu diedit. Item di feed harus memakai waktu edit.
"""
from datetime import date, datetime, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models.bengkel import SparePart, TransaksiPenjualanBengkel
from app.schemas.bengkel import DetailPartCreate, TransaksiBengkelCreate
from app.services.transaksi_bengkel_service import TransaksiBengkelService
from app.utils.constants import PaymentMethod, WorkshopStatus


def _token(client):
    res = client.post("/api/v1/auth/login/json", json={"username": "god", "password": "password123"})
    if res.status_code != 200:
        import pytest
        pytest.skip("akun uji tidak tersedia")
    return res.json()["access_token"]


def test_feed_riwayat_memakai_waktu_edit_terbaru():
    db = SessionLocal()
    client = TestClient(app)
    transaksi_id = None
    try:
        sp = db.query(SparePart).filter(SparePart.deleted_at.is_(None), SparePart.stok > 5).first()
        if sp is None:
            import pytest
            pytest.skip("tidak ada sparepart stok cukup")
        service = TransaksiBengkelService(db)
        t = service.create(
            TransaksiBengkelCreate(
                tanggal=date.today() - timedelta(days=30),
                kategori="umum",
                jenis_kendaraan="UJI RIWAYAT",
                nomor_plat="UJI-RIWAYAT",
                detail_parts=[DetailPartCreate(spare_part_id=sp.id, qty=1, harga_jual=Decimal("10000"))],
                detail_services=[],
                status_pengerjaan=WorkshopStatus.SELESAI,
                metode_bayar=PaymentMethod.TUNAI,
                jumlah_bayar=Decimal("10000"),
            ),
            user_id=None,
        )
        transaksi_id = t.id
        # Waktu buat dimundurkan 30 hari, seperti nota lama yang kemudian diedit.
        row = db.get(TransaksiPenjualanBengkel, transaksi_id)
        row.created_at = datetime.now() - timedelta(days=30)
        row.updated_at = datetime.now() - timedelta(days=30)
        db.commit()

        service.update(
            transaksi_id,
            TransaksiBengkelCreate(
                tanggal=date.today() - timedelta(days=30),
                kategori="umum",
                jenis_kendaraan="UJI RIWAYAT",
                nomor_plat="UJI-RIWAYAT",
                detail_parts=[DetailPartCreate(spare_part_id=sp.id, qty=2, harga_jual=Decimal("10000"))],
                detail_services=[],
                status_pengerjaan=WorkshopStatus.SELESAI,
                metode_bayar=PaymentMethod.TUNAI,
                jumlah_bayar=Decimal("20000"),
            ),
            user_id=None,
        )
        db.expire_all()
        edit = db.get(TransaksiPenjualanBengkel, transaksi_id).updated_at
        assert edit is not None and edit > datetime.now() - timedelta(minutes=5)

        res = client.get(
            "/api/v1/dashboard/recent-activity?limit=100",
            headers={"Authorization": f"Bearer {_token(client)}"},
        )
        assert res.status_code == 200
        item = next((i for i in res.json() if i["id"] == f"bengkel_{transaksi_id}"), None)
        assert item is not None, "transaksi yang diedit tidak ada di riwayat"
        ts = datetime.fromisoformat(item["timestamp"])
        assert abs((ts - edit.replace(tzinfo=None)).total_seconds()) < 60, (item["timestamp"], edit)
    finally:
        if transaksi_id:
            try:
                service.void_transaction(transaksi_id, "Bersihkan uji riwayat")
            except Exception:
                pass
            row = db.get(TransaksiPenjualanBengkel, transaksi_id)
            if row is not None:
                db.delete(row)
                db.commit()
        db.close()
