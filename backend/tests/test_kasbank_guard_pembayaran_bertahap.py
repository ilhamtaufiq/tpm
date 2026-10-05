"""Regresi guard anti-duplikat KasBank untuk pembayaran bertahap di hari yang sama.

DP lalu pelunasan mobil (dan cicilan lain) berbagi nomor_referensi + referensi_id
+ tanggal. Dulu pelunasan ditolak 409 "Duplikat" walau nominalnya berbeda.
Input ulang yang benar-benar identik tetap harus ditolak.
"""
from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.database.connection import SessionLocal
from app.schemas.keuangan import KasBankCreate
from app.services.kas_bank_service import KasBankService
from app.utils.constants import KasBankJenis, KasBankSource, KasBankType, PaymentMethod

HARI = date(2000, 1, 2)  # lampau: tanggal masa depan kini ditolak


def _data(nominal, ket):
    return KasBankCreate(
        tanggal=HARI, jenis=KasBankJenis.BANK_UTAMA, tipe=KasBankType.MASUK,
        nominal=Decimal(nominal), sumber=KasBankSource.JUAL_BELI_MOBIL,
        metode_bayar=PaymentMethod.TRANSFER, referensi_id=999999,
        nomor_referensi="TEST-JBM-GUARD", keterangan=ket,
    )


def test_dp_dan_pelunasan_hari_sama_diizinkan_duplikat_identik_ditolak():
    db = SessionLocal()
    try:
        svc = KasBankService(db)
        svc.create(_data("10000000", "DP mobil uji"), commit=False)
        svc.create(_data("60000000", "Lunas mobil uji"), commit=False)
        with pytest.raises(HTTPException) as e:
            svc.create(_data("60000000", "Lunas mobil uji"), commit=False)
        assert e.value.status_code == 409
    finally:
        db.rollback()
        db.close()
