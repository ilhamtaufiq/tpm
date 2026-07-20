"""
Multi-sheet Excel import for existing/opening data.

Sheets (MVP):
  _INSTRUKSI, customers, suppliers, spare_parts, jasa_servis, karyawan,
  kas_opening, hutang_opening, piutang_opening, armada, supir, mobil

Flow:
  1) generate_template()
  2) preview(file) dry-run — no commit
  3) commit(file, batch_id?) — all-or-nothing transaction
"""
from __future__ import annotations

import io
import re
import uuid
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple

import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.supplier import Supplier
from app.models.bengkel import SparePart, JasaServis
from app.models.karyawan import Karyawan
from app.models.keuangan import KasBank, HutangUsaha, PiutangUsaha
from app.models.jasa_angkut import ArmadaJasaAngkut, Supir
from app.models.mobil import Mobil
from app.utils.constants import (
    CarStatus,
    EmployeeStatus,
    HutangSource,
    HutangStatus,
    KasBankJenis,
    KasBankSource,
    KasBankType,
    OwnershipType,
    PaymentMethod,
    PaymentStatus,
    PiutangSource,
    PiutangStatus,
    TRANSACTION_PREFIXES,
)

SHEET_ORDER = [
    "_INSTRUKSI",
    "customers",
    "suppliers",
    "spare_parts",
    "jasa_servis",
    "karyawan",
    "kas_opening",
    "hutang_opening",
    "piutang_opening",
    "armada",
    "supir",
    "mobil",
]

# Header definitions: (excel_header, field_key, required)
SHEET_HEADERS: Dict[str, List[Tuple[str, str, bool]]] = {
    "customers": [
        ("kode", "kode", False),
        ("nama", "nama", True),
        ("tipe", "tipe", False),
        ("telepon", "telepon", False),
        ("alamat", "alamat", False),
        ("kota", "kota", False),
        ("email", "email", False),
        ("npwp", "npwp", False),
        ("catatan", "catatan", False),
    ],
    "suppliers": [
        ("kode", "kode", False),
        ("nama", "nama", True),
        ("telepon", "telepon", False),
        ("alamat", "alamat", False),
        ("kota", "kota", False),
        ("email", "email", False),
        ("contact_person", "contact_person", False),
        ("bank", "bank", False),
        ("rekening", "rekening", False),
        ("catatan", "catatan", False),
    ],
    "spare_parts": [
        ("kode", "kode", False),
        ("nama", "nama", True),
        ("kode_part", "kode_part", False),
        ("kategori", "kategori", False),
        ("merek", "merek", False),
        ("satuan", "satuan", False),
        ("stok", "stok", False),
        ("stok_minimum", "stok_minimum", False),
        ("harga_beli", "harga_beli", False),
        ("harga_jual", "harga_jual", False),
        ("lokasi_rak", "lokasi_rak", False),
        ("catatan", "catatan", False),
    ],
    "jasa_servis": [
        ("nama", "nama", True),
        ("kategori", "kategori", False),
        ("harga", "harga", True),
        ("deskripsi", "deskripsi", False),
    ],
    "karyawan": [
        ("kode", "kode", False),
        ("nama", "nama", True),
        ("jabatan", "jabatan", True),
        ("nik", "nik", False),
        ("telepon", "telepon", False),
        ("alamat", "alamat", False),
        ("email", "email", False),
        ("tanggal_bergabung", "tanggal_bergabung", False),
        ("gaji_pokok", "gaji_pokok", False),
        ("tunjangan", "tunjangan", False),
        ("status", "status", False),
        ("catatan", "catatan", False),
    ],
    "kas_opening": [
        ("tanggal", "tanggal", True),
        ("jenis_kas", "jenis_kas", True),
        ("nominal", "nominal", True),
        ("keterangan", "keterangan", False),
        ("catatan", "catatan", False),
    ],
    "hutang_opening": [
        ("tanggal", "tanggal", True),
        ("nama_kreditur", "nama_kreditur", True),
        ("nominal", "nominal", True),
        ("unit", "unit", False),
        ("telepon", "telepon", False),
        ("alamat", "alamat", False),
        ("tanggal_jatuh_tempo", "tanggal_jatuh_tempo", False),
        ("catatan", "catatan", False),
    ],
    "piutang_opening": [
        ("tanggal", "tanggal", True),
        ("nama_debitur", "nama_debitur", True),
        ("nominal", "nominal", True),
        ("unit", "unit", False),
        ("telepon", "telepon", False),
        ("alamat", "alamat", False),
        ("tanggal_jatuh_tempo", "tanggal_jatuh_tempo", False),
        ("catatan", "catatan", False),
    ],
    "armada": [
        ("nama", "nama", True),
        ("nopol", "nopol", True),
        ("jenis", "jenis", False),
        ("is_active", "is_active", False),
        ("catatan", "catatan", False),
    ],
    "supir": [
        ("kode", "kode", False),
        ("nama", "nama", True),
        ("telepon", "telepon", False),
        ("nik", "nik", False),
        ("nomor_sim", "nomor_sim", False),
        ("jenis_sim", "jenis_sim", False),
        ("tanggal_bergabung", "tanggal_bergabung", False),
        ("nopol_kendaraan", "nopol_kendaraan", False),
        ("is_active", "is_active", False),
        ("catatan", "catatan", False),
    ],
    "mobil": [
        ("kode", "kode", False),
        ("merek", "merek", True),
        ("model", "model", True),
        ("tahun", "tahun", True),
        ("warna", "warna", True),
        ("nomor_plat", "nomor_plat", True),
        ("harga_beli", "harga_beli", True),
        ("harga_jual", "harga_jual", False),
        ("tanggal_masuk", "tanggal_masuk", False),
        ("status", "status", False),
        ("tipe_kepemilikan", "tipe_kepemilikan", False),
        ("nama_investor", "nama_investor", False),
        ("transmisi", "transmisi", False),
        ("bahan_bakar", "bahan_bakar", False),
        ("kilometer", "kilometer", False),
        ("catatan", "catatan", False),
    ],
}

