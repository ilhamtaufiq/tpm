"""
Tes Regresi Keseimbangan Laporan Keuangan (Neraca & Perubahan Modal)
untuk dua kasus fitur baru:
1. Void & Edit Item Transaksi Bengkel yang terhubung ke Unit Mobil (Jual Beli Mobil).
2. Void & Edit Item Transaksi Bengkel yang terhubung ke Armada / Muatan Jasa Angkut.

Memastikan setelah aksi Edit Item maupun Void Transaksi Bengkel:
- Laporan Neraca tetap BALANCE (is_balanced == True, selisih < 100).
- Laporan Perubahan Ekuitas/Modal tetap BALANCE (is_balanced == True, selisih < 100).

Jalankan:
cd backend && venv/Scripts/python.exe -m pytest tests/test_bengkel_void_and_edit_balance.py -v
"""

from datetime import date
from decimal import Decimal
import pytest

from app.database import SessionLocal
from app.models.bengkel import SparePart, TransaksiPenjualanBengkel
from app.models.mobil import Mobil
from app.models.jasa_angkut import MuatanJasaAngkut, ArmadaJasaAngkut
from app.schemas.bengkel import TransaksiBengkelCreate, DetailPartCreate, DetailServiceCreate
from app.services.transaksi_bengkel_service import TransaksiBengkelService
from app.services.reports.neraca_service import NeracaService
from app.services.reports.modal_service import ModalService
from app.utils.constants import WorkshopStatus, PaymentMethod, CarStatus

TOLERANCE = 100.0  # Toleransi selisih rekonsiliasi (Rp100)


@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    yield session
    session.close()


def _assert_financial_reports_balanced(db_session, context_msg=""):
    """Helper untuk memverifikasi bahwa Neraca dan Perubahan Modal tetap 100% balance."""
    today = date.today()
    anchor_date = ModalService(db_session)._saldo_awal_date() or date(2026, 9, 12)

    # 1. Verifikasi Laporan Neraca
    neraca_report = NeracaService(db_session).get_report(as_of_date=today)
    neraca_selisih = abs(neraca_report.get("selisih", 0))
    neraca_balanced = neraca_report.get("is_balanced", False)

    assert neraca_balanced and neraca_selisih < TOLERANCE, (
        f"[{context_msg}] Laporan Neraca TIDAK balance! "
        f"selisih: {neraca_report.get('selisih')}, is_balanced: {neraca_balanced}"
    )

    # 2. Verifikasi Laporan Perubahan Modal
    modal_report = ModalService(db_session).get_report(anchor_date, today)
    modal_selisih = abs(modal_report.get("selisih", 0))
    modal_balanced = modal_report.get("is_balanced", False)

    assert modal_balanced and modal_selisih < TOLERANCE, (
        f"[{context_msg}] Laporan Perubahan Modal TIDAK balance! "
        f"selisih: {modal_report.get('selisih')}, is_balanced: {modal_balanced}"
    )


