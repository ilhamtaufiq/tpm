"""Regresi Laporan Perubahan Modal setelah import saldo awal periode berikutnya.

1. Setoran modal manual (`nomor_referensi` NULL) dulu terbuang oleh filter
   `~nomor_referensi.like("IMP-%")` (NOT LIKE NULL = NULL) → setoran tampil 0
   dan nilainya tertelan baris "penyesuaian backdate".
2. Modal awal Rp2.242.611.225 dulu dipaksa untuk SEMUA anchor; kini hanya
   anchor 2026-09-12, anchor lain memakai nilai hitung neraca(anchor).
3. Import mobil wajib mengisi `harga_beli_awal = harga_beli`, kalau tidak
   seluruh harga beli terbaca "revaluasi mobil".
"""
import json
from datetime import date
from decimal import Decimal

from app.database.connection import SessionLocal
from app.models.keuangan import KasBank
from app.models.mobil import Mobil
from app.models.system_setting import SystemSetting
from app.services.data_import_service import DataImportService
from app.services.reports.modal_service import ModalService
from app.utils.constants import KasBankJenis, KasBankSource, KasBankType, PaymentMethod

NOMOR_UJI = "TEST-SETORAN-NULLREF"


def test_setoran_tanpa_nomor_referensi_terhitung():
    db = SessionLocal()
    hari = date(2099, 1, 1)  # di luar data nyata agar tidak bercampur
    try:
        svc = ModalService(db)
        sebelum = svc._setoran_modal(hari, hari)
        kb = KasBank(
            nomor_transaksi=NOMOR_UJI,
            tanggal=hari,
            jenis=KasBankJenis.BANK_UTAMA,
            metode_bayar=PaymentMethod.TRANSFER,
            tipe=KasBankType.MASUK,
            nominal=Decimal("10000000"),
            sumber=KasBankSource.MODAL,
            nomor_referensi=None,
            keterangan="Setoran modal uji",
        )
        kb.calculate_saldo(Decimal("0"))
        db.add(kb)
        db.flush()
        assert svc._setoran_modal(hari, hari) - sebelum == 10000000.0
    finally:
        db.rollback()
        db.close()


def test_modal_awal_override_hanya_untuk_anchor_legacy():
    db = SessionLocal()
    row = db.query(SystemSetting).filter(
        SystemSetting.key == ModalService.FROZEN_MODAL_AWAL_KEY
    ).first()
    asli = row.value if row else None
    if row is not None:  # mulai tanpa nilai beku agar override/hitung yang diuji
        db.delete(row)
        db.commit()
    try:
        svc = ModalService(db)
        assert svc._frozen_modal_awal(date(2026, 10, 4), 123.45) == 123.45
        db.query(SystemSetting).filter(
            SystemSetting.key == ModalService.FROZEN_MODAL_AWAL_KEY
        ).delete()
        db.commit()
        assert svc._frozen_modal_awal(date(2026, 9, 12), 123.45) == 2242611225.0
    finally:
        row = db.query(SystemSetting).filter(
            SystemSetting.key == ModalService.FROZEN_MODAL_AWAL_KEY
        ).first()
        if row is not None:
            db.delete(row)
            db.commit()
        if asli is not None:
            db.add(SystemSetting(key=ModalService.FROZEN_MODAL_AWAL_KEY, value=asli))
        db.commit()
        db.close()


def test_import_mobil_mengisi_harga_beli_awal():
    db = SessionLocal()
    try:
        svc = DataImportService(db)
        res = svc._apply_mobil(
            [{
                "_row": 2, "merek": "UJI", "model": "IMPORT", "tahun": 2020,
                "warna": "PUTIH", "nomor_plat": "T 9999 UJI", "harga_beli": 125000000,
            }],
            dry=False,
            user_id=None,
        )
        assert res["errors"] == [] and res["created"] == 1
        db.flush()
        m = db.query(Mobil).filter(Mobil.nomor_plat == "T 9999 UJI").one()
        assert m.harga_beli_awal == m.harga_beli == Decimal("125000000")
    finally:
        db.rollback()
        db.close()
