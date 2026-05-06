import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from datetime import date
from app.database.connection import SessionLocal
from app.services.reports.base import BaseReportService
from app.services.reports.neraca_service import NeracaService
from sqlalchemy import func
from app.models.mobil import Mobil, TransaksiPenjualanMobil
from app.models.bengkel import TransaksiPenjualanBengkel, PengeluaranBengkel
from app.utils.constants import CarStatus, PaymentStatus

def test():
    db = SessionLocal()
    try:
        as_of = date(2026, 5, 6)
        
        # Check sold cars
        sold = db.query(Mobil).filter(Mobil.status == CarStatus.TERJUAL).all()
        print("SOLD CARS:")
        for m in sold:
            print(f"  {m.kode} | harga_beli={m.harga_beli} | total_modal={m.total_modal} | total_part_service={m.total_part_service}")
        
        # Check akumulasi_hpp_mobil
        akumulasi_hpp_mobil = float(db.query(func.sum(Mobil.harga_beli)).filter(
            Mobil.status == CarStatus.TERJUAL, Mobil.tanggal_terjual <= as_of
        ).scalar() or 0)
        print(f"\nakumulasi_hpp_mobil (harga_beli only): {akumulasi_hpp_mobil:,.0f}")
        
        # Check akumulasi_hpp_mobil_prep (PengeluaranBengkel for sold cars)
        akumulasi_hpp_mobil_prep = float(db.query(func.sum(PengeluaranBengkel.jumlah)).join(Mobil).filter(
            PengeluaranBengkel.bisnis_kategori.in_(["mobil", "jual_beli_mobil", "penjualan_mobil"]),
            Mobil.status == CarStatus.TERJUAL, Mobil.tanggal_terjual <= as_of
        ).scalar() or 0)
        print(f"akumulasi_hpp_mobil_prep (PengeluaranBengkel): {akumulasi_hpp_mobil_prep:,.0f}")
        
        # MISSING: Internal workshop bills for SOLD cars (TransaksiPenjualanBengkel)
        akumulasi_hpp_mobil_internal = float(db.query(func.sum(TransaksiPenjualanBengkel.grand_total)).join(
            Mobil, TransaksiPenjualanBengkel.mobil_id == Mobil.id
        ).filter(
            TransaksiPenjualanBengkel.kategori.in_(['jual_beli_mobil', 'mobil', 'penjualan_mobil']),
            TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL,
            Mobil.status == CarStatus.TERJUAL,
            Mobil.tanggal_terjual <= as_of
        ).scalar() or 0)
        print(f"akumulasi_hpp_mobil_internal (TransaksiBengkel): {akumulasi_hpp_mobil_internal:,.0f}")
        print(f"  → This is MISSING from total_non_kas_assets_historis!")
        
        # Current neraca
        res = NeracaService(db).get_report(as_of)
        print(f"\nNERACA:")
        print(f"  Aktiva:  {res['total_aktiva']:>12,.2f}")
        print(f"  Pasiva:  {res['total_pasiva']:>12,.2f}")
        print(f"  Selisih: {res['selisih']:>12,.2f}")
        print(f"  Modal Non-Kas: {res['modal']['modal_non_kas']:>12,.2f}")
        print(f"  Laba Ditahan:  {res['modal']['laba_ditahan']:>12,.2f}")
    finally:
        db.close()

if __name__ == "__main__":
    test()
