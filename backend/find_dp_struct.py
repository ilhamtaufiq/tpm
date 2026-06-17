import json
from app.database.connection import SessionLocal
from app.models.mobil import TransaksiPenjualanMobil, Mobil
from app.utils.constants import PaymentStatus
from decimal import Decimal

db = SessionLocal()
results = {"transactions": [], "kas_entries": []}
try:
    target_dp = Decimal("3000000")
    txs = db.query(TransaksiPenjualanMobil).join(Mobil).filter(
        TransaksiPenjualanMobil.dp == target_dp,
        TransaksiPenjualanMobil.status_bayar != PaymentStatus.BATAL
    ).all()
    
    for tx in txs:
        results["transactions"].append({
            "id": tx.id,
            "nomor": tx.nomor_transaksi,
            "tanggal": tx.tanggal.isoformat(),
            "mobil": f"{tx.mobil.merek} {tx.mobil.model} ({tx.mobil.nomor_plat})",
            "pembeli": tx.nama_pembeli,
            "harga_jual": float(tx.harga_jual),
            "dp": float(tx.dp)
        })

    from app.models.keuangan import KasBank
    from app.utils.constants import KasBankType, KasBankSource
    
    kas_entries = db.query(KasBank).filter(
        KasBank.nominal == target_dp,
        KasBank.tipe == KasBankType.MASUK,
        KasBank.keterangan.ilike("%DP%")
    ).all()
    
    for entry in kas_entries:
        results["kas_entries"].append({
            "id": entry.id,
            "nomor": entry.nomor_transaksi,
            "tanggal": entry.tanggal.isoformat(),
            "keterangan": entry.keterangan,
            "sumber": str(entry.sumber.value if hasattr(entry.sumber, 'value') else entry.sumber)
        })

    with open("c:/laragon/www/tpm/backend/dp_result.json", "w") as f:
        json.dump(results, f, indent=4)

finally:
    db.close()
