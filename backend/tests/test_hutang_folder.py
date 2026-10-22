"""Folder hutang manual: buat folder, isi, dan lunasi sekaligus (alokasi tertua dulu)."""
from datetime import timedelta
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.database import SessionLocal
from app.models.keuangan import HutangFolder, HutangUsaha, KasBank, PembayaranHutang
from app.services.hutang_folder_service import HutangFolderService
from app.services.kas_bank_integration import create_kas_entry
from app.services.kas_bank_service import KasBankService
from app.utils.constants import HutangSource, HutangStatus, KasBankJenis, KasBankSource, KasBankType, PaymentMethod
from app.utils.helpers import get_jakarta_date

NAMA_FOLDER = "UJI HUTANG FOLDER"
NOMOR_SALDO = "SALDO-TEST-HUTANG-FOLDER"
PREFIX = "HTG-TEST-FOLDER"


@pytest.fixture
def db():
    session = SessionLocal()
    create_kas_entry(
        db=session, tanggal=get_jakarta_date(), tipe=KasBankType.MASUK, nominal=Decimal("10000000"),
        sumber=KasBankSource.MODAL, metode_bayar=PaymentMethod.TUNAI, referensi_id=None, nomor_referensi=NOMOR_SALDO,
        keterangan="Saldo awal uji folder hutang", kas_jenis=KasBankJenis.KAS_UTAMA, commit=True,
    )
    yield session
    session.rollback()
    ids = [h.id for h in session.query(HutangUsaha).filter(HutangUsaha.nomor_hutang.like(f"{PREFIX}%")).all()]
    if ids:
        session.query(PembayaranHutang).filter(PembayaranHutang.hutang_id.in_(ids)).delete(synchronize_session=False)
    session.query(KasBank).filter(
        KasBank.nomor_referensi.in_([NOMOR_SALDO]) | KasBank.nomor_referensi.like(f"{PREFIX}%")
    ).delete(synchronize_session=False)
    session.query(HutangUsaha).filter(HutangUsaha.nomor_hutang.like(f"{PREFIX}%")).delete(synchronize_session=False)
    session.query(HutangFolder).filter(HutangFolder.nama == NAMA_FOLDER).delete(synchronize_session=False)
    session.commit()
    KasBankService(session).rebuild_balances()
    session.close()


def _dua_hutang(db, folder_id):
    hari = get_jakarta_date()
    rows = []
    for i in range(2):
        h = HutangUsaha(
            nomor_hutang=f"{PREFIX}-{i}", tanggal=hari - timedelta(days=2 - i), sumber=HutangSource.LAINNYA,
            nama_kreditur="Uji Kreditur", nominal_hutang=Decimal("200000"), total_dibayar=Decimal("0"),
            sisa_hutang=Decimal("200000"), status=HutangStatus.BELUM_LUNAS, is_internal=False, folder_id=folder_id,
        )
        db.add(h)
        rows.append(h)
    db.commit()
    return rows


def test_bayar_folder_hutang_melunasi_tertua_dulu(db):
    folder = HutangFolderService(db).buat(NAMA_FOLDER, None, None)
    _dua_hutang(db, folder.id)
    HutangFolderService(db).bayar(folder.id, get_jakarta_date(), PaymentMethod.TUNAI, Decimal("250000"), KasBankJenis.KAS_UTAMA, None, None)
    detail = HutangFolderService(db).detail(folder.id)
    assert [h["status"] for h in detail["hutang"]] == ["LUNAS", "SEBAGIAN"]
    assert detail["hutang"][1]["sisa_hutang"] == 150000


def test_bayar_folder_hutang_melebihi_sisa_ditolak(db):
    folder = HutangFolderService(db).buat(NAMA_FOLDER, None, None)
    _dua_hutang(db, folder.id)
    with pytest.raises(HTTPException) as salah:
        HutangFolderService(db).bayar(folder.id, get_jakarta_date(), PaymentMethod.TUNAI, Decimal("500000"), KasBankJenis.KAS_UTAMA, None, None)
    assert salah.value.status_code == 400


def test_folder_hutang_berisi_tidak_bisa_dihapus(db):
    folder = HutangFolderService(db).buat(NAMA_FOLDER, None, None)
    _dua_hutang(db, folder.id)
    with pytest.raises(HTTPException) as salah:
        HutangFolderService(db).hapus(folder.id)
    assert salah.value.status_code == 400


def test_hutang_baru_bisa_langsung_masuk_folder(db):
    from app.schemas.keuangan import HutangCreate
    from app.services.hutang_service import HutangService

    folder = HutangFolderService(db).buat(NAMA_FOLDER, None, None)
    h = HutangService(db).create(HutangCreate(
        tanggal=get_jakarta_date(), sumber=HutangSource.LAINNYA, nama_kreditur="Uji Baru Hutang",
        nominal_hutang=Decimal("100000"), metode_pembayaran=PaymentMethod.TUNAI, folder_id=folder.id,
    ), None)
    detail = HutangFolderService(db).detail(folder.id)
    assert [x["id"] for x in detail["hutang"]] == [h.id]
    nomor = h.nomor_hutang
    db.query(PembayaranHutang).filter(PembayaranHutang.hutang_id == h.id).delete(synchronize_session=False)
    db.query(KasBank).filter(KasBank.nomor_referensi == nomor).delete(synchronize_session=False)
    db.query(HutangUsaha).filter(HutangUsaha.id == h.id).delete(synchronize_session=False)
    db.commit()