def test_kasus_1_bengkel_mobil_edit_dan_void_balance(db):
    """Kasus 1: Edit & Void Transaksi Bengkel kategori jual_beli_mobil (Mobil Detail).

    Skenario:
    1. Ambil unit mobil yang tersedia.
    2. Ambil sparepart & buat transaksi bengkel untuk mobil tersebut.
    3. Cek Neraca & Perubahan Modal -> Wajib Balance.
    4. Lakukan Edit Item (mengubah qty / menambah service).
    5. Cek Neraca & Perubahan Modal pasca-edit -> Wajib Balance.
    6. Lakukan Void Transaksi.
    7. Cek Neraca & Perubahan Modal pasca-void -> Wajib Balance.
    """
    mobil = (
        db.query(Mobil)
        .filter(Mobil.deleted_at.is_(None), Mobil.status == CarStatus.TERSEDIA)
        .first()
    )
    if not mobil:
        pytest.skip("Tidak ada unit mobil TERSEDIA untuk testing")

    sparepart = (
        db.query(SparePart)
        .filter(SparePart.deleted_at.is_(None), SparePart.stok > 5)
        .first()
    )
    if not sparepart:
        pytest.skip("Tidak ada sparepart dengan stok cukup untuk testing")

    service = TransaksiBengkelService(db)
    transaksi = None

    try:
        # A. Create Transaksi Bengkel Mobil
        create_payload = TransaksiBengkelCreate(
            tanggal=date.today(),
            kategori="jual_beli_mobil",
            mobil_id=mobil.id,
            nomor_plat=mobil.nomor_plat,
            jenis_kendaraan=f"{mobil.merek} {mobil.model}",
            detail_parts=[
                DetailPartCreate(
                    spare_part_id=sparepart.id,
                    qty=2,
                    harga_jual=Decimal("150000"),
                )
            ],
            detail_services=[
                DetailServiceCreate(
                    nama_jasa="Jasa Repair Engine Unit",
                    harga=Decimal("100000"),
                    qty=1,
                )
            ],
            status_pengerjaan=WorkshopStatus.SELESAI,
            metode_bayar=PaymentMethod.INTERNAL,
            jumlah_bayar=Decimal("0"),
        )

        transaksi = service.create(create_payload, user_id=None)
        assert transaksi is not None
        assert transaksi.id is not None

        # Verifikasi laporan keuangan awal pasca-create
        _assert_financial_reports_balanced(db, "Kasus 1 - Awal Create Nota Bengkel Mobil")

        # B. Test Edit Item (Ubah Qty & Tambah Jasa)
        edit_payload = TransaksiBengkelCreate(
            tanggal=date.today(),
            kategori="jual_beli_mobil",
            mobil_id=mobil.id,
            nomor_plat=mobil.nomor_plat,
            jenis_kendaraan=f"{mobil.merek} {mobil.model}",
            detail_parts=[
                DetailPartCreate(
                    spare_part_id=sparepart.id,
                    qty=3,
                    harga_jual=Decimal("150000"),
                )
            ],
            detail_services=[
                DetailServiceCreate(
                    nama_jasa="Jasa Repair Engine Unit (Revised)",
                    harga=Decimal("200000"),
                    qty=1,
                )
            ],
            status_pengerjaan=WorkshopStatus.SELESAI,
            metode_bayar=PaymentMethod.INTERNAL,
            jumlah_bayar=Decimal("0"),
        )

        updated_transaksi = service.update(transaksi.id, edit_payload, user_id=None)
        assert updated_transaksi.grand_total == Decimal("650000")  # (3 * 150k) + 200k

        # Verifikasi laporan keuangan pasca-edit
        _assert_financial_reports_balanced(db, "Kasus 1 - Pasca Edit Item Nota Bengkel Mobil")

        # C. Test Void Transaksi Bengkel Mobil
        void_success = service.void_transaction(transaksi.id)
        assert void_success is True

        # Verifikasi laporan keuangan pasca-void
        _assert_financial_reports_balanced(db, "Kasus 1 - Pasca Void Nota Bengkel Mobil")

    finally:
        # Cleanup
        if transaksi:
            tx = db.query(TransaksiPenjualanBengkel).filter(TransaksiPenjualanBengkel.id == transaksi.id).first()
            if tx and tx.status_bayar != "BATAL":
                try:
                    service.void_transaction(transaksi.id)
                except Exception:
                    pass


