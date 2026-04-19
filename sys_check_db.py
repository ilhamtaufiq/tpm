import sys
sys.path.append('c:\\laragon\\www\\tpm\\backend')
from app.database import SessionLocal
from app.api.v1.dashboard import get_capital_report
from app.models.user import User
import datetime

db = SessionLocal()
mock_user = User(id=1, role="ADMIN")
try:
    report = get_capital_report(
        tanggal_dari=datetime.date(2026, 4, 1),
        tanggal_sampai=datetime.date(2026, 4, 30),
        db=db,
        current_user=mock_user
    )
    print("A:", report["section_a"]["total_a"])
    print("B:", report["section_b"]["total_b"])
    print("C:", report["section_c"]["total_c"])
    print("E:", report["section_e"]["total_e"])
    print("Theo:", report["section_d"]["theoretical_modal"])
    print("Cash:", report["section_d"]["cash"])
    print("Selisih:", report["section_d"]["penyesuaian"])
finally:
    db.close()
