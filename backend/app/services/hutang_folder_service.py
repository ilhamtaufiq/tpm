"""Folder hutang: kelompokkan hutang manual dan lunasi sekaligus.

Pelunasan folder dialokasikan ke struk tertua dulu. Tiap bagian dicatat sebagai
pembayaran hutang biasa (PembayaranHutang + kas), jadi rincian dan kas tetap konsisten.
Alokasi berurutan: jika gagal di tengah, bagian yang sudah tercatat tidak dibatalkan otomatis.
"""
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import func

from app.models.keuangan import HutangFolder, HutangUsaha
from app.schemas.keuangan import PaymentDetailHutang, PembayaranHutangSplit
from app.services.hutang_service import HutangService
from app.utils.constants import HutangStatus, KasBankJenis, PaymentMethod


def _ringkas(h: HutangUsaha) -> Dict[str, Any]:
    return {
        "id": h.id,
        "nomor_hutang": h.nomor_hutang,
        "tanggal": h.tanggal.isoformat(),
        "nama_kreditur": h.nama_kreditur,
        "nominal_hutang": float(h.nominal_hutang),
        "total_dibayar": float(h.total_dibayar or 0),
        "sisa_hutang": float(h.sisa_hutang or 0),
        "status": h.status.value,
        "pembayaran": [
            {"tanggal": x.tanggal.isoformat(), "nominal": float(x.nominal), "metode": x.metode_bayar.value if x.metode_bayar else None}
            for x in sorted(h.pembayaran, key=lambda x: (x.tanggal, x.id))
        ],
    }


class HutangFolderService:
    def __init__(self, db):
        self.db = db

    def _ambil(self, folder_id: int) -> HutangFolder:
        folder = self.db.get(HutangFolder, folder_id)
        if folder is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder hutang tidak ditemukan")
        return folder

    def _aktif(self, folder_id: int):
        return (
            self.db.query(HutangUsaha)
            .filter(HutangUsaha.folder_id == folder_id, HutangUsaha.status != HutangStatus.BATAL)
            .order_by(HutangUsaha.tanggal, HutangUsaha.id)
        )

    def daftar(self) -> List[Dict[str, Any]]:
        hasil = []
        for f in self.db.query(HutangFolder).order_by(HutangFolder.nama).all():
            rows = self._aktif(f.id).all()
            hasil.append({
                "id": f.id,
                "nama": f.nama,
                "catatan": f.catatan,
                "jumlah_struk": len(rows),
                "total_hutang": float(sum((h.nominal_hutang for h in rows), Decimal(0))),
                "total_sisa": float(sum((h.sisa_hutang or 0 for h in rows), Decimal(0))),
                "belum_lunas": sum(1 for h in rows if h.status != HutangStatus.LUNAS),
            })
        return hasil

    def buat(self, nama: str, catatan: Optional[str], user_id: Optional[int]) -> HutangFolder:
        nama = nama.strip()
        if len(nama) < 2:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nama folder minimal 2 karakter")
        if self.db.query(HutangFolder.id).filter(func.lower(HutangFolder.nama) == nama.lower()).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Folder '{nama}' sudah ada")
        folder = HutangFolder(nama=nama, catatan=catatan, created_by=user_id)
        self.db.add(folder)
        self.db.commit()
        self.db.refresh(folder)
        return folder

    def hapus(self, folder_id: int) -> None:
        folder = self._ambil(folder_id)
        if self.db.query(HutangUsaha.id).filter(HutangUsaha.folder_id == folder.id).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Folder masih berisi hutang. Pindahkan hutangnya dulu.")
        self.db.delete(folder)
        self.db.commit()

    def detail(self, folder_id: int) -> Dict[str, Any]:
        folder = self._ambil(folder_id)
        rows = self._aktif(folder.id).all()
        return {
            "id": folder.id,
            "nama": folder.nama,
            "catatan": folder.catatan,
            "total_hutang": float(sum((h.nominal_hutang for h in rows), Decimal(0))),
            "total_sisa": float(sum((h.sisa_hutang or 0 for h in rows), Decimal(0))),
            "hutang": [_ringkas(h) for h in rows],
        }

    def pindahkan(self, hutang_id: int, folder_id: Optional[int]) -> Dict[str, Any]:
        h = self.db.get(HutangUsaha, hutang_id)
        if h is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hutang tidak ditemukan")
        if h.status == HutangStatus.BATAL:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Hutang yang dibatalkan tidak bisa dipindah folder")
        if folder_id is not None:
            self._ambil(folder_id)
        h.folder_id = folder_id
        self.db.commit()
        return {"id": h.id, "nomor_hutang": h.nomor_hutang, "folder_id": folder_id}

    def bayar(self, folder_id: int, tanggal: date, metode: PaymentMethod, nominal: Decimal,
              kas_jenis: Optional[KasBankJenis], catatan: Optional[str], user_id: Optional[int]) -> Dict[str, Any]:
        self._ambil(folder_id)
        tersedia = [h for h in self._aktif(folder_id).all() if h.status != HutangStatus.LUNAS and (h.sisa_hutang or 0) > 0]
        total_sisa = sum((h.sisa_hutang for h in tersedia), Decimal(0))
        if nominal > total_sisa:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Nominal pembayaran melebihi sisa folder ({float(total_sisa):,.0f})")
        sisa_bayar = nominal
        dibayar: List[Dict[str, Any]] = []
        for h in tersedia:
            if sisa_bayar <= 0:
                break
            bagian = min(sisa_bayar, h.sisa_hutang)
            HutangService(self.db).process_payment_split(
                PembayaranHutangSplit(
                    hutang_id=h.id, tanggal=tanggal,
                    payments=[PaymentDetailHutang(metode=metode, nominal=bagian, kas_jenis=kas_jenis, catatan=catatan)],
                    catatan=catatan,
                ),
                user_id,
            )
            dibayar.append({"hutang_id": h.id, "nomor_hutang": h.nomor_hutang, "nominal": float(bagian)})
            sisa_bayar -= bagian
        return {"dibayar": dibayar, "total": float(nominal)}
