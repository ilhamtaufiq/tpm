from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.api.deps import DBSession, UnitManagerUser
from app.schemas.tanggal import TanggalTransaksi
from app.services.hutang_folder_service import HutangFolderService
from app.utils.constants import KasBankJenis, PaymentMethod

router = APIRouter(prefix="/hutang-folder", tags=["Hutang Folder"])


class FolderCreate(BaseModel):
    nama: str = Field(..., min_length=2, max_length=100)
    catatan: Optional[str] = None


class PindahFolderRequest(BaseModel):
    folder_id: Optional[int] = None


class BayarFolderRequest(BaseModel):
    tanggal: TanggalTransaksi
    metode: Literal[PaymentMethod.TUNAI, PaymentMethod.TRANSFER]
    nominal: Decimal = Field(..., gt=0)
    kas_jenis: Optional[KasBankJenis] = None
    catatan: Optional[str] = None


@router.get("")
def list_folder(db: DBSession, current_user: UnitManagerUser):
    return HutangFolderService(db).daftar()


@router.post("", status_code=201)
def buat_folder(data: FolderCreate, db: DBSession, current_user: UnitManagerUser):
    folder = HutangFolderService(db).buat(data.nama, data.catatan, current_user.id)
    return {"id": folder.id, "nama": folder.nama}


@router.get("/{folder_id}")
def detail_folder(folder_id: int, db: DBSession, current_user: UnitManagerUser):
    return HutangFolderService(db).detail(folder_id)


@router.delete("/{folder_id}")
def hapus_folder(folder_id: int, db: DBSession, current_user: UnitManagerUser):
    HutangFolderService(db).hapus(folder_id)
    return {"message": "Folder dihapus"}


@router.put("/hutang/{hutang_id}")
def pindah_hutang(hutang_id: int, data: PindahFolderRequest, db: DBSession, current_user: UnitManagerUser):
    return HutangFolderService(db).pindahkan(hutang_id, data.folder_id)


@router.post("/{folder_id}/bayar", status_code=201)
def bayar_folder(folder_id: int, data: BayarFolderRequest, db: DBSession, current_user: UnitManagerUser):
    return HutangFolderService(db).bayar(folder_id, data.tanggal, data.metode, data.nominal, data.kas_jenis, data.catatan, current_user.id)
