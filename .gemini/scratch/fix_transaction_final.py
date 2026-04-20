
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from app.database.connection import SessionLocal
from app.models.bengkel import TransaksiPenjualanBengkel
from app.models.keuangan import KasBank
from app.utils.constants import PaymentStatus, KasBankType, KasBankSource, PaymentMethod, KasBankJenis
from app.services.kas_bank_service import KasBankService
from app.schemas.keuangan import KasBankCreate
from datetime import date
from decimal import Decimal

db = SessionLocal()

# Find the transaction
t = db.query(TransaksiPenjualanBengkel).filter(TransaksiPenjualanBengkel.nomor_transaksi == 'BGL2604190001').first()

if t:
    service = KasBankService(db)
    
    # Check MASUK
    masuk = db.query(KasBank).filter(KasBank.nomor_referensi == t.nomor_transaksi, KasBank.tipe == KasBankType.MASUK).first()
    if not masuk:
        print("Creating MASUK...")
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
    
    # Check KELUAR
    keluar = db.query(KasBank).filter(KasBank.nomor_referensi == t.nomor_transaksi, KasBank.tipe == KasBankType.KELUAR).first()
    if not keluar:
        print("Creating KELUAR...")
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
    print("Verification and fix done.")
