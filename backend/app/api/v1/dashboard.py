from datetime import date
from decimal import Decimal
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
from app.models.jasa_angkut import MuatanJasaAngkut, JasaAngkutBiayaLainnya, JasaAngkutPartService, ArmadaJasaAngkut
from app.models.mobil import Mobil, MobilBiayaLainnya, TransaksiPenjualanMobil
from app.models.bengkel import PembelianSparePart, TransaksiPenjualanBengkel, PengeluaranBengkel
from app.utils.constants import KasBankSource, KasBankType, KasBankJenis, PaymentStatus, PiutangSource, PiutangStatus, CarStatus, HutangSource, AssetStatus, InvestorDisbursementStatus, OwnershipType, ExpenseCategory
from app.models.keuangan import KasBank, PiutangUsaha as PiutangModel
from app.utils.cache import build_key, get_cached, set_cached, invalidate_cache_prefix
from sqlalchemy import func, or_, case


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary")
def get_dashboard_summary(
    db: DBSession,
    current_user: ManagerUser,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
):
    """Get comprehensive dashboard summary."""
    # Default to current month if no dates provided
    if not tanggal_dari and not tanggal_sampai:
        today = date.today()
        tanggal_dari = date(today.year, today.month, 1)
        tanggal_sampai = today
    # ── Cache check (30-second TTL) ───────────────────────────────────
    _cache_key = build_key("dashboard_summary", tanggal_dari, tanggal_sampai)
    _cached = get_cached(_cache_key)
    if _cached is not None:
        return _cached
    # ─────────────────────────────────────────────────────────────────

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

    # Overhead breakdown by unit
    overhead_by_unit = db.query(
        PengeluaranBengkel.bisnis_kategori,
        func.sum(PengeluaranBengkel.jumlah)
    ).filter(
        PengeluaranBengkel.bisnis_kategori.in_(["umum", "bengkel", "penjualan_mobil", "jasa_angkut", "mobil", "jual_beli_mobil"]),
        PengeluaranBengkel.tanggal >= tanggal_dari,
        PengeluaranBengkel.tanggal <= tanggal_sampai
    )
    
    overhead_data = {str(unit).lower(): float(total or 0) for unit, total in overhead_by_unit.group_by(PengeluaranBengkel.bisnis_kategori).all()}

    result = {
        "periode": {
            "dari": tanggal_dari.isoformat() if tanggal_dari else None,
            "sampai": tanggal_sampai.isoformat() if tanggal_sampai else None,
        },
        "bengkel": {
            "total_penjualan": bengkel_summary["total_penjualan"],
            "total_transaksi": bengkel_summary["total_transaksi"],
            "laba_kotor": bengkel_summary["total_laba_kotor"],
            "total_pengeluaran": overhead_data.get("bengkel", 0) + overhead_data.get("umum", 0),
            "saldo_cash": float(kas_bank_summary.get("kas_unit_bengkel", {}).get("saldo", 0)),
        },
        "pengeluaran": {
            "total": pengeluaran_summary["total_pengeluaran"] + gaji_summary["total"],
            "jumlah_transaksi": pengeluaran_summary["total_transaksi"] + gaji_summary["count"],
            "breakdown": overhead_data
        },
        "mobil": {
            "total_penjualan": float(mobil_summary["total_penjualan"]),
            "total_transaksi": mobil_summary["total_transaksi"],
            "laba_kotor": float(mobil_summary["laba_tpm"]),
            "laba_tpm": float(mobil_summary["laba_tpm"]),
            "total_pengeluaran": (
                overhead_data.get("penjualan_mobil", 0) + 
                overhead_data.get("mobil", 0) + 
                overhead_data.get("jual_beli_mobil", 0)
            ),
            "total_modal_tersedia": float(mobil_summary.get("total_modal_tersedia", 0)),
            "saldo_cash": float(kas_bank_summary.get("kas_unit_mobil", {}).get("saldo", 0)),
        },
        "jasa_angkut": {
            "total_pendapatan": float(muatan_summary["total_pendapatan"]),
            "total_transaksi": muatan_summary["total_transaksi"],
            "laba_tpm": float(muatan_summary["laba_tpm"]),
            "total_pengeluaran": overhead_data.get("jasa_angkut", 0) + muatan_summary.get("details", {}).get("biaya_lainnya", 0),
            "active_trips": muatan_summary["hutang_supir_count"],
            "saldo_cash": float(kas_bank_summary.get("kas_unit_jasa_angkut", {}).get("saldo", 0)),
        },

        "piutang": {
            "total_piutang": float(piutang_summary["total_piutang"]),
            "total_sisa": float(piutang_summary["total_sisa"]),
            "jumlah_overdue": piutang_summary["jumlah_overdue"],
        },
        "hutang": {
            "total_hutang": float(hutang_summary["total_hutang"]),
            "total_sisa": float(hutang_summary["total_sisa"]),
            "jumlah_belum_lunas": hutang_summary["jumlah_belum_lunas"],
        },
        "kas_bank": kas_bank_summary,
        "active_trips": muatan_summary["hutang_supir_count"],  # For BusinessPulse
    }
    set_cached(_cache_key, result)
    return result


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
    # ── Cache check (60-second TTL) ───────────────────────────────────
    _cache_key = build_key("profit_summary", tanggal_dari, tanggal_sampai)
    _cached = get_cached(_cache_key)
    if _cached is not None:
        return _cached
    # ─────────────────────────────────────────────────────────────────
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

    # Calculate Jasa Angkut contributions
    muatan_gross_tpm = muatan["total_pendapatan"] # Already represents (Revenue - Driver Share)
    muatan_net_tpm = muatan["laba_tpm"] # Represents Gross TPM Share now (expenses handled separately)
    trip_costs = muatan.get("details", {}).get("biaya_lainnya", 0)


    total_laba_kotor = (
        bengkel["total_laba_kotor"] +
        mobil["laba_tpm"] +
        muatan_gross_tpm # Use Gross for proper expense matching
    )

    # Merge gaji and pembelian data into pengeluaran details
    per_kategori = pengeluaran["per_kategori"]
    
    # Add trip expenses as a category
    if trip_costs > 0:
        if "operasional_muatan" in per_kategori:
            per_kategori["operasional_muatan"]["total"] += float(trip_costs)
            per_kategori["operasional_muatan"]["count"] += muatan["total_transaksi"]
        else:
            per_kategori["operasional_muatan"] = {
                "total": float(trip_costs),
                "count": muatan["total_transaksi"]
            }

    # Add salaries
    if "gaji" in per_kategori:
        for key, value in gaji_summary.items():
            if key in per_kategori["gaji"] and isinstance(value, (int, float, Decimal)):
                per_kategori["gaji"][key] += value
            else:
                per_kategori["gaji"][key] = value
    else:
        per_kategori["gaji"] = gaji_summary


    # Final summary for Category details
    pengeluaran_details = per_kategori

    # Normalize unit details for the frontend
    pengeluaran_unit_details = {}
    raw_units = pengeluaran.get("per_unit", {})
    
    # 1. Mobil: Split General Ops vs Car Capital
    sold_mobil_ids = {str(m['mobil_id']) for m in mobil.get("sold_list", []) if m.get('mobil_id')}
    mobil_unit_breakdown = pengeluaran.get("mobil_unit", {}).copy()
    
    # NEW: Include internal workshop repairs (TransaksiPenjualanBengkel)
    # These are not in PengeluaranBengkel table but represent real unit costs
    internal_workshop_costs = db.query(
        TransaksiPenjualanBengkel.mobil_id,
        func.sum(TransaksiPenjualanBengkel.grand_total)
    ).filter(
        TransaksiPenjualanBengkel.tanggal >= tanggal_dari,
        TransaksiPenjualanBengkel.tanggal <= tanggal_sampai,
        TransaksiPenjualanBengkel.mobil_id.is_not(None),
        TransaksiPenjualanBengkel.kategori.in_(['jual_beli_mobil', 'mobil', 'penjualan_mobil'])
    ).group_by(TransaksiPenjualanBengkel.mobil_id).all()
    
    for m_id, total in internal_workshop_costs:
        m_id_str = str(m_id)
        if m_id_str not in mobil_unit_breakdown:
            mobil_unit_breakdown[m_id_str] = {}
        
        # Add to BIAYA_OPERASIONAL (Repair)
        current = mobil_unit_breakdown[m_id_str].get(ExpenseCategory.BIAYA_OPERASIONAL.value, 0)
        mobil_unit_breakdown[m_id_str][ExpenseCategory.BIAYA_OPERASIONAL.value] = float(current) + float(total)
    
    # Row 2b & Row 3: Sum directly from categorized ledger data for ALL cars in this period
    # We include sold cars too because their 'total_modal' snapshot might not include 
    # the very latest costs recorded today via the ledger.
    capital_unsold_mobil_ops = 0
    mobil_biaya_bengkel = 0
    
    for m_id, categories in mobil_unit_breakdown.items():
        # Row 2b: Pajak, BBN, etc (mapped to BIAYA_LAINNYA)
        capital_unsold_mobil_ops += float(categories.get(ExpenseCategory.BIAYA_LAINNYA.value, 0))
        # Row 3: Repairs, Maintenance (mapped to BIAYA_OPERASIONAL)
        mobil_biaya_bengkel += float(categories.get(ExpenseCategory.BIAYA_OPERASIONAL.value, 0))

    # PER USER REQUEST: Baris 7 must come ONLY from the DOMPET UNIT (KAS_UNIT_MOBIL)
    # Get total outgoings from Mobil Wallet
    wallet_mobil_outflow = float(db.query(func.sum(KasBank.nominal)).filter(
        KasBank.jenis == KasBankJenis.KAS_UNIT_MOBIL,
        KasBank.tipe == KasBankType.KELUAR,
        KasBank.tanggal >= tanggal_dari,
        KasBank.tanggal <= tanggal_sampai
    ).scalar() or 0)
    
    # Get how much of the unit-specific costs (Baris 2b & 3) were paid from THIS wallet
    wallet_unit_specific_outgoings = float(db.query(func.sum(KasBank.nominal))
        .join(PengeluaranBengkel, KasBank.referensi_id == PengeluaranBengkel.id)
        .filter(
            KasBank.jenis == KasBankJenis.KAS_UNIT_MOBIL,
            KasBank.tipe == KasBankType.KELUAR,
            KasBank.tanggal >= tanggal_dari,
            KasBank.tanggal <= tanggal_sampai,
            PengeluaranBengkel.mobil_id.is_not(None)
        ).scalar() or 0)
    
    # Row 7 is the residual of the drawer
    general_mobil_ops = wallet_mobil_outflow - wallet_unit_specific_outgoings
    
    # Define raw_mobil_total for profit calculation at the bottom
    raw_mobil_total = float(
        raw_units.get("penjualan_mobil", 0) + 
        raw_units.get("jual_beli_mobil", 0) + 
        raw_units.get("mobil", 0)
    )
    
    pengeluaran_unit_details["bengkel"] = raw_units.get("bengkel", 0)
    pengeluaran_unit_details["mobil"] = general_mobil_ops
    
    # 2. Jasa Angkut: Split General Ops vs Armada/Trip Ops
    ja_armada_breakdown = pengeluaran.get("jasa_angkut_armada", {}).copy()
    
    # NEW: Include internal workshop repairs (TransaksiPenjualanBengkel)
    ja_workshop_repairs = db.query(
        ArmadaJasaAngkut.nama,
        func.sum(TransaksiPenjualanBengkel.grand_total)
    ).join(ArmadaJasaAngkut, TransaksiPenjualanBengkel.armada_id == ArmadaJasaAngkut.id).filter(
        TransaksiPenjualanBengkel.tanggal >= tanggal_dari,
        TransaksiPenjualanBengkel.tanggal <= tanggal_sampai,
        TransaksiPenjualanBengkel.armada_id.is_not(None),
        TransaksiPenjualanBengkel.kategori == 'jasa_angkut'
    ).group_by(ArmadaJasaAngkut.nama).all()
    
    for a_name, total in ja_workshop_repairs:
        ja_armada_breakdown[a_name] = ja_armada_breakdown.get(a_name, 0) + float(total)
    trip_armada_breakdown = muatan.get("details", {}).get("operasional_per_armada", {})
    
    # Aggregate all armada specific costs (Maintenance from Pengeluaran + BBM/Tol/Parkir from Trips)
    all_armada_specific = 0
    for arm, val in ja_armada_breakdown.items():
        all_armada_specific += float(val)
    
    raw_ja_total = float(raw_units.get("jasa_angkut", 0))
    general_ja_ops = raw_ja_total - sum(ja_armada_breakdown.values())
    
    pengeluaran_unit_details["jasa_angkut"] = general_ja_ops
    pengeluaran_unit_details["umum"] = raw_units.get("umum", 0)
    
    # Add capital/specific values to summary for UI categorization
    mobil["capital_period_ops"] = capital_unsold_mobil_ops
    mobil["biaya_bengkel"] = mobil_biaya_bengkel
    
    # Jasa Angkut details for P&L
    ja_biaya_bengkel = float(muatan.get("details", {}).get("biaya_bengkel") or 0)
    muatan["details"]["biaya_bengkel"] = ja_biaya_bengkel
    
    # PER USER REQUEST: Row 3 should ONLY be BBM/Ops (e.g. 50k), excluding repairs (100k)
    armada_period_ops = (all_armada_specific + float(trip_costs)) - ja_biaya_bengkel
    muatan["details"]["armada_period_ops"] = max(0, armada_period_ops)
    
    # Merge armada breakdowns for detailed lists
    # And subtract repairs from the breakdown to stay consistent with Row 3
    bengkel_per_armada = muatan.get("details", {}).get("bengkel_per_armada", {})
    for arm, val in trip_armada_breakdown.items():
        ja_armada_breakdown[arm] = ja_armada_breakdown.get(arm, 0) + float(val)
        
    # Subtract repairs from the breakdown
    for arm, val in ja_armada_breakdown.items():
        ja_armada_breakdown[arm] = max(0, float(val) - float(bengkel_per_armada.get(arm, 0)))

    pengeluaran_unit_details["jasa_angkut_armada"] = ja_armada_breakdown
    pengeluaran_unit_details["mobil_unit"] = mobil_unit_breakdown

    # Add Purchases (as requested by user)
    if "pembelian_part" in pengeluaran_details:
        pengeluaran_details["pembelian_part"]["total"] += pembelian_summ["total_nilai"]
        pengeluaran_details["pembelian_part"]["count"] += pembelian_summ["total_transaksi"]
    else:
        pengeluaran_details["pembelian_part"] = {
            "total": pembelian_summ["total_nilai"],
            "count": pembelian_summ["total_transaksi"]
        }

    # Total Pengeluaran (Hanya gaji dan pengeluaran operasional, termasuk Prive tapi TANPA pembelian part)
    # PER USER REQUEST: Profit Bersih should deduct ALL unit costs.
    # Total JA Costs = Row 2 (Repairs) + Row 3 (Ops Armada) + Row 4 (General JA Ops)
    total_ja_costs = muatan["details"].get("biaya_bengkel", 0) + muatan["details"].get("armada_period_ops", 0) + general_ja_ops
    
    # Total Mobil Costs = Car Maintenance (unsold) + Baris 2b (Pajak etc) + Baris 7 (General Mobil Ops)
    total_mobil_costs = mobil_biaya_bengkel + capital_unsold_mobil_ops + general_mobil_ops
    
    total_pengeluaran = (
        (float(pengeluaran["total_pengeluaran"] or 0) - raw_mobil_total - raw_ja_total) + 
        gaji_summary["total"] +
        total_ja_costs +
        total_mobil_costs
    )
    laba_bersih = total_laba_kotor - total_pengeluaran

    result = {
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
        "pengeluaran_unit_details": pengeluaran_unit_details,
        "laba_bersih": laba_bersih,
    }
    set_cached(_cache_key, result)
    return result


