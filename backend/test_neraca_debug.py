import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from datetime import date
from app.database.connection import SessionLocal
from app.services.reports.neraca_service import NeracaService
from app.services.reports.base import BaseReportService

def test():
    db = SessionLocal()
    try:
        as_of = date(2026, 5, 6)
        base = BaseReportService(db)
        hist = base.get_unit_financial_breakdown(date(2024,1,1), as_of)
        
        laba_bengkel = hist["units"]["bengkel"]["laba_kotor"]
        laba_mobil = hist["units"]["mobil"]["total_laba_tpm"]
        internal_elim = float(hist.get("internal_elimination", 0))
        retained = float(hist.get("retained_earnings", 0))
        
        print("P&L:")
        print(f"  Laba Bengkel:    {laba_bengkel:>12,.0f}")
        print(f"  Laba Mobil TPM:  {laba_mobil:>12,.0f}")
        print(f"  Internal Elim:   {internal_elim:>12,.0f}")
        print(f"  Retained:        {retained:>12,.0f}")
        
        res = NeracaService(db).get_report(as_of)
        status = "BALANCED" if abs(res["selisih"]) < 1 else "UNBALANCED"
        print(f"\nNERACA [{status}]:")
        print(f"  Aktiva:        {res['total_aktiva']:>14,.2f}")
        print(f"  Pasiva:        {res['total_pasiva']:>14,.2f}")
        print(f"  Selisih:       {res['selisih']:>14,.2f}")
        print(f"  Modal Non-Kas: {res['modal']['modal_non_kas']:>14,.2f}")
        print(f"  Laba Ditahan:  {res['modal']['laba_ditahan']:>14,.2f}")
    finally:
        db.close()

if __name__ == "__main__":
    test()
