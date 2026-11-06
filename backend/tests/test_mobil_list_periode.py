"""Daftar mobil: Terbooking tampil walau tanggal masuk di luar periode (sama dengan hitungan chip).
Unit Terjual difilter menurut tanggal jual, bukan tanggal masuk."""
import secrets
from datetime import date
from decimal import Decimal

import pytest

from app.database import SessionLocal
from app.models.mobil import Mobil
from app.services.mobil_service import MobilService
from app.utils.constants import CarStatus, OwnershipType, PaymentStatus, PaymentMethod

PREFIX = "UJI-PER-"


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.rollback()
    session.query(Mobil).filter(Mobil.kode.like(f"{PREFIX}%")).delete(synchronize_session=False)
    session.commit()
    session.close()


def _mobil(db, kode, status, masuk, terjual=None):
    m = Mobil(
        kode=kode, public_gallery_token=secrets.token_urlsafe(24), merek="UJI", model="Periode", tahun=2020,
        warna="Hitam", nomor_plat=kode, harga_beli=Decimal("100000000"), status=status,
        status_bayar_beli=PaymentStatus.LUNAS, metode_bayar_beli=PaymentMethod.TUNAI,
        tipe_kepemilikan=OwnershipType.TPM, tanggal_masuk=masuk, tanggal_terjual=terjual,
    )
    db.add(m)
    db.commit()
    return m


def _kode(hasil):
    return {(m.kode if hasattr(m, "kode") else m["kode"]) for m in hasil["data"]}


def test_terbooking_tampil_tanpa_periode(db):
    """Frontend tidak mengirim periode untuk Terbooking, supaya daftar sama dengan chip."""
    _mobil(db, f"{PREFIX}BK", CarStatus.BOOKING, date(2026, 9, 1))
    hasil = MobilService(db).get_list(status=CarStatus.BOOKING)
    assert f"{PREFIX}BK" in _kode(hasil)


def test_terjual_difilter_menurut_tanggal_jual(db):
    _mobil(db, f"{PREFIX}JL", CarStatus.TERJUAL, date(2026, 9, 1), terjual=date(2026, 11, 5))
    _mobil(db, f"{PREFIX}LM", CarStatus.TERJUAL, date(2026, 9, 1), terjual=date(2026, 9, 20))
    hasil = MobilService(db).get_list(status=CarStatus.TERJUAL, tanggal_dari=date(2026, 11, 1), tanggal_sampai=date(2026, 11, 6))
    kode = _kode(hasil)
    assert f"{PREFIX}JL" in kode
    assert f"{PREFIX}LM" not in kode
