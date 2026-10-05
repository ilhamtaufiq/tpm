"""Regresi: transaksi bertanggal besok ditolak.

Kasus 5 Okt 2026: perangkat kasir mengirim tanggal 06-10 sejak ±15:00. Kas/bank
bertanggal besok tidak terhitung di Neraca hari ini, sehingga saldo sistem
diam-diam beda dengan saldo real. Sekarang input bertanggal > hari ini (WIB)
ditolak di schema (422) dan di KasBankService (400).
"""
from datetime import timedelta
from decimal import Decimal

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.database.connection import SessionLocal
from app.schemas.bengkel import PengeluaranBengkelCreate, PembelianSparePartCreate
from app.schemas.karyawan import KasbonCreate
from app.schemas.keuangan import (
    HutangCreate,
    KasBankCreate,
    PembayaranHutangCreate,
    PembayaranPiutangCreate,
    PiutangCreate,
)
from app.services.kas_bank_service import KasBankService
from app.utils.constants import KasBankJenis, KasBankSource, KasBankType, PaymentMethod
from app.utils.helpers import get_jakarta_date, pesan_tanggal_masa_depan

SCHEMA_INPUT = [
    PiutangCreate,
    HutangCreate,
    PembayaranPiutangCreate,
    PembayaranHutangCreate,
    PengeluaranBengkelCreate,
    PembelianSparePartCreate,
    KasbonCreate,
]


def _error_tanggal(schema, tanggal):
    """Error validasi pada field `tanggal` saja (field lain sengaja kosong)."""
    try:
        schema(tanggal=tanggal)
    except ValidationError as e:
        return [err for err in e.errors() if err["loc"] == ("tanggal",)]
    return []


@pytest.mark.parametrize("schema", SCHEMA_INPUT, ids=lambda s: s.__name__)
def test_schema_input_tolak_tanggal_besok(schema):
    besok = get_jakarta_date() + timedelta(days=1)
    errors = _error_tanggal(schema, besok)
    assert errors and "melewati hari ini" in errors[0]["msg"]


@pytest.mark.parametrize("schema", SCHEMA_INPUT, ids=lambda s: s.__name__)
def test_schema_input_terima_hari_ini_dan_backdate(schema):
    hari_ini = get_jakarta_date()
    assert _error_tanggal(schema, hari_ini) == []
    assert _error_tanggal(schema, hari_ini - timedelta(days=30)) == []


def test_helper_pesan_hanya_untuk_masa_depan():
    hari_ini = get_jakarta_date()
    assert pesan_tanggal_masa_depan(hari_ini) is None
    assert pesan_tanggal_masa_depan(hari_ini - timedelta(days=1)) is None
    assert pesan_tanggal_masa_depan(hari_ini + timedelta(days=1))


def _kas(tanggal):
    return KasBankCreate(
        tanggal=tanggal, jenis=KasBankJenis.KAS_UTAMA, tipe=KasBankType.MASUK,
        nominal=Decimal("1000"), sumber=KasBankSource.LAINNYA,
        metode_bayar=PaymentMethod.TUNAI, keterangan="Uji tanggal masa depan",
    )


def test_kas_service_tolak_tanggal_besok():
    db = SessionLocal()
    besok = get_jakarta_date() + timedelta(days=1)
    try:
        svc = KasBankService(db)
        with pytest.raises(HTTPException) as e:
            svc.create(_kas(besok), commit=False)
        assert e.value.status_code == 400

        # Transfer & penyesuaian saldo lewat create() -> ikut tertolak.
        with pytest.raises(HTTPException) as e:
            svc.transfer(
                KasBankJenis.BANK_UTAMA, KasBankJenis.KAS_UTAMA, Decimal("1000"),
                besok, "Uji transfer besok", user_id=None, allow_negative=True,
            )
        assert e.value.status_code == 400

        # Hari ini tetap boleh.
        svc.create(_kas(get_jakarta_date()), commit=False)
    finally:
        db.rollback()
        db.close()
