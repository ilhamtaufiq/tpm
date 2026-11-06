"""Perubahan Modal: beban operasional ditampilkan per periode, bukan kumulatif sejak anchor.

Periode di masa depan (belum ada transaksi) tidak boleh menampilkan beban periode lain.
"""
from datetime import timedelta

from app.database import SessionLocal
from app.services.reports.modal_service import ModalService
from app.utils.helpers import get_jakarta_date


def test_beban_periode_depan_nol():
    db = SessionLocal()
    try:
        depan = get_jakarta_date() + timedelta(days=400)
        awal = depan.replace(day=1)
        akhir = depan
        m = ModalService(db).get_report(awal, akhir)
        assert m["pengurangan"]["beban_operasional"]["total"] == 0
        # Penyesuaian spare part juga per periode (sisanya masuk mutasi_modal_sebelumnya).
        assert m["penambahan"]["koreksi_stok_sparepart"] == 0
        assert m["penambahan"]["penyesuaian_harga_beli_sparepart"] == 0
        assert m["is_balanced"] is True
    finally:
        db.close()
