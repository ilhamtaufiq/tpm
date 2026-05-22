from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models.bengkel import (
    PembelianSparePart,
    DetailPembelianSparePart,
    SparePart,
)
from app.models.supplier import Supplier
from app.schemas.bengkel import PembelianSparePartCreate
from app.utils.constants import (
    PaymentStatus,
    PaymentMethod,
    TRANSACTION_PREFIXES,
    KasBankType,
    KasBankSource,
    HutangSource,
    HutangStatus,
)
from app.models.keuangan import HutangUsaha, KasBank
from app.services.kas_bank_integration import create_kas_entry


class PembelianPartService:
    """Service for spare part purchase transactions."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_nomor_transaksi(self) -> str:
        """Generate unique purchase transaction number."""
        today = datetime.now()
        prefix = TRANSACTION_PREFIXES["pembelian"]
        date_str = today.strftime("%y%m%d")

        last = (
            self.db.query(PembelianSparePart)
            .filter(PembelianSparePart.nomor_transaksi.like(f"{prefix}{date_str}%"))
            .order_by(PembelianSparePart.id.desc())
            .first()
        )

        if last:
            last_num = int(last.nomor_transaksi[-4:])
            new_num = last_num + 1
        else:
            new_num = 1

        return f"{prefix}{date_str}{new_num:04d}"

    def _generate_nomor_hutang(self) -> str:
        """Generate unique hutang transaction number."""
        today = datetime.now()
        prefix = TRANSACTION_PREFIXES["hutang"]
        date_str = today.strftime("%y%m%d")

        last = (
            self.db.query(HutangUsaha)
            .filter(HutangUsaha.nomor_hutang.like(f"{prefix}{date_str}%"))
            .order_by(HutangUsaha.id.desc())
            .first()
        )

        if last:
            last_num = int(last.nomor_hutang[-4:])
            new_num = last_num + 1
        else:
            new_num = 1

        return f"{prefix}{date_str}{new_num:04d}"

    def _validate_supplier(self, supplier_id: int) -> Supplier:
        """Validate supplier exists and is active."""
        supplier = (
            self.db.query(Supplier)
            .filter(
                Supplier.id == supplier_id,
                Supplier.deleted_at.is_(None),
            )
            .first()
        )
        if not supplier:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Supplier tidak ditemukan",
            )
        return supplier

    def _validate_spare_parts(
        self, detail_items: List[Dict[str, Any]]
    ) -> Dict[int, SparePart]:
        """Validate all spare parts exist."""
        spare_part_ids = [item.spare_part_id for item in detail_items]

        spare_parts = (
            self.db.query(SparePart)
            .filter(
                SparePart.id.in_(spare_part_ids),
                SparePart.deleted_at.is_(None),
            )
            .all()
        )

        found_ids = {sp.id for sp in spare_parts}
        missing_ids = set(spare_part_ids) - found_ids

        if missing_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Spare part dengan ID {missing_ids} tidak ditemukan",
            )

        return {sp.id: sp for sp in spare_parts}

    def _attach_payment_info(self, pembelian: PembelianSparePart) -> PembelianSparePart:
        kas_entries = (
            self.db.query(KasBank)
            .filter(
                KasBank.referensi_id == pembelian.id,
                KasBank.sumber == KasBankSource.PEMBELIAN_PART,
                KasBank.tipe == KasBankType.KELUAR,
            )
            .order_by(KasBank.id.asc())
            .all()
        )
        hutang = (
            self.db.query(HutangUsaha)
            .filter(
                HutangUsaha.sumber == HutangSource.PEMBELIAN_PART,
                HutangUsaha.referensi_id == pembelian.id,
            )
            .first()
        )

        pembelian.payments = [
            {
                "metode": entry.metode_bayar,
                "jumlah": entry.nominal,
                "kas_jenis": entry.jenis,
                "catatan": entry.catatan,
            }
            for entry in kas_entries
        ]
        pembelian.jumlah_bayar = sum((entry.nominal for entry in kas_entries), Decimal("0"))

        if hutang:
            pembelian.jumlah_bayar += hutang.total_dibayar
        elif pembelian.status_bayar == PaymentStatus.LUNAS and pembelian.jumlah_bayar == 0:
            pembelian.jumlah_bayar = pembelian.grand_total

        return pembelian

    def _apply_purchase_mutations(
        self,
        pembelian: PembelianSparePart,
        data: PembelianSparePartCreate,
        spare_parts_map: Dict[int, SparePart],
        user_id: Optional[int] = None,
    ) -> None:
        total = Decimal("0")
        detail_records = []

        for item in data.detail:
            subtotal = item.harga_satuan * item.qty
            total += subtotal
            detail_records.append(
                DetailPembelianSparePart(
                    spare_part_id=item.spare_part_id,
                    qty=item.qty,
                    harga_satuan=item.harga_satuan,
                    subtotal=subtotal,
                )
            )

        grand_total = total - data.diskon
        pay_now_methods = [
            PaymentMethod.TUNAI,
            PaymentMethod.TRANSFER,
            PaymentMethod.DEBIT,
            PaymentMethod.SPLIT,
            PaymentMethod.OTHER,
        ]
        is_pay_now = data.metode_bayar in pay_now_methods

        total_paid = Decimal("0")
        if is_pay_now:
            total_paid = sum((pm.jumlah for pm in data.payments), Decimal("0")) if data.payments else grand_total

        if is_pay_now and total_paid >= grand_total:
            status_bayar = PaymentStatus.LUNAS
        else:
            status_bayar = PaymentStatus.BELUM_LUNAS

        pembelian.tanggal = data.tanggal
        pembelian.supplier_id = data.supplier_id
        pembelian.nomor_faktur = data.nomor_faktur
        pembelian.total = total
        pembelian.diskon = data.diskon
        pembelian.grand_total = grand_total
        pembelian.status_bayar = status_bayar
        pembelian.metode_bayar = data.metode_bayar
        pembelian.tanggal_bayar = data.tanggal if status_bayar == PaymentStatus.LUNAS else None
        pembelian.catatan = data.catatan
        pembelian.detail = detail_records

        self.db.flush()

        for item in data.detail:
            spare_part = spare_parts_map[item.spare_part_id]
            if spare_part.stok != 999:
                spare_part.stok += item.qty
            spare_part.harga_beli = item.harga_satuan

        if total_paid > 0:
            if data.payments:
                for pm in data.payments:
                    create_kas_entry(
                        db=self.db,
                        tanggal=data.tanggal,
                        tipe=KasBankType.KELUAR,
                        nominal=pm.jumlah,
                        sumber=KasBankSource.PEMBELIAN_PART,
                        metode_bayar=pm.metode,
                        referensi_id=pembelian.id,
                        nomor_referensi=pembelian.nomor_transaksi,
                        keterangan=f"Pembelian spare part - {pembelian.nomor_transaksi} ({pm.metode})",
                        user_id=user_id,
                        kas_jenis=pm.kas_jenis,
                        allow_negative=True,
                    )
            else:
                create_kas_entry(
                    db=self.db,
                    tanggal=data.tanggal,
                    tipe=KasBankType.KELUAR,
                    nominal=total_paid,
                    sumber=KasBankSource.PEMBELIAN_PART,
                    metode_bayar=data.metode_bayar or PaymentMethod.TUNAI,
                    referensi_id=pembelian.id,
                    nomor_referensi=pembelian.nomor_transaksi,
                    keterangan=f"Pembelian spare part - {pembelian.nomor_transaksi}",
                    user_id=user_id,
                    kas_jenis=data.kas_jenis,
                    allow_negative=True,
                )

        if total_paid < grand_total:
            sisa_hutang = grand_total - total_paid
            supplier = self.db.query(Supplier).get(data.supplier_id)
            hutang = HutangUsaha(
                nomor_hutang=self._generate_nomor_hutang(),
                tanggal=data.tanggal,
                supplier_id=data.supplier_id,
                nama_kreditur=supplier.nama if supplier else "Supplier Umum",
                telepon_kreditur=supplier.telepon if supplier else None,
                alamat_kreditur=supplier.alamat if supplier else None,
                sumber=HutangSource.PEMBELIAN_PART,
                unit=KasBankSource.BENGKEL,
                referensi_id=pembelian.id,
                nomor_referensi=pembelian.nomor_transaksi,
                nominal_hutang=sisa_hutang,
                sisa_hutang=sisa_hutang,
                status=HutangStatus.BELUM_LUNAS,
                catatan=f"Hutang sisa pembelian spare part - {pembelian.nomor_transaksi}",
                created_by=user_id,
            )
            self.db.add(hutang)

    def create(
        self,
        data: PembelianSparePartCreate,
        user_id: Optional[int] = None,
    ) -> PembelianSparePart:
        """Create a new spare part purchase transaction."""
        self._validate_supplier(data.supplier_id)
        spare_parts_map = self._validate_spare_parts(data.detail)

        pembelian = PembelianSparePart(
            nomor_transaksi=self._generate_nomor_transaksi(),
            created_by=user_id,
        )

        self.db.add(pembelian)

        self._apply_purchase_mutations(pembelian, data, spare_parts_map, user_id)

        self.db.commit()
        self.db.refresh(pembelian)

        return self._attach_payment_info(pembelian)

    def get_by_id(self, pembelian_id: int) -> PembelianSparePart:
        """Get purchase by ID with details."""
        pembelian = (
            self.db.query(PembelianSparePart)
            .options(
                joinedload(PembelianSparePart.supplier),
                joinedload(PembelianSparePart.detail).joinedload(
                    DetailPembelianSparePart.spare_part
                ),
            )
            .filter(PembelianSparePart.id == pembelian_id)
            .first()
        )
        if not pembelian:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaksi pembelian tidak ditemukan",
            )
        return self._attach_payment_info(pembelian)

    def get_by_nomor(self, nomor_transaksi: str) -> Optional[PembelianSparePart]:
        """Get purchase by transaction number."""
        return (
            self.db.query(PembelianSparePart)
            .options(
                joinedload(PembelianSparePart.supplier),
                joinedload(PembelianSparePart.detail),
            )
            .filter(PembelianSparePart.nomor_transaksi == nomor_transaksi)
            .first()
        )

    def update(
        self,
        pembelian_id: int,
        data: PembelianSparePartCreate,
        user_id: Optional[int] = None,
    ) -> PembelianSparePart:
        pembelian = self.get_by_id(pembelian_id)
        self._validate_supplier(data.supplier_id)
        spare_parts_map = self._validate_spare_parts(data.detail)

        hutang = (
            self.db.query(HutangUsaha)
            .filter(
                HutangUsaha.sumber == HutangSource.PEMBELIAN_PART,
                HutangUsaha.referensi_id == pembelian.id,
            )
            .first()
        )
        if hutang and (hutang.total_dibayar > 0 or hutang.pembayaran):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transaksi sudah memiliki pembayaran hutang; edit belum diizinkan",
            )

        for detail in pembelian.detail:
            spare_part = self.db.query(SparePart).filter(SparePart.id == detail.spare_part_id).first()
            if spare_part and spare_part.stok != 999:
                spare_part.stok -= detail.qty
                if spare_part.stok < 0:
                    spare_part.stok = 0

        self.db.query(KasBank).filter(
            KasBank.referensi_id == pembelian.id,
            KasBank.sumber == KasBankSource.PEMBELIAN_PART,
        ).delete(synchronize_session=False)

        if hutang:
            self.db.query(KasBank).filter(
                KasBank.nomor_referensi == hutang.nomor_hutang,
                KasBank.sumber == KasBankSource.HUTANG,
            ).delete(synchronize_session=False)
            self.db.delete(hutang)

        for detail in list(pembelian.detail):
            self.db.delete(detail)
        self.db.flush()

        self._apply_purchase_mutations(pembelian, data, spare_parts_map, user_id)

        self.db.commit()
        self.db.refresh(pembelian)

        return self._attach_payment_info(pembelian)

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        supplier_id: Optional[int] = None,
        status_bayar: Optional[PaymentStatus] = None,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
        sort_by: str = "tanggal",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """Get list of purchases with pagination and filters."""
        query = self.db.query(PembelianSparePart).options(
            joinedload(PembelianSparePart.supplier),
            joinedload(PembelianSparePart.detail).joinedload(
                DetailPembelianSparePart.spare_part
            )
        )

        # Search filter
        if search:
            search_filter = f"%{search}%"
            query = query.join(PembelianSparePart.supplier).filter(
                or_(
                    PembelianSparePart.nomor_transaksi.ilike(search_filter),
                    PembelianSparePart.nomor_faktur.ilike(search_filter),
                    Supplier.nama.ilike(search_filter),
                )
            )

        # Supplier filter
        if supplier_id:
            query = query.filter(PembelianSparePart.supplier_id == supplier_id)

        # Payment status filter
        if status_bayar:
            query = query.filter(PembelianSparePart.status_bayar == status_bayar)

        # Date range filter
        if tanggal_dari:
            query = query.filter(PembelianSparePart.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(PembelianSparePart.tanggal <= tanggal_sampai)

        # Count total
        total = query.count()

        # Sorting
        sort_column = getattr(PembelianSparePart, sort_by, PembelianSparePart.tanggal)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Pagination
        pembelians = query.offset(skip).limit(limit).all()

        # Calculate pages
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "data": pembelians,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": pages,
        }

    def update_payment(
        self,
        pembelian_id: int,
        metode_bayar: str,
        tanggal_bayar: Optional[date] = None,
        user_id: Optional[int] = None,
    ) -> PembelianSparePart:
        """Mark purchase as paid."""
        pembelian = self.get_by_id(pembelian_id)

        if pembelian.status_bayar == PaymentStatus.LUNAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transaksi sudah lunas",
            )

        # Update purchase status
        pembelian.status_bayar = PaymentStatus.LUNAS
        pembelian.metode_bayar = metode_bayar
        pembelian.tanggal_bayar = tanggal_bayar or date.today()

        # Check if there's a linked Hutang record
        hutang = (
            self.db.query(HutangUsaha)
            .filter(
                HutangUsaha.sumber == HutangSource.PEMBELIAN_PART,
                HutangUsaha.referensi_id == pembelian.id,
                HutangUsaha.status != HutangStatus.LUNAS,
            )
            .first()
        )

        if hutang:
            # Update hutang
            nominal_to_pay = hutang.sisa_hutang
            hutang.process_payment(nominal_to_pay)
            
            # Record to KasBank (via Hutang source)
            create_kas_entry(
                db=self.db,
                tanggal=pembelian.tanggal_bayar,
                tipe=KasBankType.KELUAR,
                nominal=nominal_to_pay,
                sumber=KasBankSource.HUTANG,
                metode_bayar=metode_bayar,
                referensi_id=None,
                nomor_referensi=hutang.nomor_hutang,
                keterangan=f"Pelunasan hutang {hutang.nomor_hutang} (Pembelian Part: {pembelian.nomor_transaksi})",
                user_id=user_id,
                allow_negative=True,
            )
        else:
            # No hutang record found (maybe it was deleted or never created)
            # Record directly to KasBank
            create_kas_entry(
                db=self.db,
                tanggal=pembelian.tanggal_bayar,
                tipe=KasBankType.KELUAR,
                nominal=pembelian.grand_total,
                sumber=KasBankSource.PEMBELIAN_PART,
                metode_bayar=metode_bayar,
                referensi_id=pembelian.id,
                nomor_referensi=pembelian.nomor_transaksi,
                keterangan=f"Pelunasan pembelian spare part - {pembelian.nomor_transaksi}",
                user_id=user_id,
                allow_negative=True,
            )

        self.db.commit()
        self.db.refresh(pembelian)

        return pembelian

    def delete(self, pembelian_id: int) -> bool:
        """Delete purchase and revert stock changes.

        Note: Only allows deletion of recent unpaid purchases.
        """
        pembelian = self.get_by_id(pembelian_id)

        # Only allow deletion of unpaid purchases
        if pembelian.status_bayar == PaymentStatus.LUNAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menghapus transaksi yang sudah lunas",
            )

        # Revert stock changes
        for detail in pembelian.detail:
            spare_part = (
                self.db.query(SparePart)
                .filter(SparePart.id == detail.spare_part_id)
                .first()
            )
            if spare_part and spare_part.stok != 999:
                spare_part.stok -= detail.qty
                if spare_part.stok < 0:
                    spare_part.stok = 0

        # Delete purchase (cascade will delete details)
        self.db.delete(pembelian)
        self.db.commit()

        return True

    def get_summary(
        self,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
    ) -> Dict[str, Any]:
        """Get purchase summary statistics."""
        query = self.db.query(PembelianSparePart)

        if tanggal_dari:
            query = query.filter(PembelianSparePart.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(PembelianSparePart.tanggal <= tanggal_sampai)

        # Total purchases
        total_count = query.count()
        total_value = (
            query.with_entities(func.sum(PembelianSparePart.grand_total)).scalar()
            or Decimal("0")
        )

        # Unpaid purchases
        unpaid_query = query.filter(
            PembelianSparePart.status_bayar == PaymentStatus.BELUM_LUNAS
        )
        unpaid_count = unpaid_query.count()
        unpaid_value = (
            unpaid_query.with_entities(func.sum(PembelianSparePart.grand_total)).scalar()
            or Decimal("0")
        )

        return {
            "total_transaksi": total_count,
            "total_nilai": float(total_value),
            "belum_lunas_count": unpaid_count,
            "belum_lunas_nilai": float(unpaid_value),
        }

    def get_by_supplier(
        self,
        supplier_id: int,
        limit: int = 10,
    ) -> List[PembelianSparePart]:
        """Get recent purchases from a supplier."""
        return (
            self.db.query(PembelianSparePart)
            .filter(PembelianSparePart.supplier_id == supplier_id)
            .order_by(PembelianSparePart.tanggal.desc())
            .limit(limit)
            .all()
        )
