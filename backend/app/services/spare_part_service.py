import os
import shutil
import uuid
import io
import openpyxl
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Optional, Dict, Any, List

from sqlalchemy import func, or_, case, text
from sqlalchemy.orm import Session
from fastapi import HTTPException, status, UploadFile
from app.config import settings

from app.models.bengkel import SparePart
from app.schemas.bengkel import SparePartCreate, SparePartUpdate


class SparePartService:
    """Service for spare part inventory management."""

    def __init__(self, db: Session):
        self.db = db

    def generate_next_kode(self, offset: int = 0) -> str:
        """Generate unique spare part code.
        
        Format: SPR + YYMM + NNNN (e.g. SPR26040001)
        Prefix is 7 chars: 'SPR' (3) + 'YYMM' (4)
        
        Args:
            offset: Additional offset to add to the counter (used during bulk import
                     to avoid duplicate kodes when newly added records aren't yet 
                     visible via DB queries).
        """
        today = datetime.now()
        prefix = "SPR"
        date_str = today.strftime("%y%m")
        full_prefix = f"{prefix}{date_str}"  # e.g. "SPR2604" = 7 chars

        last = (
            self.db.query(SparePart)
            .filter(SparePart.kode.like(f"{full_prefix}%"))
            .order_by(SparePart.kode.desc())
            .first()
        )

        if last:
            # Extract numeric suffix AFTER the prefix (not just last 4 chars)
            num_str = last.kode[len(full_prefix):]  # e.g. "0001" or "10000"
            try:
                last_num = int(num_str)
            except (ValueError, IndexError):
                last_num = 0
            new_num = last_num + 1 + offset
        else:
            new_num = 1 + offset

        return f"{full_prefix}{new_num:04d}"

    def create(self, data: SparePartCreate, user_id: Optional[int] = None) -> SparePart:
        """Create a new spare part."""
        # Check duplicate name
        existing = (
            self.db.query(SparePart)
            .filter(
                SparePart.nama == data.nama,
                SparePart.deleted_at.is_(None),
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Spare part dengan nama '{data.nama}' sudah ada",
            )

        # Generate kode if not provided
        kode = data.kode if data.kode else self.generate_next_kode()

        # Check duplicate kode
        existing_kode = self.db.query(SparePart).filter(SparePart.kode == kode).first()
        if existing_kode:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Kode spare part '{kode}' sudah digunakan",
            )

        spare_part = SparePart(
            kode=kode,
            nama=data.nama,
            kode_part=data.kode_part,
            kategori=data.kategori,
            merek=data.merek,
            satuan=data.satuan,
            stok=data.stok,
            stok_minimum=data.stok_minimum,
            harga_beli=data.harga_beli,
            harga_jual=data.harga_jual,
            lokasi_rak=data.lokasi_rak,
            catatan=data.catatan,
            gambar=data.gambar,
        )

        self.db.add(spare_part)
        self.db.commit()
        self.db.refresh(spare_part)

        return spare_part

    def get_by_id(self, spare_part_id: int) -> SparePart:
        """Get spare part by ID."""
        spare_part = (
            self.db.query(SparePart)
            .filter(
                SparePart.id == spare_part_id,
                SparePart.deleted_at.is_(None),
            )
            .first()
        )
        if not spare_part:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Spare part tidak ditemukan",
            )
        return spare_part

    def get_by_kode(self, kode: str) -> Optional[SparePart]:
        """Get spare part by kode."""
        return (
            self.db.query(SparePart)
            .filter(
                SparePart.kode == kode,
                SparePart.deleted_at.is_(None),
            )
            .first()
        )

    def update(self, spare_part_id: int, data: SparePartUpdate) -> SparePart:
        """Update spare part정보."""
        spare_part = self.get_by_id(spare_part_id)

        update_data = data.model_dump(exclude_unset=True)
        # Check duplicate name if changing
        if "nama" in update_data and update_data["nama"] != spare_part.nama:
            existing = (
                self.db.query(SparePart)
                .filter(
                    SparePart.nama == update_data["nama"],
                    SparePart.id != spare_part_id,
                    SparePart.deleted_at.is_(None),
                )
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Spare part dengan nama '{update_data['nama']}' sudah ada",
                )

        for key, value in update_data.items():
            if hasattr(spare_part, key):
                setattr(spare_part, key, value)

        self.db.commit()
        self.db.refresh(spare_part)

        return spare_part

    def upload_image(self, spare_part_id: int, file: UploadFile) -> SparePart:
        """Upload image for a spare part."""
        spare_part = self.get_by_id(spare_part_id)
        
        # Ensure upload directory exists
        resolved_path = os.path.realpath(settings.upload_full_path)
        img_dir = os.path.join(resolved_path, "spare_parts")
        os.makedirs(img_dir, exist_ok=True)
        
        # Generate unique filename
        ext = os.path.splitext(file.filename)[1].lower()
        file_id = str(uuid.uuid4())
        new_filename = f"{file_id}{ext}"
        
        # Relative path for DB
        file_path = f"spare_parts/{new_filename}"
        
        # Absolute path for filesystem
        full_path = os.path.join(img_dir, new_filename)
        
        # Delete old image if exists
        if spare_part.gambar:
            old_path = os.path.join(resolved_path, spare_part.gambar.replace("/", os.sep))
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except:
                    pass
        
        # Save file
        with open(full_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Update DB
        spare_part.gambar = file_path
        self.db.commit()
        self.db.refresh(spare_part)
        
        return spare_part

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        kategori: Optional[str] = None,
        merek: Optional[str] = None,
        low_stock_only: bool = False,
        sort_by: str = "nama",
        sort_order: str = "asc",
    ) -> Dict[str, Any]:
        """Get list of spare parts with pagination and filters."""
        query = self.db.query(SparePart).filter(SparePart.deleted_at.is_(None))

        # Search filter
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    SparePart.nama.ilike(search_filter),
                    SparePart.kode.ilike(search_filter),
                    SparePart.kode_part.ilike(search_filter),
                    SparePart.merek.ilike(search_filter),
                )
            )

        # Category filter
        if kategori:
            query = query.filter(SparePart.kategori == kategori)

        # Brand filter
        if merek:
            query = query.filter(SparePart.merek == merek)

        # Low stock filter
        if low_stock_only:
            query = query.filter(
                SparePart.stok <= SparePart.stok_minimum,
                SparePart.stok != 999
            )

        # Count total
        total = query.count()

        # Sorting
        if sort_by == "penjualan":
            from app.models.bengkel import DetailTransaksiSpareParts
            query = (
                query.outerjoin(DetailTransaksiSpareParts)
                .group_by(SparePart.id)
            )
            if sort_order == "desc":
                query = query.order_by(func.sum(DetailTransaksiSpareParts.qty).desc())
            else:
                query = query.order_by(func.sum(DetailTransaksiSpareParts.qty).asc())
        else:
            sort_column = getattr(SparePart, sort_by, SparePart.nama)
            if sort_order == "desc":
                query = query.order_by(sort_column.desc())
            else:
                query = query.order_by(sort_column.asc())

        # Pagination
        spare_parts = query.offset(skip).limit(limit).all()

        # Calculate pages
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "data": spare_parts,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": pages,
        }


    def delete(self, spare_part_id: int) -> bool:
        """Soft delete spare part."""
        spare_part = self.get_by_id(spare_part_id)

        # Check if has stock
        if spare_part.stok > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menghapus spare part yang masih memiliki stok",
            )

        spare_part.deleted_at = datetime.now()
        self.db.commit()

        return True

    def update_stock(
        self,
        spare_part_id: int,
        quantity: int,
        operation: str = "add",
    ) -> SparePart:
        """Update spare part stock.

        Args:
            spare_part_id: ID of spare part
            quantity: Amount to add/subtract
            operation: 'add' or 'subtract'
        """
        spare_part = self.get_by_id(spare_part_id)

        if operation == "add":
            if spare_part.stok != 999:
                spare_part.stok += quantity
        elif operation == "subtract":
            if spare_part.stok != 999:
                if spare_part.stok < quantity:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Stok tidak mencukupi. Stok tersedia: {spare_part.stok}",
                    )
                spare_part.stok -= quantity
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Operation harus 'add' atau 'subtract'",
            )

        self.db.commit()
        self.db.refresh(spare_part)

        return spare_part

    def update_price(
        self,
        spare_part_id: int,
        harga_beli: Optional[Decimal] = None,
        harga_jual: Optional[Decimal] = None,
    ) -> SparePart:
        """Update spare part prices."""
        spare_part = self.get_by_id(spare_part_id)

        if harga_beli is not None:
            spare_part.harga_beli = harga_beli
        if harga_jual is not None:
            spare_part.harga_jual = harga_jual

        self.db.commit()
        self.db.refresh(spare_part)

        return spare_part

    def get_low_stock_items(self) -> List[SparePart]:
        """Get spare parts with low stock."""
        return (
            self.db.query(SparePart)
            .filter(
                SparePart.deleted_at.is_(None),
                SparePart.stok <= SparePart.stok_minimum,
                SparePart.stok != 999,
            )
            .order_by(SparePart.stok.asc())
            .all()
        )

    def get_stock_value(self) -> Dict[str, Any]:
        """Get total stock value."""
        # For normal items: modal = stok × harga_beli
        # For Always Ready (999): modal = 0 (karena ini barang jasa/tanpa stok fisik)
        result = (
            self.db.query(
                func.sum(
                    case(
                        (SparePart.stok == 999, 0),
                        else_=SparePart.stok * SparePart.harga_beli
                    )
                ).label("total_value"),
                func.sum(
                    case(
                        (SparePart.stok != 999, SparePart.stok),
                        else_=0
                    )
                ).label("total_items"),
                func.count(SparePart.id).label("total_products"),
            )
            .filter(SparePart.deleted_at.is_(None))
            .first()
        )

        return {
            "total_value": float(result.total_value or 0),
            "total_items": int(result.total_items or 0),
            "total_products": int(result.total_products or 0),
        }

    def search_for_transaction(
        self,
        query: str,
        limit: int = 20,
    ) -> List[SparePart]:
        """Search spare parts for transaction form."""
        search_filter = f"%{query}%"
        return (
            self.db.query(SparePart)
            .filter(
                SparePart.deleted_at.is_(None),
                SparePart.stok > 0,
                or_(
                    SparePart.nama.ilike(search_filter),
                    SparePart.kode.ilike(search_filter),
                    SparePart.kode_part.ilike(search_filter),
                ),
            )
            .order_by(SparePart.nama.asc())
            .limit(limit)
            .all()
        )

    def get_categories(self) -> List[str]:
        """Get distinct categories."""
        categories = (
            self.db.query(SparePart.kategori)
            .filter(
                SparePart.deleted_at.is_(None),
                SparePart.kategori.isnot(None),
            )
            .distinct()
            .all()
        )
        return [c[0] for c in categories if c[0]]

    def get_brands(self) -> List[str]:
        """Get distinct brands."""
        brands = (
            self.db.query(SparePart.merek)
            .filter(
                SparePart.deleted_at.is_(None),
                SparePart.merek.isnot(None),
            )
            .distinct()
            .all()
        )
        return [b[0] for b in brands if b[0]]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get inventory statistics (top sales and lowest stock)."""
        from app.models.bengkel import DetailTransaksiSpareParts
        
        # 1. Top 5 Sales
        top_sales = (
            self.db.query(
                SparePart,
                func.sum(DetailTransaksiSpareParts.qty).label("total_sales")
            )
            .join(DetailTransaksiSpareParts)
            .filter(SparePart.deleted_at.is_(None))
            .group_by(SparePart.id)
            .order_by(func.sum(DetailTransaksiSpareParts.qty).desc())
            .limit(5)
            .all()
        )
        
        # Format top_sales to include total_sales in response
        top_sales_formatted = []
        for part, sales in top_sales:
            # We can't easily add attributes to SQLAlchemy models, so we'll return a dict or similar
            # But let's just use the model and let the speaker handle the rest if needed
            # For simplicity, we'll return the part object and add an extra field in a dict
            top_sales_formatted.append({
                "id": part.id,
                "nama": part.nama,
                "kode": part.kode,
                "stok": part.stok,
                "stok_minimum": part.stok_minimum,
                "harga_jual": float(part.harga_jual or 0),
                "kategori": part.kategori,
                "satuan": part.satuan,
                "total_sales": int(sales or 0),
                "gambar": part.gambar
            })
            
        # 2. Top 5 Lowest Stock (Excluding 999)
        lowest_stock = (
            self.db.query(SparePart)
            .filter(
                SparePart.deleted_at.is_(None),
                SparePart.stok != 999
            )
            .order_by(SparePart.stok.asc())
            .limit(5)
            .all()
        )
        
        lowest_stock_formatted = []
        for part in lowest_stock:
            lowest_stock_formatted.append({
                "id": part.id,
                "nama": part.nama,
                "kode": part.kode,
                "stok": part.stok,
                "stok_minimum": part.stok_minimum,
                "harga_jual": float(part.harga_jual or 0),
                "kategori": part.kategori,
                "satuan": part.satuan,
                "gambar": part.gambar
            })
            
        return {
            "top_sales": top_sales_formatted,
            "lowest_stock": lowest_stock_formatted
        }

    def _detect_format(self, sheet) -> str:
        """Detect Excel import format based on header row.
        
        Returns:
            'stok_format' - import-stok-format.xlsx style (Urutan, Nama, Kode Part, Harga Beli, Harga Jual, Stok, Satuan, Total Modal)
            'standard'    - Original 12-column format (Kode, Nama, Kode Part, Kategori, Merek, Satuan, Stok, Stok Min, Harga Beli, Harga Jual, Lokasi Rak, Catatan)
        """
        header_row = [str(cell.value or '').strip().lower() for cell in sheet[1]]
        
        # Check for import-stok-format pattern
        col_a = header_row[0] if len(header_row) > 0 else ''
        col_b = header_row[1] if len(header_row) > 1 else ''
        
        stok_format_indicators = ['urutan', 'no', 'no.', 'nomor', 'urutan sparepart']
        if any(indicator in col_a for indicator in stok_format_indicators):
            return 'stok_format'
        
        # Also detect by checking if col D header looks like "Harga Beli" (stok format)
        # vs "Kategori" (standard format)
        col_d = header_row[3] if len(header_row) > 3 else ''
        if 'harga' in col_d and 'beli' in col_d:
            return 'stok_format'
        
        return 'standard'

    def _parse_row_stok_format(self, row, row_idx: int) -> Dict[str, Any]:
        """Parse a row from import-stok-format.xlsx.
        
        Columns:
        A(0): Urutan Sparepart (ignored, just a sequence number)
        B(1): Nama Spare Part (Required)
        C(2): Kode Part
        D(3): Harga Beli
        E(4): Harga Jual
        F(5): Stok
        G(6): Satuan
        H(7): Total Modal (ignored, calculated field)
        I(8): Always Ready (optional, true/ya/yes/1 = stok 999)
        """
        nama = str(row[1]).strip() if row[1] else None
        if not nama:
            return {"error": f"Baris {row_idx}: Nama spare part wajib diisi"}
        
        try:
            harga_beli = Decimal(str(row[3] or 0))
            harga_jual = Decimal(str(row[4] or 0))

            stok = None
            
            # --- TWEAK MODAL: Force stock to match Excel's "Total Modal" ---
            # Total Modal is at column H (index 7). If it's explicitly > 0, calculate the exact stock 
            # so the DB's stok * harga_beli perfectly matches the Excel summary.
            excel_modal = Decimal("0")
            if len(row) > 7 and row[7]:
                try:
                    excel_modal = Decimal(str(row[7]).strip())
                except InvalidOperation:
                    pass
            
            if excel_modal > 0 and harga_beli > 0:
                stok = excel_modal / harga_beli

            # --- FALLBACK: Use actual 'stok' column or Always Ready ---
            if stok is None:
                # Check Always Ready flag (column I, index 8)
                always_ready = False
                if len(row) > 8 and row[8] is not None:
                    ar_val = str(row[8]).strip().lower()
                    always_ready = ar_val in ('true', 'ya', 'yes', '1', 'v', '✓', 'always ready')
                
                stok_raw = row[5]
                if always_ready:
                    stok = Decimal("999")
                elif stok_raw is not None:
                    stok_str = str(stok_raw).strip()
                    try:
                        stok = Decimal(stok_str) if stok_str else Decimal("0")
                    except InvalidOperation:
                        # Text like "Tanpa Stok" or completely invalid string
                        stok = Decimal("999")
                else:
                    stok = Decimal("0")
            
            satuan = str(row[6]).strip() if row[6] and str(row[6]).strip() else "pcs"
            kode_part = str(row[2]).strip() if row[2] and str(row[2]).strip() else None
            
            return {
                "kode": None,  # No internal kode in this format, will be auto-generated
                "nama": nama,
                "kode_part": kode_part,
                "kategori": "Umum",
                "merek": None,
                "satuan": satuan,
                "stok": stok,
                "stok_minimum": 5,
                "harga_beli": harga_beli,
                "harga_jual": harga_jual,
                "lokasi_rak": None,
                "catatan": None,
            }
        except (ValueError, TypeError, InvalidOperation) as e:
            return {"error": f"Baris {row_idx}: Format data numerik tidak valid ({str(e)})"}

    def _parse_row_standard(self, row, row_idx: int) -> Dict[str, Any]:
        """Parse a row from the standard 12-column export format.
        
        Columns:
        A(0): Kode Barang (Internal)
        B(1): Nama (Required)
        C(2): Kode Part (OEM / Mfg Code)
        D(3): Kategori
        E(4): Merek
        F(5): Satuan
        G(6): Stok
        H(7): Stok Minimum
        I(8): Harga Beli
        J(9): Harga Jual
        K(10): Lokasi Rak
        L(11): Catatan
        """
        kode = str(row[0]).strip() if row[0] else None
        nama = str(row[1]).strip() if row[1] else None
        
        if not nama:
            return {"error": f"Baris {row_idx}: Nama spare part wajib diisi"}
        
        try:
            stok = int(row[6]) if row[6] is not None else 0
            harga_beli = Decimal(str(row[8] or 0))
            
            if stok == 999:
                harga_beli = Decimal("0")
            
            return {
                "kode": kode,
                "nama": nama,
                "kode_part": str(row[2]).strip() if row[2] else None,
                "kategori": str(row[3]) if row[3] else "Umum",
                "merek": str(row[4]) if row[4] else None,
                "satuan": str(row[5]) if row[5] else "pcs",
                "stok": stok,
                "stok_minimum": int(row[7]) if row[7] is not None else 5,
                "harga_beli": harga_beli,
                "harga_jual": Decimal(str(row[9] or 0)),
                "lokasi_rak": str(row[10]) if len(row) > 10 and row[10] else None,
                "catatan": str(row[11]) if len(row) > 11 and row[11] else None,
            }
        except (ValueError, TypeError, InvalidOperation) as e:
            return {"error": f"Baris {row_idx}: Format data numerik tidak valid ({str(e)})"}

    def import_from_excel(self, file_content: bytes) -> Dict[str, Any]:
        """Import spare parts from Excel file.
        
        Auto-detects two formats:
        
        FORMAT 1 - 'stok_format' (import-stok-format.xlsx):
        A: Urutan Sparepart (No.)
        B: Nama Spare Part (Required)
        C: Kode Part
        D: Harga Beli
        E: Harga Jual
        F: Stok
        G: Satuan
        H: Total Modal (ignored)
        
        FORMAT 2 - 'standard' (export/original format):
        A: Kode Barang (Internal)
        B: Nama (Required)
        C: Kode Part (OEM / Mfg Code)
        D: Kategori
        E: Merek
        F: Satuan
        G: Stok
        H: Stok Minimum
        I: Harga Beli
        J: Harga Jual
        K: Lokasi Rak
        L: Catatan
        """
        try:
            wb = openpyxl.load_workbook(io.BytesIO(file_content), data_only=True)
            sheet = wb.active
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Gagal membaca file Excel: {str(e)}"
            )

        # Auto-detect format
        detected_format = self._detect_format(sheet)

        results = {
            "total": 0,
            "success": 0,
            "updated": 0,
            "duplicates": 0,
            "failed": 0,
            "skipped": 0,
            "errors": [],
            "format_detected": detected_format,
        }
        
        # ===================================================================
        # PHASE 1: Parse all rows into in-memory dicts (no DB operations)
        # ===================================================================
        parsed_rows = []
        for row_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
            if not any(row): 
                results["skipped"] += 1
                continue
            
            results["total"] += 1

            if detected_format == 'stok_format':
                parsed = self._parse_row_stok_format(row, row_idx)
            else:
                parsed = self._parse_row_standard(row, row_idx)

            if "error" in parsed:
                results["failed"] += 1
                results["errors"].append(parsed["error"])
                continue
            
            parsed["_row_idx"] = row_idx
            parsed_rows.append(parsed)

        # ===================================================================
        # PHASE 2: Apply parsed rows to DB (hard delete + fresh insert)
        # ===================================================================
        try:
            # Step 1: HARD DELETE all existing spare parts for a truly fresh import.
            from sqlalchemy import text
            self.db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
            self.db.execute(
                SparePart.__table__.delete()
            )
            self.db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
            self.db.flush()

            # Step 2: Pre-generate kodes for items that need one.
            date_str = datetime.now().strftime("%y%m")
            kodes_needed = sum(1 for p in parsed_rows if not p.get("kode"))
            pre_generated_kodes = [f"SPR{date_str}{(i + 1):04d}" for i in range(kodes_needed)]
            kode_idx = 0

            # Step 3: Insert all rows WITHOUT merging (Patokan = Urutan di Excel)
            for parsed in parsed_rows:
                row_idx = parsed["_row_idx"]
                nama = parsed["nama"]
                stok = parsed["stok"]
                harga_beli = parsed["harga_beli"]

                try:
                    # --- CREATE new item ---
                    kode = parsed.get("kode")
                    if kode:
                        new_kode = kode
                    else:
                        new_kode = pre_generated_kodes[kode_idx]
                        kode_idx += 1
                    
                    new_spare_part = SparePart(
                        kode=new_kode,
                        nama=nama,
                        kode_part=parsed["kode_part"],
                        kategori=parsed["kategori"] or "Umum",
                        merek=parsed["merek"],
                        satuan=parsed["satuan"] or "pcs",
                        stok=stok,
                        stok_minimum=parsed.get("stok_minimum", 5),
                        harga_beli=harga_beli,
                        harga_jual=parsed["harga_jual"],
                        lokasi_rak=parsed["lokasi_rak"],
                        catatan=parsed["catatan"],
                    )
                    self.db.add(new_spare_part)
                    results["success"] += 1

                except Exception as e:
                    results["failed"] += 1
                    results["errors"].append(f"Baris {row_idx}: {str(e)}")
                    continue

            # Single flush + commit for the entire batch
            self.db.flush()
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Import gagal: {str(e)}"
            )
        
        return results

    def bulk_delete(self, ids: List[int]) -> int:
        """Deletes multiple spare parts by ID (soft delete)."""
        now = datetime.now()
        updated = (
            self.db.query(SparePart)
            .filter(SparePart.id.in_(ids))
            .filter(SparePart.deleted_at.is_(None))
            .update({SparePart.deleted_at: now}, synchronize_session=False)
        )
        self.db.commit()
        return updated

    def export_to_excel(self, ids: Optional[List[int]] = None) -> io.BytesIO:
        """Export non-deleted spare parts to Excel format."""
        query = self.db.query(SparePart).filter(SparePart.deleted_at.is_(None))
        if ids:
            query = query.filter(SparePart.id.in_(ids))
            
        spare_parts = query.all()
        
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Spare Parts"
        
        # Headers
        headers = [
            "Kode", "Nama Barang", "Kode Part", "Kategori", "Merek", 
            "Satuan", "Stok", "Stok Minimal", "Harga Beli", "Harga Jual", 
            "Lokasi Rak", "Catatan"
        ]
        for col_idx, header in enumerate(headers, 1):
            ws.cell(row=1, column=col_idx, value=header)
            
        # Data
        for row_idx, sp in enumerate(spare_parts, 2):
            ws.cell(row=row_idx, column=1, value=sp.kode)
            ws.cell(row=row_idx, column=2, value=sp.nama)
            ws.cell(row=row_idx, column=3, value=sp.kode_part)
            ws.cell(row=row_idx, column=4, value=sp.kategori)
            ws.cell(row=row_idx, column=5, value=sp.merek)
            ws.cell(row=row_idx, column=6, value=sp.satuan)
            ws.cell(row=row_idx, column=7, value=sp.stok)
            ws.cell(row=row_idx, column=8, value=sp.stok_minimum)
            ws.cell(row=row_idx, column=9, value=float(sp.harga_beli) if sp.harga_beli else 0)
            ws.cell(row=row_idx, column=10, value=float(sp.harga_jual) if sp.harga_jual else 0)
            ws.cell(row=row_idx, column=11, value=sp.lokasi_rak)
            ws.cell(row=row_idx, column=12, value=sp.catatan)
            
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output
