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
from app.services.reports.laba_rugi_service import LabaRugiService
from app.services.investor_withdrawal_service import InvestorWithdrawalService
from app.utils.constants import KasBankSource, KasBankType, KasBankJenis, PaymentStatus, PiutangSource, PiutangStatus, CarStatus, HutangSource, AssetStatus, InvestorDisbursementStatus, OwnershipType, ExpenseCategory, WorkshopStatus
from app.models.keuangan import KasBank, PiutangUsaha as PiutangModel
from app.models.mobil import Mobil, InvestorWithdrawal
from app.models.bengkel import PengeluaranBengkel
from app.utils.cache import build_key, get_cached, set_cached, invalidate_cache_prefix
from sqlalchemy import func, or_, and_, case


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _workshop_activity_recognized(item) -> bool:
    """Match financial recognition: billed workshop orders, excluding voided."""
    if (item.grand_total or 0) <= 0:
        return False
    if item.status_bayar == PaymentStatus.BATAL:
        return False
    if item.status_pengerjaan == WorkshopStatus.BATAL:
        return False
    return True


def _workshop_activity_source(item) -> str:
    kategori = (getattr(item, "kategori", None) or "umum").lower()
    if kategori in ("jual_beli_mobil", "jasa_angkut"):
        return kategori
    return "bengkel"


def _meaningful_text(value, fallback: str) -> str:
    """Treat blank / dash placeholders as missing (common guest plate default)."""
    text = str(value or "").strip()
    if not text or text in {"-", "—", "–", "n/a", "N/A", "null", "None"}:
        return fallback
    return text


