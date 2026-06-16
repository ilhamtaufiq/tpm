from app.database.connection import SessionLocal
from app.models.keuangan import KasBank, KasBankSource, PiutangUsaha, HutangUsaha
from app.models.mobil import TransaksiPenjualanMobil, Mobil
from app.models.bengkel import TransaksiPenjualanBengkel
from sqlalchemy import func

db = SessionLocal()

print("--- ORPHAN DATA DIAGNOSTIC ---")

# 1. KasBank Inflows without clear source in Laba/Modal
total_kas_in = db.query(func.sum(KasBank.nominal)).filter(KasBank.tipe == 'MASUK').scalar() or 0
modal_total = db.query(func.sum(KasBank.nominal)).filter(KasBank.sumber == KasBankSource.MODAL).scalar() or 0
sales_car_paid = db.query(func.sum(TransaksiPenjualanMobil.dp)).scalar() or 0
# Add other sales sources if any...

print(f"Total Kas Inflow: {total_kas_in:,.2f}")
print(f"  from Modal: {modal_total:,.2f}")
print(f"  from Car Sales (DP): {sales_car_paid:,.2f}")
print(f"  Unaccounted Inflow: {total_kas_in - modal_total - sales_car_paid:,.2f}")

# 2. Piutang without Sales
total_piutang = db.query(func.sum(PiutangUsaha.sisa_piutang)).scalar() or 0
sales_piutang_expected = db.query(func.sum(TransaksiPenjualanMobil.sisa_bayar)).scalar() or 0

print(f"\nTotal Piutang (Current): {total_piutang:,.2f}")
print(f"Total Piutang (Expected from Sales): {sales_piutang_expected:,.2f}")
print(f"  Orphan Piutang: {total_piutang - sales_piutang_expected:,.2f}")

# 3. List top orphan piutangs
orphans = db.query(PiutangUsaha).filter(
    ~PiutangUsaha.nomor_referensi.in_(db.query(TransaksiPenjualanMobil.nomor_transaksi))
).limit(5).all()

print("\nSample Orphan Piutangs:")
for o in orphans:
    print(f"  {o.nomor_referensi}: {o.sisa_piutang:,.2f} - {o.nama_debitur}")

db.close()
