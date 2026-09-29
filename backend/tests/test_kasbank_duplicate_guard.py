"""Guard anti double-input KasBank.

Bug nyata: sync BENGKEL 2026-09-26 19:46:48 meng-insert ulang 37 baris
KasBank yang sudah tercatat (id 426-463), menggeser saldo Kas Tunai Pusat
dan Kas di Bank dari target yang disepakati.

Test ini memastikan create() menolak identitas transaksi yang sudah ada,
tapi tetap mengizinkan baris reversal ([VOID]) yang memang identik.
"""
import os
import sys
from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DATABASE_URL", "mysql+pymysql://root:@localhost/tpm")

from app.database import SessionLocal
from app.schemas.keuangan import KasBankCreate
from app.services.kas_bank_service import KasBankService
from app.utils.constants import KasBankType, KasBankSource, KasBankJenis


@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    yield session
    session.close()


def _make(keterangan="uji guard duplikat", allow_negative=True):
    return KasBankCreate(
        tanggal=date(2026, 9, 28),
        jenis=KasBankJenis.KAS_UTAMA,
        tipe=KasBankType.KELUAR,
        nominal=Decimal("1.00"),
        sumber=KasBankSource.LAINNYA,
        keterangan=keterangan,
        allow_negative=allow_negative,
    )


def test_duplicate_rejected(db):
    """Baris kedua dengan identitas sama harus ditolak HTTP 409."""
    svc = KasBankService(db)
    svc.create(_make(), commit=False)
    db.flush()

    with pytest.raises(HTTPException) as exc:
        svc.create(_make(), commit=False)
    assert exc.value.status_code == 409
    assert "Duplikat" in exc.value.detail

    db.rollback()


def test_reversal_allowed(db):
    """Baris [VOID] sengaja identik -> tidak boleh ditolak guard."""
    svc = KasBankService(db)
    svc.create(_make(keterangan="uji reversal"), commit=False)
    db.flush()

    rev = svc.create(_make(keterangan="[VOID] uji reversal"), commit=False)
    db.flush()
    assert rev.tipe == KasBankType.KELUAR

    db.rollback()
