from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, Any

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models.customer import Customer, CustomerVehicle
from app.models.keuangan import PiutangUsaha
from app.schemas.master import CustomerCreate, CustomerUpdate
from app.realtime import publish_realtime_event
from app.utils.constants import PiutangStatus


class CustomerService:
    """Service for customer management."""

    def __init__(self, db: Session):
        self.db = db

    def _emit_change(self, action: str, customer: Optional[Customer] = None, customer_id: Optional[int] = None) -> None:
        entity_id = customer.id if customer else customer_id
        publish_realtime_event(
            event=f"master.customers.{action}",
            scope="master",
            entity="customers",
            action=action,
            entity_id=entity_id,
            data={"kode": getattr(customer, "kode", None), "nama": getattr(customer, "nama", None)},
        )

    def _generate_kode(self) -> str:
        """Generate unique customer code."""
        today = datetime.now()
        prefix = "CUS"
        date_str = today.strftime("%y%m")

        # Get last customer with same prefix
        last = (
            self.db.query(Customer)
            .filter(Customer.kode.like(f"{prefix}{date_str}%"))
            .order_by(Customer.id.desc())
            .first()
        )

        if last:
            last_num = int(last.kode[-4:])
            new_num = last_num + 1
        else:
            new_num = 1

        return f"{prefix}{date_str}{new_num:04d}"

    def create(self, data: CustomerCreate, user_id: Optional[int] = None) -> Customer:
        """Create a new customer."""
        # Generate kode if not provided
        kode = data.kode if data.kode else self._generate_kode()

        # Check duplicate kode
        existing_kode = (
            self.db.query(Customer)
            .filter(Customer.kode == kode)
            .first()
        )
        if existing_kode:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Kode customer '{kode}' sudah digunakan",
            )

        customer = Customer(
            kode=kode,
            nama=data.nama,
            tipe=data.tipe,
            alamat=data.alamat,
            kota=data.kota,
            telepon=data.telepon,
            email=data.email,
            npwp=data.npwp,
            catatan=data.catatan,
        )

        self.db.add(customer)
        self.db.flush() # Get ID without committing

        # Add vehicles if provided
        if data.vehicles:
            for v_data in data.vehicles:
                vehicle = CustomerVehicle(
                    customer_id=customer.id,
                    plat_nomor=v_data.plat_nomor,
                    jenis_unit=v_data.jenis_unit,
                    catatan=v_data.catatan,
                )
                self.db.add(vehicle)

        self.db.commit()
        self.db.refresh(customer)
        self._emit_change("created", customer)

        return customer

    def get_by_id(self, customer_id: int) -> Customer:
        """Get customer by ID."""
        customer = (
            self.db.query(Customer)
            .options(joinedload(Customer.vehicles))
            .filter(
                Customer.id == customer_id,
                Customer.deleted_at.is_(None),
            )
            .first()
        )
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer tidak ditemukan",
            )
        return customer

    def get_by_kode(self, kode: str) -> Optional[Customer]:
        """Get customer by kode."""
        return (
            self.db.query(Customer)
            .filter(
                Customer.kode == kode,
                Customer.deleted_at.is_(None),
            )
            .first()
        )

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        tipe: Optional[str] = None,
        kota: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """Get list of customers with pagination and filters."""
        query = self.db.query(Customer).options(joinedload(Customer.vehicles)).filter(Customer.deleted_at.is_(None))

        # Search filter
        if search:
            search_filter = f"%{search}%"
            query = query.outerjoin(Customer.vehicles).filter(
                or_(
                    Customer.nama.ilike(search_filter),
                    Customer.kode.ilike(search_filter),
                    Customer.telepon.ilike(search_filter),
                    Customer.email.ilike(search_filter),
                    CustomerVehicle.plat_nomor.ilike(search_filter),
                )
            ).distinct()

        # Type filter
        if tipe:
            query = query.filter(Customer.tipe == tipe)

        # City filter
        if kota:
            query = query.filter(Customer.kota == kota)

        # Count total
        total = query.count()

        # Sorting
        sort_column = getattr(Customer, sort_by, Customer.created_at)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Pagination
        customers = query.offset(skip).limit(limit).all()

        # Calculate pages
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "data": customers,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": pages,
        }

    def update(self, customer_id: int, data: CustomerUpdate) -> Customer:
        """Update customer."""
        customer = self.get_by_id(customer_id)

        update_data = data.model_dump(exclude_unset=True)

        # Handle vehicles separately
        vehicles_data = update_data.pop("vehicles", None)

        for field, value in update_data.items():
            setattr(customer, field, value)

        if vehicles_data is not None:
            # Simple approach: clear and re-add
            # For better performance, we could sync them (compare IDs)
            self.db.query(CustomerVehicle).filter(CustomerVehicle.customer_id == customer.id).delete()
            for v_data in vehicles_data:
                vehicle = CustomerVehicle(
                    customer_id=customer.id,
                    plat_nomor=v_data["plat_nomor"],
                    jenis_unit=v_data["jenis_unit"],
                    catatan=v_data.get("catatan"),
                )
                self.db.add(vehicle)

        self.db.commit()
        self.db.refresh(customer)
        self._emit_change("updated", customer)

        return customer

    def delete(self, customer_id: int) -> bool:
        """Soft delete customer."""
        customer = self.get_by_id(customer_id)

        # Check if has related transactions
        if customer.transaksi_bengkel.count() > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menghapus customer yang memiliki riwayat transaksi bengkel",
            )

        if customer.transaksi_mobil.count() > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menghapus customer yang memiliki riwayat transaksi mobil",
            )

        # Check for active piutang
        active_piutang = customer.piutang.filter(
            PiutangUsaha.status != PiutangStatus.LUNAS
        ).count()
        if active_piutang > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menghapus customer yang memiliki piutang aktif",
            )

        customer.deleted_at = datetime.now()
        self.db.commit()
        self._emit_change("deleted", customer)

        return True

    def search(self, query: Optional[str], limit: int = 10) -> list[Customer]:
        """Search customers for autocomplete."""
        db_query = self.db.query(Customer).options(joinedload(Customer.vehicles)).filter(Customer.deleted_at.is_(None))

        if query:
            search_filter = f"%{query}%"
            db_query = db_query.outerjoin(Customer.vehicles).filter(
                or_(
                    Customer.nama.ilike(search_filter),
                    Customer.kode.ilike(search_filter),
                    Customer.telepon.ilike(search_filter),
                    CustomerVehicle.plat_nomor.ilike(search_filter),
                )
            ).distinct()
        else:
            # If no query, return latest customers
            db_query = db_query.order_by(Customer.id.desc())

        return db_query.limit(limit).all()

    def get_summary(self, customer_id: int) -> Dict[str, Any]:
        """Get customer summary with transaction history."""
        customer = self.get_by_id(customer_id)

        # Count transactions
        total_transaksi_bengkel = customer.transaksi_bengkel.count()
        total_transaksi_mobil = customer.transaksi_mobil.count()

        # Calculate piutang
        piutang_query = customer.piutang.filter(
            PiutangUsaha.status != PiutangStatus.LUNAS
        )
        total_piutang = sum(p.nominal_piutang for p in piutang_query.all())
        sisa_piutang = sum(p.sisa_piutang for p in piutang_query.all())

        return {
            "customer": customer,
            "total_transaksi_bengkel": total_transaksi_bengkel,
            "total_transaksi_mobil": total_transaksi_mobil,
            "total_piutang": float(total_piutang),
            "sisa_piutang": float(sisa_piutang),
        }

    def get_piutang(self, customer_id: int) -> Dict[str, Any]:
        """Get customer piutang details."""
        customer = self.get_by_id(customer_id)

        active_piutang = customer.piutang.filter(
            PiutangUsaha.status != PiutangStatus.LUNAS
        ).all()

        total_nominal = sum(p.nominal_piutang for p in active_piutang)
        total_dibayar = sum(p.total_dibayar for p in active_piutang)
        total_sisa = sum(p.sisa_piutang for p in active_piutang)

        return {
            "customer_id": customer_id,
            "customer_nama": customer.nama,
            "total_piutang": float(total_nominal),
            "total_dibayar": float(total_dibayar),
            "total_sisa": float(total_sisa),
            "jumlah_piutang_aktif": len(active_piutang),
            "piutang": active_piutang,
        }

    def get_transaction_history(
        self,
        customer_id: int,
        source: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """Get customer transaction history."""
        customer = self.get_by_id(customer_id)

        result = {
            "customer_id": customer_id,
            "customer_nama": customer.nama,
            "transaksi_bengkel": [],
            "transaksi_mobil": [],
        }

        if source is None or source == "bengkel":
            result["transaksi_bengkel"] = (
                customer.transaksi_bengkel
                .order_by(customer.transaksi_bengkel.property.mapper.class_.tanggal.desc())
                .offset(skip)
                .limit(limit)
                .all()
            )

        if source is None or source == "mobil":
            result["transaksi_mobil"] = (
                customer.transaksi_mobil
                .order_by(customer.transaksi_mobil.property.mapper.class_.tanggal.desc())
                .offset(skip)
                .limit(limit)
                .all()
            )

        return result

    def get_cities(self) -> list[str]:
        """Get distinct cities from customers."""
        cities = (
            self.db.query(Customer.kota)
            .filter(
                Customer.deleted_at.is_(None),
                Customer.kota.isnot(None),
            )
            .distinct()
            .all()
        )
        return [c[0] for c in cities if c[0]]
