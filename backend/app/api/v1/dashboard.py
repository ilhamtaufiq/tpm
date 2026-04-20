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
from app.utils.constants import KasBankSource, KasBankType, KasBankJenis, PaymentStatus, PiutangSource, PiutangStatus, CarStatus, HutangSource, AssetStatus, InvestorDisbursementStatus, OwnershipType, ExpenseCategory
from app.models.keuangan import KasBank, PiutangUsaha as PiutangModel
from app.models.bengkel import PengeluaranBengkel
from app.utils.cache import build_key, get_cached, set_cached, invalidate_cache_prefix
from sqlalchemy import func, or_, and_, case


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

