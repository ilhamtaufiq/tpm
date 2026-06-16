from typing import List, Dict, Any, Type, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
from fastapi import HTTPException, status
from datetime import datetime

from app.models.bengkel import SparePart, JasaServis
from app.models.customer import Customer
from app.models.mobil import Mobil
from app.models.jasa_angkut import ArmadaJasaAngkut, Supir
from app.models.karyawan import Karyawan
from app.models.supplier import Supplier

class TrashService:
    def __init__(self, db: Session):
        self.db = db

    MODELS = {
        "sparepart": SparePart,
        "customer": Customer,
        "mobil": Mobil,
        "armada": ArmadaJasaAngkut,
        "supir": Supir,
        "jasa_servis": JasaServis,
        "karyawan": Karyawan,
        "supplier": Supplier,
    }

    def get_deleted_items(self, category: str) -> List[Dict[str, Any]]:
        category_key = category.lower()
        model = self.MODELS.get(category_key)
        if not model:
            raise HTTPException(status_code=400, detail=f"Invalid category: {category}")
        
        items = (
            self.db.query(model)
            .filter(model.deleted_at.is_not(None))
            .order_by(desc(model.deleted_at))
            .all()
        )
        
        # Convert to dict for API
        result = []
        for item in items:
            # Determine display name based on model
            nama = "-"
            if hasattr(item, "nama"):
                nama = item.nama
            elif hasattr(item, "nomor_plat"):
                nama = item.nomor_plat
            elif hasattr(item, "nopol"):
                nama = item.nopol
            
            # Additional context for mobil
            if category_key == "mobil" and hasattr(item, "merek"):
                nama = f"{item.nomor_plat} ({item.merek} {getattr(item, 'model', '')})"

            item_dict = {
                "id": item.id,
                "deleted_at": item.deleted_at,
                "nama": nama,
                "kode": getattr(item, "kode", getattr(item, "kode_part", "-")),
            }
            result.append(item_dict)
        return result

    def restore_item(self, category: str, item_id: int) -> bool:
        model = self.MODELS.get(category.lower())
        if not model:
            raise HTTPException(status_code=400, detail="Invalid category")
            
        item = self.db.query(model).filter(model.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
            
        item.deleted_at = None
        self.db.commit()
        return True

    def permanent_delete(self, category: str, item_id: int) -> bool:
        model = self.MODELS.get(category.lower())
        if not model:
            raise HTTPException(status_code=400, detail="Invalid category")
            
        item = self.db.query(model).filter(model.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
            
        self.db.delete(item)
        self.db.commit()
        return True

    def clear_category(self, category: str) -> bool:
        """Permanently delete all soft-deleted items in a category."""
        model = self.MODELS.get(category.lower())
        if not model:
            raise HTTPException(status_code=400, detail="Invalid category")
            
        (
            self.db.query(model)
            .filter(model.deleted_at.is_not(None))
            .delete(synchronize_session=False)
        )
        self.db.commit()
        return True
