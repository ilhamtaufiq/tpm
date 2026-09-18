"""Regresi: piutang penjualan mobil nominal penuh + DP punya baris PembayaranPiutang.

Bug asal (selisih DP Sopian, MBL2609170001): `create` menulis `nominal_piutang =
sisa_bayar` (harga jual − DP) dan DP hanya masuk kas, tanpa baris PembayaranPiutang.
Laporan (`base.py get_piutang_balance`) = Σ nominal − Σ PembayaranPiutang, jadi DP
awal tak tampil di riwayat pembayaran meski uang sudah masuk kas.

Perbaikan: samakan pola bengkel/muatan — `nominal_piutang = harga_jual`, DP ditulis
sebagai PembayaranPiutang. Invarian: Σ pembayaran == total_dibayar, dan
nominal − Σ pembayaran == sisa_piutang.
"""
from datetime import date
from decimal import Decimal

from sqlalchemy import func

from app.database.connection import SessionLocal
from app.models.keuangan import KasBank, PembayaranPiutang, PiutangUsaha
from app.models.mobil import Mobil, TransaksiPenjualanMobil
from app.schemas.mobil import PaymentItem, TransaksiMobilCreate
from app.services.penjualan_mobil_service import PenjualanMobilService
from app.utils.constants import KasBankSource, KasBankType, CarStatus, PiutangSource

HARGA = Decimal("10000000")
DP = Decimal("2000000")


def _bayar_tercatat(db, piutang_id: int) -> Decimal:
    return Decimal(str(db.query(func.sum(PembayaranPiutang.nominal)).filter(
        PembayaranPiutang.piutang_id == piutang_id
    ).scalar() or 0))


def _mobil_uji(db):
    """Mobil TERSEDIA tanpa transaksi jual-beli terbuka. Jangan sentuh mobil_id=49."""
    m = (
        db.query(Mobil)
        .filter(
            Mobil.deleted_at.is_(None),
            Mobil.status == CarStatus.TERSEDIA,
        )
        .order_by(Mobil.id)
        .first()
    )
    if m is None:
        return None
    ada_trx = db.query(func.count(TransaksiPenjualanMobil.id)).filter(
        TransaksiPenjualanMobil.mobil_id == m.id,
        TransaksiPenjualanMobil.status_bayar != "BATAL",
    ).scalar()
    if ada_trx:
        return None
    return m


def _bersihkan(db, nomor: str, mobil_id: int, status_awal: str):
    """Hapus pembayaran → piutang → kas → transaksi uji; pulihkan status mobil."""
    piutang_ids = [p.id for p in db.query(PiutangUsaha).filter(
        PiutangUsaha.nomor_referensi == nomor).all()]
    if piutang_ids:
        db.query(PembayaranPiutang).filter(
            PembayaranPiutang.piutang_id.in_(piutang_ids)
        ).delete(synchronize_session=False)
        db.query(PiutangUsaha).filter(PiutangUsaha.id.in_(piutang_ids)).delete(
            synchronize_session=False)
    db.query(KasBank).filter(
        KasBank.nomor_referensi == nomor, KasBank.sumber == KasBankSource.JUAL_BELI_MOBIL
    ).delete(synchronize_session=False)
    db.query(TransaksiPenjualanMobil).filter(
        TransaksiPenjualanMobil.nomor_transaksi == nomor
    ).delete(synchronize_session=False)
    m = db.get(Mobil, mobil_id)
    if m is not None:
        m.status = status_awal
        m.tanggal_terjual = None
    db.commit()


