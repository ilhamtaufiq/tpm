
import sqlalchemy
from sqlalchemy import text
engine=sqlalchemy.create_engine('mysql+mysqldb://root:@localhost:3306/tpm_db')
with engine.connect() as conn:
    print("--- ALL INVESTOR CARS ---")
    res=conn.execute(text("""
        SELECT m.id, m.merek, m.model, m.nomor_plat, m.nominal_investor, m.status, t.id as trans_id, t.nomor_transaksi, t.laba_investor, t.nominal_pencairan, t.status_pencairan
        FROM mobil m
        LEFT JOIN transaksi_penjualan_mobil t ON m.id = t.mobil_id
        WHERE m.tipe_kepemilikan = 'INVESTOR'
    """))
    for r in res:
        print(f"ID:{r[0]} | {r[1]} {r[2]} ({r[3]}) | ModalInv:{r[4]} | Status:{r[5]} | TransID:{r[6]} | TransNum:{r[7]} | LabaInv:{r[8]} | Paid:{r[9]} | PayoutStatus:{r[10]}")

    print("\n--- RECENT KASBANK (JUAL_BELI_MOBIL) ---")
    res=conn.execute(text("SELECT id, nominal, tipe, keterangan, sumber FROM kas_bank WHERE sumber = 'JUAL_BELI_MOBIL' ORDER BY id DESC LIMIT 10"))
    for r in res:
        print(f"ID:{r[0]} | Nom:{r[1]} | Type:{r[2]} | Desc:{r[3]} | Source:{r[4]}")
