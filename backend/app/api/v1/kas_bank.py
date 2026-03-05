from typing import Optional
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Query, status

from app.api.deps import DBSession, CurrentUser, ManagerUser
from app.schemas.keuangan import (
    KasBankCreate,
    KasBankResponse,
)
from app.services.kas_bank_service import KasBankService
from app.utils.constants import KasBankJenis, KasBankType, KasBankSource


router = APIRouter(prefix="/kas-bank", tags=["Kas & Bank"])


@router.post("", response_model=KasBankResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    data: KasBankCreate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Create a new cash/bank transaction."""
    service = KasBankService(db)
    return service.create(data, current_user.id)


@router.get("")
def list_transactions(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    jenis: Optional[KasBankJenis] = None,
    tipe: Optional[KasBankType] = None,
    sumber: Optional[KasBankSource] = None,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
    sort_by: str = "tanggal",
    sort_order: str = "desc",
):
    """Get list of transactions with pagination and filters."""
    service = KasBankService(db)
    return service.get_list(
        skip=skip,
        limit=limit,
        jenis=jenis,
        tipe=tipe,
        sumber=sumber,
        tanggal_dari=tanggal_dari,
        tanggal_sampai=tanggal_sampai,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/balances")
def get_all_balances(
    db: DBSession,
    current_user: CurrentUser,
):
    """Get balances for all kas/bank types."""
    service = KasBankService(db)
    return service.get_all_balances()


@router.get("/balance/{jenis}")
def get_balance(
    jenis: KasBankJenis,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get current balance for specific kas/bank type."""
    service = KasBankService(db)
    return service.get_balance(jenis)


@router.get("/daily/{tanggal}")
def get_daily_summary(
    tanggal: date,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get daily cash/bank summary."""
    service = KasBankService(db)
    return service.get_daily_summary(tanggal)


@router.get("/monthly/{tahun}/{bulan}")
def get_monthly_summary(
    tahun: int,
    bulan: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Get monthly cash/bank summary."""
    service = KasBankService(db)
    return service.get_monthly_summary(tahun, bulan)


@router.get("/{transaction_id}", response_model=KasBankResponse)
def get_transaction(
    transaction_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get transaction by ID."""
    service = KasBankService(db)
    return service.get_by_id(transaction_id)


@router.post("/transfer")
def transfer(
    dari: KasBankJenis,
    ke: KasBankJenis,
    nominal: Decimal,
    tanggal: date,
    keterangan: str,
    db: DBSession,
    current_user: ManagerUser,
):
    """Transfer between kas/bank accounts."""
    service = KasBankService(db)
    return service.transfer(dari, ke, nominal, tanggal, keterangan, current_user.id)
@router.post("/adjust")
def adjust_balance(
    jenis: KasBankJenis,
    nominal: Decimal,
    tanggal: date,
    keterangan: str,
    db: DBSession,
    current_user: ManagerUser,
):
    """Adjust balance to a target nominal."""
    service = KasBankService(db)
    return service.adjust_balance(jenis, nominal, tanggal, keterangan, current_user.id)
