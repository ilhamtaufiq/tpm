"""Pembayaran tunai transaksi bengkel bisa masuk ke Kas Pusat (KAS_UTAMA) atau Kas Bengkel.

Frontend mengirim kas_jenis per item pembayaran. Tanpa kas_jenis, tunai tetap masuk Kas Bengkel.
"""
from datetime import date
from decimal import Decimal

import pytest

from app.database import SessionLocal
from app.models.bengkel import TransaksiPenjualanBengkel
from app.models.keuangan import KasBank
from app.schemas.bengkel import DetailServiceCreate, PaymentItem, TransaksiBengkelCreate
from app.services.transaksi_bengkel_service import TransaksiBengkelService
from app.utils.constants import KasBankJenis, KasBankSource, PaymentMethod, WorkshopStatus

NAMA = "UJI TUNAI KAS PILIHAN"


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
    yield session
    session.rollback()
    for tid in session.info["ids"]:
        session.query(KasBank).filter(KasBank.referensi_id == tid, KasBank.keterangan.like("%Bengkel%")).delete(synchronize_session=False)
        session.query(TransaksiPenjualanBengkel).filter(TransaksiPenjualanBengkel.id == tid).delete(synchronize_session=False)
    session.query(KasBank).filter(KasBank.keterangan.like(f"%{NAMA}%")).delete(synchronize_session=False)
    session.commit()
    session.close()


def _buat_lunas_tunai(db, payments):
    tx = TransaksiBengkelService(db).create(
        TransaksiBengkelCreate(
            tanggal=date.today(),
            nama_customer=NAMA,
            kategori="umum",
            detail_parts=[],
            detail_services=[DetailServiceCreate(nama_jasa="Uji tunai", harga=Decimal("100000"), qty=1)],
            status_pengerjaan=WorkshopStatus.SELESAI,
            metode_bayar=PaymentMethod.TUNAI,
            jumlah_bayar=Decimal("100000"),
            payments=payments,
        ),
        user_id=None,
    )
    db.info["ids"].append(tx.id)
    return tx


def _jenis_kas_tunai(db, tx_id):
    rows = db.query(KasBank).filter(KasBank.referensi_id == tx_id, KasBank.sumber == KasBankSource.BENGKEL, KasBank.tipe == "MASUK").all()
    return [r.jenis for r in rows]


def test_tunai_ke_kas_pusat_bila_dipilih(db):
    tx = _buat_lunas_tunai(db, [PaymentItem(metode=PaymentMethod.TUNAI, jumlah=Decimal("100000"), kas_jenis=KasBankJenis.KAS_UTAMA)])
    jenis = _jenis_kas_tunai(db, tx.id)
    assert jenis == [KasBankJenis.KAS_UTAMA]


def test_tunai_default_tetap_kas_bengkel(db):
    tx = _buat_lunas_tunai(db, [PaymentItem(metode=PaymentMethod.TUNAI, jumlah=Decimal("100000"))])
    jenis = _jenis_kas_tunai(db, tx.id)
    assert jenis == [KasBankJenis.KAS_UNIT_BENGKEL]
