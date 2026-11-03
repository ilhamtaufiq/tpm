"""Riwayat 'Semua' di dashboard: tiap grup unit dapat jatahnya sendiri.

Kasus: kas Jasa Angkut yang sangat banyak dan lebih baru tidak boleh mendorong keluar
transaksi bengkel dari daftar. Absensi karyawan juga ikut tampil di 'Semua'.
"""
from datetime import date
from decimal import Decimal

import pytest

from app.api.v1.dashboard import get_recent_activity
from app.database import SessionLocal
from app.models.bengkel import TransaksiPenjualanBengkel
from app.models.keuangan import KasBank
from app.schemas.bengkel import DetailServiceCreate, TransaksiBengkelCreate
from app.services.kas_bank_integration import create_kas_entry
from app.services.transaksi_bengkel_service import TransaksiBengkelService
from app.utils.cache import invalidate_cache_prefix
from app.utils.constants import KasBankSource, KasBankType, KasBankJenis, PaymentMethod, WorkshopStatus

NAMA = "UJI RIWAYAT GRUP"


def _bersihkan_piutang_yatim(session):
    """Piutang bengkel sisa tes (nomor_referensi tanpa transaksi) bisa tertukar dengan nomor baru.
    Hanya baris yatim yang dihapus, data yang masih punya transaksi tidak disentuh."""
    from app.models.keuangan import PembayaranPiutang, PiutangUsaha
    nomor_ada = {t[0] for t in session.query(TransaksiPenjualanBengkel.nomor_transaksi).all()}
    yatim = [p for p in session.query(PiutangUsaha).filter(PiutangUsaha.sumber == "BENGKEL").all()
             if p.nomor_referensi and p.nomor_referensi not in nomor_ada]
    for p in yatim:
        session.query(PembayaranPiutang).filter(PembayaranPiutang.piutang_id == p.id).delete(synchronize_session=False)
        session.query(PiutangUsaha).filter(PiutangUsaha.id == p.id).delete(synchronize_session=False)
    session.commit()


@pytest.fixture
def db():
    session = SessionLocal()
    _bersihkan_piutang_yatim(session)
    session.info["ids"] = []
    session.info["kas"] = []
    yield session
    session.rollback()
    for kid in session.info["kas"]:
        session.query(KasBank).filter(KasBank.id == kid).delete(synchronize_session=False)
    for tid in session.info["ids"]:
        session.query(KasBank).filter(KasBank.referensi_id == tid, KasBank.keterangan.like("%Bengkel%")).delete(synchronize_session=False)
    # Sisa percobaan yang gagal juga dibersihkan lewat nama customer uji
    session.query(TransaksiPenjualanBengkel).filter(TransaksiPenjualanBengkel.nama_customer == NAMA).delete(synchronize_session=False)
    session.commit()
    session.close()


def test_bengkel_tetap_muncul_saat_jasa_angkut_ramai(db):
    tx = TransaksiBengkelService(db).create(
        TransaksiBengkelCreate(
            tanggal=date.today(),
            nama_customer=NAMA,
            kategori="umum",
            detail_parts=[],
            detail_services=[DetailServiceCreate(nama_jasa="Uji riwayat grup", harga=Decimal("50000"), qty=1)],
            status_pengerjaan=WorkshopStatus.SELESAI,
            metode_bayar=PaymentMethod.TUNAI,
            jumlah_bayar=Decimal("50000"),
        ),
        user_id=None,
    )
    db.info["ids"].append(tx.id)

    # Kas Jasa Angkut yang lebih baru: lebih banyak dari batas tampilan
    for i in range(8):
        kas = create_kas_entry(
            db=db, tanggal=date.today(), tipe=KasBankType.MASUK, nominal=Decimal("1000"),
            sumber=KasBankSource.JASA_ANGKUT, metode_bayar=PaymentMethod.TUNAI,
            referensi_id=None, nomor_referensi=f"UJI-GRP-{i}", keterangan=f"UJI grup JA {i}",
            user_id=None, kas_jenis=KasBankJenis.KAS_UNIT_JASA_ANGKUT,
        )
        db.info["kas"].append(kas.id)

    invalidate_cache_prefix("recent_activity")
    hasil = get_recent_activity(db=db, current_user=None, limit=5, source=None)

    ada_bengkel = [h for h in hasil if h["type"] == "workshop" and h["original_id"] == tx.id]
    assert ada_bengkel, "transaksi bengkel terdorong keluar oleh kas Jasa Angkut"
    # Tiap grup dibatasi `limit`, jadi jumlah Jasa Angkut tidak lebih dari 5
    assert sum(1 for h in hasil if h["source"] == "JASA_ANGKUT") <= 5


def test_absensi_ikut_di_semua(db):
    from app.models.karyawan import Absensi, Karyawan
    from app.utils.constants import AttendanceStatus, EmployeeStatus

    k = Karyawan(kode="UJI-RGR-1", nama="UJI Riwayat Grup", jabatan="Mekanik",
                 tanggal_bergabung=date(2026, 1, 1), gaji_pokok=Decimal("0"), tunjangan=Decimal("0"),
                 status=EmployeeStatus.AKTIF)
    db.add(k)
    db.flush()
    ab = Absensi(karyawan_id=k.id, tanggal=date.today(), status=AttendanceStatus.HADIR)
    db.add(ab)
    db.commit()
    try:
        invalidate_cache_prefix("recent_activity")
        hasil = get_recent_activity(db=db, current_user=None, limit=100, source=None)
        assert any(h["source"] == "ABSENSI" and "UJI Riwayat Grup" in h["title"] for h in hasil)
    finally:
        db.query(Absensi).filter(Absensi.id == ab.id).delete(synchronize_session=False)
        db.query(Karyawan).filter(Karyawan.id == k.id).delete(synchronize_session=False)
        db.commit()