def _workshop_activity_labels(item) -> tuple[str, str]:
    kategori = (getattr(item, "kategori", None) or "umum").lower()
    plat = _meaningful_text(item.nomor_plat, "Tanpa Plat")
    customer = _meaningful_text(item.nama_customer, "Guest")
    jenis = _meaningful_text(item.jenis_kendaraan, "Kendaraan")
    nomor = _meaningful_text(item.nomor_transaksi, f"#{getattr(item, 'id', '')}")

    if kategori == "jual_beli_mobil":
        return (
            f"Servis Stok • {plat}",
            f"{_meaningful_text(item.jenis_kendaraan, 'Mobil')} • {nomor}",
        )
    if kategori == "jasa_angkut":
        return (
            f"Servis Armada • {plat}",
            f"{customer if customer != 'Guest' else 'Armada'} • {nomor}",
        )
    # Umum: prefer customer name when plate is missing so home cards aren't just "-"
    if plat == "Tanpa Plat":
        title = f"Servis • {customer}"
    else:
        title = f"{plat} • {customer}" if customer != "Guest" else plat
    return (
        title,
        f"{jenis} • {nomor}",
    )


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
    bengkel_summary = bengkel_service.get_summary(tanggal_dari, tanggal_sampai, financial_only=True)

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

    # --- Integrated Laba Rugi Logic for Consistency ---
    lr_service = LabaRugiService(db)
    # We call get_report but use the same logic/summaries.
    # To avoid repeating all queries, we could refactor, but for 30s cached dashboard,
    # calling the service is the safest way to ensure 100% agreement.
    lr_report = lr_service.get_report(tanggal_dari, tanggal_sampai)
    total_laba_operasional = lr_report["summary"]["laba_operasional"]
    laba_bersih_akhir = lr_report["summary"]["laba_bersih"]
    # ---------------------------------------------------

    # Investor capital summary for mobil unit
    investor_dana_tertanam = float(
        db.query(func.sum(Mobil.nominal_investor)).filter(
            Mobil.tipe_kepemilikan == OwnershipType.INVESTOR,
            Mobil.deleted_at.is_(None),
        ).scalar() or 0
    )
    investor_withdrawal_svc = InvestorWithdrawalService(db)
    investor_total_ditarik = float(
        db.query(func.sum(InvestorWithdrawal.nominal)).filter(
            ~InvestorWithdrawal.catatan.ilike("[REVERSED]%"),
        ).scalar() or 0
    )
    investor_sisa_hutang = max(0.0, investor_dana_tertanam - investor_total_ditarik)

    result = {
        "periode": {
            "dari": tanggal_dari.isoformat() if tanggal_dari else None,
            "sampai": tanggal_sampai.isoformat() if tanggal_sampai else None,
        },
        "bengkel": {
            "total_penjualan": float(bengkel_summary["total_penjualan"]),
            "total_transaksi": bengkel_summary["total_transaksi"],
            "laba_kotor": bengkel_summary["total_laba_kotor"],
            "laba_bersih": float(lr_report["units"]["bengkel"]["laba_bersih"]),
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
            # Satu sumber dgn Laba Rugi: repair internal = laba bengkel yg diakui
            # segera, bukan HPP mobil (full-modal ada di mobil_summary mentah).
            "laba_kotor": float(lr_report["units"]["mobil"]["laba_kotor"]),
            "laba_tpm": float(lr_report["units"]["mobil"]["laba_kotor"]),
            "laba_bersih": float(lr_report["units"]["mobil"]["laba_bersih"]),
            "total_pengeluaran": (
                overhead_data.get("penjualan_mobil", 0) + 
                overhead_data.get("mobil", 0) + 
                overhead_data.get("jual_beli_mobil", 0)
            ),
            "total_modal_tersedia": float(mobil_summary.get("total_modal_tersedia", 0)),
            "saldo_cash": float(kas_bank_summary.get("kas_unit_mobil", {}).get("saldo", 0)),
            "investor_dana_tertanam": investor_dana_tertanam,
            "investor_total_ditarik": investor_total_ditarik,
            "investor_sisa_hutang": investor_sisa_hutang,
        },
        "jasa_angkut": {
            "total_pendapatan": float(muatan_summary["total_pendapatan"]),
            "total_transaksi": muatan_summary["total_transaksi"],
            "laba_tpm": float(muatan_summary["laba_tpm"]),
            "laba_bersih": float(lr_report["units"]["jasa_angkut"]["laba_bersih"]),
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
        
        # Consistent P&L Totals from LabaRugiService
        "laba_operasional": float(total_laba_operasional),
        "laba_bersih": float(laba_bersih_akhir)
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
    source: Optional[str] = None,
):
    """Get unified recent activity feed (Financial + Operational)."""
    # ── Cache check (30-second TTL) ───────────────────────────────────
    _cache_key = build_key("recent_activity", limit, source or "all")
    _cached = get_cached(_cache_key)
    if _cached is not None:
        return _cached
    # ─────────────────────────────────────────────────────────────────

    source_clean = (source or "all").lower()

    kas_bank_service = KasBankService(db)
    bengkel_service = TransaksiBengkelService(db)
    muatan_service = MuatanService(db)

    kas_pool_limit = max(limit * 5, 500)

    # 1. Fetch recent transactions (KasBank)
    if source_clean in ("gaji", "sdm", "kasbon"):
        from app.models.keuangan import KasBank
        from app.models.karyawan import KasbonKaryawan, SlipGaji
        query = db.query(KasBank).filter(
            or_(
                KasBank.sumber.in_([KasBankSource.GAJI, KasBankSource.KASBON]),
                func.lower(KasBank.sumber).in_(["gaji", "kasbon", "sdm", "kasbon_karyawan"]),
                KasBank.keterangan.ilike("%kasbon%"),
                KasBank.keterangan.ilike("%gaji%"),
                KasBank.keterangan.ilike("%sdm%"),
                KasBank.nomor_referensi.ilike("%ksb%"),
                KasBank.nomor_referensi.ilike("%gji%"),
                KasBank.nomor_transaksi.ilike("%ksb%"),
                KasBank.nomor_transaksi.ilike("%gji%"),
            )
        ).order_by(KasBank.created_at.desc()).limit(kas_pool_limit)
        kas_data = query.all()
    elif source_clean == "bengkel":
        kas_data = kas_bank_service.get_list(
            limit=kas_pool_limit,
            sumber=KasBankSource.BENGKEL,
            sort_by="created_at",
            sort_order="desc"
        )["data"]
    elif source_clean == "jasa_angkut":
        kas_data = kas_bank_service.get_list(
            limit=kas_pool_limit,
            sumber=KasBankSource.JASA_ANGKUT,
            sort_by="created_at",
            sort_order="desc"
        )["data"]
    elif source_clean in ("jual_beli_mobil", "pembelian_mobil", "mobil"):
        from app.models.keuangan import KasBank
        query = db.query(KasBank).filter(
            KasBank.sumber.in_([KasBankSource.JUAL_BELI_MOBIL, KasBankSource.PEMBELIAN_MOBIL])
        ).order_by(KasBank.created_at.desc()).limit(kas_pool_limit)
        kas_data = query.all()
    elif source_clean == "pengeluaran":
        kas_data = kas_bank_service.get_list(
            limit=kas_pool_limit,
            sumber=KasBankSource.PENGELUARAN,
            sort_by="created_at",
            sort_order="desc"
        )["data"]
    else:
        kas_data = kas_bank_service.get_list(
            limit=kas_pool_limit,
            sort_by="created_at",
            sort_order="desc"
        )["data"]

    # 2. Fetch recent workshop sales (Bengkel)
    bengkel_data = []
    if source_clean in ("all", "bengkel", "jual_beli_mobil"):
        bengkel_pool_limit = max(limit * 5, 500)
        bengkel_raw = bengkel_service.get_list(
            limit=bengkel_pool_limit,
            sort_by="updated_at",
            sort_order="desc"
        )["data"]
        bengkel_data = [item for item in bengkel_raw if _workshop_activity_recognized(item)]
        if source_clean == "jual_beli_mobil":
            bengkel_data = [item for item in bengkel_data if (getattr(item, "kategori", None) or "").lower() == "jual_beli_mobil"]
        elif source_clean == "bengkel":
            bengkel_data = [item for item in bengkel_data if (getattr(item, "kategori", None) or "umum").lower() not in ("jual_beli_mobil", "jasa_angkut")]

    # 3. Fetch recent transport loads (Jasa Angkut)
    muatan_data = []
    if source_clean in ("all", "jasa_angkut"):
        muatan_data = muatan_service.get_list(
            limit=kas_pool_limit if source_clean == "jasa_angkut" else limit,
            sort_by="created_at",
            sort_order="desc"
        )["data"]

    # 4. Normalize and Merge
    activities = []

    # Collect KasBank ref numbers that are linked to jasa_angkut
    # so we can skip the corresponding muatan record (avoid duplicate display)
    kas_ja_refs = set()
    for item in kas_data:
        if str(item.sumber.value).upper() in ("JASA_ANGKUT", "PIUTANG"):
            if item.nomor_referensi:
                kas_ja_refs.add(item.nomor_referensi)

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

    # Direct fallback for KasbonKaryawan & SlipGaji if source is SDM
    if source_clean in ("gaji", "sdm", "kasbon"):
        from app.models.karyawan import KasbonKaryawan, SlipGaji
        from sqlalchemy.orm import joinedload

        kas_ref_set = {
            (item.nomor_referensi or "").lower() for item in kas_data if item.nomor_referensi
        }
        kas_ref_set.update(
            (item.nomor_transaksi or "").lower() for item in kas_data if item.nomor_transaksi
        )

        kasbon_rows = (
            db.query(KasbonKaryawan)
            .options(joinedload(KasbonKaryawan.karyawan))
            .order_by(KasbonKaryawan.created_at.desc())
            .limit(limit)
            .all()
        )
        for kb in kasbon_rows:
            ref_code = (kb.nomor_kasbon or "").lower()
            if ref_code not in kas_ref_set:
                emp_name = kb.karyawan.nama if getattr(kb, "karyawan", None) else "Karyawan"
                ts = kb.created_at.isoformat() if kb.created_at else kb.tanggal.isoformat()
                activities.append({
                    "type": "financial",
                    "id": f"kasbon_{kb.id}",
                    "original_id": kb.id,
                    "title": f"Kasbon karyawan {emp_name} ({kb.nomor_kasbon})",
                    "subtitle": kb.nomor_kasbon,
                    "amount": float(kb.nominal),
                    "is_incoming": False,
                    "status": kb.status.value if hasattr(kb.status, "value") else str(kb.status),
                    "timestamp": ts,
                    "source": "KASBON",
                    "ref_number": kb.nomor_kasbon,
                })

        slip_rows = (
            db.query(SlipGaji)
            .options(joinedload(SlipGaji.karyawan))
            .order_by(SlipGaji.created_at.desc())
            .limit(limit)
            .all()
        )
        for sg in slip_rows:
            ref_code = (sg.nomor_slip or "").lower()
            if ref_code not in kas_ref_set:
                emp_name = sg.karyawan.nama if getattr(sg, "karyawan", None) else "Karyawan"
                ts = sg.created_at.isoformat() if sg.created_at else sg.tanggal.isoformat()
                activities.append({
                    "type": "financial",
                    "id": f"gaji_{sg.id}",
                    "original_id": sg.id,
                    "title": f"Gaji karyawan {emp_name} ({sg.nomor_slip})",
                    "subtitle": sg.nomor_slip,
                    "amount": float(sg.thp or sg.total_gaji or 0),
                    "is_incoming": False,
                    "status": "LUNAS",
                    "timestamp": ts,
                    "source": "GAJI",
                    "ref_number": sg.nomor_slip,
                })

    for item in bengkel_data:
        title, subtitle = _workshop_activity_labels(item)
        activity_ts = getattr(item, "updated_at", None) or item.created_at
        activities.append({
            "type": "workshop",
            "id": f"bengkel_{item.id}",
            "original_id": item.id,
            "title": title,
            "subtitle": subtitle,
            "amount": float(item.grand_total),
            "is_incoming": True,
            "status": item.status_pengerjaan.name,  # ANTRE, PROSES, SELESAI
            "timestamp": activity_ts.isoformat(),
            "source": _workshop_activity_source(item),
            "ref_number": item.nomor_transaksi,
        })

    for item in muatan_data:
        # Skip muatan that already have a KasBank entry (avoid duplicate in history)
        # Check if any kas entry references this muatan's nomor_transaksi or its piutang
        has_kas_entry = item.nomor_transaksi in kas_ja_refs
        if not has_kas_entry and hasattr(item, 'piutang_id') and item.piutang_id:
            # Also check by piutang nomor (AR...)
            from app.models.keuangan import PiutangUsaha
            piutang = db.query(PiutangUsaha.nomor_piutang).filter(
                PiutangUsaha.id == item.piutang_id
            ).first()
            if piutang and piutang.nomor_piutang in kas_ja_refs:
                has_kas_entry = True
        
        if has_kas_entry:
            continue
            
        # Include driver name in subtitle and route in title
        driver_name = item.supir_nama or item.supir_nama_manual or "Driver"
        activities.append({
            "type": "transport",
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

