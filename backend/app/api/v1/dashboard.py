from datetime import date
from typing import Optional

from fastapi import APIRouter

from app.api.deps import DBSession, CurrentUser, ManagerUser
from app.services.transaksi_bengkel_service import TransaksiBengkelService
from app.services.pengeluaran_service import PengeluaranService
from app.services.penjualan_mobil_service import PenjualanMobilService
from app.services.muatan_service import MuatanService
from app.services.piutang_service import PiutangService
from app.services.kas_bank_service import KasBankService
from app.services.karyawan_service import KaryawanService
from app.services.slip_gaji_service import SlipGajiService
from app.services.pembelian_part_service import PembelianPartService
from app.services.hutang_service import HutangService
from app.services.mobil_service import MobilService
from app.models.jasa_angkut import MuatanJasaAngkut, JasaAngkutBiayaLainnya, JasaAngkutPartService
from app.models.mobil import Mobil, MobilBiayaLainnya
from app.models.bengkel import PembelianSparePart, TransaksiPenjualanBengkel
from app.utils.constants import KasBankSource, KasBankType, KasBankJenis, PaymentStatus, PiutangSource, CarStatus, HutangSource
from app.models.keuangan import KasBank
from sqlalchemy import func


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary")
def get_dashboard_summary(
    db: DBSession,
    current_user: ManagerUser,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
):
    """Get comprehensive dashboard summary."""
    # Bengkel sales
    bengkel_service = TransaksiBengkelService(db)
    bengkel_summary = bengkel_service.get_summary(tanggal_dari, tanggal_sampai)

    # Bengkel expenses
    pengeluaran_service = PengeluaranService(db)
    pengeluaran_summary = pengeluaran_service.get_summary(tanggal_dari, tanggal_sampai)

    # Car sales
    mobil_service = PenjualanMobilService(db)
    mobil_summary = mobil_service.get_summary(tanggal_dari, tanggal_sampai)

    # Transport
    muatan_service = MuatanService(db)
    muatan_summary = muatan_service.get_summary(tanggal_dari, tanggal_sampai)

    # Receivables
    piutang_service = PiutangService(db)
    piutang_summary = piutang_service.get_summary(tanggal_dari, tanggal_sampai)
    # Payables
    hutang_service = HutangService(db)
    hutang_summary = hutang_service.get_summary(tanggal_dari, tanggal_sampai)

    # Salary summary
    slip_gaji_service = SlipGajiService(db)
    gaji_summary = slip_gaji_service.get_summary_by_date_range(tanggal_dari, tanggal_sampai)

    # Cash/Bank
    kas_bank_service = KasBankService(db)
    kas_bank_summary = kas_bank_service.get_all_balances()

    return {
        "periode": {
            "dari": tanggal_dari.isoformat() if tanggal_dari else None,
            "sampai": tanggal_sampai.isoformat() if tanggal_sampai else None,
        },
        "bengkel": {
            "total_penjualan": bengkel_summary["total_penjualan"],
            "total_transaksi": bengkel_summary["total_transaksi"],
            "laba_kotor": bengkel_summary["total_laba_kotor"],
        },
        "pengeluaran": {
            "total": pengeluaran_summary["total_pengeluaran"] + gaji_summary["total"],
            "jumlah_transaksi": pengeluaran_summary["total_transaksi"] + gaji_summary["count"],
        },
        "mobil": {
            "total_penjualan": mobil_summary["total_penjualan"],
            "total_transaksi": mobil_summary["total_transaksi"],
            "laba_kotor": mobil_summary["laba_tpm"],
            "laba_tpm": mobil_summary["laba_tpm"],
        },
        "jasa_angkut": {
            "total_pendapatan": muatan_summary["total_pendapatan"],
            "total_transaksi": muatan_summary["total_transaksi"],
            "laba_tpm": muatan_summary["laba_tpm"],
        },
        "piutang": {
            "total_piutang": piutang_summary["total_piutang"],
            "total_sisa": piutang_summary["total_sisa"],
            "jumlah_overdue": piutang_summary["jumlah_overdue"],
        },
        "hutang": {
            "total_hutang": hutang_summary["total_hutang"],
            "total_sisa": hutang_summary["total_sisa"],
            "jumlah_belum_lunas": hutang_summary["jumlah_belum_lunas"],
        },
        "kas_bank": kas_bank_summary,
    }


