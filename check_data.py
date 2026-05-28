from app.database.session import SessionLocal
from app.models.supplier import Supplier
from app.models.bengkel import PembelianSparePart

db = SessionLocal()
try:
    print("Checking Suppliers:")
    suppliers = db.query(Supplier).all()
    for s in suppliers:
        print(f"ID: {s.id}, Name: {s.nama}")
    
    print("\nChecking Latest Purchases:")
    purchases = db.query(PembelianSparePart).order_by(PembelianSparePart.id.desc()).limit(5).all()
    for p in purchases:
        print(f"ID: {p.id}, Transaction: {p.nomor_transaksi}, Supplier ID: {p.supplier_id}, Supplier Object: {p.supplier.nama if p.supplier else 'None'}")
finally:
    db.close()
