from app.database.connection import SessionLocal
from app.models.mobil import TransaksiPenjualanMobil, Mobil
from app.utils.constants import PaymentStatus
from decimal import Decimal

db = SessionLocal()
try:
    target_dp = Decimal("3000000")
    txs = db.query(TransaksiPenjualanMobil).join(Mobil).filter(
        TransaksiPenjualanMobil.dp == target_dp,
        TransaksiPenjualanMobil.status_bayar != PaymentStatus.BATAL
    ).all()
    
    print(f"Found {len(txs)} transactions with DP {target_dp}:")
    for tx in txs:
        print(f"ID: {tx.id}")
        print(f"Nomor: {tx.nomor_transaksi}")
        print(f"Tanggal: {tx.tanggal}")
        print(f"Mobil: {tx.mobil.merek} {tx.mobil.model} ({tx.mobil.nomor_plat})")
        print(f"Pembeli: {tx.nama_pembeli}")
        print(f"Harga Jual: {tx.harga_jual}")
        print(f"DP: {tx.dp}")
        print("-" * 20)

    # Also check if it's a generic income with "DP" in description
    from app.models.keuangan import KasBank
    from app.utils.constants import KasBankType, KasBankSource
    
    kas_entries = db.query(KasBank).filter(
        KasBank.nominal == target_dp,
        KasBank.tipe == KasBankType.MASUK,
        KasBank.keterangan.ilike("%DP%")
    ).all()
    
    print(f"\nFound {len(kas_entries)} KasBank entries with nominal {target_dp} and 'DP' in description:")
    for entry in kas_entries:
        print(f"ID: {entry.id}")
        print(f"Nomor: {entry.nomor_transaksi}")
        print(f"Tanggal: {entry.tanggal}")
        print(f"Keterangan: {entry.keterangan}")
        print(f"Sumber: {entry.sumber}")
        print("-" * 20)

finally:
    db.close()