EXAMPLE_ROWS: Dict[str, List[Dict[str, Any]]] = {
    "customers": [
        {
            "kode": "CUS-001",
            "nama": "Budi Santoso",
            "tipe": "perorangan",
            "telepon": "08123456789",
            "alamat": "Jl. Contoh 1",
            "kota": "Cianjur",
        }
    ],
    "suppliers": [
        {
            "kode": "SUP-001",
            "nama": "Toko Onderdil Jaya",
            "telepon": "0811111111",
            "kota": "Bandung",
        }
    ],
    "spare_parts": [
        {
            "kode": "SPR-001",
            "nama": "Oli Mesin 1L",
            "kode_part": "OLI-001",
            "kategori": "Oli",
            "satuan": "pcs",
            "stok": 50,
            "stok_minimum": 5,
            "harga_beli": 35000,
            "harga_jual": 45000,
        }
    ],
    "jasa_servis": [
        {"nama": "Ganti Oli", "kategori": "Mesin", "harga": 50000, "deskripsi": "Jasa ganti oli"},
    ],
    "karyawan": [
        {
            "kode": "KRY-001",
            "nama": "Andi Mekanik",
            "jabatan": "Mekanik",
            "tanggal_bergabung": date.today().isoformat(),
            "gaji_pokok": 3000000,
            "tunjangan": 500000,
            "status": "AKTIF",
        }
    ],
    "kas_opening": [
        {
            "tanggal": date.today().isoformat(),
            "jenis_kas": "KAS_UTAMA",
            "nominal": 10000000,
            "keterangan": "Saldo awal kas utama",
        },
        {
            "tanggal": date.today().isoformat(),
            "jenis_kas": "KAS_UNIT_BENGKEL",
            "nominal": 2000000,
            "keterangan": "Saldo awal laci bengkel",
        },
    ],
    "hutang_opening": [
        {
            "tanggal": date.today().isoformat(),
            "nama_kreditur": "Supplier X",
            "nominal": 1500000,
            "unit": "BENGKEL",
            "catatan": "Sisa hutang pembelian part",
        }
    ],
    "piutang_opening": [
        {
            "tanggal": date.today().isoformat(),
            "nama_debitur": "Pelanggan Y",
            "nominal": 750000,
            "unit": "BENGKEL",
            "catatan": "Sisa piutang servis",
        }
    ],
    "armada": [
        {"nama": "Truk 01", "nopol": "F 1234 XX", "jenis": "Dump Truck", "is_active": "ya"},
    ],
    "supir": [
        {
            "kode": "SPR-DRV-01",
            "nama": "Joko Supir",
            "telepon": "0822222222",
            "tanggal_bergabung": date.today().isoformat(),
            "is_active": "ya",
        }
    ],
    "mobil": [
        {
            "kode": "MBL-001",
            "merek": "Toyota",
            "model": "Avanza",
            "tahun": 2018,
            "warna": "Hitam",
            "nomor_plat": "F 9999 AA",
            "harga_beli": 120000000,
            "harga_jual": 135000000,
            "tanggal_masuk": date.today().isoformat(),
            "status": "TERSEDIA",
            "tipe_kepemilikan": "TPM",
        }
    ],
}

INSTRUCTIONS = [
    "TEMPLATE IMPORT DATA EXISTING — TPM Super App",
    "",
    "CARA PAKAI:",
    "1. Isi sheet data (customers, suppliers, spare_parts, ...).",
    "2. Baris contoh boleh dihapus / diganti.",
    "3. Upload di Settings → Import Data → Preview (dry-run).",
    "4. Perbaiki error yang muncul, lalu Commit.",
    "",
    "URUTAN IMPOR (otomatis):",
    "customers → suppliers → spare_parts → jasa_servis → karyawan →",
    "kas_opening → hutang_opening → piutang_opening → armada → supir → mobil",
    "",
    "ATURAN PENTING:",
    "- MVP = master + stok + opening finance (bukan full histori transaksi).",
    "- kas_opening menambah MASUK ke dompet (idempotent per batch+jenis_kas).",
    "- hutang/piutang_opening mencatat sisa (total_dibayar=0, sisa=nominal).",
    "- spare_parts: upsert by kode (jika kosong → generate SPR...).",
    "- customers/suppliers: upsert by kode (jika kosong → generate).",
    "- jenis_kas valid: KAS_UTAMA, BANK_UTAMA, KAS_UNIT_BENGKEL,",
    "  KAS_UNIT_JASA_ANGKUT, KAS_UNIT_MOBIL, CASH, BANK_BCA, dll.",
    "- unit hutang/piutang: BENGKEL | JASA_ANGKUT | JUAL_BELI_MOBIL | LAINNYA",
    "- tanggal format: YYYY-MM-DD",
    "- Jangan ubah nama sheet.",
    "",
    "ADMIN ONLY. Backup database sebelum commit production.",
]


