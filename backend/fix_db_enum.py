from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    sql = "ALTER TABLE kas_bank MODIFY COLUMN sumber ENUM('BENGKEL','JUAL_BELI_MOBIL','JASA_ANGKUT','PEMBELIAN_PART','PEMBELIAN_MOBIL','PENGELUARAN','GAJI','KASBON','PIUTANG','HUTANG','MODAL','PRIVE','LAINNYA')"
    db.execute(text(sql))
    db.commit()
    print("Successfully added HUTANG to kas_bank.sumber ENUM")
except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()
