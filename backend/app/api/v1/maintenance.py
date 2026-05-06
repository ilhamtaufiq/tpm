from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import DBSession, ManagerUser
from app.services.maintenance_service import MaintenanceService

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])


@router.post("/reset-transactions")
def reset_transactions(
    db: DBSession,
    current_user: ManagerUser,
):
    """Reset all transaction data. Restricted to Manager users."""
    try:
        service = MaintenanceService(db)
        result = service.reset_transactions()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during reset: {str(e)}"
        )


@router.post("/sync-bengkel-settlements")
def sync_bengkel_settlements(
    db: DBSession,
    current_user: ManagerUser,
):
    """
    Settle all BELUM_LUNAS workshop transactions for cars already marked as TERJUAL.
    Run this once to fix historical data where pelunasan happened before the auto-settle fix.
    """
    from app.models.mobil import Mobil
    from app.models.bengkel import TransaksiPenjualanBengkel
    from app.models.keuangan import PiutangUsaha
    from app.utils.constants import (
        CarStatus, PaymentStatus, PiutangStatus, WorkshopStatus
    )
    from datetime import date

    try:
        # Find sold cars with unsettled workshop transactions
        sold_cars = db.query(Mobil).filter(Mobil.status == CarStatus.TERJUAL).all()
        settled_count = 0
        car_count = 0

        for mobil in sold_cars:
            # Update all unsettled bengkel transactions for this car
            updated = db.query(TransaksiPenjualanBengkel).filter(
                TransaksiPenjualanBengkel.mobil_id == mobil.id,
                TransaksiPenjualanBengkel.status_bayar != PaymentStatus.LUNAS
            ).update({
                "status_bayar": PaymentStatus.LUNAS,
                "jumlah_bayar": TransaksiPenjualanBengkel.grand_total,
                "status_pengerjaan": WorkshopStatus.SELESAI
            }, synchronize_session='fetch')

            if updated > 0:
                car_count += 1
                settled_count += updated

            # Also settle any unsettled Piutang linked to this car's workshop transactions
            workshop_nos = [
                t.nomor_transaksi for t in db.query(TransaksiPenjualanBengkel).filter(
                    TransaksiPenjualanBengkel.mobil_id == mobil.id
                ).all()
            ]
            if workshop_nos:
                piutangs = db.query(PiutangUsaha).filter(
                    PiutangUsaha.nomor_referensi.in_(workshop_nos),
                    PiutangUsaha.status != PiutangStatus.LUNAS
                ).all()
                for p in piutangs:
                    p.status = PiutangStatus.LUNAS
                    p.total_dibayar = p.nominal_piutang
                    p.sisa_piutang = 0
                    p.tanggal_lunas = mobil.tanggal_terjual or date.today()
                    p.catatan = (p.catatan or "") + " | Settled via maintenance sync"

        db.commit()
        return {
            "success": True,
            "message": f"Settled {settled_count} workshop transaction(s) across {car_count} sold car(s).",
            "settled_transactions": settled_count,
            "cars_affected": car_count,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sync failed: {str(e)}"
        )

