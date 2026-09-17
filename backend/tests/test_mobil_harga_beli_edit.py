"""Regresi: edit harga beli mobil (termasuk yang sudah DP) tidak boleh memunculkan selisih.

Bug asal: `MobilForm` hanya mengirim `harga_beli` saat create, jadi input edit
dibuang diam-diam. Kalau nilai itu tersimpan, `persediaan_mobil` naik tapi
`modal_awal` beku (lihat `db4a9170`) tidak ikut bergerak → Laporan Perubahan
Modal selisih sebesar koreksinya.

Perbaikan: kolom `mobil.harga_beli_awal` sebagai basis revaluasi. Selisih
`harga_beli − harga_beli_awal` diakui sebagai setoran modal non-kas
(`ModalService.get_report` → `setoran_non_kas_import`). Hutang beli yang masih
terbuka ikut digeser (aset & kewajiban naik bersama), sisa hutang tidak.

Catatan: `MobilService.update()` melakukan `commit()`, jadi tes ini WAJIB
membersihkan barisnya di `finally` (pola sama dengan `test_piutang_dp_invarian`).
"""
from datetime import date
from decimal import Decimal

import pytest

from app.database.connection import SessionLocal
from app.models.keuangan import HutangUsaha, PembayaranHutang
from app.models.mobil import Mobil
from app.schemas.mobil import MobilUpdate
from app.services.mobil_service import MobilService
from app.services.reports.modal_service import ModalService
from app.utils.constants import CarStatus, HutangSource, HutangStatus

NOMOR_UJI = "TEST-HBARGAWAL"
TAMBAHAN = Decimal("5000000")


def _laporan(db):
    """Laporan Perubahan Modal pada rentang anchor — sumber `selisih`."""
    anchor = ModalService(db)._saldo_awal_date() or date(2026, 9, 12)
    return ModalService(db).get_report(anchor, date.today())


def _mobil_uji(db):
    """Mobil stok belum terjual tanpa hutang beli terbuka — paling bersih untuk uji."""
    m = (
        db.query(Mobil)
        .filter(Mobil.deleted_at.is_(None), Mobil.status != CarStatus.TERJUAL)
        .order_by(Mobil.id)
        .first()
    )
    if m is None:
        pytest.skip("tidak ada mobil stok di DB ini")
    return m


def _bersihkan(db, mobil_id: int, harga_awal: Decimal):
    """Callback idempoten: buang hutang uji + pulihkan harga mobil + revaluasinya."""
    for h in db.query(HutangUsaha).filter(HutangUsaha.nomor_hutang == NOMOR_UJI).all():
        db.query(PembayaranHutang).filter(PembayaranHutang.hutang_id == h.id).delete()
        db.delete(h)
    m = db.get(Mobil, mobil_id)
    if m is not None:
        m.harga_beli = harga_awal
        m.harga_beli_awal = harga_awal
    db.commit()


def _assert_balance(db):
    laporan = _laporan(db)
    assert laporan["is_balanced"] is True, (
        f"laporan tidak balance setelah pemulihan: selisih={laporan['selisih']}"
    )
    return laporan


def test_edit_harga_beli_tidak_mengubah_selisih():
    """Naikkan harga beli unit stok → `selisih` harus tetap sama (bukan +delta)."""
    db = SessionLocal()
    mobil = _mobil_uji(db)
    mobil_id, harga_awal = mobil.id, Decimal(str(mobil.harga_beli))
    try:
        sebelum = _assert_balance(db)
        selisih_awal = sebelum["selisih"]
        stok_awal = sebelum["info"]["aset"]["stok_mobil"]["total"]

        MobilService(db).update(mobil_id, MobilUpdate(harga_beli=harga_awal + TAMBAHAN))

        laporan = _laporan(db)
        assert laporan["selisih"] == selisih_awal, "edit harga beli memunculkan selisih"
        assert laporan["is_balanced"] is True
        # Stok naik sebesar koreksi, dan revaluasinya tampil sebagai jejak audit.
        assert laporan["info"]["aset"]["stok_mobil"]["total"] == stok_awal + float(TAMBAHAN)
        assert laporan["penambahan"]["penyesuaian_harga_beli_mobil"] == float(TAMBAHAN)
    finally:
        _bersihkan(db, mobil_id, harga_awal)
        _assert_balance(db)
        db.close()


