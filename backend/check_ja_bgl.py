import sys
sys.path.append('.')
from app.db.session import SessionLocal
from app.models.transaksi_bengkel import TransaksiPenjualanBengkel
db=SessionLocal()
res=db.query(TransaksiPenjualanBengkel.id, TransaksiPenjualanBengkel.grand_total, TransaksiPenjualanBengkel.mobil_id).filter(TransaksiPenjualanBengkel.kategori == 'jasa_angkut').all()
print(f"JA Workshop Bills: {res}")
