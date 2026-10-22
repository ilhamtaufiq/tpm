"""Folder piutang: kelompokkan piutang dan bayar sekaligus (alokasi tertua dulu)."""
from datetime import timedelta
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.database import SessionLocal
from app.models.keuangan import KasBank, PembayaranPiutang, PiutangFolder, PiutangUsaha
from app.services.kas_bank_integration import create_kas_entry
from app.services.kas_bank_service import KasBankService
from app.services.piutang_folder_service import PiutangFolderService
from app.utils.constants import KasBankJenis, KasBankSource, KasBankType, PaymentMethod, PiutangSource, PiutangStatus
from app.utils.helpers import get_jakarta_date

NAMA_FOLDER = "UJI FOLDER A"
NOMOR_SALDO = "SALDO-TEST-FOLDER"
PREFIX_PIUTANG = "PTG-TEST-FOLDER"


@pytest.fixture
def db():
    session = SessionLocal()
    for jenis, metode in [(KasBankJenis.KAS_UTAMA, PaymentMethod.TUNAI)]:
        create_kas_entry(
            db=session, tanggal=get_jakarta_date(), tipe=KasBankType.MASUK, nominal=Decimal("10000000"),
            sumber=KasBankSource.MODAL, metode_bayar=metode, referensi_id=None, nomor_referensi=NOMOR_SALDO,
            keterangan="Saldo awal uji folder piutang", kas_jenis=jenis, commit=True,
        )
    yield session
    session.rollback()
    piutang_ids = [p.id for p in session.query(PiutangUsaha).filter(PiutangUsaha.nomor_piutang.like(f"{PREFIX_PIUTANG}%")).all()]
    if piutang_ids:
        session.query(PembayaranPiutang).filter(PembayaranPiutang.piutang_id.in_(piutang_ids)).delete(synchronize_session=False)
    session.query(KasBank).filter(KasBank.nomor_referensi.in_([NOMOR_SALDO]) | KasBank.nomor_referensi.like(f"{PREFIX_PIUTANG}%")).delete(synchronize_session=False)
    session.query(PiutangUsaha).filter(PiutangUsaha.nomor_piutang.like(f"{PREFIX_PIUTANG}%")).delete(synchronize_session=False)
    session.query(PiutangFolder).filter(PiutangFolder.nama == NAMA_FOLDER).delete(synchronize_session=False)
    session.commit()
    KasBankService(session).rebuild_balances()
    session.close()


def _lima_struk(db, folder_id):
    hari = get_jakarta_date()
    hasil = []
    for i in range(5):
        p = PiutangUsaha(
            nomor_piutang=f"{PREFIX_PIUTANG}-{i}", tanggal=hari - timedelta(days=5 - i),
            sumber=PiutangSource.LAINNYA, nama_debitur="Uji A", nominal_piutang=Decimal("100000"),
            total_dibayar=Decimal("0"), sisa_piutang=Decimal("100000"), status=PiutangStatus.BELUM_LUNAS,
            is_internal=False, folder_id=folder_id,
        )
        db.add(p)
        hasil.append(p)
    db.commit()
    return hasil


def test_bayar_folder_melunasi_struk_tertua_dulu(db):
    folder = PiutangFolderService(db).buat(NAMA_FOLDER, None, None)
    _lima_struk(db, folder.id)

    PiutangFolderService(db).bayar(folder.id, get_jakarta_date(), PaymentMethod.TUNAI, Decimal("300000"), KasBankJenis.KAS_UTAMA, None, None)

    detail = PiutangFolderService(db).detail(folder.id)
    status_urut = [p["status"] for p in detail["piutang"]]
    assert status_urut == ["LUNAS", "LUNAS", "LUNAS", "BELUM_LUNAS", "BELUM_LUNAS"]
    assert all(p["sisa_piutang"] == 100000 for p in detail["piutang"][3:])
    assert detail["piutang"][0]["pembayaran"][0]["tanggal"] == get_jakarta_date().isoformat()


def test_bayar_folder_melebihi_sisa_ditolak(db):
    folder = PiutangFolderService(db).buat(NAMA_FOLDER, None, None)
    _lima_struk(db, folder.id)
    with pytest.raises(HTTPException) as salah:
        PiutangFolderService(db).bayar(folder.id, get_jakarta_date(), PaymentMethod.TUNAI, Decimal("600000"), KasBankJenis.KAS_UTAMA, None, None)
    assert salah.value.status_code == 400


def test_folder_berisi_piutang_tidak_bisa_dihapus(db):
    folder = PiutangFolderService(db).buat(NAMA_FOLDER, None, None)
    _lima_struk(db, folder.id)
    with pytest.raises(HTTPException) as salah:
        PiutangFolderService(db).hapus(folder.id)
    assert salah.value.status_code == 400


def test_pindahkan_piutang_ke_folder_dan_keluar(db):
    folder = PiutangFolderService(db).buat(NAMA_FOLDER, None, None)
    struk = _lima_struk(db, None)[0]
    PiutangFolderService(db).pindahkan(struk.id, folder.id)
    db.refresh(struk)
    assert struk.folder_id == folder.id
    PiutangFolderService(db).pindahkan(struk.id, None)
    db.refresh(struk)
    assert struk.folder_id is None


def test_piutang_baru_bisa_langsung_masuk_folder(db):
    from app.schemas.keuangan import PiutangCreate
    from app.services.piutang_service import PiutangService
    from app.utils.constants import PiutangSource as PS

    folder = PiutangFolderService(db).buat(NAMA_FOLDER, None, None)
    p = PiutangService(db).create(PiutangCreate(
        tanggal=get_jakarta_date(), sumber=PS.LAINNYA, nama_debitur="Uji Baru",
        nominal_piutang=Decimal("100000"), metode_pembayaran=PaymentMethod.TUNAI,
        folder_id=folder.id,
    ), None)
    detail = PiutangFolderService(db).detail(folder.id)
    assert [x["id"] for x in detail["piutang"]] == [p.id]
    db.query(PembayaranPiutang).filter(PembayaranPiutang.piutang_id == p.id).delete(synchronize_session=False)
    db.query(KasBank).filter(KasBank.nomor_referensi == p.nomor_piutang).delete(synchronize_session=False)
    db.query(PiutangUsaha).filter(PiutangUsaha.id == p.id).delete(synchronize_session=False)
    db.commit()
