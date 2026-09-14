"""Endpoint penarikan dana investor saat mobil belum terjual."""
from datetime import date
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.api.deps import DBSession, ManagerUser
from app.services.investor_withdrawal_service import InvestorWithdrawalService
from app.utils.constants import KasBankJenis, PaymentMethod

router = APIRouter(prefix="/investor-withdrawals", tags=["Investor Withdrawal"])


class WithdrawalPayment(BaseModel):
    """Single payment entry for split withdrawals."""
    metode: PaymentMethod = PaymentMethod.TUNAI
    nominal: Decimal = Field(..., gt=0)
    kas_jenis: Optional[KasBankJenis] = None


class WithdrawalRequest(BaseModel):
    """Schema for withdrawing investor funds before the car is sold."""
    mobil_id: int
    nominal: Optional[Decimal] = Field(None, ge=0)
    metode_bayar: Optional[PaymentMethod] = PaymentMethod.TUNAI
    kas_jenis: Optional[KasBankJenis] = None
    payments: List[WithdrawalPayment] = []
    tanggal: Optional[date] = None
    catatan: Optional[str] = ""


class WithdrawalReversalRequest(BaseModel):
    """Schema for reversing an investor withdrawal."""
    alasan: Optional[str] = ""


@router.get("/unsold-cars")
def get_unsold_cars(
    db: DBSession,
    current_user: ManagerUser,
    nama_investor: Optional[str] = None,
):
    """Daftar mobil investor yang belum terjual beserta sisa dana yang bisa ditarik."""
    service = InvestorWithdrawalService(db)
    return service.get_unsold_cars(nama_investor)


@router.get("/history")
def get_withdrawal_history(
    db: DBSession,
    current_user: ManagerUser,
    nama_investor: Optional[str] = None,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
):
    """Riwayat penarikan dana investor (sebelum mobil terjual)."""
    service = InvestorWithdrawalService(db)
    return service.get_history(nama_investor, tanggal_dari, tanggal_sampai)


@router.post("")
def create_withdrawal(
    data: WithdrawalRequest,
    db: DBSession,
    current_user: ManagerUser,
):
    """Tarik dana investor sebelum mobil terjual (maksimal sebesar dana investor)."""
    service = InvestorWithdrawalService(db)

    if data.payments:
        payment_entries = [(p.metode, p.nominal, p.kas_jenis) for p in data.payments]
        total = sum((p.nominal for p in data.payments), Decimal("0"))
    else:
        total = data.nominal
        payment_entries = [(data.metode_bayar or PaymentMethod.TUNAI, data.nominal, data.kas_jenis)]

    rows = service.create_withdrawal(
        mobil_id=data.mobil_id,
        payment_entries=payment_entries,
        total_nominal=total,
        tanggal=data.tanggal,
        catatan=data.catatan or "",
        user_id=current_user.id,
    )
    return {
        "message": "Dana investor berhasil ditarik",
        "mobil_id": data.mobil_id,
        "total_ditarik": float(sum((r.nominal for r in rows), Decimal("0"))),
        "jumlah_entri": len(rows),
    }


@router.post("/{withdrawal_id}/reversal")
def reverse_withdrawal(
    withdrawal_id: int,
    data: WithdrawalReversalRequest,
    db: DBSession,
    current_user: ManagerUser,
):
    """Batalkan penarikan dana investor (kas dikembalikan)."""
    service = InvestorWithdrawalService(db)
    return service.reverse_withdrawal(
        withdrawal_id,
        alasan=data.alasan or "",
        user_id=current_user.id,
    )
