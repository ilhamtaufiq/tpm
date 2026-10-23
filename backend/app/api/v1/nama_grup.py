from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.api.deps import DBSession, UnitManagerUser
from app.schemas.tanggal import TanggalTransaksi
from app.services.nama_grup_service import NamaGrupService
from app.utils.constants import KasBankJenis, PaymentMethod

router = APIRouter(prefix="/per-nama", tags=["Piutang & Hutang per Nama"])


class BayarNamaRequest(BaseModel):
    nama: str = Field(..., min_length=2, max_length=100)
    tanggal: TanggalTransaksi
    metode: Literal[PaymentMethod.TUNAI, PaymentMethod.TRANSFER]
    nominal: Decimal = Field(..., gt=0)
    kas_jenis: Optional[KasBankJenis] = None
    catatan: Optional[str] = None
    struk_id: Optional[int] = None  # kosong = otomatis dari yang tertua


@router.get("/piutang")
def grup_piutang(db: DBSession, current_user: UnitManagerUser):
    return NamaGrupService(db).piutang_grup()


@router.get("/piutang/detail")
def detail_piutang(db: DBSession, current_user: UnitManagerUser, nama: str = Query(..., min_length=2)):
    return NamaGrupService(db).piutang_detail(nama)


@router.post("/piutang/bayar", status_code=201)
def bayar_piutang(data: BayarNamaRequest, db: DBSession, current_user: UnitManagerUser):
    return NamaGrupService(db).piutang_bayar(data.nama, data.tanggal, data.metode, data.nominal, data.kas_jenis, data.catatan, current_user.id, data.struk_id)


@router.get("/hutang")
def grup_hutang(db: DBSession, current_user: UnitManagerUser):
    return NamaGrupService(db).hutang_grup()


@router.get("/hutang/detail")
def detail_hutang(db: DBSession, current_user: UnitManagerUser, nama: str = Query(..., min_length=2)):
    return NamaGrupService(db).hutang_detail(nama)


@router.post("/hutang/bayar", status_code=201)
def bayar_hutang(data: BayarNamaRequest, db: DBSession, current_user: UnitManagerUser):
    return NamaGrupService(db).hutang_bayar(data.nama, data.tanggal, data.metode, data.nominal, data.kas_jenis, data.catatan, current_user.id, data.struk_id)
