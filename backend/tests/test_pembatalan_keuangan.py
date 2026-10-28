"""Pembatalan (bukan hapus) transaksi keuangan: jurnal dibalik, riwayat tercatat,
laporan tetap seimbang.

Setiap kasus berjalan di dalam transaksi yang di-rollback, jadi DB lokal tidak
ikut berubah. Pola: session di atas koneksi dengan savepoint per commit.
"""
from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.connection import engine
from app.models.bengkel import PengeluaranBengkel
from app.models.keuangan import KasBank, PiutangUsaha
from app.models.pembatalan_keuangan import PembatalanKeuangan
from app.models.pembatalan_filter import INCLUDE_DIBATALKAN
from app.schemas.bengkel import PengeluaranBengkelCreate
from app.schemas.keuangan import KasBankCreate, PiutangCreate
from app.services.kas_bank_service import KasBankService
from app.services.pembatalan_service import PembatalanService
from app.services.pengeluaran_service import PengeluaranService
from app.services.piutang_service import PiutangService
from app.services.reports.laba_rugi_service import LabaRugiService
from app.services.reports.modal_service import ModalService
from app.services.reports.neraca_service import NeracaService
from app.utils.constants import (
    KasBankJenis,
    KasBankSource,
    KasBankType,
    PaymentMethod,
    PiutangSource,
    PiutangStatus,
)
from app.utils.helpers import get_jakarta_date

TOL = 1.0


@pytest.fixture
def db():
    connection = engine.connect()
    trans = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    yield session
    session.close()
    trans.rollback()
    connection.close()


def _seed(db, jenis, nominal):
    KasBankService(db).create(
        KasBankCreate(
            tanggal=get_jakarta_date(),
            jenis=jenis,
            tipe=KasBankType.MASUK,
            nominal=Decimal(nominal),
            sumber=KasBankSource.LAINNYA,
            keterangan="SEED pembatalan test",
        ),
        None,
        commit=False,
    )


def _saldo(db, jenis):
    rows = (
        db.query(KasBank.tipe, func.sum(KasBank.nominal))
        .filter(KasBank.jenis == jenis)
        .group_by(KasBank.tipe)
        .all()
    )
    masuk = sum(float(n) for t, n in rows if t == KasBankType.MASUK)
    keluar = sum(float(n) for t, n in rows if t == KasBankType.KELUAR)
    return masuk - keluar


def _cari(obj, kunci):
    """Cari nilai pertama `kunci` di dalam dict laporan bersarang."""
    if isinstance(obj, dict):
        if kunci in obj and isinstance(obj[kunci], (int, float)):
            return float(obj[kunci])
        for v in obj.values():
            hasil = _cari(v, kunci)
            if hasil is not None:
                return hasil
    return None


def _buat_pengeluaran(db, jumlah="300000"):
    return PengeluaranService(db).create(
        PengeluaranBengkelCreate(
            tanggal=get_jakarta_date(),
            bisnis_kategori="bengkel",
            kategori="BIAYA_OPERASIONAL",
            deskripsi="Biaya test pembatalan",
            jumlah=Decimal(jumlah),
            metode_bayar=PaymentMethod.TUNAI,
            kas_jenis=KasBankJenis.KAS_UNIT_BENGKEL,
        ),
        None,
    )


