#!/usr/bin/env python3
"""
Script untuk memperbaiki status piutang yang tidak terupdate dengan benar
setelah transaksi bengkel dibayar lunas.

Bug: Di transaksi_bengkel_service.py method update(), ketika jumlah_bayar >= grand_total,
sisa_piutang di-set ke 0 tapi status piutang tidak di-update ke LUNAS.

Akibat: Piutang masih muncul di neraca meskipun sudah dibayar lunas.
"""

from datetime import datetime
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import DATABASE_URL
from app.models.keuangan import PiutangUsaha
from app.utils.constants import PiutangStatus

def fix_piutang_status():
    """Fix piutang records where sisa_piutang = 0 but status != LUNAS"""
    
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        # Find all piutang with sisa = 0 but status not LUNAS
        broken_piutangs = db.query(PiutangUsaha).filter(
            PiutangUsaha.sisa_piutang == 0,
            PiutangUsaha.status != PiutangStatus.LUNAS,
            PiutangUsaha.status != PiutangStatus.BATAL
        ).all()
        
        print(f"Found {len(broken_piutangs)} piutang records with incorrect status")
        
        fixed_count = 0
        for piutang in broken_piutangs:
            print(f"Fixing Piutang #{piutang.id} - {piutang.nomor_piutang}")
            print(f"  Nominal: {piutang.nominal_piutang}")
            print(f"  Total Dibayar: {piutang.total_dibayar}")
            print(f"  Sisa: {piutang.sisa_piutang}")
            print(f"  Old Status: {piutang.status}")
            
            piutang.status = PiutangStatus.LUNAS
            piutang.tanggal_lunas = datetime.now().date()
            fixed_count += 1
            
            print(f"  New Status: {piutang.status}")
            print()
        
        if fixed_count > 0:
            db.commit()
            print(f"✅ Successfully fixed {fixed_count} piutang records")
        else:
            print("✅ No records need fixing")
            
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("Fixing Piutang Status for Fully Paid Transactions")
    print("=" * 60)
    print()
    fix_piutang_status()
