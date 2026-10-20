"""Perbaikan data dari dashboard monitoring: piutang manual tanpa kas dan tanggal mundur.

Piutang manual (LAINNYA, tanpa referensi) yang tidak punya kas bisa dicatatkan kas
keluarnya atau dibatalkan. Baris kas yang tanggalnya lebih awal dari tanggal input
bisa dipindahkan ke tanggal yang benar, dan saldo dihitung ulang.
"""
from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.database import SessionLocal
from app.models.keuangan import KasBank, PiutangUsaha
from app.models.perbaikan_data_log import PerbaikanDataLog
from app.services.kas_bank_service import KasBankService
from app.services.perbaikan_data_service import PerbaikanDataService
from app.utils.constants import KasBankJenis, KasBankSource, KasBankType, PaymentMethod, PiutangSource, PiutangStatus
from app.utils.helpers import get_jakarta_date

NOMOR_PIUTANG = "PTG-TEST-PERBAIKAN-1"
NOMOR_KAS_MUNDUR = "BGL-TEST-PERBAIKAN-MUNDUR"
NOMOR_SALDO = "SALDO-TEST-PERBAIKAN"


@pytest.fixture
def db():
    from app.services.kas_bank_integration import create_kas_entry

    session = SessionLocal()
    # Saldo awal supaya pencairan kas tidak ditolak karena saldo tidak mencukupi.
    for jenis, metode in [
        (KasBankJenis.KAS_UTAMA, PaymentMethod.TUNAI),
        (KasBankJenis.KAS_UNIT_BENGKEL, PaymentMethod.TUNAI),
        (KasBankJenis.KAS_UNIT_MOBIL, PaymentMethod.TUNAI),
        (KasBankJenis.BANK_UTAMA, PaymentMethod.TRANSFER),
    ]:
        create_kas_entry(
            db=session,
            tanggal=get_jakarta_date(),
            tipe=KasBankType.MASUK,
            nominal=Decimal("10000000"),
            sumber=KasBankSource.MODAL,
            metode_bayar=metode,
            referensi_id=None,
            nomor_referensi=NOMOR_SALDO,
            keterangan="Saldo awal uji perbaikan data",
            kas_jenis=jenis,
            commit=True,
        )
    yield session
    session.rollback()
    session.query(KasBank).filter(
        KasBank.nomor_referensi.in_([NOMOR_PIUTANG, NOMOR_KAS_MUNDUR, NOMOR_SALDO])
    ).delete(synchronize_session=False)
    session.query(PiutangUsaha).filter(PiutangUsaha.nomor_piutang == NOMOR_PIUTANG).delete(synchronize_session=False)
    session.query(PerbaikanDataLog).filter(
        PerbaikanDataLog.nomor_referensi.in_([NOMOR_PIUTANG, NOMOR_KAS_MUNDUR])
    ).delete(synchronize_session=False)
    session.commit()
    # Saldo tiap baris kas dihitung ulang setelah baris uji dihapus.
    KasBankService(session).rebuild_balances()
    session.close()


def _piutang_manual(db, nomor=NOMOR_PIUTANG, nominal=Decimal("1000000"), tanggal=None):
    p = PiutangUsaha(
        nomor_piutang=nomor,
        tanggal=tanggal or get_jakarta_date(),
        sumber=PiutangSource.LAINNYA,
        nama_debitur="Uji Perbaikan",
        nominal_piutang=nominal,
        total_dibayar=Decimal("0"),
        sisa_piutang=nominal,
        status=PiutangStatus.BELUM_LUNAS,
        is_internal=False,
    )
    db.add(p)
    db.commit()
    return p


def test_piutang_manual_tanpa_kas_bisa_dicatat_kasnya(db):
    p = _piutang_manual(db)
    svc = PerbaikanDataService(db)
    assert any(x["id"] == p.id for x in svc.piutang_tanpa_kas())

    svc.catat_kas_piutang(p.id, PaymentMethod.TRANSFER, None, user_id=None)

    kas = db.query(KasBank).filter(KasBank.nomor_referensi == NOMOR_PIUTANG).all()
    assert len(kas) == 1
    assert kas[0].tipe.value == "KELUAR" and kas[0].nominal == Decimal("1000000")
    assert kas[0].jenis == KasBankJenis.BANK_UTAMA
    assert not any(x["id"] == p.id for x in svc.piutang_tanpa_kas())
    with pytest.raises(HTTPException) as salah:
        svc.catat_kas_piutang(p.id, PaymentMethod.TUNAI, None, user_id=None)
    assert salah.value.status_code == 409


def test_tunai_bisa_dipilih_ke_laci_unit(db):
    p = _piutang_manual(db)
    svc = PerbaikanDataService(db)
    svc.catat_kas_piutang(p.id, PaymentMethod.TUNAI, KasBankJenis.KAS_UNIT_BENGKEL, user_id=None)
    kas = db.query(KasBank).filter(KasBank.nomor_referensi == NOMOR_PIUTANG).one()
    assert kas.jenis == KasBankJenis.KAS_UNIT_BENGKEL


def test_akun_tidak_sesuai_metode_ditolak(db):
    p = _piutang_manual(db)
    svc = PerbaikanDataService(db)
    with pytest.raises(HTTPException) as tunai_ke_bank:
        svc.catat_kas_piutang(p.id, PaymentMethod.TUNAI, KasBankJenis.BANK_UTAMA, user_id=None)
    with pytest.raises(HTTPException) as transfer_ke_kas:
        svc.catat_kas_piutang(p.id, PaymentMethod.TRANSFER, KasBankJenis.KAS_UTAMA, user_id=None)
    assert tunai_ke_bank.value.status_code == 400
    assert transfer_ke_kas.value.status_code == 400


