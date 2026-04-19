import sys
sys.path.append('.')
from app.db.session import SessionLocal
from app.models.bengkel import PengeluaranBengkel
from app.models.muatan import Muatan
from sqlalchemy import func
db=SessionLocal()

# Check Ledger Expenses for Jasa Angkut
ledger_ja = db.query(PengeluaranBengkel.deskripsi, PengeluaranBengkel.jumlah, PengeluaranBengkel.mobil_id).filter(PengeluaranBengkel.bisnis_kategori == 'jasa_angkut').all()
print(f"Ledger JA: {ledger_ja}")

# Check Trip Expenses
trip_ja = db.query(Muatan.nomor_plat, Muatan.biaya_trip).filter(Muatan.biaya_trip > 0).all()
print(f"Trip JA: {trip_ja}")

# Check Workshop
from app.models.transaksi_bengkel import TransaksiPenjualanBengkel
ws_ja = db.query(TransaksiPenjualanBengkel.id, TransaksiPenjualanBengkel.grand_total, TransaksiPenjualanBengkel.mobil_id).filter(TransaksiPenjualanBengkel.kategori == 'jasa_angkut').all()
print(f"WS JA: {ws_ja}")
