"""Edit transaksi bengkel harus memperbarui updated_at, termasuk saat hanya part/jasa yang berubah.

Tanpa ini, riwayat dashboard menampilkan tanggal transaksi lama walau transaksinya sudah diedit.
"""
from datetime import date, datetime
from decimal import Decimal

import pytest
from sqlalchemy import text

from app.database import SessionLocal
from app.models.bengkel import TransaksiPenjualanBengkel
from app.schemas.bengkel import DetailServiceCreate, TransaksiBengkelCreate
from app.services.transaksi_bengkel_service import TransaksiBengkelService
from app.utils.constants import PaymentMethod, WorkshopStatus

NAMA = "UJI EDIT UPDATED AT"


@pytest.fixture
def db():
    session = SessionLocal()
    session.info["ids"] = []
    yield session
    session.rollback()
    for tid in session.info["ids"]:
        session.query(TransaksiPenjualanBengkel).filter(TransaksiPenjualanBengkel.id == tid).delete(synchronize_session=False)
    session.query(TransaksiPenjualanBengkel).filter(TransaksiPenjualanBengkel.nama_customer == NAMA).delete(synchronize_session=False)
    session.commit()
    session.close()


def _buat(db, jasa):
    return TransaksiBengkelService(db).create(
        TransaksiBengkelCreate(
            tanggal=date(2026, 10, 15), nama_customer=NAMA, kategori="umum",
            detail_parts=[], detail_services=[DetailServiceCreate(nama_jasa=j, harga=Decimal("50000"), qty=1) for j in jasa],
            status_pengerjaan=WorkshopStatus.ANTRE, metode_bayar=PaymentMethod.TUNAI, jumlah_bayar=Decimal("0"),
        ),
        user_id=None,
    )


def test_edit_jasa_saja_memperbarui_updated_at(db):
    tx = _buat(db, ["Ganti oli"])
    db.info["ids"].append(tx.id)
    # Mundurkan updated_at supaya perubahan terlihat jelas
    db.execute(text("UPDATE transaksi_penjualan_bengkel SET updated_at='2020-01-01 00:00:00' WHERE id=:i"), {"i": tx.id})
    db.commit()
    db.expire_all()

    TransaksiBengkelService(db).update(
        tx.id,
        TransaksiBengkelCreate(
            tanggal=date(2026, 10, 15), nama_customer=NAMA, kategori="umum",
            detail_parts=[], detail_services=[DetailServiceCreate(nama_jasa="Ganti oli", harga=Decimal("50000"), qty=1),
                                              DetailServiceCreate(nama_jasa="Cek rem", harga=Decimal("30000"), qty=1)],
            status_pengerjaan=WorkshopStatus.ANTRE, metode_bayar=PaymentMethod.TUNAI, jumlah_bayar=Decimal("0"),
        ),
        user_id=None,
    )
    db.expire_all()
    baru = db.query(TransaksiPenjualanBengkel).filter(TransaksiPenjualanBengkel.id == tx.id).one()
    assert baru.updated_at > datetime(2020, 1, 1)
    assert baru.tanggal == date(2026, 10, 15)
