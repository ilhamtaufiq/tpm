import sys
import os
from datetime import date
from app.database.connection import SessionLocal
from app.services.reports.neraca_service import NeracaService
from app.services.reports.base import BaseReportService

def format_idr(val):
    return f"Rp.{val:,.2f}"

def debug_neraca():
    db = SessionLocal()
    try:
        service = NeracaService(db)
        base_service = BaseReportService(db)
        today = date.today()
        report = service.get_report(today)
        hist = base_service.get_unit_financial_breakdown(date(2024, 1, 1), today)
        
        print("-" * 50)
        print(f"DEBUG NERACA AS OF {today}")
        print("-" * 50)
        
        print(f"ASET LANCAR:")
        print(f"  Kas & Bank         : {format_idr(report['aktiva_lancar']['total_kas_bank'])}")
        print(f"  Piutang            : {format_idr(report['aktiva_lancar']['total_piutang'])}")
        print(f"  Persediaan Mobil   : {format_idr(report['aktiva_lancar']['stok_mobil'])}")
        print(f"  Persediaan Parts   : {format_idr(report['aktiva_lancar']['persediaan_sparepart'])}")
        print(f"TOTAL AKTIVA         : {format_idr(report['total_aktiva'])}")
        
        print("\nPASIVA:")
        print(f"  Total Liabilities  : {format_idr(report['hutang']['total_hutang'])}")
        print(f"  Total Equity       : {format_idr(report['modal']['total_modal'])}")
        print(f"    - Setoran Modal  : {format_idr(report['modal']['setoran_modal'])}")
        print(f"    - Laba Ditahan   : {format_idr(report['modal']['laba_ditahan'])}")
        print(f"    - Prive          : {format_idr(report['modal']['prive'])}")
        
        print(f"\nRECONCILIATION DETAILS:")
        print(f"  Gross Profit (TPM) : {format_idr(hist.get('laba_tpm', 0))}")
        print(f"  Internal Elim      : {format_idr(hist.get('internal_elimination', 0))}")
        print(f"  Total Operasional  : {format_idr(hist.get('operasional', 0))}")
        
        print(f"\nUNIT BREAKDOWN ERROR CHECK:")
        b_ops = hist['units']['bengkel']['total_expenses'] + hist['units']['bengkel']['common_expenses']
        m_ops = hist['units']['mobil']['overhead']
        ja_ops = hist['units']['jasa_angkut']['overhead'] + hist['units']['jasa_angkut']['armada_ops'] + hist['units']['jasa_angkut']['armada_ops_ledger'] + hist['units']['jasa_angkut']['trip_costs']
        ja_rep = hist['units']['jasa_angkut']['repairs']
        
        print(f"  Bengkel Ops Total  : {format_idr(b_ops)}")
        print(f"  Mobil Ops Total    : {format_idr(m_ops)}")
        print(f"  Jasa Angkut Ops    : {format_idr(ja_ops)}")
        print(f"  JA Internal Repair : {format_idr(ja_rep)}")
        print(f"  Calculated Sum     : {format_idr(b_ops + m_ops + ja_ops + ja_rep)}")
        
        print(f"\nTOTAL PASIVA         : {format_idr(report['total_pasiva'])}")
        print("-" * 50)
        print(f"SELISIH (A - P)      : {format_idr(report['selisih'])}")
        print(f"STATUS               : {'BALANCED' if report['is_balanced'] else 'UNBALANCED'}")
        print("-" * 50)

    finally:
        db.close()

if __name__ == "__main__":
    debug_neraca()