def test_batalkan_pengeluaran_membalik_kas_dan_keluar_dari_laporan(db):
    _seed(db, KasBankJenis.KAS_UNIT_BENGKEL, "1000000")
    saldo_awal = _saldo(db, KasBankJenis.KAS_UNIT_BENGKEL)
    pengeluaran = _buat_pengeluaran(db)
    assert _saldo(db, KasBankJenis.KAS_UNIT_BENGKEL) == pytest.approx(saldo_awal - 300000)

    riwayat = PembatalanService(db).batalkan_pengeluaran(pengeluaran.id, "Salah input nominal", None)

    assert riwayat.jenis == "PENGELUARAN"
    assert riwayat.alasan == "Salah input nominal"
    assert riwayat.kas_nomor
    assert _saldo(db, KasBankJenis.KAS_UNIT_BENGKEL) == pytest.approx(saldo_awal)
    # Baris pengeluaran tetap ada, tapi tidak terbaca oleh query biasa.
    assert db.query(PengeluaranBengkel).filter(PengeluaranBengkel.id == pengeluaran.id).first() is None
    tersisa = (
        db.query(PengeluaranBengkel)
        .execution_options(**{INCLUDE_DIBATALKAN: True})
        .filter(PengeluaranBengkel.id == pengeluaran.id)
        .one()
    )
    assert tersisa.dibatalkan_at is not None
    assert tersisa.alasan_batal == "Salah input nominal"
    assert db.query(func.sum(PengeluaranBengkel.jumlah)).filter(
        PengeluaranBengkel.id == pengeluaran.id
    ).scalar() is None


def test_alasan_wajib_minimal_lima_karakter(db):
    _seed(db, KasBankJenis.KAS_UNIT_BENGKEL, "1000000")
    pengeluaran = _buat_pengeluaran(db)
    with pytest.raises(HTTPException) as info:
        PembatalanService(db).batalkan_pengeluaran(pengeluaran.id, "  abc ", None)
    assert info.value.status_code == 400
    assert _saldo(db, KasBankJenis.KAS_UNIT_BENGKEL) == pytest.approx(700000)


def test_pengeluaran_tidak_bisa_dibatalkan_dua_kali(db):
    _seed(db, KasBankJenis.KAS_UNIT_BENGKEL, "1000000")
    pengeluaran = _buat_pengeluaran(db)
    PembatalanService(db).batalkan_pengeluaran(pengeluaran.id, "Salah input nominal", None)
    with pytest.raises(HTTPException) as info:
        PembatalanService(db).batalkan_pengeluaran(pengeluaran.id, "Dibatalkan lagi", None)
    assert info.value.status_code == 400
    assert db.query(PembatalanKeuangan).filter(PembatalanKeuangan.dokumen_id == pengeluaran.id).count() == 1


def test_batalkan_dari_kas_mencari_pengeluaran_asal(db):
    _seed(db, KasBankJenis.KAS_UNIT_BENGKEL, "1000000")
    saldo_awal = _saldo(db, KasBankJenis.KAS_UNIT_BENGKEL)
    pengeluaran = _buat_pengeluaran(db)
    baris = (
        db.query(KasBank)
        .filter(KasBank.referensi_id == pengeluaran.id, KasBank.tipe == KasBankType.KELUAR)
        .one()
    )

    riwayat = PembatalanService(db).batalkan_dari_kas(baris.id, "Salah akun kas", None)

    assert riwayat.jenis == "PENGELUARAN"
    assert _saldo(db, KasBankJenis.KAS_UNIT_BENGKEL) == pytest.approx(saldo_awal)


def test_batalkan_transfer_membalik_kedua_kaki(db):
    _seed(db, KasBankJenis.KAS_UTAMA, "1000000")
    KasBankService(db).transfer(
        KasBankJenis.KAS_UTAMA,
        KasBankJenis.KAS_UNIT_BENGKEL,
        Decimal("200000"),
        get_jakarta_date(),
        "Modal harian",
        None,
    )
    assert _saldo(db, KasBankJenis.KAS_UTAMA) == pytest.approx(800000)
    assert _saldo(db, KasBankJenis.KAS_UNIT_BENGKEL) == pytest.approx(200000)
    kaki_masuk = (
        db.query(KasBank)
        .filter(KasBank.jenis == KasBankJenis.KAS_UNIT_BENGKEL, KasBank.tipe == KasBankType.MASUK,
                KasBank.nomor_referensi.like("TRF-%"))
        .one()
    )

    riwayat = PembatalanService(db).batalkan_dari_kas(kaki_masuk.id, "Transfer salah tujuan", None)

    assert riwayat.jenis == "TRANSFER"
    assert _saldo(db, KasBankJenis.KAS_UTAMA) == pytest.approx(1000000)
    assert _saldo(db, KasBankJenis.KAS_UNIT_BENGKEL) == pytest.approx(0)


