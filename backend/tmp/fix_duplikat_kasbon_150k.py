"""Fix: hapus duplikat KasBank KELUAR kasbon Rp150.000 (KB 245).

Latar: kasbon A Ajis 150k (KSB2609210001) di-book dua kali:
- KB 244 (asli, dibuat KasbonService, sumber=KASBON, ref KSB2609210001)
- KB 245 (duplikat, dibuat heal sync_kasbon_opening_kas_entries, sumber=LAINNYA,
  ref PTG2609210003 = nomor piutang) — predicate heal lama cuma match shape
  legacy sehingga kasbon yang dibuat via KasbonService di-heal ulang.

Efek: modal_aktual turun 150k → selisih Perubahan Modal -150k.

Script idempotent: cari kasbon piutang yang punya >1 KasBank KELUAR match
(shape legacy + shape KSB), hapus baris ekstra. Sudah dijalankan di lokal;
di server cukup jalankan sekali, baris duplikat tak akan ditemukan lagi.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import and_, or_
from app.database.connection import SessionLocal
from app.models.keuangan import KasBank, PiutangUsaha
from app.utils.constants import KasBankType, PiutangSource

db = SessionLocal()

def kasbon_keluar_rows(p: PiutangUsaha):
    """Semua KasBank KELUAR yang merefer kasbon piutang (2 shape)."""
    refs = [and_(KasBank.referensi_id == p.id, KasBank.nomor_referensi == p.nomor_piutang)]
    if p.referensi_id is not None and p.nomor_referensi is not None:
        refs.append(and_(KasBank.referensi_id == p.referensi_id,
                         KasBank.nomor_referensi == p.nomor_referensi))
    return db.query(KasBank).filter(
        KasBank.tipe == KasBankType.KELUAR,
        or_(*refs),
    ).order_by(KasBank.id).all()

deleted = []
for p in db.query(PiutangUsaha).filter(
    PiutangUsaha.sumber == PiutangSource.KASBON_KARYAWAN,
    PiutangUsaha.status != "BATAL",
).all():
    rows = kasbon_keluar_rows(p)
    if len(rows) > 1:
        # Baris pertama (ID terkecil) = yang dibuat saat kasbon dibuat; sisanya duplikat heal.
        for extra in rows[1:]:
            deleted.append(extra.id)
            db.delete(extra)

if deleted:
    db.commit()
    print(f"dihapus {len(deleted)} baris duplikat KasBank: {deleted}")
else:
    print("tidak ada duplikat — sudah bersih")

db.close()
