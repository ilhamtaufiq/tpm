"""Folder piutang: kelompokkan piutang (mis. per debitur) dan bayar sekaligus.

Pembayaran folder dialokasikan ke piutang tertua dulu. Tiap bagian dicatat sebagai
pembayaran piutang biasa (PembayaranPiutang + kas), jadi status tiap struk ikut berubah.
Catatan: alokasi dicatat berurutan. Jika gagal di tengah (mis. saldo kurang), bagian
yang sudah tercatat tidak dibatalkan otomatis; cek rincian folder setelah gagal.
"""
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import func

from app.models.keuangan import PiutangFolder, PiutangUsaha
from app.schemas.keuangan import PaymentDetail, PembayaranPiutangSplit
from app.services.piutang_service import PiutangService
from app.utils.constants import KasBankJenis, PaymentMethod, PiutangStatus


def _ringkas(p: PiutangUsaha) -> Dict[str, Any]:
    return {
        "id": p.id,
        "nomor_piutang": p.nomor_piutang,
        "tanggal": p.tanggal.isoformat(),
        "nama_debitur": p.nama_debitur,
        "nominal_piutang": float(p.nominal_piutang),
        "total_dibayar": float(p.total_dibayar or 0),
        "sisa_piutang": float(p.sisa_piutang or 0),
        "status": p.status.value,
        "pembayaran": [
            {"tanggal": x.tanggal.isoformat(), "nominal": float(x.nominal), "metode": x.metode_bayar.value if x.metode_bayar else None}
            for x in sorted(p.pembayaran, key=lambda x: (x.tanggal, x.id))
        ],
    }


class PiutangFolderService:
    def __init__(self, db):
        self.db = db

    def _ambil(self, folder_id: int) -> PiutangFolder:
        folder = self.db.get(PiutangFolder, folder_id)
        if folder is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder piutang tidak ditemukan")
        return folder

    def _piutang_aktif(self, folder_id: int):
        return (
            self.db.query(PiutangUsaha)
            .filter(PiutangUsaha.folder_id == folder_id, PiutangUsaha.status.notin_([PiutangStatus.BATAL]))
            .order_by(PiutangUsaha.tanggal, PiutangUsaha.id)
        )

    def daftar(self) -> List[Dict[str, Any]]:
        folders = self.db.query(PiutangFolder).order_by(PiutangFolder.nama).all()
        hasil = []
        for f in folders:
            rows = self._piutang_aktif(f.id).all()
            hasil.append({
                "id": f.id,
                "nama": f.nama,
                "catatan": f.catatan,
                "jumlah_struk": len(rows),
                "total_piutang": float(sum((p.nominal_piutang for p in rows), Decimal(0))),
                "total_sisa": float(sum((p.sisa_piutang or 0 for p in rows), Decimal(0))),
                "belum_lunas": sum(1 for p in rows if p.status != PiutangStatus.LUNAS),
            })
        return hasil

    def buat(self, nama: str, catatan: Optional[str], user_id: Optional[int]) -> PiutangFolder:
        nama = nama.strip()
        if len(nama) < 2:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nama folder minimal 2 karakter")
        if self.db.query(PiutangFolder.id).filter(func.lower(PiutangFolder.nama) == nama.lower()).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Folder '{nama}' sudah ada")
        folder = PiutangFolder(nama=nama, catatan=catatan, created_by=user_id)
        self.db.add(folder)
        self.db.commit()
        self.db.refresh(folder)
        return folder

    def hapus(self, folder_id: int) -> None:
        folder = self._ambil(folder_id)
        if self.db.query(PiutangUsaha.id).filter(PiutangUsaha.folder_id == folder.id).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Folder masih berisi piutang. Pindahkan piutangnya dulu.",
            )
        self.db.delete(folder)
        self.db.commit()

    def detail(self, folder_id: int) -> Dict[str, Any]:
        folder = self._ambil(folder_id)
        rows = self._piutang_aktif(folder.id).all()
        return {
            "id": folder.id,
            "nama": folder.nama,
            "catatan": folder.catatan,
            "total_piutang": float(sum((p.nominal_piutang for p in rows), Decimal(0))),
            "total_sisa": float(sum((p.sisa_piutang or 0 for p in rows), Decimal(0))),
            "piutang": [_ringkas(p) for p in rows],
        }

    def pindahkan(self, piutang_id: int, folder_id: Optional[int]) -> Dict[str, Any]:
        p = self.db.get(PiutangUsaha, piutang_id)
        if p is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Piutang tidak ditemukan")
        if p.status == PiutangStatus.BATAL:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Piutang yang dibatalkan tidak bisa dipindah folder")
        if folder_id is not None:
            self._ambil(folder_id)
        p.folder_id = folder_id
        self.db.commit()
        return {"id": p.id, "nomor_piutang": p.nomor_piutang, "folder_id": folder_id}

    def bayar(
        self,
        folder_id: int,
        tanggal: date,
        metode: PaymentMethod,
        nominal: Decimal,
        kas_jenis: Optional[KasBankJenis],
        catatan: Optional[str],
        user_id: Optional[int],
    ) -> Dict[str, Any]:
        self._ambil(folder_id)
        tersedia = [p for p in self._piutang_aktif(folder_id).all() if p.status != PiutangStatus.LUNAS]
        total_sisa = sum((p.sisa_piutang or Decimal(0) for p in tersedia), Decimal(0))
        if nominal > total_sisa:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Nominal pembayaran melebihi sisa folder ({float(total_sisa):,.0f})",
            )

        sisa_bayar = nominal
        dibayar: List[Dict[str, Any]] = []
        for p in tersedia:
            if sisa_bayar <= 0:
                break
            bagian = min(sisa_bayar, p.sisa_piutang or Decimal(0))
            if bagian <= 0:
                continue
            PiutangService(self.db).process_payment_split(
                PembayaranPiutangSplit(
                    piutang_id=p.id,
                    tanggal=tanggal,
                    payments=[PaymentDetail(metode=metode, nominal=bagian, kas_jenis=kas_jenis, catatan=catatan)],
                    catatan=catatan,
                ),
                user_id,
            )
            dibayar.append({"piutang_id": p.id, "nomor_piutang": p.nomor_piutang, "nominal": float(bagian)})
            sisa_bayar -= bagian
        return {"dibayar": dibayar, "total": float(nominal)}
