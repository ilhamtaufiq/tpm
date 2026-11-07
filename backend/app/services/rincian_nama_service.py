"""Rincian piutang/hutang per nama: satu halaman publik yang memuat semua struk, sisa, dan status.

Token dibuat dari HMAC (jenis + unit + nama) memakai kunci server, jadi tidak bisa ditebak dari
nama saja. Pemetaan token -> (jenis, unit, nama) disimpan di system_settings, supaya halaman
publik bisa membaca nama dari token. Halaman membaca data langsung, jadi selalu menampilkan
struk terbaru. Halaman ini hanya membaca, tidak bisa mengubah apa pun.
"""
import hashlib
import hmac
import json
from typing import Any, Dict, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.models.system_setting import SystemSetting
from app.services.nama_grup_service import NamaGrupService
from app.services.struk_piutang_service import STATUS_LABEL
from app.utils.constants import KasBankSource

JENIS_PIUTANG = "PIUTANG"
JENIS_HUTANG = "HUTANG"
# Tipe short link -> jenis rincian. Dipakai juga oleh short_link_service.
TIPE_RINCIAN = {"rincian_piutang": JENIS_PIUTANG, "rincian_hutang": JENIS_HUTANG}
_PREFIX_KUNCI = "rincian_nama:"


def _kunci(nama: str) -> str:
    return nama.strip().lower()


def _nilai_unit(unit: Any) -> str:
    return str(getattr(unit, "value", unit) or "")


def _token(jenis: str, unit: str, nama: str) -> str:
    pesan = f"{jenis}|{unit}|{_kunci(nama)}".encode("utf-8")
    return hmac.new(settings.jwt_secret_key.encode("utf-8"), pesan, hashlib.sha256).hexdigest()[:40]


def buat_atau_ambil_token(db: Session, jenis: str, nama: str, unit: Optional[KasBankSource]) -> str:
    """Token rincian untuk satu nama (dan unit). Dibuat sekali, lalu dipakai ulang."""
    nama = nama.strip()
    if len(nama) < 2:
        raise HTTPException(status_code=400, detail="Nama tidak valid")
    unit_nilai = _nilai_unit(unit)
    token = _token(jenis, unit_nilai, nama)
    kunci_setting = f"{_PREFIX_KUNCI}{token}"
    if db.query(SystemSetting).filter(SystemSetting.key == kunci_setting).first() is None:
        db.add(SystemSetting(
            key=kunci_setting,
            value=json.dumps({"jenis": jenis, "unit": unit_nilai, "nama": nama}, ensure_ascii=False),
            description="Pemetaan token rincian piutang/hutang per nama",
        ))
        db.commit()
    return token


def _ambil_pemetaan(db: Session, token: str) -> Optional[Dict[str, str]]:
    if not token or len(token) != 40:
        return None
    setting = db.query(SystemSetting).filter(SystemSetting.key == f"{_PREFIX_KUNCI}{token}").first()
    if setting is None or not setting.value:
        return None
    return json.loads(setting.value)


def data_rincian(db: Session, token: str) -> Dict[str, Any]:
    """Data halaman rincian untuk token. 404 bila token tidak dikenal atau tidak ada datanya."""
    pemetaan = _ambil_pemetaan(db, token)
    if pemetaan is None:
        raise HTTPException(status_code=404, detail="Rincian tidak ditemukan")

    unit = KasBankSource(pemetaan["unit"]) if pemetaan["unit"] else None
    service = NamaGrupService(db)
    if pemetaan["jenis"] == JENIS_PIUTANG:
        detail = service.piutang_detail(pemetaan["nama"], unit=unit)
    else:
        detail = service.hutang_detail(pemetaan["nama"], unit=unit)

    struk = []
    for s in detail["struk"]:
        struk.append({**s, "status_label": STATUS_LABEL.get(s["status"], s["status"])})
    return {
        "jenis": pemetaan["jenis"],
        "nama": detail["nama"],
        "total_sisa": detail["total_sisa"],
        "total_nominal": sum(s["nominal"] for s in struk),
        "total_dibayar": sum(s["total_dibayar"] for s in struk),
        "struk": struk,
    }
