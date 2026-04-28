from app.database.connection import SessionLocal
from app.services.reports.neraca_service import NeracaService
from datetime import date

def check_report():
    db = SessionLocal()
    try:
        service = NeracaService(db)
        as_of_date = date.today()
        
        res = service.get_report(as_of_date)
        
        assets = res["total_aktiva"]
        liabilities = res["hutang"]["total_hutang"]
        equity_components = res["modal"]["modal_komponen"]
        equity_identity = res["modal"]["equity_identity"]
        
        print("=== BREAKDOWN NERACA ===")
        print(f"Total Aktiva       : {assets:,.2f}")
        print(f"Total Hutang       : {liabilities:,.2f}")
        print(f"Modal Komponen     : {equity_components:,.2f}")
        print(f"Modal Identity     : {equity_identity:,.2f}")
        print(f"Selisih Komponen   : {equity_components - equity_identity:,.2f}")
        print(f"Selisih Laporan    : {res['selisih']:,.2f}")
        
        # Detail assets
        print("\n=== DETAIL ASET ===")
        print(f"Kas Tunai          : {res['aktiva_lancar']['kas_tunai']:,.2f}")
        print(f"Kas Bank           : {res['aktiva_lancar']['kas_bank']:,.2f}")
        print(f"Total Piutang      : {res['aktiva_lancar']['total_piutang']:,.2f}")
        print(f"Stok Sparepart     : {res['aktiva_lancar']['persediaan_sparepart']:,.2f}")
        print(f"Stok Mobil         : {res['aktiva_lancar']['stok_mobil']:,.2f}")
        print(f"Aset Tetap         : {res['aktiva_tetap']['total_aktiva_tetap']:,.2f}")
        
        print("\n=== DETAIL MODAL ===")
        print(f"Setoran Modal Kas  : {res['modal']['setoran_modal_kas']:,.2f}")
        print(f"Setoran Modal Non  : {res['modal']['modal_non_kas']:,.2f}")
        print(f"Laba Ditahan       : {res['modal']['laba_ditahan']:,.2f}")
        print(f"Prive              : {res['modal']['prive']:,.2f}")
    finally:
        db.close()

if __name__ == "__main__":
    check_report()