def test_kasus_2_bengkel_jasa_angkut_edit_dan_void_balance(db):
    """Kasus 2: Edit & Void Transaksi Bengkel kategori jasa_angkut (Armada Jasa Angkut).

    Skenario:
    1. Ambil muatan / armada jasa angkut.
    2. Ambil sparepart & buat transaksi perbaikan bengkel untuk muatan tersebut.
    3. Cek Neraca & Perubahan Modal -> Wajib Balance.
    4. Lakukan Edit Item (modifikasi rincian perbaikan).
    5. Cek Neraca & Perubahan Modal pasca-edit -> Wajib Balance.
    6. Lakukan Void Transaksi perbaikan.
    7. Cek Neraca & Perubahan Modal pasca-void -> Wajib Balance.
    """
    muatan = (
        db.query(MuatanJasaAngkut)
        .order_by(MuatanJasaAngkut.id.desc())
        .first()
    )
    armada = (
        db.query(ArmadaJasaAngkut)
        .filter(ArmadaJasaAngkut.is_active == True)
        .first()
    )
    if not muatan and not armada:
        pytest.skip("Tidak ada data muatan atau armada jasa angkut untuk testing")

    sparepart = (
        db.query(SparePart)
        .filter(SparePart.deleted_at.is_(None), SparePart.stok > 5)
        .first()
    )
    if not sparepart:
        pytest.skip("Tidak ada sparepart dengan stok cukup untuk testing")

    service = TransaksiBengkelService(db)
    transaksi = None

    try:
        # A. Create Transaksi Perbaikan Bengkel Jasa Angkut
        muatan_id = muatan.id if muatan else None
        armada_id = armada.id if armada else None
        nopol = armada.nopol if armada else "F 9999 JA"

        create_payload = TransaksiBengkelCreate(
            tanggal=date.today(),
            kategori="jasa_angkut",
            muatan_id=muatan_id,
            armada_id=armada_id,
            nomor_plat=nopol,
            jenis_kendaraan="Truks Jasa Angkut",
            detail_parts=[
                DetailPartCreate(
                    spare_part_id=sparepart.id,
                    qty=1,
                    harga_jual=Decimal("200000"),
                )
            ],
            detail_services=[
                DetailServiceCreate(
                    nama_jasa="Servis Rutin Armada",
                    harga=Decimal("150000"),
                    qty=1,
                )
            ],
            status_pengerjaan=WorkshopStatus.SELESAI,
            metode_bayar=PaymentMethod.INTERNAL,
            jumlah_bayar=Decimal("0"),
        )

        transaksi = service.create(create_payload, user_id=None)
        assert transaksi is not None
        assert transaksi.id is not None

        # Verifikasi laporan keuangan awal pasca-create
        _assert_financial_reports_balanced(db, "Kasus 2 - Awal Create Nota Perbaikan Armada JA")

        # B. Test Edit Item Perbaikan Armada
        edit_payload = TransaksiBengkelCreate(
            tanggal=date.today(),
            kategori="jasa_angkut",
            muatan_id=muatan_id,
            armada_id=armada_id,
            nomor_plat=nopol,
            jenis_kendaraan="Truks Jasa Angkut",
            detail_parts=[
                DetailPartCreate(
                    spare_part_id=sparepart.id,
                    qty=2,
                    harga_jual=Decimal("200000"),
                )
            ],
            detail_services=[
                DetailServiceCreate(
                    nama_jasa="Servis Rutin & Tune Up Armada",
                    harga=Decimal("250000"),
                    qty=1,
                )
            ],
            status_pengerjaan=WorkshopStatus.SELESAI,
            metode_bayar=PaymentMethod.INTERNAL,
            jumlah_bayar=Decimal("0"),
        )

        updated_transaksi = service.update(transaksi.id, edit_payload, user_id=None)
        assert updated_transaksi.grand_total == Decimal("650000")  # (2 * 200k) + 250k

        # Verifikasi laporan keuangan pasca-edit
        _assert_financial_reports_balanced(db, "Kasus 2 - Pasca Edit Item Nota Perbaikan Armada JA")

        # C. Test Void Transaksi Perbaikan Armada
        void_success = service.void_transaction(transaksi.id)
        assert void_success is True

        # Verifikasi laporan keuangan pasca-void
        _assert_financial_reports_balanced(db, "Kasus 2 - Pasca Void Nota Perbaikan Armada JA")

    finally:
        # Cleanup
        if transaksi:
            tx = db.query(TransaksiPenjualanBengkel).filter(TransaksiPenjualanBengkel.id == transaksi.id).first()
            if tx and tx.status_bayar != "BATAL":
                try:
                    service.void_transaction(transaksi.id)
                except Exception:
                    pass