class DataImportService:
    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------ utils
    @staticmethod
    def _cell(v: Any) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        return s if s else None

    @staticmethod
    def _dec(v: Any, default: str = "0") -> Decimal:
        if v is None or str(v).strip() == "":
            return Decimal(default)
        try:
            return Decimal(str(v).strip().replace(",", "."))
        except (InvalidOperation, ValueError):
            raise ValueError(f"angka tidak valid: {v}")

    @staticmethod
    def _int(v: Any, default: int = 0) -> int:
        if v is None or str(v).strip() == "":
            return default
        return int(Decimal(str(v).strip().replace(",", ".")))

    @staticmethod
    def _date(v: Any, default: Optional[date] = None) -> date:
        if v is None or str(v).strip() == "":
            return default or date.today()
        if isinstance(v, datetime):
            return v.date()
        if isinstance(v, date):
            return v
        s = str(v).strip()[:10]
        return datetime.strptime(s, "%Y-%m-%d").date()

    @staticmethod
    def _bool(v: Any, default: bool = True) -> bool:
        if v is None or str(v).strip() == "":
            return default
        return str(v).strip().lower() in ("1", "true", "ya", "yes", "y", "aktif", "v")

    def _next_kode(self, prefix: str, model, field: str = "kode") -> str:
        date_str = datetime.now().strftime("%y%m")
        like = f"{prefix}{date_str}%"
        col = getattr(model, field)
        last = (
            self.db.query(model)
            .filter(col.like(like))
            .order_by(model.id.desc())
            .first()
        )
        n = 1
        if last:
            try:
                n = int(str(getattr(last, field))[-4:]) + 1
            except Exception:
                n = 1
        return f"{prefix}{date_str}{n:04d}"

    def _gen_nomor(self, prefix_key: str, model, field: str) -> str:
        today = datetime.now()
        prefix = TRANSACTION_PREFIXES[prefix_key]
        date_str = today.strftime("%y%m%d")
        col = getattr(model, field)
        last = (
            self.db.query(model)
            .filter(col.like(f"{prefix}{date_str}%"))
            .order_by(model.id.desc())
            .first()
        )
        n = 1
        if last:
            try:
                n = int(str(getattr(last, field))[-4:]) + 1
            except Exception:
                n = 1
        return f"{prefix}{date_str}{n:04d}"

    def _map_header(self, sheet) -> Dict[str, int]:
        header = [str(c.value or "").strip().lower() for c in sheet[1]]
        return {h: i for i, h in enumerate(header) if h}

    def _row_dict(self, row, header_map: Dict[str, int], fields: List[Tuple[str, str, bool]]) -> Dict[str, Any]:
        out: Dict[str, Any] = {}
        for header, key, _req in fields:
            idx = header_map.get(header.lower())
            if idx is None or idx >= len(row):
                out[key] = None
            else:
                out[key] = row[idx]
        return out

    def _empty_row(self, row) -> bool:
        return not any(c is not None and str(c).strip() != "" for c in row)

    # ----------------------------------------------------------- template
    def generate_template(self) -> io.BytesIO:
        wb = openpyxl.Workbook()
        # instruction sheet
        ws0 = wb.active
        ws0.title = "_INSTRUKSI"
        ws0["A1"] = "\n".join(INSTRUCTIONS)
        ws0["A1"].alignment = Alignment(wrap_text=True, vertical="top")
        ws0.column_dimensions["A"].width = 100
        ws0.row_dimensions[1].height = 320

        header_fill = PatternFill("solid", fgColor="1E3A8A")
        header_font = Font(bold=True, color="FFFFFF")
        example_fill = PatternFill("solid", fgColor="FEF3C7")

        for sheet_name in SHEET_ORDER:
            if sheet_name == "_INSTRUKSI":
                continue
            ws = wb.create_sheet(sheet_name)
            fields = SHEET_HEADERS[sheet_name]
            for col, (header, _k, _r) in enumerate(fields, start=1):
                cell = ws.cell(1, col, header)
                cell.fill = header_fill
                cell.font = header_font
                ws.column_dimensions[get_column_letter(col)].width = max(14, len(header) + 2)
            for r_i, example in enumerate(EXAMPLE_ROWS.get(sheet_name, []), start=2):
                for c_i, (header, key, _r) in enumerate(fields, start=1):
                    cell = ws.cell(r_i, c_i, example.get(key))
                    cell.fill = example_fill

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return buf

    # ----------------------------------------------------------- parse workbook
    def _parse_workbook(self, file_content: bytes) -> Dict[str, List[Dict[str, Any]]]:
        try:
            wb = openpyxl.load_workbook(io.BytesIO(file_content), data_only=True)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Gagal membaca Excel: {e}",
            )
        parsed: Dict[str, List[Dict[str, Any]]] = {}
        for name in SHEET_ORDER:
            if name == "_INSTRUKSI" or name not in wb.sheetnames:
                continue
            sheet = wb[name]
            fields = SHEET_HEADERS[name]
            header_map = self._map_header(sheet)
            # require at least required headers
            missing_headers = [h for h, k, req in fields if req and h.lower() not in header_map]
            if missing_headers:
                raise HTTPException(
                    status_code=400,
                    detail=f"Sheet '{name}' kurang kolom: {', '.join(missing_headers)}",
                )
            rows: List[Dict[str, Any]] = []
            for row_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
                if self._empty_row(row):
                    continue
                d = self._row_dict(row, header_map, fields)
                d["_row"] = row_idx
                rows.append(d)
            parsed[name] = rows
        return parsed

    # ----------------------------------------------------------- validate row
    def _validate_row(self, sheet: str, row: Dict[str, Any]) -> Optional[str]:
        fields = SHEET_HEADERS[sheet]
        r = row["_row"]
        for header, key, req in fields:
            if req and (row.get(key) is None or str(row.get(key)).strip() == ""):
                return f"Baris {r}: kolom '{header}' wajib diisi"
        try:
            if sheet == "spare_parts":
                self._dec(row.get("stok"), "0")
                self._dec(row.get("harga_beli"), "0")
                self._dec(row.get("harga_jual"), "0")
            elif sheet == "jasa_servis":
                self._dec(row.get("harga"), "0")
            elif sheet == "karyawan":
                self._dec(row.get("gaji_pokok"), "0")
                self._date(row.get("tanggal_bergabung"), date.today())
                st = self._cell(row.get("status")) or "AKTIF"
                if st.upper().replace(" ", "_") not in {e.value for e in EmployeeStatus}:
                    return f"Baris {r}: status karyawan tidak valid ({st})"
            elif sheet == "kas_opening":
                self._date(row.get("tanggal"))
                jenis = (self._cell(row.get("jenis_kas")) or "").upper().replace(" ", "_")
                if jenis not in {e.value for e in KasBankJenis}:
                    return f"Baris {r}: jenis_kas tidak valid ({jenis})"
                nom = self._dec(row.get("nominal"))
                if nom <= 0:
                    return f"Baris {r}: nominal harus > 0"
            elif sheet in ("hutang_opening", "piutang_opening"):
                self._date(row.get("tanggal"))
                nom = self._dec(row.get("nominal"))
                if nom <= 0:
                    return f"Baris {r}: nominal harus > 0"
                unit = (self._cell(row.get("unit")) or "BENGKEL").upper().replace(" ", "_")
                # map aliases
                if unit == "MOBIL":
                    unit = "JUAL_BELI_MOBIL"
                if unit not in {e.value for e in KasBankSource} and unit != "BENGKEL":
                    # BENGKEL is valid KasBankSource
                    pass
                if unit not in {e.value for e in KasBankSource}:
                    return f"Baris {r}: unit tidak valid ({unit})"
            elif sheet == "armada":
                if not self._cell(row.get("nopol")):
                    return f"Baris {r}: nopol wajib"
            elif sheet == "supir":
                self._date(row.get("tanggal_bergabung"), date.today())
            elif sheet == "mobil":
                self._int(row.get("tahun"), 0)
                self._dec(row.get("harga_beli"))
                st = (self._cell(row.get("status")) or "TERSEDIA").upper()
                if st not in {e.value for e in CarStatus}:
                    return f"Baris {r}: status mobil tidak valid ({st})"
                self._date(row.get("tanggal_masuk"), date.today())
        except Exception as e:
            return f"Baris {r}: {e}"
        return None

    # ----------------------------------------------------------- apply rows
    def _apply_customers(self, rows: List[Dict[str, Any]], dry: bool) -> Dict[str, Any]:
        res = {"created": 0, "updated": 0, "skipped": 0, "errors": []}
        for row in rows:
            err = self._validate_row("customers", row)
            if err:
                res["errors"].append(err)
                continue
            nama = self._cell(row["nama"])
            kode = self._cell(row.get("kode"))
            tipe = (self._cell(row.get("tipe")) or "perorangan").lower()
            if tipe not in ("perorangan", "perusahaan"):
                tipe = "perorangan"
            existing = None
            if kode:
                existing = self.db.query(Customer).filter(Customer.kode == kode).first()
            if not existing and not kode:
                # try match by nama exact
                existing = self.db.query(Customer).filter(Customer.nama == nama).first()
            if dry:
                res["updated" if existing else "created"] += 1
                continue
            if existing:
                existing.nama = nama
                existing.tipe = tipe
                existing.telepon = self._cell(row.get("telepon"))
                existing.alamat = self._cell(row.get("alamat"))
                existing.kota = self._cell(row.get("kota"))
                existing.email = self._cell(row.get("email"))
                existing.npwp = self._cell(row.get("npwp"))
                existing.catatan = self._cell(row.get("catatan"))
                res["updated"] += 1
            else:
                if not kode:
                    kode = self._next_kode("CUS", Customer)
                self.db.add(
                    Customer(
                        kode=kode,
                        nama=nama,
                        tipe=tipe,
                        telepon=self._cell(row.get("telepon")),
                        alamat=self._cell(row.get("alamat")),
                        kota=self._cell(row.get("kota")),
                        email=self._cell(row.get("email")),
                        npwp=self._cell(row.get("npwp")),
                        catatan=self._cell(row.get("catatan")),
                    )
                )
                res["created"] += 1
        return res

    def _apply_suppliers(self, rows: List[Dict[str, Any]], dry: bool) -> Dict[str, Any]:
        res = {"created": 0, "updated": 0, "skipped": 0, "errors": []}
        for row in rows:
            err = self._validate_row("suppliers", row)
            if err:
                res["errors"].append(err)
                continue
            nama = self._cell(row["nama"])
            kode = self._cell(row.get("kode"))
            existing = None
            if kode:
                existing = self.db.query(Supplier).filter(Supplier.kode == kode).first()
            if dry:
                res["updated" if existing else "created"] += 1
                continue
            if existing:
                existing.nama = nama
                existing.telepon = self._cell(row.get("telepon"))
                existing.alamat = self._cell(row.get("alamat"))
                existing.kota = self._cell(row.get("kota"))
                existing.email = self._cell(row.get("email"))
                existing.contact_person = self._cell(row.get("contact_person"))
                existing.bank = self._cell(row.get("bank"))
                existing.rekening = self._cell(row.get("rekening"))
                existing.catatan = self._cell(row.get("catatan"))
                res["updated"] += 1
            else:
                if not kode:
                    kode = self._next_kode("SUP", Supplier)
                self.db.add(
                    Supplier(
                        kode=kode,
                        nama=nama,
                        telepon=self._cell(row.get("telepon")),
                        alamat=self._cell(row.get("alamat")),
                        kota=self._cell(row.get("kota")),
                        email=self._cell(row.get("email")),
                        contact_person=self._cell(row.get("contact_person")),
                        bank=self._cell(row.get("bank")),
                        rekening=self._cell(row.get("rekening")),
                        catatan=self._cell(row.get("catatan")),
                    )
                )
                res["created"] += 1
        return res

    def _apply_spare_parts(self, rows: List[Dict[str, Any]], dry: bool) -> Dict[str, Any]:
        res = {"created": 0, "updated": 0, "skipped": 0, "errors": []}
        for row in rows:
            err = self._validate_row("spare_parts", row)
            if err:
                res["errors"].append(err)
                continue
            try:
                nama = self._cell(row["nama"])
                kode = self._cell(row.get("kode"))
                stok = self._dec(row.get("stok"), "0")
                stok_min = self._int(row.get("stok_minimum"), 5)
                hb = self._dec(row.get("harga_beli"), "0")
                hj = self._dec(row.get("harga_jual"), "0")
            except Exception as e:
                res["errors"].append(f"Baris {row['_row']}: {e}")
                continue
            existing = None
            if kode:
                existing = self.db.query(SparePart).filter(SparePart.kode == kode).first()
            if not existing:
                kp = self._cell(row.get("kode_part"))
                if kp:
                    existing = self.db.query(SparePart).filter(SparePart.kode_part == kp).first()
            if dry:
                res["updated" if existing else "created"] += 1
                continue
            if existing:
                existing.nama = nama
                existing.kode_part = self._cell(row.get("kode_part"))
                existing.kategori = self._cell(row.get("kategori")) or "Umum"
                existing.merek = self._cell(row.get("merek"))
                existing.satuan = self._cell(row.get("satuan")) or "pcs"
                existing.stok = stok
                existing.stok_minimum = stok_min
                existing.harga_beli = hb
                existing.harga_jual = hj
                existing.lokasi_rak = self._cell(row.get("lokasi_rak"))
                existing.catatan = self._cell(row.get("catatan"))
                res["updated"] += 1
            else:
                if not kode:
                    kode = self._next_kode("SPR", SparePart)
                self.db.add(
                    SparePart(
                        kode=kode,
                        nama=nama,
                        kode_part=self._cell(row.get("kode_part")),
                        kategori=self._cell(row.get("kategori")) or "Umum",
                        merek=self._cell(row.get("merek")),
                        satuan=self._cell(row.get("satuan")) or "pcs",
                        stok=stok,
                        stok_minimum=stok_min,
                        harga_beli=hb,
                        harga_jual=hj,
                        lokasi_rak=self._cell(row.get("lokasi_rak")),
                        catatan=self._cell(row.get("catatan")),
                    )
                )
                res["created"] += 1
        return res

    def _apply_jasa_servis(self, rows: List[Dict[str, Any]], dry: bool) -> Dict[str, Any]:
        res = {"created": 0, "updated": 0, "skipped": 0, "errors": []}
        for row in rows:
            err = self._validate_row("jasa_servis", row)
            if err:
                res["errors"].append(err)
                continue
            nama = self._cell(row["nama"])
            try:
                harga = self._dec(row.get("harga"), "0")
            except Exception as e:
                res["errors"].append(f"Baris {row['_row']}: {e}")
                continue
            existing = self.db.query(JasaServis).filter(JasaServis.nama == nama).first()
            if dry:
                res["updated" if existing else "created"] += 1
                continue
            if existing:
                existing.kategori = self._cell(row.get("kategori"))
                existing.harga = harga
                existing.deskripsi = self._cell(row.get("deskripsi"))
                res["updated"] += 1
            else:
                self.db.add(
                    JasaServis(
                        nama=nama,
                        kategori=self._cell(row.get("kategori")),
                        harga=harga,
                        deskripsi=self._cell(row.get("deskripsi")),
                    )
                )
                res["created"] += 1
        return res

    def _apply_karyawan(self, rows: List[Dict[str, Any]], dry: bool) -> Dict[str, Any]:
        res = {"created": 0, "updated": 0, "skipped": 0, "errors": []}
        for row in rows:
            err = self._validate_row("karyawan", row)
            if err:
                res["errors"].append(err)
                continue
            nama = self._cell(row["nama"])
            jabatan = self._cell(row["jabatan"]) or "Staff"
            kode = self._cell(row.get("kode"))
            existing = None
            if kode:
                existing = self.db.query(Karyawan).filter(Karyawan.kode == kode).first()
            if dry:
                res["updated" if existing else "created"] += 1
                continue
            try:
                tgl = self._date(row.get("tanggal_bergabung"), date.today())
                gaji = self._dec(row.get("gaji_pokok"), "0")
                tunj = self._dec(row.get("tunjangan"), "0")
                st = (self._cell(row.get("status")) or "AKTIF").upper().replace(" ", "_")
                status = EmployeeStatus(st)
            except Exception as e:
                res["errors"].append(f"Baris {row['_row']}: {e}")
                continue
            if existing:
                existing.nama = nama
                existing.jabatan = jabatan
                existing.nik = self._cell(row.get("nik"))
                existing.telepon = self._cell(row.get("telepon"))
                existing.alamat = self._cell(row.get("alamat"))
                existing.email = self._cell(row.get("email"))
                existing.gaji_pokok = gaji
                existing.tunjangan = tunj
                existing.status = status
                existing.catatan = self._cell(row.get("catatan"))
                res["updated"] += 1
            else:
                if not kode:
                    kode = self._next_kode("KRY", Karyawan)
                self.db.add(
                    Karyawan(
                        kode=kode,
                        nama=nama,
                        jabatan=jabatan,
                        nik=self._cell(row.get("nik")),
                        telepon=self._cell(row.get("telepon")),
                        alamat=self._cell(row.get("alamat")),
                        email=self._cell(row.get("email")),
                        tanggal_bergabung=tgl,
                        gaji_pokok=gaji,
                        tunjangan=tunj,
                        status=status,
                        catatan=self._cell(row.get("catatan")),
                    )
                )
                res["created"] += 1
        return res

    def _apply_kas_opening(
        self, rows: List[Dict[str, Any]], dry: bool, batch_id: str, user_id: Optional[int]
    ) -> Dict[str, Any]:
        res = {"created": 0, "updated": 0, "skipped": 0, "errors": []}
        for row in rows:
            err = self._validate_row("kas_opening", row)
            if err:
                res["errors"].append(err)
                continue
            try:
                tgl = self._date(row.get("tanggal"))
                jenis = KasBankJenis((self._cell(row.get("jenis_kas")) or "").upper().replace(" ", "_"))
                nominal = self._dec(row.get("nominal"))
            except Exception as e:
                res["errors"].append(f"Baris {row['_row']}: {e}")
                continue
            ref = f"IMP-{batch_id}-KAS-{jenis.value}"
            existing = (
                self.db.query(KasBank)
                .filter(KasBank.nomor_referensi == ref)
                .first()
            )
            if existing:
                res["skipped"] += 1
                continue
            if dry:
                res["created"] += 1
                continue
            saldo_sebelum = KasBank.get_current_balance(self.db, jenis)
            nomor = self._gen_nomor("kas_bank", KasBank, "nomor_transaksi")
            ket = self._cell(row.get("keterangan")) or f"Saldo opening import {jenis.value}"
            kb = KasBank(
                nomor_transaksi=nomor,
                tanggal=tgl,
                jenis=jenis,
                metode_bayar=PaymentMethod.TUNAI,
                tipe=KasBankType.MASUK,
                nominal=nominal,
                sumber=KasBankSource.MODAL,
                nomor_referensi=ref,
                keterangan=ket,
                catatan=self._cell(row.get("catatan")) or f"import_batch={batch_id}",
                created_by=user_id,
            )
            kb.calculate_saldo(saldo_sebelum)
            self.db.add(kb)
            self.db.flush()
            res["created"] += 1
        return res

    def _apply_hutang_opening(
        self, rows: List[Dict[str, Any]], dry: bool, batch_id: str, user_id: Optional[int]
    ) -> Dict[str, Any]:
        res = {"created": 0, "updated": 0, "skipped": 0, "errors": []}
        for row in rows:
            err = self._validate_row("hutang_opening", row)
            if err:
                res["errors"].append(err)
                continue
            try:
                tgl = self._date(row.get("tanggal"))
                nama = self._cell(row["nama_kreditur"])
                nominal = self._dec(row.get("nominal"))
                unit_s = (self._cell(row.get("unit")) or "BENGKEL").upper().replace(" ", "_")
                if unit_s == "MOBIL":
                    unit_s = "JUAL_BELI_MOBIL"
                unit = KasBankSource(unit_s)
                jth = None
                if row.get("tanggal_jatuh_tempo") not in (None, ""):
                    jth = self._date(row.get("tanggal_jatuh_tempo"))
            except Exception as e:
                res["errors"].append(f"Baris {row['_row']}: {e}")
                continue
            ref = f"IMP-{batch_id}-HTG-{row['_row']}-{re.sub(r'[^A-Z0-9]', '', nama.upper())[:20]}"
            existing = (
                self.db.query(HutangUsaha)
                .filter(HutangUsaha.nomor_referensi == ref)
                .first()
            )
            if existing:
                res["skipped"] += 1
                continue
            if dry:
                res["created"] += 1
                continue
            nomor = self._gen_nomor("hutang", HutangUsaha, "nomor_hutang")
            self.db.add(
                HutangUsaha(
                    nomor_hutang=nomor,
                    tanggal=tgl,
                    sumber=HutangSource.LAINNYA,
                    nomor_referensi=ref,
                    unit=unit,
                    nama_kreditur=nama,
                    telepon_kreditur=self._cell(row.get("telepon")),
                    alamat_kreditur=self._cell(row.get("alamat")),
                    nominal_hutang=nominal,
                    total_dibayar=Decimal("0"),
                    sisa_hutang=nominal,
                    tanggal_jatuh_tempo=jth,
                    status=HutangStatus.BELUM_LUNAS,
                    catatan=(self._cell(row.get("catatan")) or "") + f" | import_batch={batch_id}",
                    created_by=user_id,
                )
            )
            self.db.flush()
            res["created"] += 1
        return res

    def _apply_piutang_opening(
        self, rows: List[Dict[str, Any]], dry: bool, batch_id: str, user_id: Optional[int]
    ) -> Dict[str, Any]:
        res = {"created": 0, "updated": 0, "skipped": 0, "errors": []}
        for row in rows:
            err = self._validate_row("piutang_opening", row)
            if err:
                res["errors"].append(err)
                continue
            try:
                tgl = self._date(row.get("tanggal"))
                nama = self._cell(row["nama_debitur"])
                nominal = self._dec(row.get("nominal"))
                unit_s = (self._cell(row.get("unit")) or "BENGKEL").upper().replace(" ", "_")
                if unit_s == "MOBIL":
                    unit_s = "JUAL_BELI_MOBIL"
                unit = KasBankSource(unit_s)
                jth = None
                if row.get("tanggal_jatuh_tempo") not in (None, ""):
                    jth = self._date(row.get("tanggal_jatuh_tempo"))
            except Exception as e:
                res["errors"].append(f"Baris {row['_row']}: {e}")
                continue
            ref = f"IMP-{batch_id}-PTG-{row['_row']}-{re.sub(r'[^A-Z0-9]', '', nama.upper())[:20]}"
            existing = (
                self.db.query(PiutangUsaha)
                .filter(PiutangUsaha.nomor_referensi == ref)
                .first()
            )
            if existing:
                res["skipped"] += 1
                continue
            if dry:
                res["created"] += 1
                continue
            nomor = self._gen_nomor("piutang", PiutangUsaha, "nomor_piutang")
            sumber = PiutangSource.BENGKEL
            if unit == KasBankSource.JASA_ANGKUT:
                sumber = PiutangSource.JASA_ANGKUT
            elif unit == KasBankSource.JUAL_BELI_MOBIL:
                sumber = PiutangSource.JUAL_BELI_MOBIL
            self.db.add(
                PiutangUsaha(
                    nomor_piutang=nomor,
                    tanggal=tgl,
                    sumber=sumber,
                    nomor_referensi=ref,
                    unit=unit,
                    nama_debitur=nama,
                    telepon_debitur=self._cell(row.get("telepon")),
                    alamat_debitur=self._cell(row.get("alamat")),
                    nominal_piutang=nominal,
                    total_dibayar=Decimal("0"),
                    sisa_piutang=nominal,
                    tanggal_jatuh_tempo=jth,
                    status=PiutangStatus.BELUM_LUNAS,
                    catatan=(self._cell(row.get("catatan")) or "") + f" | import_batch={batch_id}",
                    created_by=user_id,
                )
            )
            self.db.flush()
            res["created"] += 1
        return res

    def _apply_armada(self, rows: List[Dict[str, Any]], dry: bool) -> Dict[str, Any]:
        res = {"created": 0, "updated": 0, "skipped": 0, "errors": []}
        for row in rows:
            err = self._validate_row("armada", row)
            if err:
                res["errors"].append(err)
                continue
            nopol = self._cell(row["nopol"])
            nama = self._cell(row["nama"])
            existing = self.db.query(ArmadaJasaAngkut).filter(ArmadaJasaAngkut.nopol == nopol).first()
            if dry:
                res["updated" if existing else "created"] += 1
                continue
            if existing:
                existing.nama = nama
                existing.jenis = self._cell(row.get("jenis"))
                existing.is_active = self._bool(row.get("is_active"), True)
                existing.catatan = self._cell(row.get("catatan"))
                res["updated"] += 1
            else:
                self.db.add(
                    ArmadaJasaAngkut(
                        nama=nama,
                        nopol=nopol,
                        jenis=self._cell(row.get("jenis")),
                        is_active=self._bool(row.get("is_active"), True),
                        catatan=self._cell(row.get("catatan")),
                    )
                )
                res["created"] += 1
        return res

    def _apply_supir(self, rows: List[Dict[str, Any]], dry: bool) -> Dict[str, Any]:
        res = {"created": 0, "updated": 0, "skipped": 0, "errors": []}
        for row in rows:
            err = self._validate_row("supir", row)
            if err:
                res["errors"].append(err)
                continue
            nama = self._cell(row["nama"])
            kode = self._cell(row.get("kode"))
            existing = None
            if kode:
                existing = self.db.query(Supir).filter(Supir.kode == kode).first()
            if dry:
                res["updated" if existing else "created"] += 1
                continue
            try:
                tgl = self._date(row.get("tanggal_bergabung"), date.today())
            except Exception as e:
                res["errors"].append(f"Baris {row['_row']}: {e}")
                continue
            if existing:
                existing.nama = nama
                existing.telepon = self._cell(row.get("telepon"))
                existing.nik = self._cell(row.get("nik"))
                existing.nomor_sim = self._cell(row.get("nomor_sim"))
                existing.jenis_sim = self._cell(row.get("jenis_sim"))
                existing.nopol_kendaraan = self._cell(row.get("nopol_kendaraan"))
                existing.is_active = self._bool(row.get("is_active"), True)
                existing.catatan = self._cell(row.get("catatan"))
                res["updated"] += 1
            else:
                if not kode:
                    kode = self._next_kode("DRV", Supir)
                self.db.add(
                    Supir(
                        kode=kode,
                        nama=nama,
                        telepon=self._cell(row.get("telepon")),
                        nik=self._cell(row.get("nik")),
                        nomor_sim=self._cell(row.get("nomor_sim")),
                        jenis_sim=self._cell(row.get("jenis_sim")),
                        tanggal_bergabung=tgl,
                        nopol_kendaraan=self._cell(row.get("nopol_kendaraan")),
                        is_active=self._bool(row.get("is_active"), True),
                        catatan=self._cell(row.get("catatan")),
                    )
                )
                res["created"] += 1
        return res

    def _apply_mobil(
        self, rows: List[Dict[str, Any]], dry: bool, user_id: Optional[int]
    ) -> Dict[str, Any]:
        res = {"created": 0, "updated": 0, "skipped": 0, "errors": []}
        for row in rows:
            err = self._validate_row("mobil", row)
            if err:
                res["errors"].append(err)
                continue
            try:
                plat = self._cell(row["nomor_plat"])
                merek = self._cell(row["merek"])
                model = self._cell(row["model"])
                tahun = self._int(row.get("tahun"), date.today().year)
                warna = self._cell(row.get("warna")) or "-"
                hb = self._dec(row.get("harga_beli"))
                hj = self._dec(row.get("harga_jual"), "0") if row.get("harga_jual") not in (None, "") else None
                tgl = self._date(row.get("tanggal_masuk"), date.today())
                st = CarStatus((self._cell(row.get("status")) or "TERSEDIA").upper())
                own = OwnershipType((self._cell(row.get("tipe_kepemilikan")) or "TPM").upper())
                kode = self._cell(row.get("kode"))
            except Exception as e:
                res["errors"].append(f"Baris {row['_row']}: {e}")
                continue
            existing = self.db.query(Mobil).filter(Mobil.nomor_plat == plat).first()
            if dry:
                res["updated" if existing else "created"] += 1
                continue
            if existing:
                existing.merek = merek
                existing.model = model
                existing.tahun = tahun
                existing.warna = warna
                existing.harga_beli = hb
                if hj is not None:
                    existing.harga_jual = hj
                existing.status = st
                existing.tipe_kepemilikan = own
                existing.nama_investor = self._cell(row.get("nama_investor"))
                existing.transmisi = self._cell(row.get("transmisi"))
                existing.bahan_bakar = self._cell(row.get("bahan_bakar"))
                if row.get("kilometer") not in (None, ""):
                    existing.kilometer = self._int(row.get("kilometer"), 0)
                existing.catatan = self._cell(row.get("catatan"))
                res["updated"] += 1
            else:
                if not kode:
                    kode = self._next_kode("MBL", Mobil)
                token = uuid.uuid4().hex
                self.db.add(
                    Mobil(
                        kode=kode,
                        public_gallery_token=token,
                        merek=merek,
                        model=model,
                        tahun=tahun,
                        warna=warna,
                        nomor_plat=plat,
                        harga_beli=hb,
                        harga_jual=hj,
                        status=st,
                        tanggal_masuk=tgl,
                        tipe_kepemilikan=own,
                        nama_investor=self._cell(row.get("nama_investor")),
                        transmisi=self._cell(row.get("transmisi")),
                        bahan_bakar=self._cell(row.get("bahan_bakar")),
                        kilometer=self._int(row.get("kilometer"), 0) if row.get("kilometer") not in (None, "") else None,
                        status_bayar_beli=PaymentStatus.LUNAS,
                        metode_bayar_beli=PaymentMethod.TUNAI,
                        catatan=self._cell(row.get("catatan")),
                        created_by=user_id,
                    )
                )
                res["created"] += 1
        return res

    def _run(self, file_content: bytes, dry: bool, user_id: Optional[int], batch_id: Optional[str] = None) -> Dict[str, Any]:
        batch_id = batch_id or uuid.uuid4().hex[:12]
        parsed = self._parse_workbook(file_content)
        results: Dict[str, Any] = {
            "batch_id": batch_id,
            "dry_run": dry,
            "sheets": {},
            "ok": True,
        }
        apply_map = {
            "customers": lambda rows: self._apply_customers(rows, dry),
            "suppliers": lambda rows: self._apply_suppliers(rows, dry),
            "spare_parts": lambda rows: self._apply_spare_parts(rows, dry),
            "jasa_servis": lambda rows: self._apply_jasa_servis(rows, dry),
            "karyawan": lambda rows: self._apply_karyawan(rows, dry),
            "kas_opening": lambda rows: self._apply_kas_opening(rows, dry, batch_id, user_id),
            "hutang_opening": lambda rows: self._apply_hutang_opening(rows, dry, batch_id, user_id),
            "piutang_opening": lambda rows: self._apply_piutang_opening(rows, dry, batch_id, user_id),
            "armada": lambda rows: self._apply_armada(rows, dry),
            "supir": lambda rows: self._apply_supir(rows, dry),
            "mobil": lambda rows: self._apply_mobil(rows, dry, user_id),
        }
        try:
            for sheet in SHEET_ORDER:
                if sheet == "_INSTRUKSI" or sheet not in parsed:
                    continue
                rows = parsed[sheet]
                sheet_res = apply_map[sheet](rows)
                sheet_res["rows"] = len(rows)
                results["sheets"][sheet] = sheet_res
                if sheet_res.get("errors"):
                    results["ok"] = False
            if dry:
                self.db.rollback()
            else:
                if not results["ok"]:
                    self.db.rollback()
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "message": "Import dibatalkan karena ada error validasi",
                            "batch_id": batch_id,
                            "sheets": results["sheets"],
                        },
                    )
                self.db.commit()
        except HTTPException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise HTTPException(status_code=400, detail=f"Import gagal: {e}")
        return results

    def preview(self, file_content: bytes, user_id: Optional[int] = None) -> Dict[str, Any]:
        return self._run(file_content, dry=True, user_id=user_id)

    def commit(self, file_content: bytes, user_id: Optional[int] = None, batch_id: Optional[str] = None) -> Dict[str, Any]:
        return self._run(file_content, dry=False, user_id=user_id, batch_id=batch_id)
