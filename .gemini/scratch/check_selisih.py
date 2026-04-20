from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.services.reports.base import BaseReportService
from datetime import date
import json

engine = create_engine("mysql+pymysql://root:@localhost/tpm")
Session = sessionmaker(bind=engine)
db = Session()

service = BaseReportService(db)
tanggal_dari = date(2026, 4, 1)
tanggal_sampai = date(2026, 4, 30)

data = service.get_unit_financial_breakdown(tanggal_dari, tanggal_sampai)

print(f"Bengkel Internal Revenue: {data['raw_summaries']['bengkel'].get('total_internal', 0)}")
print(f"Bengkel Total HPP: {data['units']['bengkel']['total_hpp']}")
print(f"Mobil Internal Repair Cost: {data['units']['mobil']['repairs_total']}")
print(f"Mobil Prep Ledger: {data['units']['mobil']['prep_total']}")
