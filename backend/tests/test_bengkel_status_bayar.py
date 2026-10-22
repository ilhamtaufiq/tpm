"""Pembayaran Rp0 tidak boleh menandai transaksi bengkel LUNAS.

Kasus: tiket tagihan Rp0 atau tagihan Rp100.000 yang dikirim dengan pembayaran Rp0.
"""
from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.database import SessionLocal
from app.models.bengkel import TransaksiPenjualanBengkel
from app.schemas.bengkel import DetailServiceCreate, TransaksiBengkelCreate
from app.services.transaksi_bengkel_service import TransaksiBengkelService
from app.utils.constants import PaymentMethod, PaymentStatus, WorkshopStatus


def _buat(db, harga: Decimal):
    tx = TransaksiBengkelService(db).create(
        TransaksiBengkelCreate(
            tanggal=date.today(),
            kategori="umum",
            detail_parts=[],
            detail_services=[DetailServiceCreate(nama_jasa="Uji status bayar", harga=harga, qty=1)],
            status_pengerjaan=WorkshopStatus.ANTRE,
            metode_bayar=PaymentMethod.TUNAI,
            jumlah_bayar=Decimal("0"),
        ),
        user_id=None,
    )
    db.info["ids"].append(tx.id)  # create() meng-commit; catat untuk dibersihkan
    return tx


@pytest.fixture
def db():
    session = SessionLocal()
    session.info["ids"] = []
    yield session
    session.rollback()
    for tid in session.info["ids"]:
        session.query(TransaksiPenjualanBengkel).filter(TransaksiPenjualanBengkel.id == tid).delete(synchronize_session=False)
    session.commit()
    session.close()


def test_tagihan_nol_dengan_bayar_nol_tidak_lunas(db):
    tx = _buat(db, Decimal("0"))
    with pytest.raises(HTTPException) as salah:
        TransaksiBengkelService(db).update_payment(tx.id, Decimal("0"), PaymentMethod.TUNAI, user_id=None)
    assert salah.value.status_code == 400
    db.rollback()
    db.refresh(tx)
    assert tx.status_bayar == PaymentStatus.BELUM_LUNAS


def test_tagihan_ada_dengan_bayar_nol_tetap_belum_lunas(db):
    tx = _buat(db, Decimal("100000"))
    with pytest.raises(HTTPException) as salah:
        TransaksiBengkelService(db).update_payment(tx.id, Decimal("0"), PaymentMethod.TUNAI, user_id=None)
    assert salah.value.status_code == 400
    db.rollback()
    db.refresh(tx)
    assert tx.status_bayar == PaymentStatus.BELUM_LUNAS
