"""Regresi: Σ PembayaranPiutang harus == piutang.total_dibayar.

Bug asal (selisih Rp3.500.000 di Laporan Perubahan Modal, txn BGL2609150004):
order dibuka dengan `grand_total=0` + DP. Cabang `create()` saat `grand_total == 0`
menulis kas MASUK tanpa baris PembayaranPiutang (piutang belum ada). Saat tagihan
akhirnya jadi lewat `update()`, piutang dibuat dengan `total_dibayar = DP` — tapi
baris pembayarannya tidak pernah ada.

Laporan (base.py `piutang_usaha`, dipakai modal_service) menghitung piutang sebagai
Σ nominal − Σ PembayaranPiutang; Neraca memakai `sisa_piutang`. Selisih keduanya
muncul sebagai "Modal Akhir (Aktual)" lebih besar dari "(Teoritis)".
"""
from datetime import date
from decimal import Decimal

from sqlalchemy import func

from app.database.connection import SessionLocal
from app.models.bengkel import TransaksiPenjualanBengkel
from app.models.keuangan import KasBank, PembayaranPiutang, PiutangUsaha
from app.schemas.bengkel import (
    DetailServiceCreate,
    PaymentItem,
    TransaksiBengkelCreate,
    TransaksiBengkelUpdate,
)
from app.services.transaksi_bengkel_service import TransaksiBengkelService
from app.utils.constants import KasBankSource, PiutangSource, PiutangStatus

DP = Decimal("3500000")
TAGIHAN = Decimal("6725000")
PELUNASAN = TAGIHAN - DP


def _bayar_tercatat(db, piutang_id: int) -> Decimal:
    return Decimal(str(db.query(func.sum(PembayaranPiutang.nominal)).filter(
        PembayaranPiutang.piutang_id == piutang_id
    ).scalar() or 0))


def _bersihkan(db, nomor: str) -> None:
    piutang_ids = [p.id for p in db.query(PiutangUsaha).filter(
        PiutangUsaha.nomor_referensi == nomor).all()]
    if piutang_ids:
        db.query(PembayaranPiutang).filter(
            PembayaranPiutang.piutang_id.in_(piutang_ids)
        ).delete(synchronize_session=False)
    db.query(PiutangUsaha).filter(PiutangUsaha.nomor_referensi == nomor).delete(
        synchronize_session=False)
    db.query(KasBank).filter(
        KasBank.nomor_referensi == nomor, KasBank.sumber == KasBankSource.BENGKEL
    ).delete(synchronize_session=False)
    db.query(TransaksiPenjualanBengkel).filter(
        TransaksiPenjualanBengkel.nomor_transaksi == nomor
    ).delete(synchronize_session=False)
    db.commit()


def test_dp_sebelum_tagihan_tidak_membuat_piutang_overstated():
    """DP → tagihan muncul → pelunasan. Σ pembayaran harus == total_dibayar."""
    db = SessionLocal()
    nomor = None
    try:
        svc = TransaksiBengkelService(db)

        # 1. Order dibuka: belum ada tagihan (grand_total=0), customer bayar DP.
        trx = svc.create(TransaksiBengkelCreate(
            tanggal=date(2026, 9, 15),
            nama_customer="TEST DP INVARIAN",
            nomor_plat="B 0000 TEST",
            jenis_kendaraan="Test",
            detail_parts=[],
            detail_services=[],
            metode_bayar="TRANSFER",
            jumlah_bayar=DP,
            payments=[PaymentItem(metode="TRANSFER", jumlah=DP)],
        ), user_id=None)
        nomor = trx.nomor_transaksi
        assert trx.grand_total == 0, "order kosong harus grand_total=0"
        assert db.query(PiutangUsaha).filter(
            PiutangUsaha.nomor_referensi == nomor).first() is None, \
            "grand_total=0 belum boleh bikin piutang"

        # 2. Tagihan jadi → piutang lahir membawa DP.
        svc.update(trx.id, TransaksiBengkelUpdate(
            tanggal=date(2026, 9, 15),
            nama_customer="TEST DP INVARIAN",
            nomor_plat="B 0000 TEST",
            jenis_kendaraan="Test",
            kategori="umum",
            detail_parts=[],
            detail_services=[DetailServiceCreate(
                nama_jasa="Servis Test", harga=TAGIHAN, qty=1)],
            diskon=Decimal("0"),
        ), user_id=None)

        piutang = db.query(PiutangUsaha).filter(
            PiutangUsaha.nomor_referensi == nomor,
            PiutangUsaha.sumber == PiutangSource.BENGKEL,
        ).first()
        assert piutang is not None, "tagihan > 0 harus bikin piutang"
        assert piutang.total_dibayar == DP, "piutang harus mewarisi DP"

        # INTI REGRESI: DP itu harus punya baris pembayaran.
        assert _bayar_tercatat(db, piutang.id) == DP

        # 3. Pelunasan sisanya.
        svc.update_payment(
            trx.id, PELUNASAN, metode_bayar="TRANSFER",
            payments=[PaymentItem(metode="TRANSFER", jumlah=PELUNASAN)],
        )
        db.refresh(piutang)
        assert piutang.sisa_piutang == Decimal("0")

        # Invarian akhir: Σ pembayaran == total_dibayar.
        assert _bayar_tercatat(db, piutang.id) == piutang.total_dibayar

        # Dan laporan tidak overstated: Σ nominal − Σ pembayaran == sisa_piutang.
        nominal = Decimal(str(piutang.nominal_piutang or 0))
        assert nominal - _bayar_tercatat(db, piutang.id) == piutang.sisa_piutang
    finally:
        if nomor:
            _bersihkan(db, nomor)
        db.close()


def test_tidak_ada_piutang_overstated_di_seluruh_db():
    """Penjaga luas: satu pun baris piutang eksternal tak boleh overstated.

    Inilah kondisi yang memunculkan "selisih rekonsiliasi" di laporan modal.
    """
    db = SessionLocal()
    try:
        rows = db.query(PiutangUsaha).filter(
            PiutangUsaha.is_internal != True,
            PiutangUsaha.status != PiutangStatus.BATAL,
        ).all()
        buruk = []
        for p in rows:
            dilaporkan = Decimal(str(p.nominal_piutang or 0)) - _bayar_tercatat(db, p.id)
            beda = dilaporkan - Decimal(str(p.sisa_piutang or 0))
            if abs(beda) >= 1:
                buruk.append((p.id, p.nomor_referensi, float(beda)))
        assert buruk == [], f"piutang overstated (nominal−bayar ≠ sisa): {buruk}"
    finally:
        db.close()