def test_edit_harga_beli_di_unit_booking():
    """Unit dengan DP penjualan (status BOOKING) tetap boleh dikoreksi harga belinya."""
    db = SessionLocal()
    booking = (
        db.query(Mobil)
        .filter(Mobil.deleted_at.is_(None), Mobil.status == CarStatus.BOOKING)
        .first()
    )
    if booking is None:
        pytest.skip("tidak ada unit BOOKING di DB ini")
    mobil_id, harga_awal = booking.id, Decimal(str(booking.harga_beli))
    try:
        selisih_awal = _assert_balance(db)["selisih"]

        MobilService(db).update(mobil_id, MobilUpdate(harga_beli=harga_awal + TAMBAHAN))

        laporan = _laporan(db)
        assert laporan["selisih"] == selisih_awal, "booking memunculkan selisih"
        assert laporan["is_balanced"] is True

        # Snapshot HPP transaksi ikut disegarkan supaya tidak basi saat pelunasan.
        from app.models.mobil import TransaksiPenjualanMobil

        tx = (
            db.query(TransaksiPenjualanMobil)
            .filter(TransaksiPenjualanMobil.mobil_id == mobil_id)
            .first()
        )
        if tx is not None:
            assert Decimal(str(tx.total_modal)) == booking.hpp
            assert tx.laba_investor == 0, "laba investor harus tetap 0 sampai LUNAS"
    finally:
        _bersihkan(db, mobil_id, harga_awal)
        db.close()


def test_hutang_terbuka_ikut_digeser_bukan_jadi_revaluasi():
    """Harga naik saat hutang beli belum lunas → sisa hutang naik, revaluasi 0."""
    from fastapi import HTTPException

    db = SessionLocal()
    mobil = _mobil_uji(db)
    mobil_id, harga_awal = mobil.id, Decimal(str(mobil.harga_beli))
    dibayar = Decimal("20000000")
    try:
        db.add(HutangUsaha(
            nomor_hutang=NOMOR_UJI,
            tanggal=date.today(),
            nama_kreditur="Uji Harga Beli",
            sumber=HutangSource.PEMBELIAN_MOBIL,
            referensi_id=mobil_id,
            nomor_referensi=mobil.kode,
            nominal_hutang=harga_awal,
            total_dibayar=dibayar,
            sisa_hutang=harga_awal - dibayar,
            status=HutangStatus.SEBAGIAN,
        ))
        db.commit()

        selisih_awal = _laporan(db)["selisih"]
        MobilService(db).update(mobil_id, MobilUpdate(harga_beli=harga_awal + TAMBAHAN))

        hutang = db.query(HutangUsaha).filter(HutangUsaha.nomor_hutang == NOMOR_UJI).one()
        # Nilai tambahan didanai hutang → bukan setoran ekuitas → laporan tetap balance.
        assert _laporan(db)["selisih"] == selisih_awal
        assert hutang.nominal_hutang == harga_awal + TAMBAHAN
        assert hutang.sisa_hutang == harga_awal + TAMBAHAN - dibayar
        assert Decimal(str(db.get(Mobil, mobil_id).harga_beli_awal)) == harga_awal + TAMBAHAN

        # Harga tak boleh turun di bawah yang sudah dibayar.
        with pytest.raises(HTTPException) as err:
            MobilService(db).update(mobil_id, MobilUpdate(harga_beli=dibayar - 1))
        assert err.value.status_code == 400
    finally:
        _bersihkan(db, mobil_id, harga_awal)
        _assert_balance(db)
        db.close()


def test_unit_terjual_tetap_tidak_bisa_diedit():
    """Guard lama tidak boleh hilang oleh fitur baru."""
    from fastapi import HTTPException

    db = SessionLocal()
    terjual = (
        db.query(Mobil)
        .filter(Mobil.deleted_at.is_(None), Mobil.status == CarStatus.TERJUAL)
        .first()
    )
    if terjual is None:
        pytest.skip("tidak ada unit TERJUAL di DB ini")
    harga_awal = Decimal(str(terjual.harga_beli))
    try:
        with pytest.raises(HTTPException) as err:
            MobilService(db).update(terjual.id, MobilUpdate(harga_beli=harga_awal + TAMBAHAN))
        assert err.value.status_code == 400
    finally:
        assert Decimal(str(db.get(Mobil, terjual.id).harga_beli)) == harga_awal
        db.close()
