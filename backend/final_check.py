from app.database.connection import SessionLocal
from app.services.reports.neraca_service import NeracaService
from datetime import date

db = SessionLocal()
report = NeracaService(db).get_report(date.today())

print(f"Total Aktiva: {report['total_aktiva']:,.2f}")
print(f"  Kas & Bank: {report['aktiva_lancar']['total_kas_bank']:,.2f}")
print(f"  Piutang: {report['aktiva_lancar']['total_piutang']:,.2f}")
print(f"  Stok Mobil: {report['aktiva_lancar']['stok_mobil']:,.2f}")

print(f"\nTotal Pasiva: {report['total_pasiva']:,.2f}")
print(f"  Hutang: {report['hutang']['total_hutang']:,.2f}")
print(f"  Modal: {report['modal']['total_modal']:,.2f}")

print(f"\nSelisih: {report['selisih']:,.2f}")

db.close()
