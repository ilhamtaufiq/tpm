"""Perbaikan data keuangan dari dashboard web (khusus ADMIN/MANAGER).

Dua kelompok temuan:
- Piutang manual tanpa kas: piutang LAINNYA yang dibuat dari form tanpa metode
  pencairan, sehingga tidak punya baris kas. Perbaikan: catat kas keluar
  (uang memang keluar) atau batalkan piutang (uang tidak pernah keluar).
- Tanggal mundur: baris kas yang tanggalnya lebih awal dari tanggal input
  (dibuat_pada - tanggal = selisih hari). Perbaikan: pindahkan tanggal baris kas
  dan induknya (piutang, hutang, transaksi bengkel) lalu hitung ulang saldo.

Setiap aksi, termasuk yang gagal, dicatat di riwayat (perbaikan_data_log).
Pemeriksaan kesehatan membaca kondisi data dan memberi rekomendasi.
"""
import json
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Callable, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import func, or_

from app.models.bengkel import TransaksiPenjualanBengkel
from app.models.keuangan import HutangUsaha, KasBank, PiutangUsaha
from app.models.perbaikan_data_log import PerbaikanDataLog
from app.models.user import User
from app.services.kas_bank_integration import create_kas_entry, get_kas_jenis
from app.services.kas_bank_service import KasBankService
from app.utils.constants import (
    KasBankJenis,
    KasBankSource,
    KasBankType,
    PaymentMethod,
    PiutangSource,
    PiutangStatus,
)
from app.utils.helpers import get_jakarta_date, get_jakarta_now, pesan_tanggal_masa_depan

# Akun yang boleh dipilih untuk pencairan tunai: kas utama dan laci tiap unit.
AKUN_TUNAI = {
    KasBankJenis.KAS_UTAMA,
    KasBankJenis.KAS_UNIT_BENGKEL,
    KasBankJenis.KAS_UNIT_JASA_ANGKUT,
    KasBankJenis.KAS_UNIT_MOBIL,
}
AKUN_TRANSFER = {KasBankJenis.BANK_UTAMA}
AKUN_DIPERIKSA = [
    KasBankJenis.KAS_UTAMA,
    KasBankJenis.KAS_UNIT_BENGKEL,
    KasBankJenis.KAS_UNIT_JASA_ANGKUT,
    KasBankJenis.KAS_UNIT_MOBIL,
    KasBankJenis.BANK_UTAMA,
]
PIUTANG_LAMA_HARI = 30
HARI_RIWAYAT_GAGAL = 7


def _rupiah(nilai: Any) -> str:
    return f"Rp{float(nilai):,.0f}".replace(",", ".")


