import os
import sys
from decimal import Decimal
from datetime import date

# Add the project root to sys.path
sys.path.append(os.getcwd())

from backend.app.db.session import SessionLocal
from backend.app.services.transaksi_bengkel_service import TransaksiBengkelService
from backend.app.schemas.bengkel import TransaksiBengkelCreate, PaymentItem, DetailPartCreate, DetailServiceCreate

db = SessionLocal()
try:
    service = TransaksiBengkelService(db)
    payload = TransaksiBengkelCreate(
        tanggal=date.today(),
        nama_customer="Test DP Issue",
        nomor_plat="B 1234 TEST",
        jenis_kendaraan="Test Car",
        detail_parts=[],
        detail_services=[DetailServiceCreate(nama_jasa="Test Service", harga=Decimal("250000"), qty=1)],
        diskon=Decimal("0"),
        metode_bayar="TUNAI",
        jumlah_bayar=Decimal("100000"),
        payments=[PaymentItem(metode="TUNAI", jumlah=Decimal("100000"))]
    )
    
    # Mock user_id = 1
    trx = service.create(payload, 1)
    
    print(f"Transaction: {trx.nomor_transaksi}, Grand Total: {trx.grand_total}, Paid: {trx.jumlah_bayar}")
    
    from backend.app.models.keuangan import PiutangUsaha
    piutang = db.query(PiutangUsaha).filter(PiutangUsaha.nomor_referensi == trx.nomor_transaksi).first()
    if piutang:
        print(f"Piutang: {piutang.nomor_piutang}, Nominal: {piutang.nominal_piutang}, Sisa: {piutang.sisa_piutang}")
    else:
        print("No Piutang created.")
        
finally:
    db.close()
