from fastapi import APIRouter

from app.api.deps import DBSession, CurrentUser
from app.models.customer import Customer
from app.models.supplier import Supplier
from app.models.bengkel import SparePart, JasaServis
from app.models.keuangan import Aset
from sqlalchemy import func


router = APIRouter(prefix="/master-data", tags=["Master Data"])


@router.get("/stats")
def get_master_data_stats(
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Get simple counts for each master data entity.
    """
    def count_total(model):
        return db.query(func.count(model.id)).scalar() or 0

    return {
        "customers": count_total(Customer),
        "suppliers": count_total(Supplier),
        "spareparts": count_total(SparePart),
        "jasa": count_total(JasaServis),
        "assets": count_total(Aset),
    }