@router.get("/daily/{tanggal}")
def get_daily_dashboard(
    tanggal: date,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get daily dashboard summary."""
    # Bengkel daily
    bengkel_service = TransaksiBengkelService(db)
    bengkel_daily = bengkel_service.get_daily_summary(tanggal)

    # Expenses daily
    pengeluaran_service = PengeluaranService(db)
    pengeluaran_daily = pengeluaran_service.get_daily_summary(tanggal)

    # Cash/Bank daily
    kas_bank_service = KasBankService(db)
    kas_bank_daily = kas_bank_service.get_daily_summary(tanggal)

    # Salary summary for the day
    slip_gaji_service = SlipGajiService(db)
    gaji_summary = slip_gaji_service.get_summary_by_date_range(tanggal, tanggal)

    # Update pengeluaran_daily
    pengeluaran_daily["total_pengeluaran"] += gaji_summary["total"]
    pengeluaran_daily["jumlah_transaksi"] += gaji_summary["count"]
    if "gaji" in pengeluaran_daily["per_kategori"]:
        pengeluaran_daily["per_kategori"]["gaji"] += gaji_summary["total"]
    else:
        pengeluaran_daily["per_kategori"]["gaji"] = gaji_summary["total"]

    return {
        "tanggal": tanggal.isoformat(),
        "bengkel": bengkel_daily,
        "pengeluaran": pengeluaran_daily,
        "kas_bank": kas_bank_daily,
    }


@router.get("/hr-summary")
def get_hr_summary(
    db: DBSession,
    current_user: ManagerUser,
):
    """Get HR summary statistics."""
    karyawan_service = KaryawanService(db)
    return karyawan_service.get_employee_stats()


@router.get("/profit-summary")
def get_profit_summary(
    db: DBSession,
    current_user: ManagerUser,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
):
    """Get profit summary across all business units."""
    # Bengkel
    bengkel_service = TransaksiBengkelService(db)
    bengkel = bengkel_service.get_summary(tanggal_dari, tanggal_sampai)

    # Pengeluaran
    pengeluaran_service = PengeluaranService(db)
    pengeluaran = pengeluaran_service.get_summary(tanggal_dari, tanggal_sampai)

    # Mobil
    mobil_service = PenjualanMobilService(db)
    mobil = mobil_service.get_summary(tanggal_dari, tanggal_sampai)

    # Jasa Angkut
    muatan_service = MuatanService(db)
    muatan = muatan_service.get_summary(tanggal_dari, tanggal_sampai)

    # Pembelian Part (New)
    pembelian_service = PembelianPartService(db)
    pembelian_summ = pembelian_service.get_summary(tanggal_dari, tanggal_sampai)

    # Salary summary
    slip_gaji_service = SlipGajiService(db)
    gaji_summary = slip_gaji_service.get_summary_by_date_range(tanggal_dari, tanggal_sampai)

    # Calculate totals
    total_pendapatan = (
        bengkel["total_penjualan"] +
        mobil["total_penjualan"] +
        muatan["total_pendapatan"]
    )

    total_laba_kotor = (
        bengkel["total_laba_kotor"] +
        mobil["laba_tpm"] +
        muatan["laba_tpm"]
    )

    # Merge gaji and pembelian data into pengeluaran details
    pengeluaran_details = pengeluaran["per_kategori"]
    
    # Add salaries
    if "gaji" in pengeluaran_details:
        pengeluaran_details["gaji"]["total"] += gaji_summary["total"]
        pengeluaran_details["gaji"]["count"] += gaji_summary["count"]
    else:
        pengeluaran_details["gaji"] = gaji_summary

    # Add Purchases (as requested by user)
    if "pembelian_part" in pengeluaran_details:
        pengeluaran_details["pembelian_part"]["total"] += pembelian_summ["total_nilai"]
        pengeluaran_details["pembelian_part"]["count"] += pembelian_summ["total_transaksi"]
    else:
        pengeluaran_details["pembelian_part"] = {
            "total": pembelian_summ["total_nilai"],
            "count": pembelian_summ["total_transaksi"]
        }

    prive_total = 0
    if "prive" in pengeluaran_details:
        prive_total = pengeluaran_details["prive"].get("total", 0)

    # Total Pengeluaran (Include Prive, Salaries, and Purchases)
    total_pengeluaran = (
        pengeluaran["total_pengeluaran"] + 
        gaji_summary["total"] + 
        pembelian_summ["total_nilai"]
    )
    laba_bersih = total_laba_kotor - total_pengeluaran

    return {
        "periode": {
            "dari": tanggal_dari.isoformat() if tanggal_dari else None,
            "sampai": tanggal_sampai.isoformat() if tanggal_sampai else None,
        },
        "pendapatan": {
            "bengkel": bengkel["total_penjualan"],
            "mobil": mobil["total_penjualan"],
            "jasa_angkut": muatan["total_pendapatan"],
            "total": total_pendapatan,
        },
        "laba_kotor": {
            "bengkel": bengkel["total_laba_kotor"],
            "mobil": mobil["laba_tpm"],
            "jasa_angkut": muatan["laba_tpm"],
            "total": total_laba_kotor,
        },
        "bengkel_details": {
            "total_penjualan": bengkel["total_penjualan"],
            "total_parts": bengkel["total_parts"],
            "total_jasa": bengkel["total_jasa"],
            "total_diskon": bengkel["total_diskon"],
            "total_hpp": bengkel["total_hpp"],
            "total_laba_kotor": bengkel["total_laba_kotor"],
        },
        "mobil_details": mobil,
        "jasa_angkut_details": muatan.get("details", {}),
        "pengeluaran": total_pengeluaran,
        "pengeluaran_details": pengeluaran_details,
        "laba_bersih": laba_bersih,
    }


@router.get("/recent-activity")
def get_recent_activity(
    db: DBSession,
    current_user: ManagerUser,
    limit: int = 10,
):
    """Get unified recent activity feed (Financial + Operational)."""

    # 1. Fetch recent transactions (KasBank)
    kas_bank_service = KasBankService(db)
    kas_data = kas_bank_service.get_list(
        limit=limit,
        sort_by="created_at",
        sort_order="desc"
    )["data"]

    # 2. Fetch recent workshop sales (Bengkel)
    bengkel_service = TransaksiBengkelService(db)
    bengkel_data = bengkel_service.get_list(
        limit=limit,
        sort_by="created_at",
        sort_order="desc"
    )["data"]

    # 3. Fetch recent transport loads (Jasa Angkut)
    muatan_service = MuatanService(db)
    muatan_data = muatan_service.get_list(
        limit=limit,
        sort_by="created_at",
        sort_order="desc"
    )["data"]

    # 4. Normalize and Merge
    activities = []

    for item in kas_data:
        activities.append({
            "type": "financial",
            "id": f"kas_{item.id}",
            "original_id": item.id,
            "title": item.keterangan or str(item.sumber.value),
            "subtitle": item.nomor_transaksi,
            "amount": float(item.nominal),
            "is_incoming": item.tipe.name == "MASUK",
            "status": item.jenis.name,  # CASH, BCA, etc.
            "timestamp": item.created_at.isoformat(),
            "source": str(item.sumber.value),
            "ref_number": item.nomor_referensi,
        })

    for item in bengkel_data:
        activities.append({
            "type": "workshop",
            "id": f"bengkel_{item.id}",
            "original_id": item.id,
            "title": item.nomor_plat or "Tanpa Plat",
            "subtitle": f"{item.jenis_kendaraan or 'Kendaraan'} • {item.nama_customer or 'Guest'}",
            "amount": float(item.grand_total),
            "is_incoming": True,
            "status": item.status_pengerjaan.name,  # ANTRE, PROSES, SELESAI
            "timestamp": item.created_at.isoformat(),
            "source": "bengkel",
            "ref_number": item.nomor_transaksi,
        })

    for item in muatan_data:
        # Include driver name in subtitle and route in title
        driver_name = item.supir_nama or item.supir_nama_manual or "Driver"
        activities.append({
            "type": "workshop", # Using workshop type for UI consistency if needed, or better, source below
            "id": f"muatan_{item.id}",
            "original_id": item.id,
            "title": f"{item.asal} → {item.tujuan}",
            "subtitle": f"{item.info_kendaraan or 'Armada'} • {driver_name}",
            "amount": float(item.pendapatan_kotor - item.laba_supir), # TPM Margin
            "is_incoming": True,
            "status": item.status_bayar.value if hasattr(item.status_bayar, 'value') else str(item.status_bayar),
            "timestamp": item.created_at.isoformat(),
            "source": "jasa_angkut",
            "ref_number": item.nomor_transaksi,
        })

    # 5. Sort and Slice
    activities.sort(key=lambda x: x["timestamp"], reverse=True)
    return activities[:limit]


@router.get("/capital-report")
def get_capital_report(
    db: DBSession,
    current_user: ManagerUser,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
):
    """Get capital change report (Laporan Perubahan Modal)."""
    
    # Helpers
    def get_kas_sum(sumber, tipe, method_filter=None):
        q = db.query(func.sum(KasBank.nominal)).filter(
            KasBank.sumber == sumber,
            KasBank.tipe == tipe
        )
        if tanggal_dari:
            q = q.filter(KasBank.tanggal >= tanggal_dari)
        if tanggal_sampai:
            q = q.filter(KasBank.tanggal <= tanggal_sampai)
        if method_filter:
            if method_filter == 'cash':
                q = q.filter(KasBank.jenis == KasBankJenis.CASH)
            elif method_filter == 'transfer':
                q = q.filter(KasBank.jenis != KasBankJenis.CASH)
        return float(q.scalar() or 0)

    # Services
    bengkel_service = TransaksiBengkelService(db)
    penjualan_mobil_service = PenjualanMobilService(db)
    mobil_service = MobilService(db)
    muatan_service = MuatanService(db)
    piutang_service = PiutangService(db)
    kas_service = KasBankService(db)
    pengeluaran_service = PengeluaranService(db)
    slip_gaji_service = SlipGajiService(db)
    hutang_service = HutangService(db)

    # Pre-fetch summaries for expense calculations
    pengeluaran = pengeluaran_service.get_summary(tanggal_dari, tanggal_sampai)
    gaji_summary = slip_gaji_service.get_summary_by_date_range(tanggal_dari, tanggal_sampai)

    # --- A. Laba dan Modal Awal ---
    # 1. Setoran Modal (Net Capital: Masuk - Keluar)
    modal_in = get_kas_sum(KasBankSource.MODAL, KasBankType.MASUK)
    modal_out = get_kas_sum(KasBankSource.MODAL, KasBankType.KELUAR)
    setoran_modal = modal_in - modal_out

    # 2. Earnings & Basis (HPP, Laba)
    bengkel_summ = bengkel_service.get_summary(tanggal_dari, tanggal_sampai)
    mobil_summ = penjualan_mobil_service.get_summary(tanggal_dari, tanggal_sampai)
    muatan_summ = muatan_service.get_summary(tanggal_dari, tanggal_sampai)

    hpp_bengkel = bengkel_summ["total_hpp"] # Total HPP Parts
    hpp_mobil = mobil_summ["total_modal"]   # Total Modal Mobil (Harga Beli + Biaya)
    
    # Laba (Gross Profit contributions)
    laba_bengkel = bengkel_summ["total_laba_kotor"]
    laba_mobil_tpm = mobil_summ["laba_tpm"]
    laba_jasa_angkut_tpm = muatan_summ["laba_tpm"]
    
    total_laba_kotor = laba_bengkel + laba_mobil_tpm + laba_jasa_angkut_tpm

    # 2b. Internal bengkel for TERSEDIA cars — no bilateral KasBank.
    # Cost is tracked via Piutang (BENGKEL → JB MOBIL) in Section B.

    # A. Summary
    section_a = {
        "setoran_modal": setoran_modal,
        "hpp_bengkel": hpp_bengkel,
        "hpp_mobil": hpp_mobil,
        "total_laba": total_laba_kotor,
        "internal_bengkel_mobil": 0,  # Removed: no longer uses bilateral
        "details": {
            "laba_bengkel": laba_bengkel,
            "laba_kotor_mobil": mobil_summ["total_laba_kotor"],
            "laba_investor_mobil": mobil_summ["laba_investor"],
            "laba_mobil_tpm": laba_mobil_tpm,
            "laba_jasa_angkut": laba_jasa_angkut_tpm,
        },
        "total_a": setoran_modal + hpp_bengkel + hpp_mobil + total_laba_kotor
    }

    # --- B. Piutang ---
    piutang_summ = piutang_service.get_summary(tanggal_dari, tanggal_sampai)
    p_by_sumber = piutang_summ.get("by_sumber", {})
    
    p_lainnya = p_by_sumber.get(PiutangSource.LAINNYA.value, {}).get("sisa_piutang", 0)
    p_mobil = p_by_sumber.get(PiutangSource.JUAL_BELI_MOBIL.value, {}).get("sisa_piutang", 0)
    p_bengkel_pure = p_by_sumber.get(PiutangSource.BENGKEL.value, {}).get("sisa_piutang", 0)
    
    # Integrated bengkel piutang (from Unpaid Jasa Angkut)
    # 1. Biaya Lainnya (Older records)
    q_integrated_old = (
        db.query(func.sum(JasaAngkutBiayaLainnya.jumlah))
        .join(MuatanJasaAngkut)
        .filter(
            JasaAngkutBiayaLainnya.kategori == "Perawatan Bengkel",
            MuatanJasaAngkut.status_bayar == PaymentStatus.BELUM_LUNAS
        )
    )
    if tanggal_dari: q_integrated_old = q_integrated_old.filter(MuatanJasaAngkut.tanggal >= tanggal_dari)
    if tanggal_sampai: q_integrated_old = q_integrated_old.filter(MuatanJasaAngkut.tanggal <= tanggal_sampai)
    
    # 2. Part Service (Newer linked records)
    q_integrated_new = (
        db.query(func.sum(JasaAngkutPartService.total))
        .join(MuatanJasaAngkut)
        .filter(MuatanJasaAngkut.status_bayar == PaymentStatus.BELUM_LUNAS)
    )
    if tanggal_dari: q_integrated_new = q_integrated_new.filter(MuatanJasaAngkut.tanggal >= tanggal_dari)
    if tanggal_sampai: q_integrated_new = q_integrated_new.filter(MuatanJasaAngkut.tanggal <= tanggal_sampai)
        
    p_bengkel_integrated = float((q_integrated_old.scalar() or 0) + (q_integrated_new.scalar() or 0))

    # Piutang Jasa Angkut (Laba TPM part)
    q_ja_tpm = (
        db.query(func.sum(MuatanJasaAngkut.laba_tpm))
        .filter(MuatanJasaAngkut.status_bayar == PaymentStatus.BELUM_LUNAS)
    )
    if tanggal_dari: q_ja_tpm = q_ja_tpm.filter(MuatanJasaAngkut.tanggal >= tanggal_dari)
    if tanggal_sampai: q_ja_tpm = q_ja_tpm.filter(MuatanJasaAngkut.tanggal <= tanggal_sampai)
        
    p_jasa_angkut_tpm = float(q_ja_tpm.scalar() or 0)
    
    # Combined: PIUTANG SUPIR JASA ANGKUT
    p_supir_ja = p_jasa_angkut_tpm + p_bengkel_integrated

    # PIUTANG PART JUAL MOBIL — display only, NOT in total_b.
    # Internal bengkel transactions for unsold cars create Piutang only (no bilateral).
    # The piutang is NOT included in total_b because no cash actually left the company;
    # it's an internal asset reclassification (parts inventory → car value).
    # The piutang is settled automatically when the car is sold.
    q_part_mobil = (
        db.query(func.sum(TransaksiPenjualanBengkel.grand_total))
        .join(Mobil, TransaksiPenjualanBengkel.mobil_id == Mobil.id)
        .filter(
            TransaksiPenjualanBengkel.kategori == "jual_beli_mobil",
            Mobil.status == CarStatus.TERSEDIA
        )
    )
    p_part_jual_mobil = float(q_part_mobil.scalar() or 0)

    p_karyawan = p_by_sumber.get(PiutangSource.KASBON_KARYAWAN.value, {}).get("sisa_piutang", 0)
    
    # PIUTANG USAHA = Bengkel piutang EXCLUDING jual_beli_mobil internal ones
    from app.models.keuangan import PiutangUsaha as PiutangModel
    q_usaha = db.query(func.sum(PiutangModel.sisa_piutang)).filter(
        PiutangModel.sumber == PiutangSource.BENGKEL,
        PiutangModel.sisa_piutang > 0,
    )
    # Exclude piutang linked to jual_beli_mobil transactions
    jb_mobil_trx_ids = db.query(TransaksiPenjualanBengkel.nomor_transaksi).filter(
        TransaksiPenjualanBengkel.kategori == 'jual_beli_mobil'
    ).subquery()
    q_usaha = q_usaha.filter(~PiutangModel.nomor_referensi.in_(jb_mobil_trx_ids))
    
    p_usaha = float(q_usaha.scalar() or 0)
    
    # piutang_part_mobil INCLUDED in total — balanced by HPP+Laba in Section A
    total_b = p_lainnya + p_mobil + p_supir_ja + p_karyawan + p_usaha + p_part_jual_mobil

    section_b = {
        "piutang_lainnya": p_lainnya,
        "piutang_mobil": p_mobil,
        "piutang_part_mobil": p_part_jual_mobil,
        "piutang_part_mobil_display": p_part_jual_mobil,
        "piutang_jasa_angkut": p_supir_ja,
        "piutang_karyawan": p_karyawan,
        "piutang_usaha": p_usaha,
        "total_b": total_b
    }

    # --- C. Pengurangan Laba dan Modal (Stock & Operational Acquisitions) ---
    # 1. Total Pembelian Part (Total Nominal Purchase, not just Cash)
    pembelian_part_summ = PembelianPartService(db).get_summary(tanggal_dari, tanggal_sampai)
    total_beli_part = pembelian_part_summ["total_nilai"]

    # 2. Total Pembelian Mobil (Total Nominal Purchase)
    mobil_inv_summ = mobil_service.get_inventory_summary(tanggal_dari, tanggal_sampai)
    total_beli_mobil = mobil_inv_summ["total_modal_pembelian"]

    # 3. Arus Keluar JB Mobil (outflows with source JUAL_BELI_MOBIL)
    #    Includes: pengembalian investor, biaya persiapan (BBN/pajak).
    #    EXCLUDES old bilateral entries from internal bengkel (legacy data).
    #    biaya_persiapan NOT counted separately (already in jb_mobil KELUAR).
    jb_mobil_cash = get_kas_sum(KasBankSource.JUAL_BELI_MOBIL, KasBankType.KELUAR, 'cash')
    jb_mobil_transfer = get_kas_sum(KasBankSource.JUAL_BELI_MOBIL, KasBankType.KELUAR, 'transfer')

    # Subtract old bilateral KELUAR entries (legacy from before bilateral removal)
    q_old_bilateral = (
        db.query(func.sum(KasBank.nominal))
        .filter(
            KasBank.sumber == KasBankSource.JUAL_BELI_MOBIL,
            KasBank.tipe == KasBankType.KELUAR,
            KasBank.keterangan.like("Biaya Repair Internal via Bengkel%"),
        )
    )
    if tanggal_dari:
        q_old_bilateral = q_old_bilateral.filter(KasBank.tanggal >= tanggal_dari)
    if tanggal_sampai:
        q_old_bilateral = q_old_bilateral.filter(KasBank.tanggal <= tanggal_sampai)
    old_bilateral_keluar = float(q_old_bilateral.scalar() or 0)
    jb_mobil_cash = max(jb_mobil_cash - old_bilateral_keluar, 0)  # Remove legacy bilateral

    # 4. Beban Operasional, Gaji, Prive (From KasBank)
    biaya_opr = get_kas_sum(KasBankSource.PENGELUARAN, KasBankType.KELUAR)
    biaya_gaji = gaji_summary["total"]
    prive = get_kas_sum(KasBankSource.PRIVE, KasBankType.KELUAR)

    # 5. Biaya Persiapan Mobil — ALREADY included in jb_mobil KELUAR above.
    #    We query it here ONLY for display purposes (breakdown).
    q_prep = db.query(func.sum(MobilBiayaLainnya.jumlah)).join(Mobil)
    if tanggal_dari: q_prep = q_prep.filter(MobilBiayaLainnya.tanggal >= tanggal_dari)
    if tanggal_sampai: q_prep = q_prep.filter(MobilBiayaLainnya.tanggal <= tanggal_sampai)
    biaya_persiapan_display = float(q_prep.scalar() or 0)

    # 6. Kasbon Karyawan is excluded from Section C 
    # Because it is already tracked in Section B (Piutang).
    # Including it here would double-count it during reconciliation (Modal - B - C).
    kasbon_net = 0

    # 7. Transaksi Lainnya (Net: keluar - masuk from manual entries)
    lainnya_out = get_kas_sum(KasBankSource.LAINNYA, KasBankType.KELUAR)
    lainnya_in = get_kas_sum(KasBankSource.LAINNYA, KasBankType.MASUK)
    lainnya_net_out = lainnya_out - lainnya_in  # Net outflow (negative = net income)

    total_c = (
        total_beli_part +
        total_beli_mobil +
        jb_mobil_cash + jb_mobil_transfer +
        biaya_opr + biaya_gaji + prive +
        # kasbon_net + 
        lainnya_net_out
    )

    section_c = {
        "pembelian_part": {
            "cash": get_kas_sum(KasBankSource.PEMBELIAN_PART, KasBankType.KELUAR, 'cash'),
            "transfer": get_kas_sum(KasBankSource.PEMBELIAN_PART, KasBankType.KELUAR, 'transfer'),
            "total": total_beli_part
        },
        "pembelian_mobil": {
            "cash": get_kas_sum(KasBankSource.PEMBELIAN_MOBIL, KasBankType.KELUAR, 'cash'),
            "transfer": get_kas_sum(KasBankSource.PEMBELIAN_MOBIL, KasBankType.KELUAR, 'transfer'),
            "total": total_beli_mobil
        },
        "pengembalian_investor": {
            "cash": jb_mobil_cash,
            "transfer": jb_mobil_transfer,
            "total": jb_mobil_cash + jb_mobil_transfer,
            "termasuk_biaya_persiapan": biaya_persiapan_display,
        },
        "operasional": biaya_opr,
        "gaji": biaya_gaji,
        "prive": prive,
        "biaya_persiapan": 0,  # Already included in pengembalian_investor total
        "biaya_persiapan_display": biaya_persiapan_display,  # For display only
        "kasbon_karyawan": kasbon_net,
        "transaksi_lainnya": lainnya_net_out,
        "total_c": total_c
    }

    # --- E. Hutang / Kewajiban ---
    # Fetch current payable balances
    hutang_summ = hutang_service.get_summary(tanggal_dari, tanggal_sampai)
    h_by_sumber = hutang_summ.get("by_sumber", {})
    
    h_part = h_by_sumber.get(HutangSource.PEMBELIAN_PART.value, {}).get("sisa_hutang", 0)
    h_mobil = h_by_sumber.get(HutangSource.PEMBELIAN_MOBIL.value, {}).get("sisa_hutang", 0)
    h_investor = h_by_sumber.get(HutangSource.JUAL_BELI_MOBIL.value, {}).get("sisa_hutang", 0) # e.g. investor funds waiting to be paid back
    h_lainnya = h_by_sumber.get(HutangSource.LAINNYA.value, {}).get("sisa_hutang", 0)
    
    total_e = h_part + h_mobil + h_investor + h_lainnya
    
    section_e = {
        "hutang_part": h_part,
        "hutang_mobil": h_mobil,
        "hutang_investor": h_investor,
        "hutang_lainnya": h_lainnya,
        "total_e": total_e
    }

    # --- D. Sisa Laba dan Modal (Cash Position) ---
    balances = kas_service.get_all_balances(as_of=tanggal_sampai)
    posisi_cash = balances.get(KasBankJenis.CASH.value, {}).get("saldo", 0)
    
    posisi_transfer = 0
    for k, v in balances.items():
        if k != KasBankJenis.CASH.value and isinstance(v, dict):
            posisi_transfer += v.get("saldo", 0)

    total_kas = posisi_cash + posisi_transfer
    
    # Formula-based reconciliation: should equal total_kas
    modal_komponen = section_a["total_a"] - section_b["total_b"] - section_c["total_c"] + total_e
    penyesuaian = round(total_kas - modal_komponen, 2)

    section_d = {
        "cash": posisi_cash,
        "transfer": posisi_transfer,
        "total_d": total_kas,
        "theoretical_modal": modal_komponen,
        "modal_komponen": modal_komponen,
        "penyesuaian": penyesuaian,
    }

    print(f"DEBUG RECON: A={section_a['total_a']}, B={section_b['total_b']}, C={section_c['total_c']}, E={total_e}")
    print(f"DEBUG RECON: formula={modal_komponen}, bank={total_kas}, penyesuaian={penyesuaian}")
    return {
        "section_a": section_a,
        "section_b": section_b,
        "section_c": section_c,
        "section_d": section_d,
        "section_e": section_e,
        "grand_total": total_kas
    }


@router.get("/neraca")
def get_neraca(
    db: DBSession,
    current_user: ManagerUser,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
):
    """Get balance sheet (Neraca) report.
    
    Neraca is a SNAPSHOT of financial position.
    - Piutang & Hutang show ALL outstanding (not date-filtered)
    - Kas & Bank show cumulative balance up to tanggal_sampai
    - Persediaan & Stok Mobil show current position
    - Modal is derived to ensure balance: Modal = Aktiva - Hutang
    
    Structure:
    AKTIVA (Assets):
      - Aktiva Lancar (Current Assets): Kas & Bank, Piutang, Persediaan
      - Aktiva Tetap (Fixed Assets): Stok Mobil (full investment value)
    PASIVA (Liabilities + Equity):
      - Hutang (Liabilities): all outstanding payables
      - Modal (Equity): setoran modal, laba ditahan, prive
    """

    # Helpers
    def get_kas_sum(sumber, tipe, method_filter=None):
        q = db.query(func.sum(KasBank.nominal)).filter(
            KasBank.sumber == sumber,
            KasBank.tipe == tipe
        )
        if tanggal_sampai:
            q = q.filter(KasBank.tanggal <= tanggal_sampai)
        if method_filter:
            if method_filter == 'cash':
                q = q.filter(KasBank.jenis == KasBankJenis.CASH)
            elif method_filter == 'transfer':
                q = q.filter(KasBank.jenis != KasBankJenis.CASH)
        return float(q.scalar() or 0)

    # ==========================================
    # SERVICES
    # ==========================================
    kas_service = KasBankService(db)
    piutang_service = PiutangService(db)
    hutang_service = HutangService(db)
    bengkel_service = TransaksiBengkelService(db)
    penjualan_mobil_service = PenjualanMobilService(db)
    mobil_service = MobilService(db)
    muatan_service = MuatanService(db)
    pengeluaran_service = PengeluaranService(db)
    slip_gaji_service = SlipGajiService(db)
    from app.services.spare_part_service import SparePartService
    sparepart_service = SparePartService(db)

    # ==========================================
    # A. AKTIVA LANCAR (Current Assets)
    # ==========================================

    # 1. Kas & Bank (cumulative balance up to date)
    balances = kas_service.get_all_balances(as_of=tanggal_sampai)
    kas_tunai = balances.get(KasBankJenis.CASH.value, {}).get("saldo", 0)
    
    kas_bank = 0
    bank_details = {}
    for k, v in balances.items():
        if k != KasBankJenis.CASH.value and isinstance(v, dict):
            saldo = v.get("saldo", 0)
            kas_bank += saldo
            bank_details[k] = saldo
    
    total_kas_bank = kas_tunai + kas_bank

    # 2. Piutang Usaha — ALL outstanding (no date filter for balance sheet)
    piutang_summ = piutang_service.get_summary()  # No date filter = all outstanding
    p_by_sumber = piutang_summ.get("by_sumber", {})
    
    piutang_bengkel = p_by_sumber.get(PiutangSource.BENGKEL.value, {}).get("sisa_piutang", 0)
    piutang_mobil = p_by_sumber.get(PiutangSource.JUAL_BELI_MOBIL.value, {}).get("sisa_piutang", 0)
    piutang_jasa_angkut = p_by_sumber.get(PiutangSource.JASA_ANGKUT.value, {}).get("sisa_piutang", 0)
    piutang_karyawan = p_by_sumber.get(PiutangSource.KASBON_KARYAWAN.value, {}).get("sisa_piutang", 0)
    piutang_lainnya = p_by_sumber.get(PiutangSource.LAINNYA.value, {}).get("sisa_piutang", 0)
    
    total_piutang = piutang_bengkel + piutang_mobil + piutang_jasa_angkut + piutang_karyawan + piutang_lainnya

    # 3. Persediaan Sparepart (current stock at cost)
    stock_value = sparepart_service.get_stock_value()
    persediaan_sparepart = stock_value["total_value"]

    total_aktiva_lancar = total_kas_bank + total_piutang + persediaan_sparepart

    aktiva_lancar = {
        "kas_tunai": kas_tunai,
        "kas_bank": kas_bank,
        "bank_details": bank_details,
        "total_kas_bank": total_kas_bank,
        "piutang_bengkel": piutang_bengkel,
        "piutang_mobil": piutang_mobil,
        "piutang_jasa_angkut": piutang_jasa_angkut,
        "piutang_karyawan": piutang_karyawan,
        "piutang_lainnya": piutang_lainnya,
        "total_piutang": total_piutang,
        "persediaan_sparepart": persediaan_sparepart,
        "total_aktiva_lancar": total_aktiva_lancar,
    }

    # ==========================================
    # B. AKTIVA TETAP (Fixed Assets)
    # ==========================================
    
    # Stok Mobil: Full investment value (harga_beli + biaya_lainnya + part_service)
    # Only for cars with status TERSEDIA
    available_cars = (
        db.query(Mobil)
        .filter(Mobil.deleted_at.is_(None), Mobil.status == CarStatus.TERSEDIA)
        .all()
    )
    
    stok_mobil_harga_beli = 0
    stok_mobil_biaya = 0
    stok_mobil_part_service = 0
    jumlah_mobil_tersedia = len(available_cars)
    
    for car in available_cars:
        stok_mobil_harga_beli += float(car.harga_beli or 0)
        stok_mobil_biaya += float(car.total_biaya or 0)
        stok_mobil_part_service += float(car.total_part_service or 0)
    
    stok_mobil_total = stok_mobil_harga_beli + stok_mobil_biaya + stok_mobil_part_service

    total_aktiva_tetap = stok_mobil_total

    aktiva_tetap = {
        "stok_mobil_harga_beli": stok_mobil_harga_beli,
        "stok_mobil_biaya": stok_mobil_biaya,
        "stok_mobil_part_service": stok_mobil_part_service,
        "stok_mobil": stok_mobil_total,
        "jumlah_unit_mobil": jumlah_mobil_tersedia,
        "total_aktiva_tetap": total_aktiva_tetap,
    }

    # ==========================================
    # TOTAL AKTIVA
    # ==========================================
    total_aktiva = total_aktiva_lancar + total_aktiva_tetap

    # ==========================================
    # C. HUTANG (Liabilities) — ALL outstanding (no date filter)
    # ==========================================
    hutang_summ = hutang_service.get_summary()  # No date filter = all outstanding
    h_by_sumber = hutang_summ.get("by_sumber", {})
    
    hutang_part = h_by_sumber.get(HutangSource.PEMBELIAN_PART.value, {}).get("sisa_hutang", 0)
    hutang_mobil = h_by_sumber.get(HutangSource.PEMBELIAN_MOBIL.value, {}).get("sisa_hutang", 0)
    hutang_investor = h_by_sumber.get(HutangSource.JUAL_BELI_MOBIL.value, {}).get("sisa_hutang", 0)
    hutang_lainnya = h_by_sumber.get(HutangSource.LAINNYA.value, {}).get("sisa_hutang", 0)
    
    total_hutang = hutang_part + hutang_mobil + hutang_investor + hutang_lainnya

    hutang = {
        "hutang_part": hutang_part,
        "hutang_mobil": hutang_mobil,
        "hutang_investor": hutang_investor,
        "hutang_lainnya": hutang_lainnya,
        "total_hutang": total_hutang,
    }

    # ==========================================
    # D. MODAL (Equity)
    # ==========================================
    # In accounting: Modal = Aktiva - Hutang (by definition)
    # We calculate the components for display, AND derive total_modal
    # from the accounting identity to ensure balance.
    
    # 1. Setoran Modal (Net: Masuk - Keluar, cumulative)
    modal_in = get_kas_sum(KasBankSource.MODAL, KasBankType.MASUK)
    modal_out = get_kas_sum(KasBankSource.MODAL, KasBankType.KELUAR)
    setoran_modal = modal_in - modal_out
    
    # 2. Laba Ditahan components (for display)
    bengkel_summ = bengkel_service.get_summary(tanggal_dari, tanggal_sampai)
    mobil_summ = penjualan_mobil_service.get_summary(tanggal_dari, tanggal_sampai)
    muatan_summ = muatan_service.get_summary(tanggal_dari, tanggal_sampai)
    
    laba_bengkel = bengkel_summ["total_laba_kotor"]
    laba_mobil_tpm = mobil_summ["laba_tpm"]
    laba_jasa_angkut = muatan_summ["laba_tpm"]
    total_laba_kotor = laba_bengkel + laba_mobil_tpm + laba_jasa_angkut
    
    # Beban Operasional
    pengeluaran = pengeluaran_service.get_summary(tanggal_dari, tanggal_sampai)
    gaji_summary = slip_gaji_service.get_summary_by_date_range(tanggal_dari, tanggal_sampai)
    
    pengeluaran_details = pengeluaran["per_kategori"]
    prive_total = pengeluaran_details.get("prive", {}).get("total", 0)
    
    # Beban = pengeluaran operasional (excluding prive, which is separate)
    total_beban = pengeluaran["total_pengeluaran"] + gaji_summary["total"] - prive_total
    
    laba_ditahan = total_laba_kotor - total_beban
    prive = prive_total

    # Modal dihitung dari identity: Modal = Aktiva - Hutang
    # Ini menjamin neraca SELALU seimbang
    total_modal = total_aktiva - total_hutang
    
    # Selisih antara perhitungan komponen vs identity (untuk transparansi)
    modal_komponen = setoran_modal + laba_ditahan - prive
    selisih_modal = round(total_modal - modal_komponen, 2)

    modal = {
        "setoran_modal": setoran_modal,
        "laba_kotor": total_laba_kotor,
        "detail_laba": {
            "bengkel": laba_bengkel,
            "mobil": laba_mobil_tpm,
            "jasa_angkut": laba_jasa_angkut,
        },
        "total_beban": total_beban,
        "laba_ditahan": laba_ditahan,
        "prive": prive,
        "total_modal": total_modal,
        "modal_komponen": modal_komponen,
        "selisih_modal": selisih_modal,
    }

    # ==========================================
    # TOTAL PASIVA (guaranteed balanced)
    # ==========================================
    total_pasiva = total_hutang + total_modal

    selisih = round(total_aktiva - total_pasiva, 2)

    print(f"DEBUG NERACA: Aktiva={total_aktiva}, Hutang={total_hutang}, Modal={total_modal}, Pasiva={total_pasiva}, Selisih={selisih}")
    print(f"DEBUG NERACA KOMPONEN: Setoran={setoran_modal}, Laba={laba_ditahan}, Prive={prive}, Komponen={modal_komponen}, SelisihModal={selisih_modal}")
    print(f"DEBUG NERACA AKTIVA: Kas={total_kas_bank}, Piutang={total_piutang}, Persediaan={persediaan_sparepart}, Mobil={stok_mobil_total} (Beli={stok_mobil_harga_beli}+Biaya={stok_mobil_biaya}+Part={stok_mobil_part_service})")

    return {
        "periode": {
            "dari": tanggal_dari.isoformat() if tanggal_dari else None,
            "sampai": tanggal_sampai.isoformat() if tanggal_sampai else None,
        },
        "aktiva_lancar": aktiva_lancar,
        "aktiva_tetap": aktiva_tetap,
        "total_aktiva": total_aktiva,
        "hutang": hutang,
        "modal": modal,
        "total_pasiva": total_pasiva,
        "selisih": selisih,
        "is_balanced": abs(selisih) < 1,
    }