class PerbaikanDataService:
    def __init__(self, db):
        self.db = db

    # ------------------------------------------------------------------
    # Riwayat
    # ------------------------------------------------------------------
    def _catat_riwayat(
        self,
        jenis: str,
        nomor: str,
        ringkasan: str,
        sebelum: Dict[str, Any],
        sesudah: Optional[Dict[str, Any]],
        user_id: Optional[int],
    ) -> None:
        self.db.add(
            PerbaikanDataLog(
                jenis=jenis,
                nomor_referensi=(nomor or "-")[:50],
                ringkasan=ringkasan[:255],
                sebelum=json.dumps(sebelum, ensure_ascii=False),
                sesudah=json.dumps(sesudah, ensure_ascii=False) if sesudah is not None else None,
                user_id=user_id,
            )
        )

    def _jalankan(self, jenis: str, nomor: str, user_id: Optional[int], aksi: Callable[[], Any]) -> Any:
        """Jalankan aksi; kalau gagal, catat ke riwayat (sebagai GAGAL_<jenis>) lalu lempar lagi."""
        try:
            return aksi()
        except HTTPException as e:
            pesan = e.detail if isinstance(e.detail, str) else "Permintaan ditolak"
            self._catat_gagal(jenis, nomor, pesan, user_id)
            raise
        except Exception as e:  # error tak terduga: tetap meninggalkan jejak
            self._catat_gagal(jenis, nomor, f"Error tak terduga ({type(e).__name__})", user_id)
            raise

    def _catat_gagal(self, jenis: str, nomor: str, pesan: str, user_id: Optional[int]) -> None:
        self.db.rollback()
        self._catat_riwayat(f"GAGAL_{jenis}", nomor, f"Gagal: {pesan}", {}, None, user_id)
        self.db.commit()

    def riwayat(self, limit: int = 100) -> List[Dict[str, Any]]:
        rows = (
            self.db.query(PerbaikanDataLog, User.username)
            .outerjoin(User, User.id == PerbaikanDataLog.user_id)
            .order_by(PerbaikanDataLog.created_at.desc(), PerbaikanDataLog.id.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": log.id,
                "waktu": log.created_at.isoformat(),
                "jenis": log.jenis,
                "nomor_referensi": log.nomor_referensi,
                "ringkasan": log.ringkasan,
                "sebelum": json.loads(log.sebelum) if log.sebelum else None,
                "sesudah": json.loads(log.sesudah) if log.sesudah else None,
                "oleh": username,
            }
            for log, username in rows
        ]

    # ------------------------------------------------------------------
    # Piutang manual tanpa kas
    # ------------------------------------------------------------------
    def _kandidat_piutang_manual(self):
        return (
            self.db.query(PiutangUsaha)
            .filter(
                PiutangUsaha.sumber == PiutangSource.LAINNYA,
                PiutangUsaha.referensi_id.is_(None),
                PiutangUsaha.nomor_referensi.is_(None),
                PiutangUsaha.is_internal == False,  # noqa: E712
                PiutangUsaha.status != PiutangStatus.BATAL,
            )
        )

    def _punya_kas(self, nomor_piutang: str) -> bool:
        return (
            self.db.query(KasBank.id)
            .filter(KasBank.nomor_referensi == nomor_piutang)
            .first()
            is not None
        )

    def _nomor_piutang(self, piutang_id: int) -> str:
        p = self.db.get(PiutangUsaha, piutang_id)
        return p.nomor_piutang if p else f"PIUTANG#{piutang_id}"

    def piutang_tanpa_kas(self) -> List[Dict[str, Any]]:
        hasil = []
        for p in self._kandidat_piutang_manual().order_by(PiutangUsaha.tanggal, PiutangUsaha.id).all():
            if self._punya_kas(p.nomor_piutang):
                continue
            hasil.append({
                "id": p.id,
                "nomor_piutang": p.nomor_piutang,
                "tanggal": p.tanggal.isoformat(),
                "nama_debitur": p.nama_debitur,
                "nominal_piutang": float(p.nominal_piutang),
                "catatan": p.catatan,
            })
        return hasil

    def _ambil_piutang_manual_tanpa_kas(self, piutang_id: int) -> PiutangUsaha:
        p = self.db.get(PiutangUsaha, piutang_id)
        if p is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Piutang tidak ditemukan. Mungkin sudah dihapus.")
        if p.status == PiutangStatus.BATAL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Piutang {p.nomor_piutang} sudah dibatalkan, tidak ada yang perlu dikoreksi.",
            )
        if self._kandidat_piutang_manual().filter(PiutangUsaha.id == piutang_id).first() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Piutang {p.nomor_piutang} bukan piutang manual. Piutang dari transaksi bengkel, "
                    "muatan, atau retur dikoreksi dari menu asalnya, bukan dari halaman ini."
                ),
            )
        if self._punya_kas(p.nomor_piutang):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Piutang {p.nomor_piutang} sudah punya catatan kas, jadi tidak perlu dicatat lagi. "
                    f"Cek Kas dengan nomor {p.nomor_piutang}."
                ),
            )
        return p

    def catat_kas_piutang(
        self,
        piutang_id: int,
        metode: PaymentMethod,
        kas_jenis: Optional[KasBankJenis],
        user_id: Optional[int],
    ) -> Dict[str, Any]:
        nomor = self._nomor_piutang(piutang_id)
        return self._jalankan(
            "PIUTANG_CATAT_KAS",
            nomor,
            user_id,
            lambda: self._catat_kas_piutang(piutang_id, metode, kas_jenis, user_id),
        )

    def _catat_kas_piutang(
        self,
        piutang_id: int,
        metode: PaymentMethod,
        kas_jenis: Optional[KasBankJenis],
        user_id: Optional[int],
    ) -> Dict[str, Any]:
        p = self._ambil_piutang_manual_tanpa_kas(piutang_id)
        akun_valid = AKUN_TUNAI if metode == PaymentMethod.TUNAI else AKUN_TRANSFER
        if kas_jenis is None:
            kas_jenis = get_kas_jenis(metode, p.unit)
        if kas_jenis not in akun_valid:
            if metode == PaymentMethod.TUNAI:
                pesan = (
                    f"Akun {kas_jenis.value} bukan akun tunai. Pencairan tunai lewat Kas Utama "
                    "atau laci unit (Bengkel, Jasa Angkut, Jual Beli Mobil)."
                )
            else:
                pesan = f"Akun {kas_jenis.value} bukan akun transfer. Pencairan transfer lewat Bank Utama."
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=pesan)
        try:
            create_kas_entry(
                db=self.db,
                tanggal=p.tanggal,
                tipe=KasBankType.KELUAR,
                nominal=p.nominal_piutang,
                sumber=p.unit or KasBankSource.PIUTANG,
                metode_bayar=metode,
                referensi_id=p.id,
                nomor_referensi=p.nomor_piutang,
                keterangan=f"[Perbaikan] Pemberian piutang kepada {p.nama_debitur} ({metode.value})",
                user_id=user_id,
                kas_jenis=kas_jenis,
                commit=True,
            )
        except HTTPException as e:
            if e.status_code == status.HTTP_400_BAD_REQUEST and "Saldo tidak mencukupi" in str(e.detail):
                saldo = str(e.detail).rsplit(":", 1)[-1].strip()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Saldo {kas_jenis.value} tidak cukup untuk {_rupiah(p.nominal_piutang)} "
                        f"(saldo sekarang {saldo}). Pilih akun lain, atau isi saldo akun ini dulu."
                    ),
                ) from e
            raise
        self._catat_riwayat(
            "PIUTANG_CATAT_KAS",
            p.nomor_piutang,
            f"Kas keluar {kas_jenis.value} ({metode.value}) untuk piutang {p.nama_debitur}",
            {"kas": None, "nominal_piutang": float(p.nominal_piutang)},
            {"kas_jenis": kas_jenis.value, "metode": metode.value, "nominal": float(p.nominal_piutang), "tanggal": p.tanggal.isoformat()},
            user_id,
        )
        self.db.commit()
        return {
            "id": p.id,
            "nomor_piutang": p.nomor_piutang,
            "metode": metode.value,
            "kas_jenis": kas_jenis.value,
        }

    def batalkan_piutang(self, piutang_id: int, user_id: Optional[int]) -> Dict[str, Any]:
        nomor = self._nomor_piutang(piutang_id)
        return self._jalankan(
            "PIUTANG_BATAL",
            nomor,
            user_id,
            lambda: self._batalkan_piutang(piutang_id, user_id),
        )

    def _batalkan_piutang(self, piutang_id: int, user_id: Optional[int]) -> Dict[str, Any]:
        p = self._ambil_piutang_manual_tanpa_kas(piutang_id)
        status_sebelum = p.status.value
        p.status = PiutangStatus.BATAL
        p.sisa_piutang = 0
        p.catatan = f"{p.catatan or ''} [Dibatalkan lewat Perbaikan Data: tidak ada uang keluar]".strip()
        self._catat_riwayat(
            "PIUTANG_BATAL",
            p.nomor_piutang,
            f"Piutang {p.nama_debitur} dibatalkan (tidak ada uang keluar)",
            {"status": status_sebelum, "sisa_piutang": float(p.nominal_piutang)},
            {"status": PiutangStatus.BATAL.value, "sisa_piutang": 0},
            user_id,
        )
        self.db.commit()
        return {"id": p.id, "nomor_piutang": p.nomor_piutang, "status": PiutangStatus.BATAL.value}

    # ------------------------------------------------------------------
    # Tanggal mundur
    # ------------------------------------------------------------------
    def tanggal_mundur(self, selisih_hari: int = 1) -> List[Dict[str, Any]]:
        rows = (
            self.db.query(
                KasBank.nomor_referensi,
                KasBank.tanggal,
                func.max(func.date(KasBank.created_at)).label("dibuat_pada"),
                func.count(KasBank.id).label("jumlah_baris"),
                func.sum(KasBank.nominal).label("total"),
                func.min(KasBank.keterangan).label("keterangan"),
            )
            .filter(
                KasBank.nomor_referensi.isnot(None),
                ~KasBank.nomor_referensi.like("IMP-%"),
                func.datediff(func.date(KasBank.created_at), KasBank.tanggal) == selisih_hari,
            )
            .group_by(KasBank.nomor_referensi, KasBank.tanggal)
            .order_by(KasBank.tanggal, KasBank.nomor_referensi)
            .all()
        )
        hasil = []
        for nomor, tanggal_lama, dibuat_pada, jumlah, total, keterangan in rows:
            hasil.append({
                "nomor_referensi": nomor,
                "tanggal_lama": tanggal_lama.isoformat(),
                "tanggal_seharusnya": dibuat_pada.isoformat(),
                "jumlah_baris": int(jumlah),
                "total": float(total or 0),
                "keterangan": keterangan,
                "induk": self._cari_induk(nomor),
            })
        return hasil

    def _cari_induk(self, nomor: str) -> Optional[str]:
        if self.db.query(PiutangUsaha.id).filter(
            or_(PiutangUsaha.nomor_piutang == nomor, PiutangUsaha.nomor_referensi == nomor)
        ).first():
            return "PIUTANG"
        if self.db.query(HutangUsaha.id).filter(
            or_(HutangUsaha.nomor_hutang == nomor, HutangUsaha.nomor_referensi == nomor)
        ).first():
            return "HUTANG"
        if self.db.query(TransaksiPenjualanBengkel.id).filter(
            TransaksiPenjualanBengkel.nomor_transaksi == nomor
        ).first():
            return "TRANSAKSI_BENGKEL"
        return None

    def ubah_tanggal(self, nomor_referensi: str, tanggal_lama, tanggal_baru, user_id: Optional[int]) -> Dict[str, Any]:
        return self._jalankan(
            "TANGGAL_UBAH",
            nomor_referensi,
            user_id,
            lambda: self._ubah_tanggal(nomor_referensi, tanggal_lama, tanggal_baru, user_id),
        )

    def _ubah_tanggal(self, nomor_referensi: str, tanggal_lama, tanggal_baru, user_id: Optional[int]) -> Dict[str, Any]:
        pesan = pesan_tanggal_masa_depan(tanggal_baru)
        if pesan:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=pesan)

        kas = (
            self.db.query(KasBank)
            .filter(KasBank.nomor_referensi == nomor_referensi, KasBank.tanggal == tanggal_lama)
            .all()
        )
        if not kas:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    f"Tidak ada kas bernomor {nomor_referensi} pada {tanggal_lama.isoformat()}. "
                    "Mungkin sudah dipindah sebelumnya. Muat ulang halaman untuk melihat daftar terbaru."
                ),
            )
        for row in kas:
            row.tanggal = tanggal_baru

        induk = (
            self.db.query(PiutangUsaha)
            .filter(
                or_(PiutangUsaha.nomor_piutang == nomor_referensi, PiutangUsaha.nomor_referensi == nomor_referensi),
                PiutangUsaha.tanggal == tanggal_lama,
            )
            .all()
        )
        induk += (
            self.db.query(HutangUsaha)
            .filter(
                or_(HutangUsaha.nomor_hutang == nomor_referensi, HutangUsaha.nomor_referensi == nomor_referensi),
                HutangUsaha.tanggal == tanggal_lama,
            )
            .all()
        )
        induk += (
            self.db.query(TransaksiPenjualanBengkel)
            .filter(
                TransaksiPenjualanBengkel.nomor_transaksi == nomor_referensi,
                TransaksiPenjualanBengkel.tanggal == tanggal_lama,
            )
            .all()
        )
        for row in induk:
            row.tanggal = tanggal_baru

        self._catat_riwayat(
            "TANGGAL_UBAH",
            nomor_referensi,
            f"Tanggal {nomor_referensi} dipindah dari {tanggal_lama.isoformat()} ke {tanggal_baru.isoformat()}",
            {"tanggal": tanggal_lama.isoformat(), "baris_kas": len(kas), "dokumen_induk": len(induk)},
            {"tanggal": tanggal_baru.isoformat()},
            user_id,
        )
        self.db.flush()
        KasBankService(self.db).rebuild_balances()
        self.db.commit()
        return {
            "nomor_referensi": nomor_referensi,
            "baris_kas": len(kas),
            "dokumen_induk": len(induk),
            "tanggal_baru": tanggal_baru.isoformat(),
        }

    # ------------------------------------------------------------------
    # Pemeriksaan kesehatan dan rekomendasi
    # ------------------------------------------------------------------
    def _saldo_akhir(self, jenis: KasBankJenis) -> Optional[Decimal]:
        akhir = (
            self.db.query(KasBank.saldo_sesudah)
            .filter(KasBank.jenis == jenis)
            .order_by(KasBank.tanggal.desc(), KasBank.id.desc())
            .first()
        )
        return Decimal(akhir[0]) if akhir else None

    def _total_tipe(self, jenis: KasBankJenis, tipe: KasBankType) -> Decimal:
        total = (
            self.db.query(func.coalesce(func.sum(KasBank.nominal), 0))
            .filter(KasBank.jenis == jenis, KasBank.tipe == tipe)
            .scalar()
        )
        return Decimal(total or 0)

    def kesehatan(self) -> Dict[str, Any]:
        """Cek kondisi data dan rekomendasi. Tingkat: ok, info, peringatan, kritis."""
        hari_ini = get_jakarta_date()
        checks: List[Dict[str, str]] = []
        rekomendasi: List[Dict[str, str]] = []

        for jenis in AKUN_DIPERIKSA:
            akhir = self._saldo_akhir(jenis)
            if akhir is None:
                continue
            if akhir < 0:
                checks.append({"tingkat": "kritis", "pesan": f"Saldo {jenis.value} negatif ({_rupiah(akhir)})."})
                rekomendasi.append({
                    "tingkat": "kritis",
                    "pesan": f"Saldo {jenis.value} negatif. Cek pengeluaran, setoran, atau pembayaran yang belum tercatat di akun ini.",
                })
            selisih = akhir - (self._total_tipe(jenis, KasBankType.MASUK) - self._total_tipe(jenis, KasBankType.KELUAR))
            if abs(selisih) > Decimal("1"):
                checks.append({
                    "tingkat": "peringatan",
                    "pesan": f"Rantai saldo {jenis.value} tidak sama dengan total masuk − keluar (selisih {_rupiah(selisih)}).",
                })
                rekomendasi.append({
                    "tingkat": "peringatan",
                    "pesan": f"Saldo {jenis.value} perlu dihitung ulang. Hubungi admin sebelum mengandalkan angka saldo di akun ini.",
                })

        piutang = self.piutang_tanpa_kas()
        if piutang:
            checks.append({"tingkat": "peringatan", "pesan": f"{len(piutang)} piutang manual belum punya kas."})
        for p in piutang:
            umur = (hari_ini - date.fromisoformat(p["tanggal"])).days
            if umur > PIUTANG_LAMA_HARI:
                rekomendasi.append({
                    "tingkat": "peringatan",
                    "pesan": (
                        f"Piutang {p['nomor_piutang']} ({p['nama_debitur']}) sudah {umur} hari tanpa kas. "
                        "Catat kas jika uang memang keluar, atau batalkan jika tidak."
                    ),
                })
            else:
                rekomendasi.append({
                    "tingkat": "info",
                    "pesan": f"Piutang {p['nomor_piutang']} ({p['nama_debitur']}) belum punya kas. Catat kas atau batalkan.",
                })

        mundur = self.tanggal_mundur(1)
        if mundur:
            checks.append({"tingkat": "peringatan", "pesan": f"{len(mundur)} kas tercatat 1 hari sebelum tanggal input."})
        sudah_dipindah = {
            row[0]
            for row in self.db.query(PerbaikanDataLog.nomor_referensi)
            .filter(PerbaikanDataLog.jenis == "TANGGAL_UBAH")
            .all()
        }
        for g in mundur:
            if g["nomor_referensi"] in sudah_dipindah:
                rekomendasi.append({
                    "tingkat": "peringatan",
                    "pesan": (
                        f"Kas {g['nomor_referensi']} sudah pernah dipindah tanggalnya tapi masih tercatat mundur. "
                        "Cek induknya dan kas lain dengan nomor yang sama."
                    ),
                })
            else:
                rekomendasi.append({
                    "tingkat": "info",
                    "pesan": (
                        f"Kas {g['nomor_referensi']} tercatat sehari sebelum tanggal input. "
                        "Pindahkan tanggalnya jika memang salah input."
                    ),
                })

        sejak = get_jakarta_now().replace(tzinfo=None) - timedelta(days=HARI_RIWAYAT_GAGAL)
        gagal = (
            self.db.query(func.count(PerbaikanDataLog.id))
            .filter(PerbaikanDataLog.jenis.like("GAGAL_%"), PerbaikanDataLog.created_at >= sejak)
            .scalar()
        )
        if gagal:
            checks.append({"tingkat": "info", "pesan": f"{gagal} percobaan perbaikan gagal dalam {HARI_RIWAYAT_GAGAL} hari."})
            rekomendasi.append({
                "tingkat": "info",
                "pesan": f"Ada {gagal} percobaan perbaikan yang gagal. Lihat riwayat untuk pesan penyebabnya.",
            })

        if not checks:
            checks.append({"tingkat": "ok", "pesan": "Tidak ada temuan. Saldo kas konsisten dan tidak ada piutang tanpa kas."})
        return {"checks": checks, "rekomendasi": rekomendasi}
