"""Pencarian riwayat kas/bank di server: cocok di keterangan atau nomor, dan tiap kata harus cocok."""
from decimal import Decimal

import pytest

from app.database import SessionLocal
from app.models.keuangan import KasBank
from app.services.kas_bank_integration import create_kas_entry
from app.services.kas_bank_service import KasBankService
from app.utils.constants import KasBankJenis, KasBankSource, KasBankType, PaymentMethod
from app.utils.helpers import get_jakarta_date

PREFIX = "UJI-CARI-KAS"


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.rollback()
    session.query(KasBank).filter(KasBank.keterangan.like(f"{PREFIX}%")).delete(synchronize_session=False)
    session.commit()
    KasBankService(session).rebuild_balances()
    session.close()


def _catat(db, keterangan, nomor_referensi):
    create_kas_entry(
        db=db, tanggal=get_jakarta_date(), tipe=KasBankType.MASUK, nominal=Decimal("10000"),
        sumber=KasBankSource.MODAL, metode_bayar=PaymentMethod.TUNAI, referensi_id=None,
        nomor_referensi=nomor_referensi, keterangan=keterangan, kas_jenis=KasBankJenis.KAS_UTAMA, commit=True,
    )


def test_cari_cocok_di_keterangan_dan_nomor_referensi(db):
    _catat(db, f"{PREFIX} servis oli canter", f"{PREFIX}-REF-A")
    _catat(db, f"{PREFIX} bayar gaji", f"{PREFIX}-REF-B")

    hasil = KasBankService(db).get_list(search="oli canter", limit=50)
    ket = [r.keterangan for r in hasil["data"] if r.keterangan.startswith(PREFIX)]
    assert ket == [f"{PREFIX} servis oli canter"]

    hasil = KasBankService(db).get_list(search=f"{PREFIX}-REF-B", limit=50)
    ket = [r.keterangan for r in hasil["data"] if r.keterangan.startswith(PREFIX)]
    assert ket == [f"{PREFIX} bayar gaji"]


def test_tanpa_kata_cari_tidak_memfilter(db):
    _catat(db, f"{PREFIX} satu", f"{PREFIX}-REF-C")
    semua = KasBankService(db).get_list(limit=500)
    assert any(r.keterangan == f"{PREFIX} satu" for r in semua["data"])
    kosong = KasBankService(db).get_list(search="   ", limit=500)
    assert kosong["total"] == semua["total"]
