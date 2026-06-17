"""Diagnostic: Compare imported modal vs what the DB thinks."""
import sys
sys.path.insert(0, '.')
from app.database.connection import engine
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from app.models.bengkel import SparePart

with Session(engine) as db:
    # Total items
    total = db.query(func.count(SparePart.id)).filter(SparePart.deleted_at.is_(None)).scalar()
    print(f"Total items in DB: {total}")
    
    # Items with stok = 999
    always_ready = db.query(func.count(SparePart.id)).filter(
        SparePart.deleted_at.is_(None),
        SparePart.stok == 999
    ).scalar()
    print(f"Always Ready (stok=999): {always_ready}")
    
    # Items with stok = 999 BUT harga_beli > 0
    ar_with_price = db.query(SparePart).filter(
        SparePart.deleted_at.is_(None),
        SparePart.stok == 999,
        SparePart.harga_beli > 0
    ).all()
    print(f"Always Ready with harga_beli > 0: {len(ar_with_price)}")
    if ar_with_price:
        hidden_modal = sum(float(p.harga_beli) for p in ar_with_price)
        print(f"  Hidden modal (excluded from calc): Rp {hidden_modal:,.0f}")
        print("  Examples:")
        for p in ar_with_price[:10]:
            print(f"    {p.nama} | stok={float(p.stok)} | harga_beli={p.harga_beli}")
    
    # Computed total modal from DB (current formula)
    result = db.query(
        func.sum(
            case(
                (SparePart.stok == 999, 0),
                else_=SparePart.stok * SparePart.harga_beli
            )
        ).label("db_modal")
    ).filter(SparePart.deleted_at.is_(None)).first()
    print(f"\nDB Total Modal (excluding stok=999): Rp {float(result.db_modal or 0):,.0f}")
    
    # What if we include ALL items?
    result2 = db.query(
        func.sum(SparePart.stok * SparePart.harga_beli).label("full_modal")
    ).filter(SparePart.deleted_at.is_(None)).first()
    print(f"DB Full Modal (including all):        Rp {float(result2.full_modal or 0):,.0f}")
    
    # Correct calc: stok=999 items → modal = 0, others → stok * harga_beli
    # Also check: items with harga_beli=0 but stok > 0
    zero_price = db.query(func.count(SparePart.id)).filter(
        SparePart.deleted_at.is_(None),
        SparePart.harga_beli == 0,
        SparePart.stok > 0,
        SparePart.stok != 999
    ).scalar()
    print(f"\nItems with harga_beli=0 but stok > 0 (non-999): {zero_price}")
    
    # Check for duplicate names in DB
    dupes = db.query(
        SparePart.nama, 
        func.count(SparePart.id).label('cnt')
    ).filter(
        SparePart.deleted_at.is_(None)
    ).group_by(SparePart.nama).having(func.count(SparePart.id) > 1).all()
    
    if dupes:
        print(f"\n⚠️ DB has duplicate names: {len(dupes)}")
        for d in dupes[:10]:
            print(f"  '{d.nama}' x{d.cnt}")
    else:
        print("\n✅ No duplicate names in DB")
    
    # Sum stok * harga_beli item by item for verification
    all_items = db.query(SparePart).filter(SparePart.deleted_at.is_(None)).all()
    manual_modal = 0
    for item in all_items:
        if item.stok != 999:
            manual_modal += float(item.stok) * float(item.harga_beli)
    print(f"\nManual Python-calculated modal: Rp {manual_modal:,.0f}")
