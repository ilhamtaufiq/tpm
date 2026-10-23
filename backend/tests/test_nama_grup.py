"""Piutang dan hutang dikelompokkan otomatis per nama; pelunasan per nama tertua dulu."""
from datetime import timedelta
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.database import SessionLocal
from app.models.keuangan import HutangUsaha, KasBank, PembayaranHutang, PembayaranPiutang, PiutangUsaha
from app.services.kas_bank_integration import create_kas_entry
from app.services.kas_bank_service import KasBankService
from app.services.nama_grup_service import NamaGrupService
from app.utils.constants import HutangSource, HutangStatus, KasBankJenis, KasBankSource, KasBankType, PaymentMethod, PiutangSource, PiutangStatus
from app.utils.helpers import get_jakarta_date

NAMA = "UJI NAMA A"
NOMOR_SALDO = "SALDO-TEST-NAMA"
PREFIX = "PTG-TEST-NAMA"
PREFIX_H = "HTG-TEST-NAMA"


@pytest.fixture
def db():
    session = SessionLocal()
    create_kas_entry(
        db=session, tanggal=get_jakarta_date(), tipe=KasBankType.MASUK, nominal=Decimal("10000000"),
        sumber=KasBankSource.MODAL, metode_bayar=PaymentMethod.TUNAI, referensi_id=None, nomor_referensi=NOMOR_SALDO,
        keterangan="Saldo awal uji nama", kas_jenis=KasBankJenis.KAS_UTAMA, commit=True,
    )
    yield session
    session.rollback()
    ids = [p.id for p in session.query(PiutangUsaha).filter(PiutangUsaha.nomor_piutang.like(f"{PREFIX}%")).all()]
    if ids:
        session.query(PembayaranPiutang).filter(PembayaranPiutang.piutang_id.in_(ids)).delete(synchronize_session=False)
    hids = [h.id for h in session.query(HutangUsaha).filter(HutangUsaha.nomor_hutang.like(f"{PREFIX_H}%")).all()]
    if hids:
        session.query(PembayaranHutang).filter(PembayaranHutang.hutang_id.in_(hids)).delete(synchronize_session=False)
    session.query(KasBank).filter(
        KasBank.nomor_referensi.in_([NOMOR_SALDO])
        | KasBank.nomor_referensi.like(f"{PREFIX}%")
        | KasBank.nomor_referensi.like(f"{PREFIX_H}%")
    ).delete(synchronize_session=False)
    session.query(PiutangUsaha).filter(PiutangUsaha.nomor_piutang.like(f"{PREFIX}%")).delete(synchronize_session=False)
    session.query(HutangUsaha).filter(HutangUsaha.nomor_hutang.like(f"{PREFIX_H}%")).delete(synchronize_session=False)
    session.commit()
    KasBankService(session).rebuild_balances()
    session.close()


def _lima_piutang(db):
    hari = get_jakarta_date()
    for i in range(5):
        db.add(PiutangUsaha(
            nomor_piutang=f"{PREFIX}-{i}", tanggal=hari - timedelta(days=5 - i), sumber=PiutangSource.LAINNYA,
            nama_debitur=NAMA, nominal_piutang=Decimal("100000"), total_dibayar=Decimal("0"),
            sisa_piutang=Decimal("100000"), status=PiutangStatus.BELUM_LUNAS, is_internal=False,
        ))
    db.commit()


def test_piutang_dikelompokkan_per_nama(db):
    _lima_piutang(db)
    grup = [g for g in NamaGrupService(db).piutang_grup() if g["nama"] == NAMA][0]
    assert grup["jumlah_struk"] == 5
    assert grup["total_sisa"] == 500000


def test_nama_dianggap_sama_tanpa_peka_huruf_besar_kecil(db):
    _lima_piutang(db)
    db.add(PiutangUsaha(
        nomor_piutang=f"{PREFIX}-X", tanggal=get_jakarta_date(), sumber=PiutangSource.LAINNYA,
        nama_debitur=NAMA.lower() + " ", nominal_piutang=Decimal("100000"), total_dibayar=Decimal("0"),
        sisa_piutang=Decimal("100000"), status=PiutangStatus.BELUM_LUNAS, is_internal=False,
    ))
    db.commit()
    grup = [g for g in NamaGrupService(db).piutang_grup() if g["nama"].lower() == NAMA.lower()]
    assert len(grup) == 1
    assert grup[0]["jumlah_struk"] == 6
    assert NamaGrupService(db).piutang_detail(NAMA.lower())["total_sisa"] == 600000


def test_bayar_per_nama_melunasi_struk_tertua(db):
    _lima_piutang(db)
    NamaGrupService(db).piutang_bayar(NAMA, get_jakarta_date(), PaymentMethod.TUNAI, Decimal("300000"), KasBankJenis.KAS_UTAMA, None, None)
    detail = NamaGrupService(db).piutang_detail(NAMA)
    assert [s["status"] for s in detail["struk"]] == ["LUNAS", "LUNAS", "LUNAS", "BELUM_LUNAS", "BELUM_LUNAS"]


def test_bayar_per_nama_melebihi_sisa_ditolak(db):
    _lima_piutang(db)
    with pytest.raises(HTTPException) as salah:
        NamaGrupService(db).piutang_bayar(NAMA, get_jakarta_date(), PaymentMethod.TUNAI, Decimal("600000"), KasBankJenis.KAS_UTAMA, None, None)
    assert salah.value.status_code == 400


def test_bayar_hutang_per_nama(db):
    hari = get_jakarta_date()
    for i in range(2):
        db.add(HutangUsaha(
            nomor_hutang=f"{PREFIX_H}-{i}", tanggal=hari - timedelta(days=2 - i), sumber=HutangSource.LAINNYA,
            nama_kreditur=NAMA, nominal_hutang=Decimal("200000"), total_dibayar=Decimal("0"),
            sisa_hutang=Decimal("200000"), status=HutangStatus.BELUM_LUNAS, is_internal=False,
        ))
    db.commit()
    NamaGrupService(db).hutang_bayar(NAMA, hari, PaymentMethod.TUNAI, Decimal("250000"), KasBankJenis.KAS_UTAMA, None, None)
    detail = NamaGrupService(db).hutang_detail(NAMA)
    assert [s["status"] for s in detail["struk"]] == ["LUNAS", "SEBAGIAN"]
    assert detail["struk"][1]["sisa"] == 150000


def test_daftar_piutang_bisa_mengecualikan_internal(db):
    from app.services.piutang_service import PiutangService

    hari = get_jakarta_date()
    for nomor, internal in [(f"{PREFIX}-EXT", False), (f"{PREFIX}-INT", True)]:
        db.add(PiutangUsaha(
            nomor_piutang=nomor, tanggal=hari, sumber=PiutangSource.LAINNYA,
            nama_debitur=NAMA, nominal_piutang=Decimal("100000"), total_dibayar=Decimal("0"),
            sisa_piutang=Decimal("100000"), status=PiutangStatus.BELUM_LUNAS, is_internal=internal,
        ))
    db.commit()
    semua = {p.nomor_piutang for p in PiutangService(db).get_list(limit=100, search=PREFIX)["data"]}
    tanpa_internal = {p.nomor_piutang for p in PiutangService(db).get_list(limit=100, search=PREFIX, exclude_internal=True)["data"]}
    assert semua == {f"{PREFIX}-EXT", f"{PREFIX}-INT"}
    assert tanpa_internal == {f"{PREFIX}-EXT"}
