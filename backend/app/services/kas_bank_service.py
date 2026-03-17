from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List
from calendar import monthrange

from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.keuangan import KasBank
from app.schemas.keuangan import KasBankCreate
from app.utils.constants import (
    KasBankType,
    KasBankSource,
    KasBankJenis,
    TRANSACTION_PREFIXES,
)


class KasBankService:
    """Service for cash and bank transaction management."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_nomor_transaksi(self) -> str:
        """Generate unique transaction number."""
        today = datetime.now()
        prefix = TRANSACTION_PREFIXES["kas_bank"]
        date_str = today.strftime("%y%m%d")

        last = (
            self.db.query(KasBank)
            .filter(KasBank.nomor_transaksi.like(f"{prefix}{date_str}%"))
            .order_by(KasBank.id.desc())
            .first()
        )

        if last:
            last_num = int(last.nomor_transaksi[-4:])
            new_num = last_num + 1
        else:
            new_num = 1

        return f"{prefix}{date_str}{new_num:04d}"

    def _get_current_balance(
        self, 
        jenis: KasBankJenis, 
        user_id: Optional[int] = None,
        as_of: Optional[date] = None
    ) -> Decimal:
        """Get balance for kas/bank type at a specific date (end of day).
        If jenis is CASH and user_id is provided, gets balance for that user's wallet.
        """
        query = self.db.query(KasBank).filter(KasBank.jenis == jenis)
        
        if jenis == KasBankJenis.CASH and user_id is not None:
            query = query.filter(KasBank.user_id == user_id)
        
        if as_of:
            query = query.filter(KasBank.tanggal <= as_of)
            
        last_record = query.order_by(KasBank.id.desc()).first()
        return last_record.saldo_sesudah if last_record else Decimal("0")

    def create(
        self,
        data: KasBankCreate,
        current_user_id: Optional[int] = None,
    ) -> KasBank:
        """Create a new cash/bank transaction."""
        # For CASH transactions, we MUST have a user_id (the wallet owner)
        # If not provided in data, use the current user
        target_user_id = data.user_id
        if data.jenis == KasBankJenis.CASH and target_user_id is None:
            target_user_id = current_user_id

        # Get current balance (filtered by user if it's CASH)
        saldo_sebelum = self._get_current_balance(
            data.jenis, 
            user_id=target_user_id if data.jenis == KasBankJenis.CASH else None
        )

        # Check if enough balance for outgoing transaction
        if data.tipe == KasBankType.KELUAR and data.nominal > saldo_sebelum:
            user_msg = f" for user {target_user_id}" if data.jenis == KasBankJenis.CASH else ""
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Saldo tidak mencukupi{user_msg}. Saldo {data.jenis.value}: {saldo_sebelum}",
            )

        # Generate transaction number
        nomor_transaksi = self._generate_nomor_transaksi()

        kas_bank = KasBank(
            nomor_transaksi=nomor_transaksi,
            tanggal=data.tanggal,
            jenis=data.jenis,
            tipe=data.tipe,
            nominal=data.nominal,
            sumber=data.sumber,
            metode_bayar=data.metode_bayar,
            referensi_id=data.referensi_id,
            nomor_referensi=data.nomor_referensi,
            keterangan=data.keterangan,
            catatan=data.catatan,
            user_id=target_user_id, # The wallet owner
            created_by=current_user_id, # The person who entered the data
        )

        # Calculate balance
        kas_bank.calculate_saldo(saldo_sebelum)

        self.db.add(kas_bank)
        self.db.commit()
        self.db.refresh(kas_bank)

        return kas_bank

    def get_by_id(self, kas_bank_id: int) -> KasBank:
        """Get transaction by ID."""
        kas_bank = (
            self.db.query(KasBank)
            .filter(KasBank.id == kas_bank_id)
            .first()
        )
        if not kas_bank:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaksi tidak ditemukan",
            )
        return kas_bank

    def get_by_nomor(self, nomor_transaksi: str) -> Optional[KasBank]:
        """Get transaction by number."""
        return (
            self.db.query(KasBank)
            .filter(KasBank.nomor_transaksi == nomor_transaksi)
            .first()
        )

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        jenis: Optional[KasBankJenis] = None,
        tipe: Optional[KasBankType] = None,
        sumber: Optional[KasBankSource] = None,
        user_id: Optional[int] = None,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
        sort_by: str = "tanggal",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """Get list of transactions with pagination and filters."""
        query = self.db.query(KasBank)

        # Jenis filter
        if jenis:
            query = query.filter(KasBank.jenis == jenis)

        # Type filter
        if tipe:
            query = query.filter(KasBank.tipe == tipe)

        # Source filter
        if sumber:
            query = query.filter(KasBank.sumber == sumber)

        # User filter
        if user_id:
            query = query.filter(KasBank.user_id == user_id)

        # Date range filter
        if tanggal_dari:
            query = query.filter(KasBank.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(KasBank.tanggal <= tanggal_sampai)

        # Count total
        total = query.count()

        # Calculate period summaries
        masuk_total = (
            query.filter(KasBank.tipe == KasBankType.MASUK)
            .with_entities(func.sum(KasBank.nominal))
            .scalar()
            or Decimal("0")
        )
        keluar_total = (
            query.filter(KasBank.tipe == KasBankType.KELUAR)
            .with_entities(func.sum(KasBank.nominal))
            .scalar()
            or Decimal("0")
        )

        # Get first and last records for balance
        first_record = query.order_by(KasBank.id.asc()).first()
        last_record = query.order_by(KasBank.id.desc()).first()

        saldo_awal = first_record.saldo_sebelum if first_record else Decimal("0")
        saldo_akhir = last_record.saldo_sesudah if last_record else Decimal("0")

        # Sorting
        sort_column = getattr(KasBank, sort_by, KasBank.tanggal)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc(), KasBank.id.desc())
        else:
            query = query.order_by(sort_column.asc(), KasBank.id.asc())

        # Pagination
        kas_banks = query.offset(skip).limit(limit).all()

        # Calculate pages
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "data": kas_banks,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": pages,
            "saldo_awal": float(saldo_awal),
            "total_masuk": float(masuk_total),
            "total_keluar": float(keluar_total),
            "saldo_akhir": float(saldo_akhir),
        }

    def get_balance(self, jenis: KasBankJenis, as_of: Optional[date] = None) -> Dict[str, Any]:
        """Get balance for specific kas/bank type as of a date."""
        balance = self._get_current_balance(jenis, as_of)

        # Get month totals based on as_of or today
        target_date = as_of or date.today()
        month_start = date(target_date.year, target_date.month, 1)

        month_query = self.db.query(KasBank).filter(
            KasBank.jenis == jenis,
            KasBank.tanggal >= month_start,
            KasBank.tanggal <= target_date,
        )

        masuk = (
            month_query.filter(KasBank.tipe == KasBankType.MASUK)
            .with_entities(func.sum(KasBank.nominal))
            .scalar()
            or Decimal("0")
        )

        keluar = (
            month_query.filter(KasBank.tipe == KasBankType.KELUAR)
            .with_entities(func.sum(KasBank.nominal))
            .scalar()
            or Decimal("0")
        )

        return {
            "jenis": jenis.value,
            "saldo": float(balance),
            "total_masuk_bulan_ini": float(masuk),
            "total_keluar_bulan_ini": float(keluar),
        }

    def get_all_balances(self, as_of: Optional[date] = None) -> Dict[str, Any]:
        """Get balances for all kas/bank types as of a date."""
        result = {}
        total_saldo = Decimal("0")

        for jenis in KasBankJenis:
            key = jenis.value.lower()
            if jenis == KasBankJenis.CASH:
                # For cash, we provide the total but also a breakdown by user
                balance_info = self.get_balance(jenis, as_of=as_of)
                balance_info["breakdown"] = self.get_cash_user_breakdown(as_of=as_of)
                result[key] = balance_info
            else:
                balance_info = self.get_balance(jenis, as_of=as_of)
                result[key] = balance_info
            
            total_saldo += Decimal(str(balance_info["saldo"]))

        result["total_saldo"] = float(total_saldo)
        return result

    def get_cash_user_breakdown(self, as_of: Optional[date] = None) -> List[Dict[str, Any]]:
        """Get breakdown of cash balance per user."""
        from app.models.user import User
        
        # Get all users who have at least one cash transaction
        user_ids = (
            self.db.query(KasBank.user_id)
            .filter(KasBank.jenis == KasBankJenis.CASH)
            .filter(KasBank.user_id != None)
            .distinct()
            .all()
        )
        
        breakdown = []
        for (uid,) in user_ids:
            user = self.db.query(User).filter(User.id == uid).first()
            if not user:
                continue
                
            balance = self._get_current_balance(KasBankJenis.CASH, user_id=uid, as_of=as_of)
            if balance != 0:
                breakdown.append({
                    "user_id": uid,
                    "username": user.username,
                    "full_name": user.full_name,
                    "balance": float(balance)
                })
        
        return breakdown

    def get_daily_summary(self, tanggal: date) -> Dict[str, Any]:
        """Get daily cash/bank summary."""
        query = self.db.query(KasBank).filter(KasBank.tanggal == tanggal)

        by_jenis = {}
        for jenis in KasBankJenis:
            jenis_query = query.filter(KasBank.jenis == jenis)

            masuk = (
                jenis_query.filter(KasBank.tipe == KasBankType.MASUK)
                .with_entities(func.sum(KasBank.nominal))
                .scalar()
                or Decimal("0")
            )

            keluar = (
                jenis_query.filter(KasBank.tipe == KasBankType.KELUAR)
                .with_entities(func.sum(KasBank.nominal))
                .scalar()
                or Decimal("0")
            )

            if masuk > 0 or keluar > 0:
                by_jenis[jenis.value] = {
                    "masuk": float(masuk),
                    "keluar": float(keluar),
                    "nett": float(masuk - keluar),
                }

        total_masuk = (
            query.filter(KasBank.tipe == KasBankType.MASUK)
            .with_entities(func.sum(KasBank.nominal))
            .scalar()
            or Decimal("0")
        )

        total_keluar = (
            query.filter(KasBank.tipe == KasBankType.KELUAR)
            .with_entities(func.sum(KasBank.nominal))
            .scalar()
            or Decimal("0")
        )

        return {
            "tanggal": tanggal.isoformat(),
            "total_masuk": float(total_masuk),
            "total_keluar": float(total_keluar),
            "nett": float(total_masuk - total_keluar),
            "by_jenis": by_jenis,
        }

    def get_monthly_summary(
        self,
        tahun: int,
        bulan: int,
    ) -> Dict[str, Any]:
        """Get monthly cash/bank summary."""
        _, last_day = monthrange(tahun, bulan)
        start_date = date(tahun, bulan, 1)
        end_date = date(tahun, bulan, last_day)

        query = self.db.query(KasBank).filter(
            KasBank.tanggal >= start_date,
            KasBank.tanggal <= end_date,
        )

        # By source
        by_source = {}
        for source in KasBankSource:
            source_query = query.filter(KasBank.sumber == source)

            masuk = (
                source_query.filter(KasBank.tipe == KasBankType.MASUK)
                .with_entities(func.sum(KasBank.nominal))
                .scalar()
                or Decimal("0")
            )

            keluar = (
                source_query.filter(KasBank.tipe == KasBankType.KELUAR)
                .with_entities(func.sum(KasBank.nominal))
                .scalar()
                or Decimal("0")
            )

            if masuk > 0 or keluar > 0:
                by_source[source.value] = {
                    "masuk": float(masuk),
                    "keluar": float(keluar),
                }

        # Totals
        total_masuk = (
            query.filter(KasBank.tipe == KasBankType.MASUK)
            .with_entities(func.sum(KasBank.nominal))
            .scalar()
            or Decimal("0")
        )

        total_keluar = (
            query.filter(KasBank.tipe == KasBankType.KELUAR)
            .with_entities(func.sum(KasBank.nominal))
            .scalar()
            or Decimal("0")
        )

        # Daily breakdown
        daily = (
            query.with_entities(
                KasBank.tanggal,
                KasBank.tipe,
                func.sum(KasBank.nominal).label("total"),
            )
            .group_by(KasBank.tanggal, KasBank.tipe)
            .order_by(KasBank.tanggal)
            .all()
        )

        daily_data = {}
        for row in daily:
            date_str = row.tanggal.isoformat()
            if date_str not in daily_data:
                daily_data[date_str] = {"masuk": 0, "keluar": 0}
            if row.tipe == KasBankType.MASUK:
                daily_data[date_str]["masuk"] = float(row.total or 0)
            else:
                daily_data[date_str]["keluar"] = float(row.total or 0)

        return {
            "tahun": tahun,
            "bulan": bulan,
            "total_masuk": float(total_masuk),
            "total_keluar": float(total_keluar),
            "nett": float(total_masuk - total_keluar),
            "by_source": by_source,
            "daily": daily_data,
        }

    def transfer(
        self,
        dari: KasBankJenis,
        ke: KasBankJenis,
        nominal: Decimal,
        tanggal: date,
        keterangan: str,
        current_user_id: Optional[int] = None,
        dari_user_id: Optional[int] = None,
        ke_user_id: Optional[int] = None,
    ) -> Dict[str, KasBank]:
        """Transfer between kas/bank accounts (optionally between different user wallets for CASH)."""
        if dari == ke and dari != KasBankJenis.CASH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat transfer ke akun yang sama",
            )
            
        if dari == ke and dari == KasBankJenis.CASH and dari_user_id == ke_user_id:
             raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat transfer kas ke user yang sama",
            )

        # Check source balance
        source_balance = self._get_current_balance(dari, user_id=dari_user_id)
        if nominal > source_balance:
            msg = f"Saldo {dari.value}"
            if dari == KasBankJenis.CASH and dari_user_id:
                msg += f" user {dari_user_id}"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{msg} tidak mencukupi. Saldo: {source_balance}",
            )

        # Create outgoing transaction
        keluar_data = KasBankCreate(
            tanggal=tanggal,
            jenis=dari,
            tipe=KasBankType.KELUAR,
            nominal=nominal,
            sumber=KasBankSource.LAINNYA,
            keterangan=f"Transfer ke {ke.value}{' (User ' + str(ke_user_id) + ')' if ke_user_id else ''}: {keterangan}",
            user_id=dari_user_id,
        )
        keluar = self.create(keluar_data, current_user_id)

        # Create incoming transaction
        masuk_data = KasBankCreate(
            tanggal=tanggal,
            jenis=ke,
            tipe=KasBankType.MASUK,
            nominal=nominal,
            sumber=KasBankSource.LAINNYA,
            nomor_referensi=keluar.nomor_transaksi,
            keterangan=f"Transfer dari {dari.value}{' (User ' + str(dari_user_id) + ')' if dari_user_id else ''}: {keterangan}",
            user_id=ke_user_id,
        )
        masuk = self.create(masuk_data, current_user_id)

        return {
            "keluar": keluar,
            "masuk": masuk,
        }
    def adjust_balance(
        self,
        jenis: KasBankJenis,
        target_nominal: Decimal,
        tanggal: date,
        keterangan: str,
        user_id: Optional[int] = None,
    ) -> KasBank:
        """Adjust balance to a target nominal by creating an adjustment transaction."""
        current_balance = self._get_current_balance(jenis)
        
        if target_nominal == current_balance:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Saldo sudah sesuai dengan target nominal: {target_nominal}",
            )
            
        if target_nominal > current_balance:
            tipe = KasBankType.MASUK
            nominal = target_nominal - current_balance
            adj_keterangan = f"Penyesuaian Saldo (Tambah): {keterangan}"
        else:
            tipe = KasBankType.KELUAR
            nominal = current_balance - target_nominal
            adj_keterangan = f"Penyesuaian Saldo (Kurang): {keterangan}"
            
        kas_bank = KasBank(
            nomor_transaksi=self._generate_nomor_transaksi(),
            tanggal=tanggal,
            jenis=jenis,
            tipe=tipe,
            nominal=nominal,
            sumber=KasBankSource.LAINNYA,
            keterangan=adj_keterangan,
            created_by=user_id,
        )
        
        kas_bank.calculate_saldo(current_balance)
        
        self.db.add(kas_bank)
        self.db.commit()
        self.db.refresh(kas_bank)
        
        return kas_bank
