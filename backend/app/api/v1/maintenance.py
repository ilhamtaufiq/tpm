from fastapi import APIRouter, Depends, HTTPException, status
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
