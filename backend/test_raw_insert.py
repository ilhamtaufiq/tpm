from app.database.connection import engine
from sqlalchemy import text
from datetime import date

with engine.connect() as conn:
    try:
        conn.execute(text("INSERT INTO mobil (kode, merek, model, tahun, nomor_plat, harga_beli, tanggal_masuk, created_at, updated_at, nominal_investor) VALUES ('TEST-RAW', 'TEST', 'TEST', 2020, 'TEST-RAW', 0, '2026-05-08', now(), now(), 0)"))
        conn.commit()
        print("SUCCESS RAW INSERT")
    except Exception as e:
        print(f"FAILED RAW INSERT: {e}")
    finally:
        conn.execute(text("DELETE FROM mobil WHERE kode = 'TEST-RAW'"))
        conn.commit()