def test_transfer_ditolak_bila_saldo_tujuan_sudah_terpakai(db):
    _seed(db, KasBankJenis.KAS_UTAMA, "1000000")
    KasBankService(db).transfer(
        KasBankJenis.KAS_UTAMA, KasBankJenis.KAS_UNIT_BENGKEL,
        Decimal("200000"), get_jakarta_date(), "Modal harian", None,
    )
    _buat_pengeluaran(db, jumlah="150000")  # uang unit sudah terpakai
    kaki_masuk = (
        db.query(KasBank)
        .filter(KasBank.jenis == KasBankJenis.KAS_UNIT_BENGKEL, KasBank.tipe == KasBankType.MASUK,
                KasBank.nomor_referensi.like("TRF-%"))
        .one()
    )
    with pytest.raises(HTTPException) as info:
        PembatalanService(db).batalkan_dari_kas(kaki_masuk.id, "Transfer salah tujuan", None)
    assert info.value.status_code == 400
    assert "menjadi negatif" in info.value.detail
    assert _saldo(db, KasBankJenis.KAS_UTAMA) == pytest.approx(800000)


def _buat_kasbon(db, nominal="200000"):
    return PiutangService(db).create(
        PiutangCreate(
            tanggal=get_jakarta_date(),
            sumber=PiutangSource.LAINNYA,
            nama_debitur="Budi Test",
            nominal_piutang=Decimal(nominal),
            metode_pembayaran=PaymentMethod.TUNAI,
            catatan="Kasbon test pembatalan",
        ),
        None,
    )


def test_batalkan_piutang_tanpa_pembayaran(db):
    _seed(db, KasBankJenis.KAS_UTAMA, "1000000")
    saldo_awal = _saldo(db, KasBankJenis.KAS_UTAMA)
    piutang = _buat_kasbon(db)
    assert _saldo(db, KasBankJenis.KAS_UTAMA) == pytest.approx(saldo_awal - 200000)

    PembatalanService(db).batalkan_piutang(piutang.id, "Kasbon tidak jadi", None)

    db.refresh(piutang)
    assert piutang.status == PiutangStatus.BATAL
    assert _saldo(db, KasBankJenis.KAS_UTAMA) == pytest.approx(saldo_awal)


def test_piutang_yang_sudah_dibayar_tidak_bisa_dibatalkan(db):
    _seed(db, KasBankJenis.KAS_UTAMA, "1000000")
    piutang = _buat_kasbon(db)
    piutang.total_dibayar = Decimal("50000")
    db.flush()
    with pytest.raises(HTTPException) as info:
        PembatalanService(db).batalkan_piutang(piutang.id, "Kasbon tidak jadi", None)
    assert info.value.status_code == 400
    assert "sudah ada pembayaran" in info.value.detail


def test_laporan_tetap_seimbang_setelah_pembatalan(db):
    hari_ini = get_jakarta_date()
    _seed(db, KasBankJenis.KAS_UNIT_BENGKEL, "1000000")
    _seed(db, KasBankJenis.KAS_UTAMA, "1000000")

    neraca_awal = NeracaService(db).get_report(hari_ini)
    laba_awal = _cari(LabaRugiService(db).get_report(hari_ini, hari_ini), "laba_operasional")
    kas_awal = _saldo(db, KasBankJenis.KAS_UNIT_BENGKEL)

    pengeluaran = _buat_pengeluaran(db, jumlah="300000")
    laba_dengan_biaya = _cari(LabaRugiService(db).get_report(hari_ini, hari_ini), "laba_operasional")
    assert laba_dengan_biaya - laba_awal == pytest.approx(-300000, abs=TOL)

    PembatalanService(db).batalkan_pengeluaran(pengeluaran.id, "Salah input nominal", None)

    neraca = NeracaService(db).get_report(hari_ini)
    laba = _cari(LabaRugiService(db).get_report(hari_ini, hari_ini), "laba_operasional")

    assert neraca_awal["is_balanced"] is True
    assert neraca["is_balanced"] is True
    # Perubahan Modal harus memakai laba operasional yang sama dengan Laba Rugi.
    anchor = ModalService(db)._saldo_awal_date()
    if anchor:
        laba_modal = _cari(ModalService(db).get_report(anchor, hari_ini), "laba_operasional")
        assert laba_modal == pytest.approx(laba, abs=TOL)
    assert _saldo(db, KasBankJenis.KAS_UNIT_BENGKEL) == pytest.approx(kas_awal)
    # Setelah dibatalkan, laba operasional kembali seperti sebelum biaya dibuat.
    assert laba == pytest.approx(laba_awal, abs=TOL)


