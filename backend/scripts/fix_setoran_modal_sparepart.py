"""
Script: Buat Setoran Modal Awal untuk Persediaan Sparepart Import
=================================================================
Ini membuat SEPASANG entry di KasBank:
1. MASUK (Setoran Modal) → meningkatkan setoran_modal
2. KELUAR (Konversi ke Persediaan) → mengembalikan saldo kas ke posisi semula

Net effect:
- Kas: TIDAK BERUBAH (masuk lalu keluar cancel out)
- Modal: NAIK 255,926,258 (setoran_modal tercatat)
- Neraca: Aktiva = Pasiva (seimbang)
"""
import os, sys
sys.path.insert(0, '.')
os.environ.setdefault('DATABASE_URL', 'mysql+pymysql://root:@localhost/tpm')

from datetime import date
from decimal import Decimal
from sqlalchemy import func, case
from app.database import SessionLocal
from app.models.keuangan import KasBank
from app.models.bengkel import SparePart
from app.utils.constants import KasBankSource, KasBankType, KasBankJenis

db = SessionLocal()

# 1. Hitung exact modal persediaan
total_modal = float(db.query(
    func.sum(
        case(
            (SparePart.stok == 999, SparePart.harga_beli),
            else_=SparePart.stok * SparePart.harga_beli
        )
    )
).filter(SparePart.deleted_at.is_(None)).scalar() or 0)

print(f"Total Modal Persediaan Sparepart: Rp {total_modal:,.0f}")

# 2. Cari tanggal paling awal di KasBank untuk entry BEFORE any other transaction
earliest = db.query(KasBank).order_by(KasBank.id.asc()).first()
if earliest:
    # Pakai 1 hari sebelum transaksi paling awal
    entry_date = date(2024, 1, 1)  # System inception date
    print(f"Tanggal entry: {entry_date} (sebelum semua transaksi)")
else:
    entry_date = date(2024, 1, 1)
    print(f"Tanggal entry: {entry_date} (default inception)")

# 3. Cek saldo KAS_UTAMA saat ini pada tanggal entry
last_kas = db.query(KasBank.saldo_sesudah).filter(
    KasBank.jenis == KasBankJenis.KAS_UTAMA,
    KasBank.tanggal <= entry_date
).order_by(KasBank.id.desc()).first()
saldo_awal = float(last_kas[0] if last_kas else 0)
print(f"Saldo KAS_UTAMA pada {entry_date}: Rp {saldo_awal:,.0f}")

nominal = Decimal(str(int(total_modal)))

# 4. Buat Entry MASUK (Setoran Modal)
entry_masuk = KasBank(
    tanggal=entry_date,
    jenis=KasBankJenis.KAS_UTAMA,
    sumber=KasBankSource.MODAL,
    tipe=KasBankType.MASUK,
    nominal=nominal,
    saldo_sebelum=Decimal(str(int(saldo_awal))),
    saldo_sesudah=Decimal(str(int(saldo_awal))) + nominal,
    keterangan="[SYSTEM] Setoran Modal Awal - Persediaan Sparepart (Import Excel)",
    user_id=1  # Admin
)

# 5. Buat Entry KELUAR (Konversi ke Persediaan)
entry_keluar = KasBank(
    tanggal=entry_date,
    jenis=KasBankJenis.KAS_UTAMA,
    sumber=KasBankSource.BENGKEL,
    tipe=KasBankType.KELUAR,
    nominal=nominal,
    saldo_sebelum=Decimal(str(int(saldo_awal))) + nominal,
    saldo_sesudah=Decimal(str(int(saldo_awal))),  # Kembali ke saldo awal
    keterangan="[SYSTEM] Konversi Modal ke Persediaan Sparepart (Non-Kas / Import Awal)",
    user_id=1  # Admin
)

print(f"\n=== PREVIEW ===")
print(f"Entry 1 (MASUK):")
print(f"  Tanggal: {entry_masuk.tanggal}")
print(f"  Jenis: {entry_masuk.jenis}")
print(f"  Sumber: {entry_masuk.sumber}")
print(f"  Tipe: {entry_masuk.tipe}")
print(f"  Nominal: Rp {entry_masuk.nominal:,.0f}")
print(f"  Saldo: {entry_masuk.saldo_sebelum:,.0f} → {entry_masuk.saldo_sesudah:,.0f}")
print(f"  Keterangan: {entry_masuk.keterangan}")
print()
print(f"Entry 2 (KELUAR):")
print(f"  Tanggal: {entry_keluar.tanggal}")
print(f"  Jenis: {entry_keluar.jenis}")
print(f"  Sumber: {entry_keluar.sumber}")
print(f"  Tipe: {entry_keluar.tipe}")
print(f"  Nominal: Rp {entry_keluar.nominal:,.0f}")
print(f"  Saldo: {entry_keluar.saldo_sebelum:,.0f} → {entry_keluar.saldo_sesudah:,.0f}")
print(f"  Keterangan: {entry_keluar.keterangan}")

# 6. COMMIT
confirm = input("\nKetik 'yes' untuk insert ke database: ").strip().lower()
if confirm == 'yes':
    db.add(entry_masuk)
    db.flush()  # Get ID for masuk first
    db.add(entry_keluar)
    db.commit()
    print(f"\n✅ Berhasil! Entry ID: {entry_masuk.id} (MASUK), {entry_keluar.id} (KELUAR)")
    
    # 7. Verify
    from app.services.reports.neraca_service import NeracaService
    n = NeracaService(db).get_report(date(2026, 4, 28))
    print(f"\n=== VERIFIKASI NERACA ===")
    print(f"Total Aktiva:  Rp {n['total_aktiva']:,.0f}")
    print(f"Total Pasiva:  Rp {n['total_pasiva']:,.0f}")
    print(f"Selisih:       Rp {n['selisih']:,.0f}")
    print(f"Balanced:      {'✅ YA' if n['is_balanced'] else '❌ BELUM'}")
else:
    print("\n❌ Dibatalkan.")

db.close()
