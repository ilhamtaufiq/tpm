from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.api.deps import DBSession, ManagerUser
from app.schemas.tanggal import TanggalTransaksi
from app.services.perbaikan_data_service import PerbaikanDataService
from app.utils.constants import KasBankJenis, PaymentMethod

router = APIRouter(prefix="/perbaikan-data", tags=["Perbaikan Data"])


class CatatKasPiutangRequest(BaseModel):
    metode: Literal[PaymentMethod.TUNAI, PaymentMethod.TRANSFER]
    kas_jenis: Optional[KasBankJenis] = None


class UbahTanggalRequest(BaseModel):
    nomor_referensi: str
    tanggal_lama: date
    tanggal_baru: TanggalTransaksi


@router.get("/piutang-tanpa-kas")
def list_piutang_tanpa_kas(db: DBSession, current_user: ManagerUser):
    return PerbaikanDataService(db).piutang_tanpa_kas()


@router.post("/piutang/{piutang_id}/catat-kas")
def catat_kas_piutang(piutang_id: int, data: CatatKasPiutangRequest, db: DBSession, current_user: ManagerUser):
    return PerbaikanDataService(db).catat_kas_piutang(piutang_id, data.metode, data.kas_jenis, current_user.id)


@router.post("/piutang/{piutang_id}/batalkan")
def batalkan_piutang(piutang_id: int, db: DBSession, current_user: ManagerUser):
    return PerbaikanDataService(db).batalkan_piutang(piutang_id)


@router.get("/tanggal-mundur")
def list_tanggal_mundur(
    db: DBSession,
    current_user: ManagerUser,
    selisih_hari: int = Query(1, ge=1, le=31),
):
    return PerbaikanDataService(db).tanggal_mundur(selisih_hari)


@router.post("/tanggal")
def ubah_tanggal(data: UbahTanggalRequest, db: DBSession, current_user: ManagerUser):
    return PerbaikanDataService(db).ubah_tanggal(data.nomor_referensi, data.tanggal_lama, data.tanggal_baru)
