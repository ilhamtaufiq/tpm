from app.database.connection import engine
from sqlalchemy import text

with engine.connect() as conn:
    print("Column Status Bayar in muatan_jasa_angkut:")
    res = conn.execute(text("SHOW COLUMNS FROM muatan_jasa_angkut LIKE 'status_bayar'")).fetchone()
    print(res)
    
    print("\nAll values in muatan_jasa_angkut.status_bayar:")
    res = conn.execute(text("SELECT DISTINCT status_bayar FROM muatan_jasa_angkut")).fetchall()
    for row in res:
        print(f"'{row[0]}'")

    print("\nColumn status in piutang_usaha:")
    res = conn.execute(text("SHOW COLUMNS FROM piutang_usaha LIKE 'status'")).fetchone()
    print(res)
    
    # Try to fix them right now
    print("\nAttempting to fix muatan_jasa_angkut.status_bayar...")
    conn.execute(text("UPDATE muatan_jasa_angkut SET status_bayar = UPPER(status_bayar)"))
    conn.commit()
    print("Done.")
