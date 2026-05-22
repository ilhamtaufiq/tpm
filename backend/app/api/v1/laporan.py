from datetime import date
from typing import Optional
from fastapi import APIRouter
from app.api.deps import DBSession, ManagerUser

from app.services.reports.laba_rugi_service import LabaRugiService
from app.services.reports.modal_service import ModalService
from app.services.reports.neraca_service import NeracaService

router = APIRouter(prefix="/laporan", tags=["Laporan"])

@router.get("/laba-rugi")
def get_laba_rugi(
    db: DBSession,
    current_user: ManagerUser,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
):
    """Laporan Laba Rugi (Profit and Loss Statement)"""
    if not tanggal_dari and not tanggal_sampai:
        today = date.today()
        tanggal_dari = date(today.year, today.month, 1)
        tanggal_sampai = today
    
    service = LabaRugiService(db)
    return service.get_report(tanggal_dari, tanggal_sampai)

@router.get("/perubahan-modal")
def get_perubahan_modal(
    db: DBSession,
    current_user: ManagerUser,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
):
    """Laporan Perubahan Modal (Capital Change Report)"""
    if not tanggal_dari and not tanggal_sampai:
        today = date.today()
        tanggal_dari = date(today.year, today.month, 1)
        tanggal_sampai = today
    
    service = ModalService(db)
    return service.get_report(tanggal_dari, tanggal_sampai)

@router.get("/neraca")
def get_neraca(
    db: DBSession,
    current_user: ManagerUser,
    as_of_date: Optional[date] = None,
):
    """Laporan Neraca (Balance Sheet)"""
    if not as_of_date:
        as_of_date = date.today()
    
    service = NeracaService(db)
    return service.get_report(as_of_date)

@router.post("/neraca/sync")
def sync_neraca_internal(
    db: DBSession,
    current_user: ManagerUser,
):
    """Automatically fix internal transaction discrepancies in Neraca."""
    service = NeracaService(db)
    return service.sync_internal_transactions(user_id=current_user.id)


@router.get("/validate")
def validate_reports(
    db: DBSession,
    current_user: ManagerUser,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
):
    """
    Cross-validate all three financial reports for the same period.
    Checks consistency of Laba Bersih, Kas, and Hutang across reports.
    """
    if not tanggal_dari and not tanggal_sampai:
        today = date.today()
        tanggal_dari = date(today.year, today.month, 1)
        tanggal_sampai = today
    
    # Run all three reports
    lr_service = LabaRugiService(db)
    modal_service = ModalService(db)
    neraca_service = NeracaService(db)
    
    lr = lr_service.get_report(tanggal_dari, tanggal_sampai)
    modal = modal_service.get_report(tanggal_dari, tanggal_sampai)
    neraca = neraca_service.get_report(tanggal_sampai)  # Neraca uses end date as snapshot

    # ═══════════════════════════════════════════════════════════════
    # CHECK 1: Laba Consistency
    # Laba Rugi operating profit should match Modal period profit.
    # ═══════════════════════════════════════════════════════════════
    lr_laba_bersih = float(lr["summary"]["laba_bersih"])
    lr_laba_operasional = float(lr["summary"]["laba_operasional"])
    modal_laba_period = float(modal.get("info", {}).get("laba_bersih", 0))
    neraca_retained = float(neraca["modal"]["laba_ditahan"])
    neraca_prive = float(neraca["modal"]["prive"])

    selisih_laba = lr_laba_operasional - modal_laba_period
    laba_ok = abs(selisih_laba) < 100

    # ═══════════════════════════════════════════════════════════════
    # CHECK 2: Kas/Bank Consistency
    # Modal snapshot cash should match Neraca Aktiva Lancar cash.
    # ═══════════════════════════════════════════════════════════════
    modal_total_kas = float(modal.get("info", {}).get("aset", {}).get("kas_bank", 0))
    
    neraca_kas_tunai = float(neraca["aktiva_lancar"]["kas_tunai"])
    neraca_kas_bank = float(neraca["aktiva_lancar"]["kas_bank"])
    neraca_unit_cash = float(neraca["aktiva_lancar"]["unit_cash"])
    neraca_total_kas = neraca_kas_tunai + neraca_kas_bank + neraca_unit_cash
    
    selisih_kas = modal_total_kas - neraca_total_kas
    kas_ok = abs(selisih_kas) < 100

    # ═══════════════════════════════════════════════════════════════
    # CHECK 3: Hutang Consistency
    # Modal snapshot hutang should match Neraca total hutang.
    # ═══════════════════════════════════════════════════════════════
    modal_hutang = float(modal.get("info", {}).get("aset", {}).get("hutang", {}).get("total", 0))
    neraca_hutang = float(neraca["hutang"]["total_hutang"])
    
    selisih_hutang = modal_hutang - neraca_hutang
    hutang_ok = abs(selisih_hutang) < 100

    # ═══════════════════════════════════════════════════════════════
    # CHECK 4: Neraca Balance (Bottom-Up)
    # ═══════════════════════════════════════════════════════════════
    neraca_balanced = neraca.get("is_balanced", False)
    neraca_selisih = float(neraca.get("selisih", 0))
    
    # Overall status
    all_ok = laba_ok and kas_ok and hutang_ok and neraca_balanced

    return {
        "status": "SYNCED" if all_ok else "HAS_DISCREPANCY",
        "periode": {"dari": tanggal_dari, "sampai": tanggal_sampai},
        "checks": {
            "laba_bersih": {
                "status": "OK" if laba_ok else "MISMATCH",
                "laba_rugi_operasional": lr_laba_operasional,
                "laba_rugi_bersih": lr_laba_bersih,
                "modal_laba_period": modal_laba_period,
                "neraca_retained_earnings": neraca_retained,
                "neraca_prive": neraca_prive,
                "selisih": selisih_laba
            },
            "kas_bank": {
                "status": "OK" if kas_ok else "MISMATCH",
                "modal_snapshot": modal_total_kas,
                "neraca_aktiva_lancar": neraca_total_kas,
                "selisih": selisih_kas
            },
            "hutang": {
                "status": "OK" if hutang_ok else "MISMATCH",
                "modal_snapshot": modal_hutang,
                "neraca_hutang": neraca_hutang,
                "selisih": selisih_hutang
            },
            "neraca_balance": {
                "status": "OK" if neraca_balanced else "UNBALANCED",
                "total_aktiva": float(neraca["total_aktiva"]),
                "total_pasiva": float(neraca["total_pasiva"]),
                "selisih": neraca_selisih,
                "equity_from_components": float(neraca.get("cross_validation", {}).get("equity_from_components", 0)),
                "equity_from_identity": float(neraca.get("cross_validation", {}).get("equity_from_identity", 0)),
                "selisih_equity": float(neraca.get("cross_validation", {}).get("selisih_equity", 0))
            }
        }
    }