def test_riwayat_pembatalan_bisa_dibaca(db):
    _seed(db, KasBankJenis.KAS_UNIT_BENGKEL, "1000000")
    pengeluaran = _buat_pengeluaran(db)
    PembatalanService(db).batalkan_pengeluaran(pengeluaran.id, "Salah input nominal", None)
    daftar = PembatalanService(db).list_riwayat("pengeluaran", 10)
    assert any(r.dokumen_id == pengeluaran.id and r.alasan == "Salah input nominal" for r in daftar)


def _buat_karyawan_kasbon(db):
    from uuid import uuid4

    from app.models.karyawan import Karyawan

    karyawan = Karyawan(kode=f"TST{uuid4().hex[:12]}", nama="Karyawan Test Kasbon", jabatan="Mekanik", tanggal_bergabung=date(2026, 1, 1))
    db.add(karyawan)
    db.flush()
    return karyawan


def test_batalkan_kasbon_karyawan_membalik_kas_dan_piutang(db):
    from app.schemas.karyawan import KasbonCreate
    from app.services.kasbon_service import KasbonService
    from app.utils.constants import PaymentStatus

    _seed(db, KasBankJenis.KAS_UTAMA, "1000000")
    saldo_awal = _saldo(db, KasBankJenis.KAS_UTAMA)
    karyawan = _buat_karyawan_kasbon(db)
    kasbon = KasbonService(db).create(
        KasbonCreate(
            karyawan_id=karyawan.id,
            tanggal=get_jakarta_date(),
            nominal=Decimal("200000"),
            metode_bayar=PaymentMethod.TUNAI,
            unit=KasBankSource.BENGKEL,
        ),
        None,
    )
    assert _saldo(db, KasBankJenis.KAS_UTAMA) == pytest.approx(saldo_awal - 200000)

    PembatalanService(db).batalkan_kasbon(kasbon.id, "Kasbon tidak jadi", None)

    db.refresh(kasbon)
    assert kasbon.status == PaymentStatus.BATAL
    assert _saldo(db, KasBankJenis.KAS_UTAMA) == pytest.approx(saldo_awal)
    piutang = db.query(PiutangUsaha).filter(PiutangUsaha.nomor_referensi == kasbon.nomor_kasbon).one()
    assert piutang.status == PiutangStatus.BATAL


def test_kasbon_yang_sudah_lunas_tidak_bisa_dibatalkan(db):
    from app.schemas.karyawan import KasbonCreate
    from app.services.kasbon_service import KasbonService
    from app.utils.constants import PaymentStatus

    _seed(db, KasBankJenis.KAS_UNIT_BENGKEL, "1000000")
    _seed(db, KasBankJenis.KAS_UTAMA, "1000000")
    karyawan = _buat_karyawan_kasbon(db)
    kasbon = KasbonService(db).create(
        KasbonCreate(karyawan_id=karyawan.id, tanggal=get_jakarta_date(), nominal=Decimal("200000"),
                     metode_bayar=PaymentMethod.TUNAI, unit=KasBankSource.BENGKEL),
        None,
    )
    kasbon.status = PaymentStatus.LUNAS
    db.flush()
    with pytest.raises(HTTPException) as info:
        PembatalanService(db).batalkan_kasbon(kasbon.id, "Kasbon tidak jadi", None)
    assert info.value.status_code == 400
