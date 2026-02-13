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
from app.models.jasa_angkut import MuatanJasaAngkut, JasaAngkutBiayaLainnya, JasaAngkutPartService
from app.models.mobil import Mobil, MobilBiayaLainnya
from app.models.bengkel import PembelianSparePart, TransaksiPenjualanBengkel
from app.utils.constants import KasBankSource, KasBankType, KasBankJenis, PaymentStatus, PiutangSource, CarStatus
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
            "laba_kotor": mobil_summary["total_laba_kotor"],
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

    # Merge gaji data into pengeluaran details
    pengeluaran_details = pengeluaran["per_kategori"]
    if "gaji" in pengeluaran_details:
        pengeluaran_details["gaji"]["total"] += gaji_summary["total"]
        pengeluaran_details["gaji"]["count"] += gaji_summary["count"]
    else:
        pengeluaran_details["gaji"] = gaji_summary

    prive_total = 0
    if "prive" in pengeluaran_details:
        prive_total = pengeluaran_details["prive"].get("total", 0)

    # Total Pengeluaran (Include Prive and Salaries)
    total_pengeluaran = pengeluaran["total_pengeluaran"] + gaji_summary["total"]
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

    # 3. Normalize and Merge
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

    # 4. Sort and Slice
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
    mobil_service = PenjualanMobilService(db)
    muatan_service = MuatanService(db)
    piutang_service = PiutangService(db)
    kas_service = KasBankService(db)
    pengeluaran_service = PengeluaranService(db)
    slip_gaji_service = SlipGajiService(db)

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
    mobil_summ = mobil_service.get_summary(tanggal_dari, tanggal_sampai)
    muatan_summ = muatan_service.get_summary(tanggal_dari, tanggal_sampai)

    hpp_bengkel = bengkel_summ["total_hpp"] # Total HPP Parts
    hpp_mobil = mobil_summ["total_modal"]   # Total Modal Mobil (Harga Beli + Biaya)
    
    # Laba (Gross Profit contributions)
    laba_bengkel = bengkel_summ["total_laba_kotor"]
    laba_mobil_kotor = mobil_summ["total_laba_kotor"]
    laba_jasa_angkut_tpm = muatan_summ["laba_tpm"]
    
    total_laba_kotor = laba_bengkel + laba_mobil_kotor + laba_jasa_angkut_tpm

    # A. Summary
    section_a = {
        "setoran_modal": setoran_modal,
        "hpp_bengkel": hpp_bengkel,
        "hpp_mobil": hpp_mobil,
        "total_laba": total_laba_kotor,
        "details": {
            "laba_bengkel": laba_bengkel,
            "laba_kotor_mobil": laba_mobil_kotor,
            "laba_investor_mobil": mobil_summ["laba_investor"],
            "laba_mobil": mobil_summ["laba_tpm"],
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

    # PIUTANG PART JUAL MOBIL (Bengkel costs for unsold cars)
    q_part_mobil = (
        db.query(func.sum(TransaksiPenjualanBengkel.grand_total))
        .join(Mobil, TransaksiPenjualanBengkel.mobil_id == Mobil.id)
        .filter(
            TransaksiPenjualanBengkel.kategori == "jual_beli_mobil",
            Mobil.status == CarStatus.TERSEDIA
        )
    )
    # Note: Using car's status to determine if it's still unpaid modal. 
    # Not using date filter for balance sheet style piutang usually, but let's follow the app style.
    
    p_part_jual_mobil = float(q_part_mobil.scalar() or 0)

    p_karyawan = p_by_sumber.get(PiutangSource.KASBON_KARYAWAN.value, {}).get("sisa_piutang", 0)
    p_usaha = p_by_sumber.get(PiutangSource.BENGKEL.value, {}).get("sisa_piutang", 0)
    
    total_b = p_lainnya + p_mobil + p_part_jual_mobil + p_supir_ja + p_karyawan + p_usaha

    section_b = {
        "piutang_lainnya": p_lainnya,
        "piutang_mobil": p_mobil,
        "piutang_part_mobil": p_part_jual_mobil,
        "piutang_jasa_angkut": p_supir_ja,
        "piutang_karyawan": p_karyawan,
        "piutang_usaha": p_usaha,
        "total_b": total_b
    }

    # --- C. Pengurangan Laba dan Modal (Actual Cash Transacted) ---
    # 1. Total Pembelian Part (From KasBank to ensure sync with cash position)
    beli_part_cash = get_kas_sum(KasBankSource.PEMBELIAN_PART, KasBankType.KELUAR, 'cash')
    beli_part_transfer = get_kas_sum(KasBankSource.PEMBELIAN_PART, KasBankType.KELUAR, 'transfer')

    # 2. Total Pembelian Mobil (From KasBank)
    beli_mobil_cash = get_kas_sum(KasBankSource.PEMBELIAN_MOBIL, KasBankType.KELUAR, 'cash')
    beli_mobil_transfer = get_kas_sum(KasBankSource.PEMBELIAN_MOBIL, KasBankType.KELUAR, 'transfer')

    # 3. Pengembalian Investor / Share Profit (From KasBank)
    investor_cash = get_kas_sum(KasBankSource.JUAL_BELI_MOBIL, KasBankType.KELUAR, 'cash')
    investor_transfer = get_kas_sum(KasBankSource.JUAL_BELI_MOBIL, KasBankType.KELUAR, 'transfer')

    # 4. Beban Operasional, Gaji, Prive (From KasBank)
    biaya_opr = get_kas_sum(KasBankSource.PENGELUARAN, KasBankType.KELUAR)
    biaya_gaji = get_kas_sum(KasBankSource.GAJI, KasBankType.KELUAR)
    prive = get_kas_sum(KasBankSource.PRIVE, KasBankType.KELUAR)

    # 5. Biaya Persiapan Mobil (Internal adjust or Cash)
    q_prep = db.query(func.sum(MobilBiayaLainnya.jumlah)).join(Mobil)
    if tanggal_dari: q_prep = q_prep.filter(MobilBiayaLainnya.tanggal >= tanggal_dari)
    if tanggal_sampai: q_prep = q_prep.filter(MobilBiayaLainnya.tanggal <= tanggal_sampai)
    biaya_persiapan = float(q_prep.scalar() or 0)

    total_c = (
        beli_part_cash + beli_part_transfer +
        beli_mobil_cash + beli_mobil_transfer +
        investor_cash + investor_transfer +
        biaya_opr + biaya_gaji + prive + 
        biaya_persiapan
    )

    section_c = {
        "pembelian_part": {
            "cash": beli_part_cash,
            "transfer": beli_part_transfer,
            "total": beli_part_cash + beli_part_transfer
        },
        "pembelian_mobil": {
            "cash": beli_mobil_cash,
            "transfer": beli_mobil_transfer,
            "total": beli_mobil_cash + beli_mobil_transfer
        },
        "pengembalian_investor": {
            "cash": investor_cash,
            "transfer": investor_transfer,
            "total": investor_cash + investor_transfer
        },
        "operasional": biaya_opr,
        "gaji": biaya_gaji,
        "prive": prive,
        "biaya_persiapan": biaya_persiapan,
        "total_c": total_c
    }

    # --- D. Sisa Laba dan Modal (Cash Position) ---
    balances = kas_service.get_all_balances(as_of=tanggal_sampai)
    posisi_cash = balances.get(KasBankJenis.CASH.value, {}).get("saldo", 0)
    
    posisi_transfer = 0
    for k, v in balances.items():
        if k != KasBankJenis.CASH.value and isinstance(v, dict):
            posisi_transfer += v.get("saldo", 0)

    section_d = {
        "cash": posisi_cash,
        "transfer": posisi_transfer,
        "total_d": posisi_cash + posisi_transfer,
        "theoretical_modal": section_a["total_a"] - section_b["total_b"] - section_c["total_c"]
    }

    return {
        "section_a": section_a,
        "section_b": section_b,
        "section_c": section_c,
        "section_d": section_d,
        "grand_total": (section_a["total_a"] - section_c["total_c"]) # Ideally should match Total Assets (D + B) roughly? 
        # Accounting equation: Assets (Cash + Piutang) = Equity + Liabilities.
        # Here: (Sisa Modal + Laba) ~ (Cash + Receivables - Payables).
        # We'll just return the sections as requested.
    }

