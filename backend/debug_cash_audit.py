import sys
import os
from datetime import date
from app.database.connection import SessionLocal
from app.models.keuangan import KasBank

def debug_cash_flow():
    db = SessionLocal()
    try:
        # 1. Physical Cash Trace
        inflow = db.query(KasBank).filter(KasBank.tipe == 'MASUK').all()
        outflow = db.query(KasBank).filter(KasBank.tipe == 'KELUAR').all()
        
        total_in = sum([k.nominal for k in inflow])
        total_out = sum([k.nominal for k in outflow])
        real_cash = total_in - total_out
        
        print("-" * 50)
        print("REAL CASH FLOW AUDIT (From KasBank Table)")
        print("-" * 50)
        print(f"Total Kas Masuk   : Rp.{total_in:,.2f}")
        print(f"Total Kas Keluar  : Rp.{total_out:,.2f}")
        print(f"Saldo Kas Seharusnya: Rp.{real_cash:,.2f}")
        
        # 2. Check Neraca Reporting
        from app.services.reports.neraca_service import NeracaService
        service = NeracaService(db)
        report = service.get_report(date.today())
        reported_cash = report['aktiva_lancar']['total_kas_bank']
        
        print(f"Saldo Kas Dilapor : Rp.{reported_cash:,.2f}")
        print(f"Selisih Kas       : Rp.{real_cash - reported_cash:,.2f}")
        print("-" * 50)
        
        # 3. Detail Outflow
        print("\nTOP 5 OUTFLOWS TODAY:")
        today_out = [k for k in outflow if k.tanggal == date.today()]
        for k in sorted(today_out, key=lambda x: x.nominal, reverse=True)[:5]:
            print(f"  - {k.nominal:10,.2f} | {k.keterangan}")

    finally:
        db.close()

if __name__ == "__main__":
    debug_cash_flow()
