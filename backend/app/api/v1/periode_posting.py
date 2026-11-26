from datetime import date
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.api.deps import AdminUser, CurrentUser, DBSession, ManagerUser
from app.services.periode_posting_service import PeriodePostingService
from app.utils.helpers import get_jakarta_date


router = APIRouter(prefix="/periode-posting", tags=["Posting Bulanan"])


class PostingRequest(BaseModel):
    catatan: Optional[str] = Field(None, max_length=255)


class BukaKembaliRequest(BaseModel):
    alasan: str = Field(..., min_length=5, max_length=255)


@router.get("")
def daftar_periode(
    db: DBSession,
    current_user: CurrentUser,
    tahun: Optional[int] = Query(None, ge=2000, le=2100),
):
    """Status posting 12 bulan pada satu tahun (default tahun berjalan)."""
    return {
        "tahun": tahun or get_jakarta_date().year,
        "periode": PeriodePostingService(db).daftar(tahun or get_jakarta_date().year),
    }


@router.get("/status")
def status_tanggal(
    db: DBSession,
    current_user: CurrentUser,
    tanggal: date = Query(..., description="Tanggal nota"),
):
    """Status posting bulan dari `tanggal` (dipakai form edit nota)."""
    return PeriodePostingService(db).status_tanggal(tanggal)


@router.post("/{tahun}/{bulan}/posting")
def posting_periode(
    tahun: int,
    bulan: int,
    data: PostingRequest,
    db: DBSession,
    current_user: ManagerUser,
):
    """Posting bulan yang sudah berakhir: nota di bulan itu terkunci."""
    return PeriodePostingService(db).posting(tahun, bulan, current_user.id, data.catatan)


@router.post("/{tahun}/{bulan}/buka")
def buka_kembali_periode(
    tahun: int,
    bulan: int,
    data: BukaKembaliRequest,
    db: DBSession,
    current_user: AdminUser,
):
    """Buka kembali bulan yang sudah diposting (admin, alasan wajib)."""
    return PeriodePostingService(db).buka_kembali(tahun, bulan, current_user.id, data.alasan)
