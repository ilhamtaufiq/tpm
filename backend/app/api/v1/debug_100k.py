
from app.db.session import SessionLocal
from app.models.bengkel import PengeluaranBengkel
from app.models.keuangan import KasBank
from app.utils.constants import KasBankJenis
from sqlalchemy import func

db = SessionLocal()

# Check Mobil Wallet outflows
print("MOBIL WALLET OUTFLOWS:")
kas = db.query(KasBank).filter(
    KasBank.jenis == KasBankJenis.KAS_UNIT_MOBIL,
    KasBank.tipe == "KELUAR"
).all()

for k in kas:
    print(f"Kas ID: {k.id}, Nominal: {k.nominal}, Ref: {k.referensi_id}, Cat: {k.keterangan}")
    
    # Check if linked to PengeluaranBengkel
    if k.referensi_id:
        p = db.query(PengeluaranBengkel).filter(PengeluaranBengkel.id == k.referensi_id).first()
        if p:
            print(f"  -> Linked to PengeluaranBengkel {p.id}, MobilID: {p.mobil_id}, Kategori: {p.kategori}")
        else:
            print(f"  -> No PengeluaranBengkel found for ID {k.referensi_id}")
    else:
        print("  -> No Ref ID")

db.close()
