import sys
import os
from decimal import Decimal

# Add backend to path
ABSPATH = "C:/laragon/www/tpm/backend"
sys.path.insert(0, ABSPATH)

from app.database.session import SessionLocal
from app.models.bengkel import TransaksiPenjualanBengkel
from app.models.keuangan import KasBank
from app.services.kas_bank_integration import create_kas_entry
from app.utils.constants import PaymentStatus, PaymentMethod, KasBankType, KasBankSource, KasBankJenis

def sync():
    db = SessionLocal()
    try:
        # Find all TUNAI LUNAS workshop transactions
        print("Checking for Tunai + Lunas workshop transactions...")
        trans = db.query(TransaksiPenjualanBengkel).filter(
            TransaksiPenjualanBengkel.status_bayar == PaymentStatus.LUNAS,
            TransaksiPenjualanBengkel.metode_bayar == PaymentMethod.TUNAI
        ).all()
        
        print(f"Found {len(trans)} transactions.")
        
        for t in trans:
            # Check if KasBank record for this transaction already exists for KAS_UNIT_BENGKEL
            exists = db.query(KasBank).filter(
                KasBank.referensi_id == t.id,
                KasBank.sumber == KasBankSource.BENGKEL,
                KasBank.jenis == KasBankJenis.KAS_UNIT_BENGKEL
            ).first()
            
            if not exists:
                print(f"Syncing transaction {t.nomor_transaksi} (Amount: {t.jumlah_bayar})...")
                # Create KasBank MASUK entry
                # We use create_kas_entry which handles balance update
                create_kas_entry(
                    db=db,
                    tanggal=t.tanggal,
                    tipe=KasBankType.MASUK,
                    nominal=t.jumlah_bayar,
                    sumber=KasBankSource.BENGKEL,
                    metode_bayar=PaymentMethod.TUNAI,
                    referensi_id=t.id,
                    nomor_referensi=t.nomor_transaksi,
                    keterangan=f"SYNC: Pembayaran Tunai Bengkel {t.nomor_transaksi}",
                    kas_jenis=KasBankJenis.KAS_UNIT_BENGKEL
                )
                print(f"Successfully synced {t.nomor_transaksi}")
            else:
                print(f"Transaction {t.nomor_transaksi} already has a KasBank record for {exists.jenis.value}.")
                
        db.commit()
        print("Sync complete.")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    sync()
