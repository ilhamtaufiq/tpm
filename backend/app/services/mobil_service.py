import os
import shutil
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status, UploadFile
from app.config import settings

from app.models.mobil import Mobil, MobilMedia, MobilBiayaLainnya, MobilPartService
from app.models.bengkel import SparePart, PengeluaranBengkel
from app.schemas.mobil import MobilCreate, MobilUpdate
from app.utils.constants import CarStatus, OwnershipType, PaymentStatus, PaymentMethod, TRANSACTION_PREFIXES, KasBankType, KasBankSource, HutangSource, HutangStatus, ExpenseCategory
from app.models.keuangan import HutangUsaha, HutangStatus
from app.services.kas_bank_integration import create_kas_entry


class MobilService:
    """Service for car inventory management."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_kode(self) -> str:
        """Generate unique car code."""
        today = datetime.now()
        prefix = TRANSACTION_PREFIXES["mobil"]
        date_str = today.strftime("%y%m")

        last = (
            self.db.query(Mobil)
            .filter(Mobil.kode.like(f"{prefix}{date_str}%"))
            .order_by(Mobil.id.desc())
            .first()
        )

        if last:
            last_num = int(last.kode[-4:])
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


    def _generate_pengeluaran_nomor(self) -> str:
        """Generate unique expense transaction number."""
        today = datetime.now()
        prefix = TRANSACTION_PREFIXES["pengeluaran"]
        date_str = today.strftime("%y%m%d")

        last = (
            self.db.query(PengeluaranBengkel)
            .filter(PengeluaranBengkel.nomor_transaksi.like(f"{prefix}{date_str}%"))
            .order_by(PengeluaranBengkel.id.desc())
            .first()
        )

        if last:
            last_num = int(last.nomor_transaksi[-4:])
            new_num = last_num + 1
        else:
            new_num = 1

        return f"{prefix}{date_str}{new_num:04d}"



    def create(
        self,
        data: MobilCreate,
        user_id: Optional[int] = None,
    ) -> Mobil:
        """Create a new car inventory record."""
        # Check duplicate plate number
        existing = (
            self.db.query(Mobil)
            .filter(
                Mobil.nomor_plat == data.nomor_plat,
                Mobil.deleted_at.is_(None),
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mobil dengan nomor plat '{data.nomor_plat}' sudah ada",
            )

        # Generate kode if not provided
        kode = data.kode if data.kode else self._generate_kode()

        # Check duplicate kode
        existing_kode = self.db.query(Mobil).filter(Mobil.kode == kode).first()
        if existing_kode:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Kode mobil '{kode}' sudah digunakan",
            )

        # Validate investor data
        if data.tipe_kepemilikan == OwnershipType.INVESTOR:
            if not data.nama_investor:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Nama investor wajib diisi untuk mobil investor",
                )
            if data.persentase_investor <= 0 and data.nominal_investor <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Persentase atau Nominal investor harus diisi",
                )

        # Calculate summary of payments
        total_pembayaran = Decimal("0")
        metode_utama = data.metode_bayar
        
        if data.payments:
            total_pembayaran = sum(p.jumlah for p in data.payments)
            # If multiple methods used, set main method as SPLIT
            metodes = list(set(p.metode for p in data.payments if p.jumlah > 0))
            if len(metodes) > 1:
                metode_utama = PaymentMethod.SPLIT
            elif len(metodes) == 1:
                metode_utama = metodes[0]
        else:
            # Traditional behavior (single payment)
            total_pembayaran = data.dp if data.status_bayar != PaymentStatus.LUNAS else data.harga_beli
            metode_utama = data.metode_bayar

        mobil = Mobil(
            kode=kode,
            merek=data.merek,
            model=data.model,
            tahun=data.tahun,
            warna=data.warna,
            nomor_plat=data.nomor_plat,
            nomor_rangka=data.nomor_rangka,
            nomor_mesin=data.nomor_mesin,
            transmisi=data.transmisi,
            bahan_bakar=data.bahan_bakar,
            kilometer=data.kilometer,
            harga_beli=data.harga_beli,
            harga_jual=data.harga_jual,
            tipe_kepemilikan=data.tipe_kepemilikan,
            nama_investor=data.nama_investor,
            persentase_investor=data.persentase_investor,
            nominal_investor=data.nominal_investor,
            status=CarStatus.TERSEDIA,
            tanggal_masuk=data.tanggal_masuk,
            catatan=data.catatan,
            created_by=user_id,
            # New fields for purchase tracking
            status_bayar_beli=data.status_bayar,
            metode_bayar_beli=metode_utama,
            dp_beli=total_pembayaran if data.status_bayar != PaymentStatus.LUNAS else Decimal("0"),
        )

        self.db.add(mobil)
        self.db.flush()

        # Record purchase payment to KasBank (money going out)
        if data.payments:
            for p in data.payments:
                if p.jumlah > 0:
                    create_kas_entry(
                        db=self.db,
                        tanggal=data.tanggal_masuk,
                        tipe=KasBankType.KELUAR,
                        nominal=p.jumlah,
                        sumber=KasBankSource.PEMBELIAN_MOBIL,
                        metode_bayar=p.metode,
                        referensi_id=mobil.id,
                        nomor_referensi=mobil.kode,
                        keterangan=f"Pembelian Unit ({p.metode.upper()}): {mobil.merek} {mobil.model} ({mobil.nomor_plat})",
                        user_id=user_id,
                    )
        elif total_pembayaran > 0:
            create_kas_entry(
                db=self.db,
                tanggal=data.tanggal_masuk,
                tipe=KasBankType.KELUAR,
                nominal=total_pembayaran,
                sumber=KasBankSource.PEMBELIAN_MOBIL,
                metode_bayar=metode_utama,
                referensi_id=mobil.id,
                nomor_referensi=mobil.kode,
                keterangan=f"Pembelian Unit: {mobil.merek} {mobil.model} ({mobil.nomor_plat})",
                user_id=user_id,
            )

        # Record Hutang (Payable) if not fully paid
        if data.status_bayar != PaymentStatus.LUNAS:
            sisa_hutang = data.harga_beli - total_pembayaran
            hutang = HutangUsaha(
                nomor_hutang=self._generate_nomor_hutang(),
                tanggal=data.tanggal_masuk,
                supplier_id=None, # Buying from individual/other source
                nama_kreditur=f"Pembelian Mobil {mobil.nomor_plat}",
                sumber=HutangSource.PEMBELIAN_MOBIL,
                referensi_id=mobil.id,
                nomor_referensi=mobil.kode,
                nominal_hutang=data.harga_beli,
                total_dibayar=total_pembayaran,
                sisa_hutang=sisa_hutang,
                status=HutangStatus.BELUM_LUNAS if total_pembayaran == 0 else HutangStatus.SEBAGIAN,
                catatan=f"Hutang pembelian mobil {mobil.merek} {mobil.model} ({mobil.nomor_plat})",
                created_by=user_id,
            )
            self.db.add(hutang)

        self.db.commit()
        self.db.refresh(mobil)

        return mobil

    def get_by_id(self, mobil_id: int) -> Mobil:
        """Get car by ID with related data."""
        mobil = (
            self.db.query(Mobil)
            .options(
                joinedload(Mobil.media),
                joinedload(Mobil.biaya_lainnya),
                joinedload(Mobil.part_services),
                joinedload(Mobil.bengkel_perbaikan),
                joinedload(Mobil.pengeluaran_bengkel),
                joinedload(Mobil.penjualan),
            )
            .filter(
                Mobil.id == mobil_id,
                Mobil.deleted_at.is_(None),
            )
            .first()
        )
        if not mobil:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mobil tidak ditemukan",
            )
        return mobil

    def get_by_kode(self, kode: str) -> Optional[Mobil]:
        """Get car by code."""
        return (
            self.db.query(Mobil)
            .filter(
                Mobil.kode == kode,
                Mobil.deleted_at.is_(None),
            )
            .first()
        )

    def get_by_plat(self, nomor_plat: str) -> Optional[Mobil]:
        """Get car by plate number."""
        return (
            self.db.query(Mobil)
            .filter(
                Mobil.nomor_plat == nomor_plat,
                Mobil.deleted_at.is_(None),
            )
            .first()
        )

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        status: Optional[CarStatus] = None,
        tipe_kepemilikan: Optional[OwnershipType] = None,
        merek: Optional[str] = None,
        tahun: Optional[int] = None,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
        sort_by: str = "tanggal_masuk",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """Get list of cars with pagination and filters."""
        query = (
            self.db.query(Mobil)
            .options(
                joinedload(Mobil.media),
                joinedload(Mobil.biaya_lainnya),
                joinedload(Mobil.part_services),
                joinedload(Mobil.bengkel_perbaikan),
                joinedload(Mobil.penjualan),
            )
            .filter(Mobil.deleted_at.is_(None))
        )

        # Search filter
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    Mobil.kode.ilike(search_filter),
                    Mobil.merek.ilike(search_filter),
                    Mobil.model.ilike(search_filter),
                    Mobil.nomor_plat.ilike(search_filter),
                    Mobil.nama_investor.ilike(search_filter),
                )
            )

        # Status filter
        if status:
            query = query.filter(Mobil.status == status)

        # Ownership filter
        if tipe_kepemilikan:
            query = query.filter(Mobil.tipe_kepemilikan == tipe_kepemilikan)

        # Brand filter
        if merek:
            query = query.filter(Mobil.merek == merek)

        # Year filter
        if tahun:
            query = query.filter(Mobil.tahun == tahun)
            
        # Date range filter
        if tanggal_dari:
            query = query.filter(Mobil.tanggal_masuk >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(Mobil.tanggal_masuk <= tanggal_sampai)

        # Count total
        total = query.count()

        # Sorting
        sort_column = getattr(Mobil, sort_by, Mobil.tanggal_masuk)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Pagination
        mobils = query.offset(skip).limit(limit).all()

        # Calculate pages
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "data": mobils,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": pages,
        }

    def update(self, mobil_id: int, data: MobilUpdate) -> Mobil:
        """Update car information."""
        mobil = self.get_by_id(mobil_id)

        # Cannot update sold car (except some fields)
        if mobil.status == CarStatus.TERJUAL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat mengubah data mobil yang sudah terjual",
            )

        update_data = data.model_dump(exclude_unset=True)

        # Check duplicate plate if changing
        if "nomor_plat" in update_data and update_data["nomor_plat"] != mobil.nomor_plat:
            existing = (
                self.db.query(Mobil)
                .filter(
                    Mobil.nomor_plat == update_data["nomor_plat"],
                    Mobil.id != mobil_id,
                    Mobil.deleted_at.is_(None),
                )
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Nomor plat '{update_data['nomor_plat']}' sudah digunakan",
                )

        for key, value in update_data.items():
            if hasattr(mobil, key):
                setattr(mobil, key, value)

        self.db.commit()
        self.db.refresh(mobil)

        return mobil

    def update_status(self, mobil_id: int, status: CarStatus) -> Mobil:
        """Update car status."""
        mobil = self.get_by_id(mobil_id)
        mobil.status = status
        self.db.commit()
        self.db.refresh(mobil)
        return mobil

    def delete(self, mobil_id: int) -> bool:
        """Soft delete car."""
        mobil = self.get_by_id(mobil_id)

        # Cannot delete sold car
        if mobil.status == CarStatus.TERJUAL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menghapus mobil yang sudah terjual",
            )

        mobil.deleted_at = datetime.now()
        self.db.commit()

        return True

    # Additional cost management
    def add_biaya(
        self,
        mobil_id: int,
        tanggal: date,
        kategori: str,
        deskripsi: str,
        jumlah: Decimal,
        metode_bayar: PaymentMethod = PaymentMethod.TUNAI,
        payments: Optional[List[Dict[str, Any]]] = None,
        catatan: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> PengeluaranBengkel:
        """Add additional cost to car, unified with workshop expenses."""
        mobil = self.get_by_id(mobil_id)

        if mobil.status == CarStatus.TERJUAL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menambah biaya untuk mobil yang sudah terjual",
            )

        nomor_transaksi = self._generate_pengeluaran_nomor()

        biaya = PengeluaranBengkel(
            nomor_transaksi=nomor_transaksi,
            tanggal=tanggal,
            bisnis_kategori="jasa_angkut" if kategori == "Jasa Angkut" else "mobil",
            mobil_id=mobil_id,
            kategori=ExpenseCategory.BIAYA_OPERASIONAL,
            deskripsi=f"[{kategori}] {deskripsi}" if kategori else deskripsi,
            jumlah=jumlah,
            catatan=catatan,
            created_by=user_id
        )

        self.db.add(biaya)
        self.db.flush()

        # Record to KasBank if not internal/bengkel
        if kategori != "Perawatan Bengkel":
            if payments:
                for p in payments:
                    p_jumlah = Decimal(str(p.get("jumlah", 0)))
                    p_metode = p.get("metode", PaymentMethod.TUNAI)
                    if p_jumlah > 0:
                        create_kas_entry(
                            db=self.db,
                            tanggal=tanggal,
                            tipe=KasBankType.KELUAR,
                            nominal=p_jumlah,
                            sumber=KasBankSource.JUAL_BELI_MOBIL,
                            metode_bayar=p_metode,
                            referensi_id=biaya.id,
                            nomor_referensi=nomor_transaksi,
                            keterangan=f"Biaya {kategori} ({p_metode.upper()}) - {mobil.nomor_plat}: {deskripsi}",
                            user_id=user_id,
                        )
            else:
                create_kas_entry(
                    db=self.db,
                    tanggal=tanggal,
                    tipe=KasBankType.KELUAR,
                    nominal=jumlah,
                    sumber=KasBankSource.JUAL_BELI_MOBIL,
                    metode_bayar=metode_bayar,
                    referensi_id=biaya.id,
                    nomor_referensi=nomor_transaksi,
                    keterangan=f"Biaya {kategori} - {mobil.nomor_plat}: {deskripsi}",
                    user_id=user_id,
                )

        self.db.commit()
        self.db.refresh(biaya)

        return biaya

    def delete_biaya(self, biaya_id: int) -> bool:
        """Delete additional cost."""
        biaya = (
            self.db.query(MobilBiayaLainnya)
            .filter(MobilBiayaLainnya.id == biaya_id)
            .first()
        )
        if not biaya:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Biaya tidak ditemukan",
            )

        self.db.delete(biaya)
        self.db.commit()

        return True

    # Part/Service management
    def add_part_service(
        self,
        mobil_id: int,
        tanggal: date,
        tipe: str,
        deskripsi: str,
        qty: int,
        harga_satuan: Decimal,
        catatan: Optional[str] = None,
    ) -> MobilPartService:
        """Add part/service cost to car."""
        mobil = self.get_by_id(mobil_id)

        if mobil.status == CarStatus.TERJUAL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menambah part/service untuk mobil yang sudah terjual",
            )

        total = harga_satuan * qty

        part_service = MobilPartService(
            mobil_id=mobil_id,
            tanggal=tanggal,
            tipe=tipe,
            deskripsi=deskripsi,
            qty=qty,
            harga_satuan=harga_satuan,
            total=total,
            catatan=catatan,
        )

        self.db.add(part_service)
        self.db.commit()
        self.db.refresh(part_service)

        return part_service



    def delete_part_service(self, part_service_id: int) -> bool:
        """Delete part/service cost."""
        ps = (
            self.db.query(MobilPartService)
            .filter(MobilPartService.id == part_service_id)
            .first()
        )
        if not ps:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Part/Service tidak ditemukan",
            )

        self.db.delete(ps)
        self.db.commit()

        return True

    # Statistics
    def get_inventory_summary(
        self,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
    ) -> Dict[str, Any]:
        """Get inventory summary statistics."""
        query = self.db.query(Mobil).filter(Mobil.deleted_at.is_(None))
        
        if tanggal_dari:
            query = query.filter(Mobil.tanggal_masuk >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(Mobil.tanggal_masuk <= tanggal_sampai)

        total_count = query.count()

        # Count by status
        by_status = (
            query.with_entities(
                Mobil.status,
                func.count(Mobil.id).label("count"),
            )
            .group_by(Mobil.status)
            .all()
        )
        status_counts = {s.value: 0 for s in CarStatus}
        for row in by_status:
            status_counts[row.status.value] = row.count

        # Count by ownership
        by_ownership = (
            query.with_entities(
                Mobil.tipe_kepemilikan,
                func.count(Mobil.id).label("count"),
            )
            .group_by(Mobil.tipe_kepemilikan)
            .all()
        )
        ownership_counts = {o.value: 0 for o in OwnershipType}
        for row in by_ownership:
            ownership_counts[row.tipe_kepemilikan.value] = row.count

        # Total capital (only available cars)
        available_query = query.filter(Mobil.status == CarStatus.TERSEDIA)
        total_modal_tersedia = (
            available_query.with_entities(func.sum(Mobil.harga_beli)).scalar()
            or Decimal("0")
        )

        # Total purchase value (all cars in current filtered set)
        total_modal_pembelian = (
            query.with_entities(func.sum(Mobil.harga_beli)).scalar()
            or Decimal("0")
        )

        return {
            "total_mobil": total_count,
            "per_status": status_counts,
            "per_kepemilikan": ownership_counts,
            "total_modal_tersedia": float(total_modal_tersedia),
            "total_modal_pembelian": float(total_modal_pembelian),
        }

    def get_available_for_sale(
        self,
        search: Optional[str] = None,
        limit: int = 20,
    ) -> List[Mobil]:
        """Get available cars for sale selection."""
        query = self.db.query(Mobil).filter(
            Mobil.deleted_at.is_(None),
            Mobil.status == CarStatus.TERSEDIA,
        )

        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    Mobil.kode.ilike(search_filter),
                    Mobil.merek.ilike(search_filter),
                    Mobil.model.ilike(search_filter),
                    Mobil.nomor_plat.ilike(search_filter),
                )
            )

        return query.order_by(Mobil.tanggal_masuk.desc()).limit(limit).all()

    def get_brands(self) -> List[str]:
        """Get distinct car brands."""
        brands = (
            self.db.query(Mobil.merek)
            .filter(Mobil.deleted_at.is_(None))
            .distinct()
            .all()
        )
        return [b[0] for b in brands if b[0]]

    def get_years(self) -> List[int]:
        """Get distinct car years."""
        years = (
            self.db.query(Mobil.tahun)
            .filter(Mobil.deleted_at.is_(None))
            .distinct()
            .order_by(Mobil.tahun.desc())
            .all()
        )
        return [y[0] for y in years if y[0]]

    def upload_media(
        self,
        mobil_id: int,
        files: List[UploadFile],
        is_primary: bool = False,
    ) -> List[MobilMedia]:
        """Upload images/videos for a car."""
        mobil = self.get_by_id(mobil_id)
        
        # Ensure upload directory exists - resolve symlink first
        resolved_path = os.path.realpath(settings.upload_full_path)
        media_dir = os.path.join(resolved_path, "mobil", str(mobil_id))
        os.makedirs(media_dir, exist_ok=True)
        
        results = []
        for file in files:
            # Generate unique filename
            ext = os.path.splitext(file.filename)[1].lower()
            file_id = str(uuid.uuid4())
            new_filename = f"{file_id}{ext}"
            
            # Use forward slashes for the database record (URL compatible)
            file_path = f"mobil/{mobil_id}/{new_filename}"
            
            # Use platform-specific separator for filesystem operations
            # Resolve path to ensure we use the physical location
            resolved_base = os.path.realpath(settings.upload_full_path)
            full_path = os.path.join(resolved_base, "mobil", str(mobil_id), new_filename)
            
            # Save file
            with open(full_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Determine file type
            file_type = "video" if ext in [".mp4", ".mov", ".avi", ".mkv"] else "image"
            
            # Save to DB
            media = MobilMedia(
                mobil_id=mobil_id,
                file_path=file_path,
                file_name=file.filename,
                file_type=file_type,
                is_primary=is_primary and len(results) == 0,
                urutan=len(mobil.media) + len(results)
            )
            self.db.add(media)
            results.append(media)
            
        self.db.commit()
        for r in results:
            self.db.refresh(r)
            
        return results

    def delete_media(self, media_id: int) -> bool:
        """Delete media file and DB record."""
        media = (
            self.db.query(MobilMedia)
            .filter(MobilMedia.id == media_id)
            .first()
        )
        if not media:
            raise HTTPException(status_code=404, detail="Media tidak ditemukan")
            
        # Normalize slashes for the current OS and use absolute path
        # Resolve symlinks to ensure we are deleting from the correct physical location
        resolved_base = os.path.realpath(settings.upload_full_path)
        normalized_path = media.file_path.replace("/", os.sep)
        full_path = os.path.join(resolved_base, normalized_path)
        
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
            except Exception as e:
                # Log error but continue with DB deletion if file is gone or inaccessible
                print(f"Error deleting file {full_path}: {e}")
            
        # Delete DB record
        self.db.delete(media)
        self.db.commit()
        
        return True