@router.get("/recent-activity")
def get_recent_activity(
    db: DBSession,
    current_user: ManagerUser,
    limit: int = 10,
):
    """Get unified recent activity feed (Financial + Operational)."""
    # ── Cache check (30-second TTL) ───────────────────────────────────
    _cache_key = build_key("recent_activity", limit)
    _cached = get_cached(_cache_key)
    if _cached is not None:
        return _cached
    # ─────────────────────────────────────────────────────────────────

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
    result = activities[:limit]
    set_cached(_cache_key, result)
    return result


@router.get("/capital-report")
def get_capital_report(
    db: DBSession,
    current_user: ManagerUser,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
):
    """Get capital change report (Laporan Perubahan Modal)."""
    # ── Cache check (60-second TTL) ───────────────────────────────────
    _cache_key = build_key("capital_report", tanggal_dari, tanggal_sampai)
    _cached = get_cached(_cache_key)
    if _cached is not None:
        return _cached
    # ─────────────────────────────────────────────────────────────────

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
            cash_types = [
                KasBankJenis.CASH,
                KasBankJenis.KAS_UNIT_BENGKEL,
                KasBankJenis.KAS_UNIT_JASA_ANGKUT,
                KasBankJenis.KAS_UNIT_MOBIL,
                KasBankJenis.KAS_UTAMA
            ]
            if method_filter == 'cash':
                q = q.filter(KasBank.jenis.in_(cash_types))
            elif method_filter == 'transfer':
                q = q.filter(~KasBank.jenis.in_(cash_types))
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
    
    # For Section A, we want to show the Unit Performance.
    # Laba Kotor Unit = Income - Direct Costs (HPP/Operational)
    laba_bengkel = bengkel_summ["total_laba_kotor"] # Selling - HPP
    laba_kotor_mobil = mobil_summ["total_laba_kotor"] # Selling - (Beli + Prep)
    laba_mobil_tpm = mobil_summ["laba_tpm"]
    laba_investor_mobil = mobil_summ["laba_investor"]
    
    # Jasa Angkut: Show Gross Unit Income (Income - Driver) in Section A.
    # All other costs (Trip, Maintenance, Ops) are handled in Section C.
    laba_jasa_angkut_gross = muatan_summ["total_pendapatan"] # Income - Driver
    
    # Jual Beli Mobil: Show Gross Profit (Selling - Modal) in Section A.
    # Investor payouts are handled in Section C.
    laba_kotor_mobil_gross = mobil_summ["total_laba_kotor"] # Selling - Modal
    
    # Total operational profit for reconciliation vs Cash
    total_laba_unit = laba_bengkel + laba_kotor_mobil_gross + laba_jasa_angkut_gross
    
    # 2c. INITIAL STOCK & ASSETS CALCULATION
    # ... (skipping unchanged part in code but keeping the context) ...
    from app.services.spare_part_service import SparePartService
    sparepart_service = SparePartService(db)
    current_stock_value = sparepart_service.get_stock_value()["total_value"]
    
    from app.models.bengkel import PembelianSparePart
    total_purchases = db.query(func.sum(PembelianSparePart.grand_total)).scalar() or 0
    modal_awal_persediaan = max(0, current_stock_value - float(total_purchases))

    from app.models.keuangan import Aset
    total_fixed_assets = db.query(func.sum(Aset.harga_beli)).filter(Aset.status == AssetStatus.AKTIF).scalar() or 0
    modal_awal_total = modal_awal_persediaan + float(total_fixed_assets)

    # SEC A TOTAL: Initial Capital + Realized Assets + All Profits
    # This represents everything that SHOULD exist in Cash/Receivables/Inventory.
    total_a = float(setoran_modal) + float(hpp_bengkel) + float(hpp_mobil) + float(total_laba_unit) + float(modal_awal_total)

    # A. Summary
    section_a = {
        "setoran_modal": setoran_modal,
        "hpp_bengkel": hpp_bengkel,
        "hpp_mobil": hpp_mobil,
        "total_laba": total_laba_unit,
        "details": {
            "laba_bengkel": laba_bengkel,
            "laba_kotor_mobil": laba_kotor_mobil_gross,
            "laba_investor_mobil": float(mobil_summ.get("laba_investor", 0)), # For INFO only
            "laba_jasa_angkut": laba_jasa_angkut_gross,
            "biaya_jasa_angkut_trip": muatan_summ["total_biaya_trip"], # For INFO only
        },
        "aset_persediaan": modal_awal_persediaan,
        "aset_tetap": float(total_fixed_assets),
        "modal_persediaan": modal_awal_total,
        "total_a": total_a
    }

    # --- B. Piutang ---
    piutang_summ = piutang_service.get_summary(tanggal_dari, tanggal_sampai)
    p_by_sumber = piutang_summ.get("by_sumber", {})
    
    p_lainnya_gross = p_by_sumber.get(PiutangSource.LAINNYA.value, {}).get("total_piutang", 0)
    p_mobil_gross = p_by_sumber.get(PiutangSource.JUAL_BELI_MOBIL.value, {}).get("total_piutang", 0)
    
    # PIUTANG JASA ANGKUT (Gross New Created in period)
    # Only muatans that generated a PiutangUsaha record are counted.
    # Muatans that were LUNAS from the start bypass this table and are handled by direct Kas Masuk.
    q_ja_gross = db.query(func.sum(PiutangModel.nominal_piutang)).filter(
        PiutangModel.sumber == PiutangSource.JASA_ANGKUT,
        PiutangModel.status != PiutangStatus.BATAL
    )
    if tanggal_dari: q_ja_gross = q_ja_gross.filter(PiutangModel.tanggal >= tanggal_dari)
    if tanggal_sampai: q_ja_gross = q_ja_gross.filter(PiutangModel.tanggal <= tanggal_sampai)
    p_supir_ja = float(q_ja_gross.scalar() or 0)

    # PIUTANG PART JUAL MOBIL — Outstanding workshop investment in UNSOLD cars only.
    # When a car is sold, its parts cost is fully captured via total_modal in Section A,
    # so it must NOT appear here anymore. Only unsold cars have "outstanding" parts.
    q_part_mobil = (
        db.query(func.sum(TransaksiPenjualanBengkel.grand_total))
        .join(Mobil, TransaksiPenjualanBengkel.mobil_id == Mobil.id)
        .filter(
            TransaksiPenjualanBengkel.kategori == "jual_beli_mobil",
            Mobil.status != CarStatus.TERJUAL,  # Exclude sold cars
        )
    )
    if tanggal_dari: q_part_mobil = q_part_mobil.filter(TransaksiPenjualanBengkel.tanggal >= tanggal_dari)
    if tanggal_sampai: q_part_mobil = q_part_mobil.filter(TransaksiPenjualanBengkel.tanggal <= tanggal_sampai)
    p_part_jual_mobil = float(q_part_mobil.scalar() or 0)

    # DIRECT PAYMENTS (DP & Partials) 
    # These often use operational sources instead of PIUTANG source in KasBank entries.
    # We must subtract them from gross piutang to get the correct net outstanding change.
    def get_direct_cash(src, kb_src):
        q = (
            db.query(func.sum(KasBank.nominal))
            .join(PiutangModel, PiutangModel.nomor_referensi == KasBank.nomor_referensi)
            .filter(
                KasBank.sumber == kb_src,
                KasBank.tipe == KasBankType.MASUK,
                PiutangModel.sumber == src,
                PiutangModel.status != PiutangStatus.BATAL
            )
        )
        if tanggal_dari: q = q.filter(KasBank.tanggal >= tanggal_dari)
        if tanggal_sampai: q = q.filter(KasBank.tanggal <= tanggal_sampai)
        return float(q.scalar() or 0)

    p_mobil_direct_cash = get_direct_cash(PiutangSource.JUAL_BELI_MOBIL, KasBankSource.JUAL_BELI_MOBIL)
    p_bengkel_direct_cash = get_direct_cash(PiutangSource.BENGKEL, KasBankSource.BENGKEL)
    p_ja_direct_cash = get_direct_cash(PiutangSource.JASA_ANGKUT, KasBankSource.JASA_ANGKUT)

    p_karyawan_gross = p_by_sumber.get(PiutangSource.KASBON_KARYAWAN.value, {}).get("total_piutang", 0)
    
    # PIUTANG USAHA (Gross New)
    from app.models.keuangan import PembayaranPiutang as PaymentModel
    q_usaha_gross = db.query(func.sum(PiutangModel.nominal_piutang)).filter(
        PiutangModel.sumber == PiutangSource.BENGKEL,
        PiutangModel.status != PiutangStatus.BATAL,
    )
    if tanggal_dari: q_usaha_gross = q_usaha_gross.filter(PiutangModel.tanggal >= tanggal_dari)
    if tanggal_sampai: q_usaha_gross = q_usaha_gross.filter(PiutangModel.tanggal <= tanggal_sampai)
    
    # Exclude piutang linked to jual_beli_mobil transactions
    jb_mobil_trx_ids = db.query(TransaksiPenjualanBengkel.nomor_transaksi).filter(
        TransaksiPenjualanBengkel.kategori == 'jual_beli_mobil'
    ).subquery()
    q_usaha_gross = q_usaha_gross.filter(~PiutangModel.nomor_referensi.in_(jb_mobil_trx_ids))
    p_usaha_gross = float(q_usaha_gross.scalar() or 0)

    # --- ALL REPAYMENTS RECEIVED THIS PERIOD ---
    # This includes payments for NEW piutang and OLD piutang
    q_repayments = db.query(func.sum(PaymentModel.nominal))
    if tanggal_dari: q_repayments = q_repayments.filter(PaymentModel.tanggal >= tanggal_dari)
    if tanggal_sampai: q_repayments = q_repayments.filter(PaymentModel.tanggal <= tanggal_sampai)
    total_penerimaan_piutang = float(q_repayments.scalar() or 0)

    # Breakdown repayments by source for net items
    q_repayments_source = (
        db.query(PiutangModel.sumber, func.sum(PaymentModel.nominal))
        .join(PaymentModel, PaymentModel.piutang_id == PiutangModel.id)
    )
    if tanggal_dari: q_repayments_source = q_repayments_source.filter(PaymentModel.tanggal >= tanggal_dari)
    if tanggal_sampai: q_repayments_source = q_repayments_source.filter(PaymentModel.tanggal <= tanggal_sampai)
    
    repayments_by_source = {s.value if hasattr(s, "value") else s: float(n) for s, n in q_repayments_source.group_by(PiutangModel.sumber).all()}

    # Calculate net items for display (Gross Created in period - Payments Received in period - DPs Received)
    p_lainnya_net = p_lainnya_gross - repayments_by_source.get(PiutangSource.LAINNYA.value, 0)
    p_mobil_net = p_mobil_gross - p_mobil_direct_cash - repayments_by_source.get(PiutangSource.JUAL_BELI_MOBIL.value, 0)
    p_supir_ja_net = p_supir_ja - p_ja_direct_cash - repayments_by_source.get(PiutangSource.JASA_ANGKUT.value, 0)
    p_karyawan_net = p_karyawan_gross - repayments_by_source.get(PiutangSource.KASBON_KARYAWAN.value, 0)
    p_usaha_net = p_usaha_gross - p_bengkel_direct_cash - repayments_by_source.get(PiutangSource.BENGKEL.value, 0)
    
    # Total B = Net Change in Piutang asset this period.
    # Note: p_part_jual_mobil is internal (reclassification), so we usually keep it separate 
    # but the user sees it as a category too.
    total_b = p_lainnya_net + p_mobil_net + p_supir_ja_net + p_karyawan_net + p_usaha_net + p_part_jual_mobil

    # Combined Piutang with Initial Non-Cash Assets for reconciliation
    # Since these are included in A (added) but are not cash, they must be in B (subtracted)
    total_b_with_assets = total_b + modal_awal_total

    section_b = {
        "piutang_lainnya": p_lainnya_net,
        "piutang_mobil": p_mobil_net,
        "piutang_part_mobil": p_part_jual_mobil,
        "piutang_part_mobil_display": p_part_jual_mobil,
        "piutang_jasa_angkut": p_supir_ja_net,
        "piutang_karyawan": p_karyawan_net,
        "piutang_usaha": p_usaha_net,
        "aset_persediaan": modal_awal_persediaan,
        "aset_tetap": float(total_fixed_assets),
        "modal_persediaan": modal_awal_total,
        "total_penerimaan": total_penerimaan_piutang, # For display
        "total_b": total_b_with_assets
    }

    # Pre-calculate Accrued Investor Payables for use in Section C and Section E
    # Sold investor units that are not yet disbursed: Modal Investor + Laba Investor - Any partial payouts
    q_pending_investor = db.query(
        func.sum(
            Mobil.nominal_investor + 
            TransaksiPenjualanMobil.laba_investor - 
            TransaksiPenjualanMobil.nominal_pencairan
        )
    ).join(Mobil, TransaksiPenjualanMobil.mobil_id == Mobil.id).filter(
        TransaksiPenjualanMobil.tipe_kepemilikan == OwnershipType.INVESTOR,
        TransaksiPenjualanMobil.status_bayar == PaymentStatus.LUNAS,
        TransaksiPenjualanMobil.status_pencairan != InvestorDisbursementStatus.DICAIRKAN
    )
    if tanggal_sampai:
        q_pending_investor = q_pending_investor.filter(TransaksiPenjualanMobil.tanggal <= (tanggal_sampai or date.max))
    
    h_investor_accrued = float(q_pending_investor.scalar() or 0)

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

    # Subtract internal/bilateral KELUAR entries (not real cash movements)
    # Includes: legacy bilateral, new internal piutang/hutang settlement entries
    from app.utils.constants import PaymentMethod
    q_internal_bilateral = (
        db.query(func.sum(KasBank.nominal))
        .filter(
            KasBank.sumber == KasBankSource.JUAL_BELI_MOBIL,
            KasBank.tipe == KasBankType.KELUAR,
            or_(
                KasBank.keterangan.like("Biaya Repair Internal via Bengkel%"),  # Legacy
                KasBank.keterangan.like("Pelunasan Biaya Repair Internal%"),    # New piutang settlement
                KasBank.keterangan.like("Pelunasan %Unit %"),                   # New hutang settlement
                KasBank.metode_bayar == PaymentMethod.INTERNAL,                 # Catch-all for INTERNAL
            ),
        )
    )
    if tanggal_dari:
        q_internal_bilateral = q_internal_bilateral.filter(KasBank.tanggal >= tanggal_dari)
    if tanggal_sampai:
        q_internal_bilateral = q_internal_bilateral.filter(KasBank.tanggal <= tanggal_sampai)
    internal_bilateral_keluar = float(q_internal_bilateral.scalar() or 0)
    jb_mobil_cash = max(jb_mobil_cash - internal_bilateral_keluar, 0)  # Remove internal entries

    # 4. Beban Operasional, Gaji, Prive (From KasBank)
    # Include unit-specific operational sources to ensure cash reconciliation
    # Exclude Jasa Angkut wallet because it's now fully handled in Section A (Net Laba JA)
    biaya_opr_p_q = db.query(func.sum(KasBank.nominal)).filter(
        KasBank.sumber == KasBankSource.PENGELUARAN,
        KasBank.tipe == KasBankType.KELUAR,
        KasBank.jenis != KasBankJenis.KAS_UNIT_JASA_ANGKUT
    )
    if tanggal_dari: biaya_opr_p_q = biaya_opr_p_q.filter(KasBank.tanggal >= tanggal_dari)
    if tanggal_sampai: biaya_opr_p_q = biaya_opr_p_q.filter(KasBank.tanggal <= tanggal_sampai)
    biaya_opr_p = float(biaya_opr_p_q.scalar() or 0)
    
    # Jasa Angkut Maintenance & Operasional (Direct from muatan_service breakdown)
    # Includes: Trip Costs (BBM/Tol) + Workshop + Wallet Outflows
    ja_trip_total = muatan_summ.get("total_biaya_trip", 0)
    ja_unit_total = muatan_summ.get("total_biaya_operasional_unit", 0)
    biaya_opr_ja = float(ja_trip_total) + float(ja_unit_total)
    
    biaya_opr_b = get_kas_sum(KasBankSource.BENGKEL, KasBankType.KELUAR)
    biaya_opr = biaya_opr_p + biaya_opr_ja + biaya_opr_b
    
    biaya_gaji = float(gaji_summary.get("total_gaji_pokok", 0) + gaji_summary.get("total_uang_lembur", 0))
    prive = get_kas_sum(KasBankSource.PRIVE, KasBankType.KELUAR)

    # Unit-specific operational expenses for transparency
    pengeluaran_summ = pengeluaran_service.get_summary(tanggal_dari, tanggal_sampai)
    raw_units = pengeluaran_summ.get("per_unit", {})

    # Combine breakdown from Pengeluaran (Wallet) + Muatan (Trip stats)
    raw_ja_armada = raw_units.get("jasa_angkut_armada", {}) # From Pengeluaran breakdown
    ja_trip_breakdown = muatan_summ.get("details", {}).get("operasional_per_armada", {})
    
    ja_full_armada_breakdown = {}
    # Combine both
    for name, val in raw_ja_armada.items():
        ja_full_armada_breakdown[name] = ja_full_armada_breakdown.get(name, 0) + float(val)
    for name, val in ja_trip_breakdown.items():
        ja_full_armada_breakdown[name] = ja_full_armada_breakdown.get(name, 0) + float(val)

    operasional_unit_details = {
        "bengkel": float(raw_units.get("bengkel", 0) + biaya_opr_b),
        "mobil": float(raw_units.get("penjualan_mobil", 0) + raw_units.get("jual_beli_mobil", 0) + raw_units.get("mobil", 0)),
        "jasa_angkut": biaya_opr_ja,
        "umum": float(raw_units.get("umum", 0)),
        "jasa_angkut_armada": ja_full_armada_breakdown
    }

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
        (jb_mobil_cash + jb_mobil_transfer + h_investor_accrued) +
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
            "accrued": h_investor_accrued,
            "total": jb_mobil_cash + jb_mobil_transfer + h_investor_accrued,
            "termasuk_biaya_persiapan": biaya_persiapan_display,
        },
        "operasional": biaya_opr,
        "operasional_unit_details": operasional_unit_details,
        "gaji": float(gaji_summary.get("total_gaji_pokok", 0)),
        "lembur": float(gaji_summary.get("total_uang_lembur", 0)),
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
    
    # Hutang Investor components:
    # 1. Manual payables from HutangUsaha table (e.g. borrowing investor money)
    h_investor_base = h_by_sumber.get(HutangSource.JUAL_BELI_MOBIL.value, {}).get("sisa_hutang", 0)
    
    h_investor = h_investor_base + h_investor_accrued
    
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
    
    unit_keys = [
        KasBankJenis.KAS_UNIT_BENGKEL.value.lower(),
        KasBankJenis.KAS_UNIT_JASA_ANGKUT.value.lower(),
        KasBankJenis.KAS_UNIT_MOBIL.value.lower(),
    ]
    main_cash_keys = [
        KasBankJenis.CASH.value.lower(),
        KasBankJenis.KAS_UTAMA.value.lower(),
    ]
    
    posisi_cash = 0
    posisi_transfer = 0
    
    for k, v in balances.items():
        if not isinstance(v, dict): continue
        saldo = v.get("saldo", 0)
        
        if k in main_cash_keys or k in unit_keys:
            posisi_cash += saldo
        elif k not in ["total_saldo"]:
            # Bank accounts and BOP accounts classified as transfer for macro-reconciliation
            posisi_transfer += saldo

    # Breakdown by accounts for audit
    unit_details = {k: 0 for k in unit_keys}
    for k, v in balances.items():
        if k in unit_keys and isinstance(v, dict):
            unit_details[k] = v.get("saldo", 0)

    total_kas = posisi_cash + posisi_transfer
    
    # Formula-based reconciliation: should equal total_kas
    modal_komponen = section_a["total_a"] - section_b["total_b"] - section_c["total_c"] + total_e
    penyesuaian = round(total_kas - modal_komponen, 2)

    section_d = {
        "cash": posisi_cash,
        "transfer": posisi_transfer,
        "unit_details": {k: float(v or 0) for k, v in unit_details.items()},
        "total_d": total_kas,
        "theoretical_modal": modal_komponen,
        "modal_komponen": modal_komponen,
        "penyesuaian": penyesuaian,
    }

    # Result summary
    result = {
        "section_a": section_a,
        "section_b": section_b,
        "section_c": section_c,
        "section_d": section_d,
        "section_e": section_e,
        "grand_total": total_kas
    }
    set_cached(_cache_key, result)
    return result


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
    # ── Cache check (60-second TTL) ───────────────────────────────────
    _cache_key = build_key("neraca", tanggal_dari, tanggal_sampai)
    _cached = get_cached(_cache_key)
    if _cached is not None:
        return _cached
    # ─────────────────────────────────────────────────────────────────

    # Helpers
    def get_kas_sum(sumber, tipe, method_filter=None):
        q = db.query(func.sum(KasBank.nominal)).filter(
            KasBank.sumber == sumber,
            KasBank.tipe == tipe
        )
        if tanggal_sampai:
            q = q.filter(KasBank.tanggal <= tanggal_sampai)
        if method_filter:
            cash_types = [
                KasBankJenis.CASH,
                KasBankJenis.KAS_UNIT_BENGKEL,
                KasBankJenis.KAS_UNIT_JASA_ANGKUT,
                KasBankJenis.KAS_UNIT_MOBIL,
                KasBankJenis.KAS_UTAMA
            ]
            if method_filter == 'cash':
                q = q.filter(KasBank.jenis.in_(cash_types))
            elif method_filter == 'transfer':
                q = q.filter(~KasBank.jenis.in_(cash_types))
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
    from app.services.asset_service import AssetService
    asset_service = AssetService(db)

    # ==========================================
    # A. AKTIVA LANCAR (Current Assets)
    # ==========================================

    balances = kas_service.get_all_balances(as_of=tanggal_sampai)
    
    kas_tunai = 0 # Main Cash (Utama)
    kas_bank = 0 # Bank Accounts
    unit_cash = 0 # Unit-specific Cash
    
    bank_details = {}
    unit_details = {}
    
    unit_keys = [
        KasBankJenis.KAS_UNIT_BENGKEL.value.lower(),
        KasBankJenis.KAS_UNIT_JASA_ANGKUT.value.lower(),
        KasBankJenis.KAS_UNIT_MOBIL.value.lower(),
    ]
    
    main_cash_keys = [
        KasBankJenis.CASH.value.lower(),
        KasBankJenis.KAS_UTAMA.value.lower(),
    ]
    
    # Initialize details to ensure all units appear even if saldo is 0
    unit_details = {k: 0 for k in unit_keys}

    for k, v in balances.items():
        if not isinstance(v, dict): continue
        saldo = v.get("saldo", 0)
        
        if k in main_cash_keys:
            kas_tunai += saldo
        elif k in unit_keys:
            unit_cash += saldo
            unit_details[k] = saldo
        else:
            # All other accounts are treated as Bank/Central
            kas_bank += saldo
            bank_details[k] = saldo
    
    total_kas_bank_all = kas_tunai + kas_bank + unit_cash

    # 2. Piutang (Snapshot logic)
    # We need to replicate the exact buckets from Perubahan Modal Section B
    from app.models.keuangan import PiutangUsaha as PiutangModel, PembayaranPiutang as PaymentModel
    from app.models.bengkel import TransaksiPenjualanBengkel
    from app.models.mobil import Mobil
    from app.utils.constants import CarStatus, PiutangSource, KasBankSource, KasBankType
    
    # Helper for Snapshot Balance
    def get_sisa_snapshot(src):
        # 1. Gross Piutang (nominal) created up to tanggal_sampai
        gross = db.query(func.sum(PiutangModel.nominal_piutang)).filter(
            PiutangModel.sumber == src,
            PiutangModel.status != PiutangStatus.BATAL,
            PiutangModel.tanggal <= (tanggal_sampai or date.max)
        ).scalar() or 0
        
        # 2. Payments via PembayaranPiutang table
        paid = db.query(func.sum(PaymentModel.nominal)).join(
            PiutangModel, PaymentModel.piutang_id == PiutangModel.id
        ).filter(
            PiutangModel.sumber == src,
            PiutangModel.tanggal <= (tanggal_sampai or date.max),
            PaymentModel.tanggal <= (tanggal_sampai or date.max)
        ).scalar() or 0
        
        # 3. Direct Payments via KasBank (DPs/Partials recorded outside PembayaranPiutang table)
        # We find payments in KasBank with the same nomor_referensi and appropriate source
        from app.models.keuangan import KasBank
        from app.utils.constants import KasBankSource, KasBankType
        
        # Map PiutangSource to corresponding KasBankSource
        source_map = {
            PiutangSource.JUAL_BELI_MOBIL: KasBankSource.JUAL_BELI_MOBIL,
            PiutangSource.BENGKEL: KasBankSource.BENGKEL,
            PiutangSource.JASA_ANGKUT: KasBankSource.JASA_ANGKUT
        }
        
        direct_paid = 0
        if src in source_map:
            kb_src = source_map[src]
            q_direct = db.query(func.sum(KasBank.nominal)).join(
                PiutangModel, PiutangModel.nomor_referensi == KasBank.nomor_referensi
            ).filter(
                KasBank.sumber == kb_src,
                KasBank.tipe == KasBankType.MASUK,
                PiutangModel.sumber == src,
                PiutangModel.status != PiutangStatus.BATAL,
                PiutangModel.tanggal <= (tanggal_sampai or date.max),
                KasBank.tanggal <= (tanggal_sampai or date.max)
            )
            direct_paid = float(q_direct.scalar() or 0)
            
        return float(gross) - float(paid) - float(direct_paid)

    p_lainnya = get_sisa_snapshot(PiutangSource.LAINNYA)
    p_mobil = get_sisa_snapshot(PiutangSource.JUAL_BELI_MOBIL)
    p_jasa_angkut = get_sisa_snapshot(PiutangSource.JASA_ANGKUT)
    p_karyawan = get_sisa_snapshot(PiutangSource.KASBON_KARYAWAN)
    
    # Internal Repair Receivable (Piutang Part Jual Mobil)
    # Same logic as get_capital_report line 460
    q_part_mobil = (
        db.query(func.sum(TransaksiPenjualanBengkel.grand_total))
        .join(Mobil, TransaksiPenjualanBengkel.mobil_id == Mobil.id)
        .filter(
            TransaksiPenjualanBengkel.kategori == "jual_beli_mobil",
            TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL,
            Mobil.deleted_at.is_(None),
            TransaksiPenjualanBengkel.tanggal <= (tanggal_sampai or date.max),
            or_(
                Mobil.tanggal_terjual.is_(None),
                Mobil.tanggal_terjual > (tanggal_sampai or date.max)
            )
        )
    )
    p_part_mobil = float(q_part_mobil.scalar() or 0)
    
    # Piutang Usaha (Bengkel)
    p_bengkel_gross = get_sisa_snapshot(PiutangSource.BENGKEL)
    
    # Subtract internal portion if it exists in PiutangUsaha table
    jb_mobil_trx_ids = db.query(TransaksiPenjualanBengkel.nomor_transaksi).filter(
        TransaksiPenjualanBengkel.kategori == 'jual_beli_mobil'
    ).subquery()
    
    q_bengkel_internal = (
        db.query(func.sum(PiutangModel.nominal_piutang))
        .filter(
            PiutangModel.sumber == PiutangSource.BENGKEL,
            PiutangModel.status != PiutangStatus.BATAL,
            PiutangModel.nomor_referensi.in_(jb_mobil_trx_ids),
            PiutangModel.tanggal <= (tanggal_sampai or date.max)
        )
    )
    p_bengkel_internal_gross = float(q_bengkel_internal.scalar() or 0)
    
    q_bengkel_internal_paid = (
        db.query(func.sum(PaymentModel.nominal))
        .join(PiutangModel, PaymentModel.piutang_id == PiutangModel.id)
        .filter(
            PiutangModel.sumber == PiutangSource.BENGKEL,
            PiutangModel.nomor_referensi.in_(jb_mobil_trx_ids),
            PiutangModel.tanggal <= (tanggal_sampai or date.max),
            PaymentModel.tanggal <= (tanggal_sampai or date.max)
        )
    )
    p_bengkel_internal_paid = float(q_bengkel_internal_paid.scalar() or 0)
    p_bengkel_internal_net = p_bengkel_internal_gross - p_bengkel_internal_paid
    
    p_usaha = max(p_bengkel_gross - p_bengkel_internal_net, 0)

    # Re-assign to clarify final names for dict
    piutang_usaha = p_usaha
    piutang_part_mobil = p_part_mobil
    piutang_mobil = p_mobil
    piutang_jasa_angkut = p_jasa_angkut
    piutang_karyawan = p_karyawan
    piutang_lainnya = p_lainnya
    
    total_piutang = piutang_usaha + piutang_part_mobil + piutang_mobil + piutang_jasa_angkut + piutang_karyawan + piutang_lainnya

    # 3. Persediaan Sparepart
    sparepart_summary = sparepart_service.get_stock_value()
    persediaan_sparepart = sparepart_summary.get("total_value", 0)

    # 4. Stok Mobil (Inventory) — SQL aggregation (avoids loading N car objects into Python)

    q_harga_beli = db.query(
        func.sum(Mobil.harga_beli)
    ).filter(Mobil.status != CarStatus.TERJUAL, Mobil.deleted_at.is_(None))
    harga_beli_total = float(q_harga_beli.scalar() or 0)

    q_biaya_lain = db.query(
        func.sum(MobilBiayaLainnya.jumlah)
    ).join(Mobil, MobilBiayaLainnya.mobil_id == Mobil.id).filter(
        Mobil.status != CarStatus.TERJUAL,
        Mobil.deleted_at.is_(None),
        MobilBiayaLainnya.kategori != "Perawatan Bengkel"
    )
    biaya_lain_total = float(q_biaya_lain.scalar() or 0)

    from app.models.bengkel import PengeluaranBengkel
    # Sum of bengkel workshop costs assigned to unsold cars
    q_biaya_pengeluaran = (
        db.query(func.sum(PengeluaranBengkel.jumlah))
        .join(Mobil, PengeluaranBengkel.mobil_id == Mobil.id)
        .filter(
            Mobil.status != CarStatus.TERJUAL,
            Mobil.deleted_at.is_(None)
        )
    )
    biaya_pengeluaran_total = float(q_biaya_pengeluaran.scalar() or 0)

    stok_mobil_total = harga_beli_total + biaya_lain_total + biaya_pengeluaran_total

    total_aktiva_lancar = float(total_kas_bank_all or 0) + float(total_piutang or 0) + float(persediaan_sparepart or 0) + stok_mobil_total
    
    aktiva_lancar = {
        "kas_tunai": float(kas_tunai or 0),
        "kas_bank": float(kas_bank or 0),
        "bank_details": {k: float(v or 0) for k, v in bank_details.items()},
        "unit_cash": float(unit_cash or 0),
        "unit_details": {k: float(v or 0) for k, v in unit_details.items()},
        "total_kas_bank": float(total_kas_bank_all or 0),
        "piutang_usaha": float(piutang_usaha or 0),
        "piutang_part_mobil": float(piutang_part_mobil or 0),
        "piutang_mobil": float(piutang_mobil or 0),
        "piutang_jasa_angkut": float(piutang_jasa_angkut or 0),
        "piutang_karyawan": float(piutang_karyawan or 0),
        "piutang_lainnya": float(piutang_lainnya or 0),
        "total_piutang": float(total_piutang or 0),
        "persediaan_sparepart": float(persediaan_sparepart or 0),
        "stok_mobil": float(stok_mobil_total or 0),
        "total_aktiva_lancar": float(total_aktiva_lancar or 0),
    }

    # Fixed Assets (Aktiva Tetap)
    # Using the new Aset model
    from app.models.keuangan import Aset
    fixed_assets = db.query(Aset).filter(Aset.status == AssetStatus.AKTIF).all()
    
    nilai_perolehan = 0.0
    for asset in fixed_assets:
        nilai_perolehan += float(asset.harga_beli or 0)
    
    total_aktiva_tetap = nilai_perolehan

    aktiva_tetap = {
        "nilai_perolehan": float(nilai_perolehan),
        "akumulasi_depresiasi": 0.0,
        "nilai_buku": float(nilai_perolehan),
        "total_aktiva_tetap": float(total_aktiva_tetap),
        "detail_aset": [
            {
                "id": a.id,
                "kode": a.kode,
                "nama": a.nama,
                "kategori": a.kategori.value,
                "harga_beli": float(a.harga_beli or 0)
            } for a in fixed_assets
        ]
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
    
    hutang_part = float(h_by_sumber.get(HutangSource.PEMBELIAN_PART.value, {}).get("sisa_hutang", 0))
    hutang_mobil = float(h_by_sumber.get(HutangSource.PEMBELIAN_MOBIL.value, {}).get("sisa_hutang", 0))
    
    # Combined investor debt (Manual + Accrued from sales)
    h_inv_base = float(h_by_sumber.get(HutangSource.JUAL_BELI_MOBIL.value, {}).get("sisa_hutang", 0))
    q_pending_inv = db.query(
        func.sum(
            Mobil.nominal_investor + 
            TransaksiPenjualanMobil.laba_investor - 
            TransaksiPenjualanMobil.nominal_pencairan
        )
    ).join(Mobil, TransaksiPenjualanMobil.mobil_id == Mobil.id).filter(
        TransaksiPenjualanMobil.tipe_kepemilikan == OwnershipType.INVESTOR,
        TransaksiPenjualanMobil.status_bayar == PaymentStatus.LUNAS,
        TransaksiPenjualanMobil.status_pencairan != InvestorDisbursementStatus.DICAIRKAN
    )
    if tanggal_sampai:
        q_pending_inv = q_pending_inv.filter(TransaksiPenjualanMobil.tanggal <= (tanggal_sampai or date.max))
        
    h_inv_accrued = float(q_pending_inv.scalar() or 0)
    hutang_investor = h_inv_base + h_inv_accrued
    
    hutang_lainnya = float(h_by_sumber.get(HutangSource.LAINNYA.value, {}).get("sisa_hutang", 0))
    
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
    setoran_modal = float(modal_in or 0) - float(modal_out or 0)
    
    # 2. Laba Ditahan components (for display). 
    # Use None for tanggal_dari to get cumulative (retained earnings) up to tanggal_sampai.
    bengkel_summ = bengkel_service.get_summary(None, tanggal_sampai)
    mobil_summ = penjualan_mobil_service.get_summary(None, tanggal_sampai)
    muatan_summ = muatan_service.get_summary(None, tanggal_sampai)
    
    laba_bengkel = float(bengkel_summ["total_laba_kotor"] or 0)
    laba_mobil_tpm = float(mobil_summ["laba_tpm"] or 0)
    # Per User Request: jasa_angkut profit is recorded as Gross TPM share (50%)
    # muatan_summ["total_pendapatan"] already represents (Revenue - Driver Share)
    laba_jasa_angkut = float(muatan_summ["total_pendapatan"] or 0)
    total_laba_kotor = laba_bengkel + laba_mobil_tpm + laba_jasa_angkut

    
    # Beban Operasional (Cumulative)
    pengeluaran = pengeluaran_service.get_summary(None, tanggal_sampai)
    gaji_summary = slip_gaji_service.get_summary_by_date_range(None, tanggal_sampai)
    
    pengeluaran_details = pengeluaran["per_kategori"]
    prive_total = float(pengeluaran_details.get("prive", {}).get("total", 0))
    
    # Beban = pengeluaran operasional + trip costs (excluding prive, which is separate)
    # PER USER REQUEST: Exclude car management costs from "total_beban" because they are
    # already subtracted inside "laba_mobil_tpm" or capitalized in "stok_mobil" (Aktiva).
    raw_units = pengeluaran.get("per_unit", {})
    biaya_mobil = float(raw_units.get("penjualan_mobil", 0) + raw_units.get("jual_beli_mobil", 0) + raw_units.get("mobil", 0))
    
    trip_costs = float(muatan_summ.get("details", {}).get("biaya_lainnya", 0))
    total_beban = (float(pengeluaran["total_pengeluaran"] or 0) - biaya_mobil) + float(gaji_summary["total"] or 0) + trip_costs - prive_total
    
    laba_ditahan = total_laba_kotor - total_beban
    prive = prive_total

    # Modal dihitung dari identity: Modal = Aktiva - Hutang
    # Ini menjamin neraca SELALU seimbang
    total_modal = total_aktiva - total_hutang
    
    # 3. Investor capital returns (if recorded in JUAL_BELI_MOBIL but originally from Setoran)
    # We subtract the capital part that has been paid out since it reduces the equity components
    paid_inv_cap = float(db.query(func.sum(Mobil.nominal_investor)).join(
        TransaksiPenjualanMobil, Mobil.id == TransaksiPenjualanMobil.mobil_id
    ).filter(
        TransaksiPenjualanMobil.tipe_kepemilikan == OwnershipType.INVESTOR,
        TransaksiPenjualanMobil.status_pencairan == InvestorDisbursementStatus.DICAIRKAN
    ).scalar() or 0)

    # 4. Modal Awal (Adjustment for stock and fixed assets without purchase records)
    # This aligns the component-based equity with the asset-based equity for unrecorded inventory/assets.
    from app.models.bengkel import PembelianSparePart, TransaksiPenjualanBengkel
    
    # Total purchases up to tanggal_sampai
    q_purchases = db.query(func.sum(PembelianSparePart.grand_total))
    if tanggal_sampai:
        q_purchases = q_purchases.filter(PembelianSparePart.tanggal <= tanggal_sampai)
    total_purchases_ever = float(q_purchases.scalar() or 0)
    
    # Total HPP ever sold up to tanggal_sampai to keep initial capital constant
    q_hpp = db.query(func.sum(TransaksiPenjualanBengkel.hpp_parts)).filter(
        TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL
    )
    if tanggal_sampai:
        q_hpp = q_hpp.filter(TransaksiPenjualanBengkel.tanggal <= tanggal_sampai)
    total_hpp_ever = float(q_hpp.scalar() or 0)
    
    # Initial Stock = (Current Stock + Total Sold Stock) - Total Purchases Recorded
    # Note: persediaan_sparepart already represents the stock at tanggal_sampai
    modal_persediaan_adj = max(0, (float(persediaan_sparepart) + total_hpp_ever) - total_purchases_ever)
    
    # Fixed Assets contribution to initial capital
    modal_aset_adj = float(total_aktiva_tetap or 0)
    
    modal_awal_total = modal_persediaan_adj + modal_aset_adj

    # Selisih antara perhitungan komponen vs identity (untuk transparansi)
    modal_komponen = setoran_modal + laba_ditahan - prive - paid_inv_cap + modal_awal_total
    selisih_modal = round(total_modal - modal_komponen, 2)


    modal = {
        "setoran_modal": float(setoran_modal),
        "laba_kotor": float(total_laba_kotor),
        "detail_laba": {
            "bengkel": float(laba_bengkel),
            "mobil": float(laba_mobil_tpm),
            "jasa_angkut": float(laba_jasa_angkut),
        },
        "total_beban": float(total_beban),
        "laba_ditahan": float(laba_ditahan),
        "prive": float(prive),
        "pencairan_investor": float(paid_inv_cap),
        "modal_persediaan": float(modal_awal_total),
        "total_modal": float(total_modal),
        "modal_komponen": float(modal_komponen),
        "selisih_modal": float(selisih_modal),
    }



    # ==========================================
    # TOTAL PASIVA (guaranteed balanced)
    # ==========================================
    total_pasiva = total_hutang + total_modal

    selisih = round(total_aktiva - total_pasiva, 2)

    print(f"DEBUG NERACA: Aktiva={total_aktiva}, Hutang={total_hutang}, Modal={total_modal}, Pasiva={total_pasiva}, Selisih={selisih}")
    print(f"DEBUG NERACA KOMPONEN: Setoran={setoran_modal}, Laba={laba_ditahan}, Prive={prive}, Komponen={modal_komponen}, SelisihModal={selisih_modal}")
    print(f"DEBUG NERACA AKTIVA: Kas={total_kas_bank_all}, Piutang={total_piutang}, Persediaan={persediaan_sparepart}, Mobil={stok_mobil_total}")

    result = {
        "periode": {
            "dari": tanggal_dari.isoformat() if tanggal_dari else None,
            "sampai": tanggal_sampai.isoformat() if tanggal_sampai else None,
        },
        "aktiva_lancar": aktiva_lancar,
        "aktiva_tetap": aktiva_tetap,
        "total_aktiva": float(total_aktiva),
        "hutang": hutang,
        "modal": {
            **modal,
            "total_modal": float(total_modal),
            "modal_komponen": float(modal_komponen),
            "selisih_modal": float(selisih_modal),
        },
        "total_pasiva": float(total_pasiva),
        "selisih": float(selisih),
        "is_balanced": abs(selisih) < 0.1
    }
    set_cached(_cache_key, result)
    return result
