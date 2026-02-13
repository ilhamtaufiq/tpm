"""Add INTERNAL to metode_bayar ENUM in transaksi_penjualan_bengkel table."""
from sqlalchemy import text
from app.database import engine

with engine.connect() as conn:
    conn.execute(text(
        "ALTER TABLE transaksi_penjualan_bengkel "
        "MODIFY COLUMN metode_bayar ENUM('TUNAI','TRANSFER','KREDIT','DEBIT','SPLIT','INTERNAL')"
    ))
    conn.commit()
    print("Done! Added INTERNAL to metode_bayar ENUM.")
