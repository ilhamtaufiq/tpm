import sys
import os
from datetime import datetime, date



from app.db.session import SessionLocal
from app.services.reports.modal_service import ModalService

def check_report():
    db = SessionLocal()
    try:
        service = ModalService(db)
        # Use current month
        start_date = date.today().replace(day=1)
        end_date = date.today()
        
        res = service.get_report(start_date, end_date)
        
        akhir = res["modal_akhir"]
        info = res.get("info", {})
        aset = info.get("aset", {})
        hutang = info.get("hutang", {})
        
        # Calculate aktual exactly as the code does
        aktual = (
            aset.get("kas_bank", 0) + 
            aset.get("stok_part", 0) + 
            aset.get("stok_mobil", 0) + 
            aset.get("aset_tetap", 0) + 
            aset.get("piutang", 0)
        ) - (
            hutang.get("part", 0) + 
            hutang.get("mobil", 0) + 
            hutang.get("ja", 0) + 
            hutang.get("investor", 0) + 
            hutang.get("lainnya", 0)
        )
        
        print("=== BREAKDOWN ===")
        print(f"Modal Teoritis Akhir : {akhir:,.2f}")
        print(f"Modal Aktual Neraca  : {aktual:,.2f}")
        print(f"Selisih              : {akhir - aktual:,.2f}")
        print("-----------------")
        print("Penambahan:")
        for k, v in res["penambahan"].items():
            if isinstance(v, dict):
                print(f"  {k}: {v.get('total', 0):,.2f}")
            else:
                print(f"  {k}: {v:,.2f}")
                
        print("Pengurangan:")
        for k, v in res["pengurangan"].items():
            if isinstance(v, dict):
                print(f"  {k}: {v.get('total', 0):,.2f}")
            else:
                print(f"  {k}: {v:,.2f}")
                
        print("Aset:")
        for k, v in aset.items():
            print(f"  {k}: {v:,.2f}")
            
        print("Hutang:")
        for k, v in hutang.items():
            print(f"  {k}: {v:,.2f}")
            
    finally:
        db.close()

if __name__ == "__main__":
    check_report()
