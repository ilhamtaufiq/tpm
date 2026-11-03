"""Transaksi bengkel yang dibayar belakangan lewat menu Piutang harus ikut LUNAS.

Kasus: transaksi kredit (belum bayar saat dibuat) membentuk piutang. Piutang lalu dilunasi
dari Keuangan Piutang. Status transaksi di Antrian harus ikut berubah.
"""
from datetime import date
from decimal import Decimal

import pytest

from app.database import SessionLocal
from app.models.bengkel import TransaksiPenjualanBengkel
from app.models.keuangan import KasBank, PembayaranPiutang, PiutangUsaha
from app.schemas.bengkel import DetailServiceCreate, TransaksiBengkelCreate
from app.schemas.keuangan import PaymentDetail, PembayaranPiutangSplit
from app.services.piutang_service import PiutangService
from app.services.transaksi_bengkel_service import TransaksiBengkelService
from app.utils.constants import PaymentMethod, PaymentStatus, PiutangStatus, WorkshopStatus

NAMA = "UJI LUNAS PIUTANG BGL"


@pytest.fixture
def db():
    session = SessionLocal()
    session.info["ids"] = []
    yield session
    session.rollback()
    trx_ids = session.info["ids"]
    piutang_ids = [p.id for p in session.query(PiutangUsaha).filter(PiutangUsaha.nama_debitur == NAMA).all()]
    session.query(PembayaranPiutang).filter(PembayaranPiutang.piutang_id.in_(piutang_ids)).delete(synchronize_session=False)
    session.query(KasBank).filter(KasBank.keterangan.like(f"%{NAMA}%")).delete(synchronize_session=False)
    session.query(PiutangUsaha).filter(PiutangUsaha.nama_debitur == NAMA).delete(synchronize_session=False)
    for tid in trx_ids:
        session.query(TransaksiPenjualanBengkel).filter(TransaksiPenjualanBengkel.id == tid).delete(synchronize_session=False)
    session.commit()
    session.close()


def test_bayar_piutang_bengkel_melunasi_transaksi_asal(db):
    tx = TransaksiBengkelService(db).create(
        TransaksiBengkelCreate(
            tanggal=date.today(),
            nama_customer=NAMA,
            kategori="umum",
            detail_parts=[],
            detail_services=[DetailServiceCreate(nama_jasa="Uji lunas piutang", harga=Decimal("150000"), qty=1)],
            status_pengerjaan=WorkshopStatus.ANTRE,
            metode_bayar=PaymentMethod.KREDIT,
            jumlah_bayar=Decimal("0"),
        ),
        user_id=None,
    )
    db.info["ids"].append(tx.id)
    piutang = db.query(PiutangUsaha).filter(PiutangUsaha.nomor_referensi == tx.nomor_transaksi).one()
    assert piutang.status == PiutangStatus.BELUM_LUNAS

    PiutangService(db).process_payment_split(
        PembayaranPiutangSplit(
            piutang_id=piutang.id,
            tanggal=date.today(),
            payments=[PaymentDetail(metode=PaymentMethod.TUNAI, nominal=Decimal("150000"), kas_jenis="KAS_UTAMA")],
        ),
        user_id=None,
    )

    db.expire_all()
    tx = db.query(TransaksiPenjualanBengkel).filter(TransaksiPenjualanBengkel.id == tx.id).one()
    assert tx.status_bayar == PaymentStatus.LUNAS
    assert tx.jumlah_bayar == tx.grand_total
