from app.database.connection import SessionLocal
from app.models.keuangan import KasBank, PiutangUsaha, HutangUsaha
from app.models.mobil import TransaksiPenjualanMobil, Mobil
from app.models.bengkel import TransaksiPenjualanBengkel, PengeluaranBengkel
from sqlalchemy import or_

db = SessionLocal()

print("--- SUPER CLEANUP START ---")

# 1. Delete by Keywords
keywords = ["Test", "AVANZA TEST", "MBL2605080001", "BGL2605080001", "UNIT MOBIL - TEST"]
for kw in keywords:
    pattern = f"%{kw}%"
    
    kb = db.query(KasBank).filter(KasBank.keterangan.ilike(pattern)).delete(synchronize_session=False)
    print(f"Deleted {kb} KasBank records for '{kw}'")
    
    pu = db.query(PiutangUsaha).filter(or_(
        PiutangUsaha.nomor_referensi.ilike(pattern),
        PiutangUsaha.nama_debitur.ilike(pattern)
    )).delete(synchronize_session=False)
    print(f"Deleted {pu} Piutang records for '{kw}'")
    
    hu = db.query(HutangUsaha).filter(or_(
        HutangUsaha.nomor_referensi.ilike(pattern),
        HutangUsaha.nama_kreditur.ilike(pattern)
    )).delete(synchronize_session=False)
    print(f"Deleted {hu} Hutang records for '{kw}'")

# 2. Delete Specific Transactions
tpm = db.query(TransaksiPenjualanMobil).filter(TransaksiPenjualanMobil.nomor_transaksi == "MBL2605080001").delete(synchronize_session=False)
print(f"Deleted {tpm} TransaksiPenjualanMobil records")

tpb = db.query(TransaksiPenjualanBengkel).filter(TransaksiPenjualanBengkel.nomor_transaksi == "BGL2605080001").delete(synchronize_session=False)
print(f"Deleted {tpb} TransaksiPenjualanBengkel records")

# 3. Delete Cars
cars = db.query(Mobil).filter(or_(Mobil.nomor_plat == "TEST-123", Mobil.model == "AVANZA TEST")).all()
for c in cars:
    # Delete expenses linked to this car
    exp = db.query(PengeluaranBengkel).filter(PengeluaranBengkel.mobil_id == c.id).delete(synchronize_session=False)
    print(f"Deleted {exp} Pengeluaran records for car ID {c.id}")
    db.delete(c)
    print(f"Deleted car {c.nomor_plat}")

db.commit()
db.close()
print("--- SUPER CLEANUP DONE ---")
