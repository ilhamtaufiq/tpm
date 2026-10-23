from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.services.short_link_service import ShortLinkService

router = APIRouter(prefix="/public/short-link", tags=["Public Short Link"])


class ShortLinkCreate(BaseModel):
    tipe: str = Field(..., max_length=20)
    target: str = Field(..., max_length=80)


@router.post("")
def buat_short_link(data: ShortLinkCreate, db: Session = Depends(get_db)):
    """Buat (atau ambil yang sudah ada) kode pendek untuk struk. Publik, tanpa login."""
    try:
        link = ShortLinkService(db).buat_atau_ambil(data.tipe, data.target)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"kode": link.kode, "tipe": link.tipe, "target": link.target}


@router.get("/{kode}")
def ambil_short_link(kode: str, db: Session = Depends(get_db)):
    link = ShortLinkService(db).ambil(kode)
    if link is None:
        raise HTTPException(status_code=404, detail="Link tidak ditemukan")
    return {"tipe": link.tipe, "target": link.target}
