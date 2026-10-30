"""Transfer antar akun dengan nominal, tanggal, dan keterangan yang sama harus tetap bisa diinput.
Guard duplikat hanya berlaku untuk transaksi biasa, bukan kaki transfer.
"""
from datetime import date
from decimal import Decimal

import pytest

from app.database import SessionLocal
from app.models.keuangan import KasBank
from app.services.kas_bank_service import KasBankService
from app.utils.constants import KasBankJenis

MARKER = "UJI-TRF-DUP"


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.rollback()
    session.query(KasBank).filter(KasBank.keterangan.like(f"%{MARKER}%")).delete(synchronize_session=False)
    session.commit()
    session.close()


def test_transfer_kedua_dengan_nominal_dan_tanggal_sama_tetap_bisa(db):
    service = KasBankService(db)
    args = dict(
        dari=KasBankJenis.KAS_UNIT_BENGKEL,
        ke=KasBankJenis.BANK_BCA,
        nominal=Decimal("1000000"),
        tanggal=date.today(),
        keterangan=f"TUKER TF {MARKER}",
        user_id=None,
        allow_negative=True,
    )
    service.transfer(**args)
    service.transfer(**args)
    kaki = db.query(KasBank).filter(KasBank.keterangan.like(f"%{MARKER}%")).all()
    assert len(kaki) == 4
    assert len({k.nomor_referensi for k in kaki}) == 2
