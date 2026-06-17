import sys
import os
from datetime import datetime
from decimal import Decimal

# Add current directory to path
sys.path.append(os.getcwd())

from app.database.connection import SessionLocal
from app.models.jasa_angkut import JasaAngkutBiayaLainnya, ArmadaJasaAngkut
from app.models.mobil import MobilBiayaLainnya, Mobil
from app.models.bengkel import PengeluaranBengkel
from app.utils.constants import TRANSACTION_PREFIXES, ExpenseCategory, PaymentMethod

def generate_nomor(db, date_obj):
    prefix = TRANSACTION_PREFIXES["pengeluaran"]
    date_str = date_obj.strftime("%y%m%d")
    
    last = (
        db.query(PengeluaranBengkel)
        .filter(PengeluaranBengkel.nomor_transaksi.like(f"{prefix}{date_str}%"))
        .order_by(PengeluaranBengkel.id.desc())
        .first()
    )
    
    if last:
        last_num = int(last.nomor_transaksi[-4:])
        new_num = last_num + 1
    else:
        new_num = 1
        
    return f"{prefix}{date_str}{new_num:04d}"

def migrate():
    db = SessionLocal()
    try:
        print("Starting migration...")
        
        # 1. Migrate Armada Expenses
        armada_expenses = db.query(JasaAngkutBiayaLainnya).all()
        print(f"Found {len(armada_expenses)} Armada expenses to migrate.")
        
        for ae in armada_expenses:
            # Check if already migrated (simple check by description or reference)
            exists = db.query(PengeluaranBengkel).filter(
                PengeluaranBengkel.tanggal == ae.tanggal,
                PengeluaranBengkel.jumlah == ae.jumlah,
                PengeluaranBengkel.deskripsi == ae.deskripsi,
                PengeluaranBengkel.armada_id == ae.armada_id
            ).first()
            
            if not exists:
                nomor = generate_nomor(db, ae.tanggal)
                new_exp = PengeluaranBengkel(
                    nomor_transaksi=nomor,
                    tanggal=ae.tanggal,
                    bisnis_kategori="jasa_angkut",
                    armada_id=ae.armada_id,
                    muatan_id=ae.muatan_id,
                    kategori=ExpenseCategory.BIAYA_OPERASIONAL,
                    deskripsi=ae.deskripsi,
                    jumlah=ae.jumlah,
                    catatan=ae.catatan,
                    metode_bayar=PaymentMethod.TUNAI # Default for legacy
                )
                db.add(new_exp)
                db.flush()
                print(f"Migrated Armada Expense: {nomor} - {ae.deskripsi}")
        
        # 2. Migrate Mobil Expenses
        mobil_expenses = db.query(MobilBiayaLainnya).all()
        print(f"Found {len(mobil_expenses)} Mobil expenses to migrate.")
        
        for me in mobil_expenses:
            exists = db.query(PengeluaranBengkel).filter(
                PengeluaranBengkel.tanggal == me.tanggal,
                PengeluaranBengkel.jumlah == me.jumlah,
                PengeluaranBengkel.deskripsi == (f"[{me.kategori}] {me.deskripsi}" if me.kategori else me.deskripsi),
                PengeluaranBengkel.mobil_id == me.mobil_id
            ).first()
            
            if not exists:
                nomor = generate_nomor(db, me.tanggal)
                new_exp = PengeluaranBengkel(
                    nomor_transaksi=nomor,
                    tanggal=me.tanggal,
                    bisnis_kategori="mobil",
                    mobil_id=me.mobil_id,
                    kategori=ExpenseCategory.BIAYA_OPERASIONAL,
                    deskripsi=f"[{me.kategori}] {me.deskripsi}" if me.kategori else me.deskripsi,
                    jumlah=me.jumlah,
                    catatan=me.catatan,
                    metode_bayar=PaymentMethod.TUNAI
                )
                db.add(new_exp)
                db.flush()
                print(f"Migrated Mobil Expense: {nomor} - {me.deskripsi}")

        db.commit()
        print("Migration completed successfully.")
        
    except Exception as e:
        db.rollback()
        print(f"Error during migration: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
