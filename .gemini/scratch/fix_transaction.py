
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from app.database.connection import SessionLocal
from app.models.bengkel import TransaksiPenjualanBengkel
from app.models.keuangan import KasBank
from app.utils.constants import PaymentStatus, KasBankType, KasBankSource, PaymentMethod
from app.services.kas_bank_service import KasBankService
from app.schemas.keuangan import KasBankCreate
from datetime import date
from decimal import Decimal

db = SessionLocal()

# 1. Find the discrepant transaction
t = db.query(TransaksiPenjualanBengkel).filter(TransaksiPenjualanBengkel.nomor_transaksi == 'BGL2604190001').first()

if t and t.status_bayar != PaymentStatus.LUNAS:
    print(f"Fixing transaction {t.nomor_transaksi}...")
    
    # Update transaction to LUNAS0
    t.status_bayar = PaymentStatus.LUNAS
    t.jumlah_bayar = t.grand_total
    
    # Create KasBank entries if not exist
    # Check if exists first
    kb_exists = db.query(KasBank).filter(KasBank.nomor_referensi == t.nomor_transaksi).first()
    
    if not kb_exists:
        service = KasBankService(db)
        
        # MASUK to Bengkel
        service.create(KasBankCreate(
            tanggal=t.tanggal,
            jenis='KAS_UNIT_BENGKEL',
            tipe=KasBankType.MASUK,
            nominal=t.grand_total,
            sumber=KasBankSource.BENGKEL,
            metode_bayar=PaymentMethod.INTERNAL,
            referensi_id=t.id,
            nomor_referensi=t.nomor_transaksi,
            keterangan=f"Pembayaran (INTERNAL) bengkel {t.nomor_transaksi}",
            allow_negative=True
        ), user_id=1)
        
        # KELUAR from Mobil
        service.create(KasBankCreate(
            tanggal=t.tanggal,
            jenis='KAS_UNIT_MOBIL',
            tipe=KasBankType.KELUAR,
            nominal=t.grand_total,
            sumber=KasBankSource.JUAL_BELI_MOBIL,
            metode_bayar=PaymentMethod.INTERNAL,
            referensi_id=t.id,
            nomor_referensi=t.nomor_transaksi,
            keterangan=f"Biaya Repair Internal via Bengkel: {t.nomor_transaksi}",
            allow_negative=True
        ), user_id=1)
        
    db.commit()
    print("Done fixing.")
else:
    print("Transaction already fixed or not found.")