def test_piutang_manual_tanpa_kas_bisa_dibatalkan(db):
    p = _piutang_manual(db)
    hasil = PerbaikanDataService(db).batalkan_piutang(p.id, None)
    db.refresh(p)
    assert hasil["status"] == PiutangStatus.BATAL.value
    assert p.status == PiutangStatus.BATAL and p.sisa_piutang == 0


def test_piutang_dengan_kas_tidak_bisa_dibatalkan(db):
    p = _piutang_manual(db)
    PerbaikanDataService(db).catat_kas_piutang(p.id, PaymentMethod.TUNAI, None, user_id=None)
    with pytest.raises(HTTPException) as salah:
        PerbaikanDataService(db).batalkan_piutang(p.id, None)
    assert salah.value.status_code == 409


def test_tanggal_mundur_terdeteksi_dan_bisa_dipindah(db):
    hari_ini = get_jakarta_date()
    kemarin = hari_ini - timedelta(days=1)
    from app.services.kas_bank_integration import create_kas_entry

    kas = create_kas_entry(
        db=db,
        tanggal=kemarin,
        tipe="MASUK",
        nominal=Decimal("50000"),
        sumber=KasBankSource.BENGKEL,
        metode_bayar=PaymentMethod.TUNAI,
        referensi_id=None,
        nomor_referensi=NOMOR_KAS_MUNDUR,
        keterangan="Uji tanggal mundur",
        kas_jenis=KasBankJenis.KAS_UTAMA,
        commit=True,
    )
    # created_at diset ke hari ini supaya selisihnya 1 hari.
    kas.created_at = datetime(hari_ini.year, hari_ini.month, hari_ini.day, 10, 0, 0)
    db.commit()

    svc = PerbaikanDataService(db)
    kandidat = [x for x in svc.tanggal_mundur(1) if x["nomor_referensi"] == NOMOR_KAS_MUNDUR]
    assert len(kandidat) == 1
    assert kandidat[0]["tanggal_lama"] == kemarin.isoformat()
    assert kandidat[0]["tanggal_seharusnya"] == hari_ini.isoformat()

    hasil = svc.ubah_tanggal(NOMOR_KAS_MUNDUR, kemarin, hari_ini, None)
    assert hasil["baris_kas"] == 1
    db.refresh(kas)
    assert kas.tanggal == hari_ini
    assert not any(x["nomor_referensi"] == NOMOR_KAS_MUNDUR for x in svc.tanggal_mundur(1))


def test_ubah_tanggal_menolak_tanggal_masa_depan(db):
    with pytest.raises(HTTPException) as salah:
        PerbaikanDataService(db).ubah_tanggal(NOMOR_KAS_MUNDUR, get_jakarta_date(), get_jakarta_date() + timedelta(days=3), None)
    assert salah.value.status_code == 400


def test_riwayat_mencatat_setiap_perbaikan(db):
    p = _piutang_manual(db)
    svc = PerbaikanDataService(db)
    svc.catat_kas_piutang(p.id, PaymentMethod.TUNAI, KasBankJenis.KAS_UNIT_MOBIL, user_id=None)
    catatan = [x for x in svc.riwayat() if x["nomor_referensi"] == NOMOR_PIUTANG]
    assert len(catatan) == 1
    assert catatan[0]["jenis"] == "PIUTANG_CATAT_KAS"
    assert catatan[0]["sesudah"]["kas_jenis"] == KasBankJenis.KAS_UNIT_MOBIL.value
    assert catatan[0]["sesudah"]["nominal"] == 1000000.0


def test_gagal_dicatat_ke_riwayat_dengan_pesan_jelas(db):
    p = _piutang_manual(db)
    svc = PerbaikanDataService(db)
    svc.catat_kas_piutang(p.id, PaymentMethod.TUNAI, None, user_id=None)
    with pytest.raises(HTTPException) as salah:
        svc.catat_kas_piutang(p.id, PaymentMethod.TUNAI, None, user_id=None)
    assert salah.value.status_code == 409
    assert "tidak perlu dicatat lagi" in salah.value.detail
    gagal = [x for x in svc.riwayat() if x["jenis"] == "GAGAL_PIUTANG_CATAT_KAS"]
    assert gagal and "tidak perlu dicatat lagi" in gagal[0]["ringkasan"]


def test_saldo_kurang_menyarankan_akun_lain(db):
    p = _piutang_manual(db, nominal=Decimal("999999999"))
    svc = PerbaikanDataService(db)
    with pytest.raises(HTTPException) as salah:
        svc.catat_kas_piutang(p.id, PaymentMethod.TUNAI, KasBankJenis.KAS_UNIT_JASA_ANGKUT, user_id=None)
    assert salah.value.status_code == 400
    assert "Pilih akun lain" in salah.value.detail
    assert db.query(KasBank).filter(KasBank.nomor_referensi == NOMOR_PIUTANG).count() == 0


def test_kesehatan_menandai_piutang_lama_tanpa_kas(db):
    lama = get_jakarta_date() - timedelta(days=60)
    _piutang_manual(db, tanggal=lama)
    hasil = PerbaikanDataService(db).kesehatan()
    pesan = [r["pesan"] for r in hasil["rekomendasi"] if r["tingkat"] == "peringatan"]
    assert any(NOMOR_PIUTANG in x and "sudah 60 hari tanpa kas" in x for x in pesan)
    assert any(c["tingkat"] == "peringatan" for c in hasil["checks"])
