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


def test_kaki_masuk_gagal_membatalkan_kaki_keluar(db, monkeypatch):
    """Transfer harus atomik: kaki keluar tidak boleh tertinggal jika kaki masuk gagal."""
    from fastapi import HTTPException

    service = KasBankService(db)
    asli = service.create
    panggilan = {"n": 0}

    def gagal_di_kaki_kedua(data, *args, **kwargs):
        panggilan["n"] += 1
        if panggilan["n"] == 2:
            raise HTTPException(status_code=500, detail="simulasi gagal")
        return asli(data, *args, **kwargs)

    monkeypatch.setattr(service, "create", gagal_di_kaki_kedua)
    with pytest.raises(HTTPException):
        service.transfer(
            dari=KasBankJenis.KAS_UNIT_BENGKEL, ke=KasBankJenis.BANK_BCA,
            nominal=Decimal("777000"), tanggal=date.today(),
            keterangan=f"ATOMIK {MARKER}", user_id=None, allow_negative=True,
        )
    db.rollback()
    sisa = db.query(KasBank).filter(KasBank.keterangan.like(f"%ATOMIK {MARKER}%")).all()
    assert sisa == []


def test_transfer_normal_menyimpan_dua_kaki_dengan_grup_sama(db):
    KasBankService(db).transfer(
        dari=KasBankJenis.KAS_UNIT_BENGKEL, ke=KasBankJenis.BANK_BCA,
        nominal=Decimal("888000"), tanggal=date.today(),
        keterangan=f"GRUP {MARKER}", user_id=None, allow_negative=True,
    )
    kaki = db.query(KasBank).filter(KasBank.keterangan.like(f"%GRUP {MARKER}%")).all()
    assert len(kaki) == 2
    assert len({k.nomor_referensi for k in kaki}) == 1
    assert kaki[0].nomor_referensi.startswith("TRF-")
