"""Skrip rapikan nama piutang/hutang lama: akhiran unit untuk transaksi unit, bukan piutang pribadi."""
import importlib.util
import os
from datetime import date
from decimal import Decimal

import pytest

from app.database import SessionLocal
from app.models.keuangan import HutangUsaha, PiutangUsaha
from app.utils.constants import HutangSource, HutangStatus, PiutangSource, PiutangStatus

PREFIX = "UJI-RENAME-"
SKRIP = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "rename_piutang_hutang_lama.py")


def _muat_skrip():
    spec = importlib.util.spec_from_file_location("rename_lama", SKRIP)
    modul = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modul)
    return modul


def _piutang(db, nomor, nama, sumber, status=PiutangStatus.BELUM_LUNAS, internal=False):
    p = PiutangUsaha(nomor_piutang=PREFIX + nomor, tanggal=date(2026, 10, 1), sumber=sumber, nama_debitur=nama,
                     nominal_piutang=Decimal("100000"), total_dibayar=Decimal("0"), sisa_piutang=Decimal("100000"),
                     status=status, is_internal=internal, nomor_referensi=PREFIX + nomor)
    db.add(p)
    return p


def _hutang(db, nomor, kreditur, sumber):
    h = HutangUsaha(nomor_hutang=PREFIX + nomor, tanggal=date(2026, 10, 1), sumber=sumber, nama_kreditur=kreditur,
                    nominal_hutang=Decimal("100000"), total_dibayar=Decimal("0"), sisa_hutang=Decimal("100000"),
                    status=HutangStatus.BELUM_LUNAS, is_internal=True, nomor_referensi=PREFIX + nomor)
    db.add(h)
    return h


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.rollback()
    session.query(PiutangUsaha).filter(PiutangUsaha.nomor_piutang.like(PREFIX + "%")).delete(synchronize_session=False)
    session.query(HutangUsaha).filter(HutangUsaha.nomor_hutang.like(PREFIX + "%")).delete(synchronize_session=False)
    session.commit()
    session.close()


def test_rename_sesuai_aturan_dan_idempoten(db):
    skrip = _muat_skrip()
    _piutang(db, "P1", "Pak Heri", PiutangSource.BENGKEL)
    _piutang(db, "P2", "Mang Usa", PiutangSource.JASA_ANGKUT)
    _piutang(db, "P3", "JB MOBIL - B 1 UJI", PiutangSource.JUAL_BELI_MOBIL)
    _piutang(db, "P4", "Pinjaman Budi", PiutangSource.LAINNYA)
    _piutang(db, "P5", "Batal Dulu", PiutangSource.BENGKEL, status=PiutangStatus.BATAL)
    _piutang(db, "P6", "Sudah Bertag - Bengkel", PiutangSource.BENGKEL)
    _hutang(db, "H1", "BENGKEL TPM", HutangSource.JUAL_BELI_MOBIL)
    _hutang(db, "H2", "BENGKEL TPM", HutangSource.LAINNYA)
    db.commit()

    rencana = {p.nomor_piutang: baru for p, baru in skrip.rencana_piutang(db) if p.nomor_piutang.startswith(PREFIX)}
    assert rencana[PREFIX + "P1"] == "Pak Heri - Bengkel"
    assert rencana[PREFIX + "P2"] == "Mang Usa - Jasa Angkut"
    assert PREFIX + "P3" not in rencana
    assert PREFIX + "P4" not in rencana
    assert PREFIX + "P5" not in rencana
    assert PREFIX + "P6" not in rencana

    hutang = {h.nomor_hutang: baru for h, baru in skrip.rencana_hutang(db) if h.nomor_hutang.startswith(PREFIX)}
    assert hutang == {PREFIX + "H1": "BENGKEL TPM - Jual Beli Mobil", PREFIX + "H2": "BENGKEL TPM - Jasa Angkut"}

    # Terapkan seperti --apply, lalu jalankan lagi: tidak boleh ada yang berubah lagi
    for p, baru in skrip.rencana_piutang(db):
        p.nama_debitur = baru
    for h, baru in skrip.rencana_hutang(db):
        h.nama_kreditur = baru
    db.commit()
    assert [p for p, _ in skrip.rencana_piutang(db) if p.nomor_piutang.startswith(PREFIX)] == []
    assert [h for h, _ in skrip.rencana_hutang(db) if h.nomor_hutang.startswith(PREFIX)] == []
