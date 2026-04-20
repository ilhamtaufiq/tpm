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
