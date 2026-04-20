
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from app.database.connection import SessionLocal
from app.services.reports.modal_service import ModalService
from datetime import date
import json

db = SessionLocal()

service = ModalService(db)
tanggal_dari = date(2026, 4, 1)
tanggal_sampai = date(2026, 4, 30)

r = service.get_report(tanggal_dari, tanggal_sampai)

print("=== RECONCILIATION DATA ===")
print(f"Total A (Penambahan): {r['section_a']['total_a']}")
print(f"Total B (Aset/Piutang): {r['section_b']['total_b']}")
print(f"Total C (Pengurang): {r['section_c']['total_c']}")
print(f"Total E (Hutang/Modal Tambahan): {r['section_e']['total_e']}")
theo = r['section_a']['total_a'] - r['section_b']['total_b'] - r['section_c']['total_c'] + r['section_e']['total_e']
print(f"Theoretical Modal: {theo}")
print(f"Actual Cash/Bank: {r['section_d']['total_d']}")
print(f"Penyesuaian (Selisih): {r['section_d']['penyesuaian']}")

print("\n--- Breakdown Section B ---")
for k, v in r['section_b'].items():
    print(f"  {k}: {v}")

print("\n--- Breakdown Section C ---")
print(f"Prive: {r['section_c']['prive']}")
print(f"Gaji: {r['section_c']['gaji']}")
print(f"HPP Mobil: {r['section_c']['hpp_mobil']['pembelian']}")
print(f"Hutang: {r['section_c']['kasbon_karyawan']}")
print(f"Operasional: {r['section_c']['operasional']}")

print("\n--- Actual Balances ---")
from app.models.keuangan import KasBank
from app.utils.constants import KasBankJenis
for jenis in KasBankJenis:
    last_kb = db.query(KasBank.saldo_sesudah).filter(KasBank.jenis == jenis).order_by(KasBank.id.desc()).first()
    print(f"  {jenis.name}: {float(last_kb[0] if last_kb else 0)}")
