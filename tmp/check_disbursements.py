
import sqlalchemy
from sqlalchemy import text
engine=sqlalchemy.create_engine('mysql+mysqldb://root:@localhost:3306/tpm_db')
with engine.connect() as conn:
    print("--- PENDING DISBURSEMENTS (MODAL_INV + LABA_INV - NOMINAL_PENCAIRAN) ---")
    res=conn.execute(text("""
        SELECT m.nama_investor, t.nomor_transaksi, m.nominal_investor, t.laba_investor, t.nominal_pencairan, t.status_pencairan
        FROM transaksi_penjualan_mobil t
        JOIN mobil m ON t.mobil_id = m.id
        WHERE t.tipe_kepemilikan = 'INVESTOR' AND t.status_bayar = 'LUNAS'
    """))
    for r in res:
        print(f"{r[0]}; {r[1]}; {r[2]}; {r[3]}; {r[4]}; {r[5]}")
