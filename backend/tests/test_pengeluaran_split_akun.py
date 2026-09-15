"""
Regresi: cabang SPLIT di PengeluaranService harus memakai `kas_jenis` per baris.

Bug asal: `create_kas_entry(..., kas_jenis=data.kas_jenis)` — akun level transaksi
selalu dipakai, `PaymentItem.kas_jenis` diabaikan. Akibatnya pilihan akun per baris
hilang dan jatuh ke default policy (mis. dompet unit bengkel -> KAS_UTAMA).
"""
from datetime import date
from decimal import Decimal

import pytest

from app.database import SessionLocal
from app.schemas.bengkel import PaymentItem, PengeluaranBengkelCreate
from app.services.kas_bank_integration import get_kas_jenis
from app.utils.constants import KasBankJenis, KasBankSource, PaymentMethod


@pytest.fixture
def tangkap_kas_entry(monkeypatch):
    """Ganti create_kas_entry supaya argumennya bisa diperiksa tanpa menulis DB."""
    captured = []

    def _fake(**kw):
        captured.append(kw)

        class _Result:
            id = 0

        return _Result()

    import app.services.pengeluaran_service as mod

    monkeypatch.setattr(mod, "create_kas_entry", _fake)
    return captured


def _buat(db, payments, jumlah, kas_jenis=None):
    data = PengeluaranBengkelCreate(
        tanggal=date(2026, 9, 16),
        bisnis_kategori="bengkel",
        kategori="BIAYA_OPERASIONAL",
        deskripsi="VERIFY split akun per baris",
        jumlah=jumlah,
        metode_bayar=PaymentMethod.SPLIT,
        kas_jenis=kas_jenis,
        payments=payments,
    )
    from app.services.pengeluaran_service import PengeluaranService

    PengeluaranService(db).create(data)


def test_akun_per_baris_dipakai(tangkap_kas_entry):
    db = SessionLocal()
    try:
        _buat(
            db,
            [
                PaymentItem(
                    metode=PaymentMethod.TUNAI,
                    jumlah=Decimal("500000"),
                    kas_jenis=KasBankJenis.KAS_UTAMA,
                ),
                PaymentItem(
                    metode=PaymentMethod.TRANSFER,
                    jumlah=Decimal("1000000"),
                    kas_jenis=KasBankJenis.BANK_UTAMA,
                ),
            ],
            Decimal("1500000"),
        )
        assert [k["kas_jenis"] for k in tangkap_kas_entry] == [
            KasBankJenis.KAS_UTAMA,
            KasBankJenis.BANK_UTAMA,
        ]
    finally:
        db.rollback()
        db.close()


def test_akun_unit_menang_atas_default_policy(tangkap_kas_entry):
    """Kasus pembeda: kode lama selalu jatuh ke KAS_UTAMA, mengabaikan pilihan user."""
    db = SessionLocal()
    try:
        _buat(
            db,
            [
                PaymentItem(
                    metode=PaymentMethod.TUNAI,
                    jumlah=Decimal("200000"),
                    kas_jenis=KasBankJenis.KAS_UNIT_BENGKEL,
                )
            ],
            Decimal("200000"),
        )
        dipakai = tangkap_kas_entry[0]["kas_jenis"]
        default = get_kas_jenis(PaymentMethod.TUNAI, KasBankSource.PENGELUARAN)

        assert dipakai == KasBankJenis.KAS_UNIT_BENGKEL
        assert dipakai != default  # kalau sama, test ini tidak membuktikan apa-apa
    finally:
        db.rollback()
        db.close()


def test_fallback_ke_akun_level_transaksi(tangkap_kas_entry):
    """Baris tanpa kas_jenis tetap memakai akun level transaksi."""
    db = SessionLocal()
    try:
        _buat(
            db,
            [
                PaymentItem(
                    metode=PaymentMethod.TRANSFER,
                    jumlah=Decimal("300000"),
                    kas_jenis=None,
                )
            ],
            Decimal("300000"),
            kas_jenis=KasBankJenis.BANK_UTAMA,
        )
        assert tangkap_kas_entry[0]["kas_jenis"] == KasBankJenis.BANK_UTAMA
    finally:
        db.rollback()
        db.close()
