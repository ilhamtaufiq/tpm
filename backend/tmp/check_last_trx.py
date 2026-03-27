from app.db.session import SessionLocal
from app.models.bengkel import TransaksiPenjualanBengkel
from app.models.keuangan import PiutangUsaha

db = SessionLocal()
try:
    trx = db.query(TransaksiPenjualanBengkel).order_by(TransaksiPenjualanBengkel.id.desc()).first()
    if trx:
        print(f"Transaction: {trx.nomor_transaksi}, Grand Total: {trx.grand_total}, Paid: {trx.jumlah_bayar}")
        piutang = db.query(PiutangUsaha).filter(PiutangUsaha.nomor_referensi == trx.nomor_transaksi).first()
        if piutang:
            print(f"Piutang: {piutang.nomor_piutang}, Nominal: {piutang.nominal_piutang}, Sisa: {piutang.sisa_piutang}, Paid: {piutang.total_dibayar}")
        else:
            print("No Piutang linked.")
    else:
        print("No transactions found.")
finally:
    db.close()
