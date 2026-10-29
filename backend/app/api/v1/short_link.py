from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
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


# Halaman /s/{kode} memuat tag OG sendiri (crawler chat membaca halaman ini langsung),
# lalu meneruskan pengunjung ke halaman struk di server.
PUBLIC_BASE_URL = "https://tpm.cianjur.space"
VIEW_BASE_URL = f"{PUBLIC_BASE_URL}/api/v1/public/receipt/view"

go_router = APIRouter(tags=["Public Short Link"])


@go_router.get("/s/{kode}", response_class=HTMLResponse)
def buka_short_link(kode: str, db: Session = Depends(get_db)):
    link = ShortLinkService(db).ambil(kode)
    if link is None:
        raise HTTPException(status_code=404, detail="Link tidak ditemukan")
    tujuan = f"{VIEW_BASE_URL}/{link.tipe}/{link.target}"
    gambar = f"{PUBLIC_BASE_URL}/api/v1/public/receipt/image/{link.tipe}/{link.target}"
    return f"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Struk Digital - TIGA PUTRA MOTOR</title>
  <meta property="og:type" content="website">
  <meta property="og:url" content="{PUBLIC_BASE_URL}/s/{kode}">
  <meta property="og:title" content="Struk Digital - TIGA PUTRA MOTOR">
  <meta property="og:description" content="Klik untuk melihat struk Anda.">
  <meta property="og:image" content="{gambar}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="{gambar}">
  <meta http-equiv="refresh" content="0;url={tujuan}">
  <script>window.location.replace("{tujuan}");</script>
</head>
<body></body>
</html>"""
