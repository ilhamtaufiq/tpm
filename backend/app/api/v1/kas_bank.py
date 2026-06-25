from typing import Optional
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import DBSession, CurrentUser, ManagerUser, UnitManagerUser, get_unit_scope_for_role
from app.schemas.keuangan import (
    KasBankCreate,
    KasBankResponse,
    KasBankAllSummary,
)
from app.services.kas_bank_service import KasBankService
from app.utils.constants import KasBankJenis, KasBankType, KasBankSource


router = APIRouter(prefix="/kas-bank", tags=["Kas & Bank"])


UNIT_WALLET_MAP = {
    KasBankSource.BENGKEL: KasBankJenis.KAS_UNIT_BENGKEL,
    KasBankSource.JASA_ANGKUT: KasBankJenis.KAS_UNIT_JASA_ANGKUT,
    KasBankSource.JUAL_BELI_MOBIL: KasBankJenis.KAS_UNIT_MOBIL,
}


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
    unit_scope = get_unit_scope_for_role(current_user.role)
    allowed_jenis = [UNIT_WALLET_MAP[unit_scope]] if unit_scope else None
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
        allowed_jenis=allowed_jenis,
    )


@router.get("/balances", response_model=KasBankAllSummary)
def get_all_balances(
    db: DBSession,
    current_user: CurrentUser,
):
    """Get balances for all kas/bank types."""
    unit_scope = get_unit_scope_for_role(current_user.role)
    from app.services.reports.neraca_service import NeracaService
    neraca_service = NeracaService(db)
    if unit_scope in (None, "jasa_angkut"):
        neraca_service.sync_ja_internal_bengkel_finance()
    if unit_scope in (None, "mobil"):
        neraca_service.sync_mobil_internal_bengkel_finance()

    service = KasBankService(db)
    allowed_jenis = [UNIT_WALLET_MAP[unit_scope]] if unit_scope else None
    return service.get_all_balances(allowed_jenis=allowed_jenis)


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
    current_user: UnitManagerUser,
    allow_negative: bool = Query(False),
):
    """Transfer between kas/bank accounts."""
    unit_scope = get_unit_scope_for_role(current_user.role)
    if unit_scope:
        unit_wallet = UNIT_WALLET_MAP[unit_scope]
        allowed_pairs = {
            (KasBankJenis.KAS_UTAMA, unit_wallet),
            (unit_wallet, KasBankJenis.KAS_UTAMA),
            (unit_wallet, KasBankJenis.BANK_UTAMA),
        }
        if (dari, ke) not in allowed_pairs:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Transfer antar akun ini tidak diizinkan untuk role unit.",
            )

    service = KasBankService(db)
    return service.transfer(
        dari, ke, nominal, tanggal, keterangan,
        current_user.id,
        allow_negative=allow_negative
    )


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
