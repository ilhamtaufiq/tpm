from typing import Optional

from fastapi import APIRouter, Query

from app.api.deps import DBSession, ManagerUser
from app.schemas.pembatalan import PembatalanResponse
from app.services.pembatalan_service import PembatalanService

router = APIRouter(prefix="/pembatalan", tags=["Pembatalan Keuangan"])


@router.get("", response_model=list[PembatalanResponse])
def list_pembatalan(
    db: DBSession,
    current_user: ManagerUser,
    jenis: Optional[str] = Query(None, description="PENGELUARAN | PIUTANG | TRANSFER"),
    limit: int = Query(100, ge=1, le=500),
):
    """Riwayat pembatalan transaksi keuangan, terbaru dulu."""
    return PembatalanService(db).list_riwayat(jenis, limit)


@router.post("/kas/{kas_id}", response_model=PembatalanResponse)
def batalkan_dari_kas(
    kas_id: int,
    db: DBSession,
    current_user: ManagerUser,
    alasan: str = Query(..., max_length=255, description="Alasan pembatalan, wajib"),
):
    """Batalkan transaksi asal dari satu baris kas (pengeluaran, kasbon/piutang, atau transfer)."""
    return PembatalanService(db).batalkan_dari_kas(kas_id, alasan, current_user.id)


@router.post("/pengeluaran/{pengeluaran_id}", response_model=PembatalanResponse)
def batalkan_pengeluaran(
    pengeluaran_id: int,
    db: DBSession,
    current_user: ManagerUser,
    alasan: str = Query(..., max_length=255, description="Alasan pembatalan, wajib"),
):
    return PembatalanService(db).batalkan_pengeluaran(pengeluaran_id, alasan, current_user.id)


@router.post("/piutang/{piutang_id}", response_model=PembatalanResponse)
def batalkan_piutang(
    piutang_id: int,
    db: DBSession,
    current_user: ManagerUser,
    alasan: str = Query(..., max_length=255, description="Alasan pembatalan, wajib"),
):
    return PembatalanService(db).batalkan_piutang(piutang_id, alasan, current_user.id)


@router.post("/kasbon/{kasbon_id}", response_model=PembatalanResponse)
def batalkan_kasbon(
    kasbon_id: int,
    db: DBSession,
    current_user: ManagerUser,
    alasan: str = Query(..., max_length=255, description="Alasan pembatalan, wajib"),
):
    return PembatalanService(db).batalkan_kasbon(kasbon_id, alasan, current_user.id)
