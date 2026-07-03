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
    from app.services.penjualan_mobil_service import PenjualanMobilService

    try:
        cars_affected = PenjualanMobilService(db).reconcile_unsettled_workshop_for_sold_mobils()

        return {
            "success": True,
            "message": f"Reconciled workshop debts for {cars_affected} sold car(s).",
            "cars_affected": cars_affected,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sync failed: {str(e)}"
        )

