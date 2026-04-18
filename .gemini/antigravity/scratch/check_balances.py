from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.keuangan import KasBank
from app.utils.constants import KasBankJenis, KasBankType, KasBankSource

# Setup DB
engine = create_engine("mysql+pymysql://root:@localhost/tpm")
Session = sessionmaker(bind=engine)
db = Session()

try:
    print("=== SALDO SAAT INI ===")
    accounts = [
        KasBankJenis.KAS_UTAMA,
        KasBankJenis.KAS_UNIT_BENGKEL,
        KasBankJenis.KAS_UNIT_JASA_ANGKUT,
        KasBankJenis.KAS_UNIT_MOBIL
    ]
    
    for acc in accounts:
        last = db.query(KasBank).filter(KasBank.jenis == acc).order_by(KasBank.id.desc()).first()
        saldo = last.saldo_sesudah if last else 0
        print(f"{acc.value}: {saldo}")

    print("\n=== TRANSAKSI TERAKHIR KAS_UTAMA ===")
    trxs = db.query(KasBank).filter(KasBank.jenis == KasBankJenis.KAS_UTAMA).order_by(KasBank.id.desc()).limit(5).all()
    for t in trxs:
        print(f"{t.tanggal} | {t.tipe} | {t.nominal} | {t.keterangan}")

    print("\n=== TRANSAKSI TERAKHIR JASA ANGKUT ===")
    trxs_ja = db.query(KasBank).filter(KasBank.jenis == KasBankJenis.KAS_UNIT_JASA_ANGKUT).order_by(KasBank.id.desc()).limit(5).all()
    for t in trxs_ja:
        print(f"{t.tanggal} | {t.tipe} | {t.nominal} | {t.keterangan}")

finally:
    db.close()