def test_create_dp_writes_pembayaran_full_nominal():
    """Create DP parsial: nominal=full harga, DP jadi baris pembayaran."""
    db = SessionLocal()
    mobil = _mobil_uji(db)
    if mobil is None:
        db.close()
        return  # tidak ada mobil TERSEDIA bersih; skip
    mobil_id, status_awal = mobil.id, mobil.status
    nomor = None
    try:
        svc = PenjualanMobilService(db)
        trx = svc.create(TransaksiMobilCreate(
            tanggal=date(2026, 9, 18),
            mobil_id=mobil_id,
            nama_pembeli="TEST DP MOBIL",
            harga_jual=HARGA,
            dp=DP,
            metode_bayar="TRANSFER",
            payments=[PaymentItem(metode="TRANSFER", nominal=DP)],
        ), user_id=None)
        nomor = trx.nomor_transaksi

        piutang = db.query(PiutangUsaha).filter(
            PiutangUsaha.nomor_referensi == nomor,
            PiutangUsaha.sumber == PiutangSource.JUAL_BELI_MOBIL,
        ).first()
        assert piutang is not None
        assert piutang.nominal_piutang == HARGA, "nominal harus harga jual penuh"
        assert piutang.total_dibayar == DP
        assert piutang.sisa_piutang == HARGA - DP
        assert _bayar_tercatat(db, piutang.id) == DP, "DP harus punya baris pembayaran"

        kas = db.query(KasBank).filter(
            KasBank.nomor_referensi == nomor,
            KasBank.sumber == KasBankSource.JUAL_BELI_MOBIL,
            KasBank.tipe == KasBankType.MASUK,
        ).all()
        assert len(kas) == 1, "create harus tulis 1 kas (bukan 2/0)"
        assert kas[0].nominal == DP
    finally:
        if nomor:
            _bersihkan(db, nomor, mobil_id, status_awal)
        db.close()


def test_update_payment_writes_pembayaran_no_double_kas():
    """Cicilan via update_payment: Σ pembayaran naik, kas tidak dobel."""
    db = SessionLocal()
    mobil = _mobil_uji(db)
    if mobil is None:
        db.close()
        return
    mobil_id, status_awal = mobil.id, mobil.status
    nomor = None
    try:
        svc = PenjualanMobilService(db)
        trx = svc.create(TransaksiMobilCreate(
            tanggal=date(2026, 9, 18),
            mobil_id=mobil_id,
            nama_pembeli="TEST DP MOBIL",
            harga_jual=HARGA,
            dp=DP,
            metode_bayar="TRANSFER",
            payments=[PaymentItem(metode="TRANSFER", nominal=DP)],
        ), user_id=None)
        nomor = trx.nomor_transaksi

        svc.update_payment(
            trx.id, Decimal("1000000"),
            payments=[("TRANSFER", Decimal("1000000"), None)],
            user_id=None,
        )
        piutang = db.query(PiutangUsaha).filter(
            PiutangUsaha.nomor_referensi == nomor,
            PiutangUsaha.sumber == PiutangSource.JUAL_BELI_MOBIL,
        ).first()
        assert _bayar_tercatat(db, piutang.id) == DP + Decimal("1000000")
        assert piutang.total_dibayar == DP + Decimal("1000000")
        assert piutang.sisa_piutang == HARGA - DP - Decimal("1000000")

        kas = db.query(KasBank).filter(
            KasBank.nomor_referensi == nomor,
            KasBank.sumber == KasBankSource.JUAL_BELI_MOBIL,
            KasBank.tipe == KasBankType.MASUK,
        ).all()
        assert len(kas) == 2, "create + update_payment = 2 kas, bukan 3"
    finally:
        if nomor:
            _bersihkan(db, nomor, mobil_id, status_awal)
        db.close()


def test_lunas_create_skips_piutang():
    """DP >= harga jual: lunas penuh, tidak bikin piutang."""
    db = SessionLocal()
    mobil = _mobil_uji(db)
    if mobil is None:
        db.close()
        return
    mobil_id, status_awal = mobil.id, mobil.status
    nomor = None
    try:
        svc = PenjualanMobilService(db)
        trx = svc.create(TransaksiMobilCreate(
            tanggal=date(2026, 9, 18),
            mobil_id=mobil_id,
            nama_pembeli="TEST DP MOBIL",
            harga_jual=HARGA,
            dp=HARGA,
            metode_bayar="TRANSFER",
            payments=[PaymentItem(metode="TRANSFER", nominal=HARGA)],
        ), user_id=None)
        nomor = trx.nomor_transaksi
        assert db.query(PiutangUsaha).filter(
            PiutangUsaha.nomor_referensi == nomor,
            PiutangUsaha.sumber == PiutangSource.JUAL_BELI_MOBIL,
        ).first() is None, "lunas penuh tidak boleh bikin piutang"
    finally:
        if nomor:
            _bersihkan(db, nomor, mobil_id, status_awal)
        db.close()