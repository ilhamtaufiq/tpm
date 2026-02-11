# SESSION.md - TPM Backend Development Progress

## Last Updated: 2026-01-30 (Session 4)

---

## Current Status

### Phase Completion

| Phase | Description | Status | Progress |
|-------|-------------|--------|----------|
| 1 | Project Setup & Foundation | ✅ Complete | 100% |
| 2 | Database Models & Migrations | ✅ Complete | 100% |
| 3 | Business Logic & Services | ✅ Complete | 100% |
| 4 | Laporan (Reports) Services | ⏳ Pending | 0% |
| 5 | API Routes | ✅ Complete | 100% |
| 6 | Final Integration & Utilities | ✅ Complete | 100% |
| 7 | Deployment Preparation | ⏳ Pending | 0% |

---

## Session 3 Progress (2026-01-30)

### Services Completed (17 total)

#### Authentication & Master Data
1. ✅ `auth_service.py` - User authentication & JWT
2. ✅ `supplier_service.py` - Supplier CRUD + search
3. ✅ `customer_service.py` - Customer CRUD + summary + piutang

#### Bengkel (Workshop) Module
4. ✅ `spare_part_service.py` - Inventory + stock management
5. ✅ `pembelian_part_service.py` - Purchase transactions + stock update
6. ✅ `transaksi_bengkel_service.py` - Sales + HPP + piutang integration
7. ✅ `pengeluaran_service.py` - Expense tracking + summaries

#### Jual Beli Mobil (Car Sales) Module
8. ✅ `mobil_service.py` - Car inventory + biaya + part/service costs
9. ✅ `penjualan_mobil_service.py` - Sales + investor profit split

#### Jasa Angkut (Transportation) Module
10. ✅ `supir_service.py` - Driver management + statistics
11. ✅ `muatan_service.py` - Load/trip + 50% profit split

#### HR & Payroll Module
12. ✅ `karyawan_service.py` - Employee management + statistics
13. ✅ `absensi_service.py` - Attendance + clock in/out
14. ✅ `slip_gaji_service.py` - Payroll generation + payment
15. ✅ `kasbon_service.py` - Cash advance + piutang integration

#### Keuangan (Finance) Module
16. ✅ `piutang_service.py` - Receivables + payments + overdue tracking
17. ✅ `kas_bank_service.py` - Cash/bank ledger + balance tracking + transfer

---

## File Structure Summary

```
backend/
├── venv/                    ✅ Virtual environment
├── app/
│   ├── models/             ✅ 8 files (25 models)
│   │   ├── user.py
│   │   ├── supplier.py
│   │   ├── customer.py
│   │   ├── bengkel.py      (SparePart, Pembelian, Transaksi, Pengeluaran)
│   │   ├── mobil.py        (Mobil, BiayaLainnya, PartService, Transaksi)
│   │   ├── jasa_angkut.py  (Supir, Muatan, BiayaLainnya, PartService)
│   │   ├── karyawan.py     (Karyawan, Absensi, SlipGaji, Kasbon)
│   │   └── keuangan.py     (Piutang, Pembayaran, KasBank)
│   ├── schemas/            ✅ 7 files
│   │   ├── user.py
│   │   ├── master.py
│   │   ├── bengkel.py
│   │   ├── mobil.py
│   │   ├── jasa_angkut.py
│   │   ├── karyawan.py
│   │   └── keuangan.py
│   ├── services/           ✅ 17 files (COMPLETE)
│   │   ├── auth_service.py
│   │   ├── supplier_service.py
│   │   ├── customer_service.py
│   │   ├── spare_part_service.py
│   │   ├── pembelian_part_service.py     ✅ NEW
│   │   ├── transaksi_bengkel_service.py  ✅ NEW
│   │   ├── pengeluaran_service.py        ✅ NEW
│   │   ├── mobil_service.py              ✅ NEW
│   │   ├── penjualan_mobil_service.py    ✅ NEW
│   │   ├── supir_service.py              ✅ NEW
│   │   ├── muatan_service.py             ✅ NEW
│   │   ├── karyawan_service.py           ✅ NEW
│   │   ├── absensi_service.py            ✅ NEW
│   │   ├── slip_gaji_service.py          ✅ NEW
│   │   ├── kasbon_service.py             ✅ NEW
│   │   ├── piutang_service.py            ✅ NEW
│   │   └── kas_bank_service.py           ✅ NEW
│   └── api/v1/             ✅ 18 files (COMPLETE)
│       ├── auth.py
│       ├── suppliers.py
│       ├── customers.py
│       ├── spare_parts.py
│       ├── pembelian_parts.py
│       ├── transaksi_bengkel.py
│       ├── pengeluaran.py
│       ├── mobil.py
│       ├── penjualan_mobil.py
│       ├── supir.py
│       ├── muatan.py
│       ├── karyawan.py
│       ├── absensi.py
│       ├── slip_gaji.py
│       ├── kasbon.py
│       ├── piutang.py
│       ├── kas_bank.py
│       └── dashboard.py
└── requirements.txt
```

---

## Session 4 Progress (2026-01-30)

### Completed Tasks
1. ✅ **Registered all 18 API routes** in `router.py`
   - 162 endpoints now active
2. ✅ **Created `.env` file** for development
3. ✅ **Created database `tpm_db`** in MySQL
4. ✅ **Generated & applied Alembic migration** (initial_schema)
5. ✅ **Tested backend server** - running at http://127.0.0.1:8000

### API Routes Registered
| Route File | Endpoints | Status |
|------------|-----------|--------|
| auth.py | /auth/* | ✅ |
| suppliers.py | /suppliers/* | ✅ |
| customers.py | /customers/* | ✅ |
| spare_parts.py | /spare-parts/* | ✅ |
| pembelian_parts.py | /pembelian-parts/* | ✅ |
| transaksi_bengkel.py | /transaksi-bengkel/* | ✅ |
| pengeluaran.py | /pengeluaran/* | ✅ |
| mobil.py | /mobil/* | ✅ |
| penjualan_mobil.py | /penjualan-mobil/* | ✅ |
| supir.py | /supir/* | ✅ |
| muatan.py | /muatan/* | ✅ |
| karyawan.py | /karyawan/* | ✅ |
| absensi.py | /absensi/* | ✅ |
| slip_gaji.py | /slip-gaji/* | ✅ |
| kasbon.py | /kasbon/* | ✅ |
| piutang.py | /piutang/* | ✅ |
| kas_bank.py | /kas-bank/* | ✅ |
| dashboard.py | /dashboard/* | ✅ |

---

## Next Steps (Priority Order)

1. **Reports Services (Phase 4)**:
   - Daily/monthly sales reports
   - Profit/loss reports (Laba Rugi)
   - Stock reports
   - Financial statements

2. **Pengawas Feature** (if needed by frontend):
   - Model, schema, service, route

3. **Testing**:
   - Unit tests for services
   - Integration tests for API routes

---

## Commands Reference

```bash
# Activate virtual environment
cd backend
source venv/Scripts/activate  # Git Bash
# or
venv\Scripts\activate         # Windows CMD

# Run server
uvicorn app.main:app --reload

# Run tests
pytest

# Generate migration
alembic revision --autogenerate -m "message"

# Apply migration
alembic upgrade head
```

---

## Tech Stack

- **Python**: 3.10+
- **Framework**: FastAPI 0.104.1
- **ORM**: SQLAlchemy 2.0.23
- **Database**: MySQL 8.0
- **Auth**: JWT (python-jose)
- **Validation**: Pydantic 2.5.0
- **Migrations**: Alembic 1.12.1

---

## Business Rules Implemented

1. **Bengkel**: Auto-calculate HPP, laba_kotor, kembalian
2. **Jual Beli Mobil**: Investor profit split based on persentase_investor
3. **Jasa Angkut**: 50% profit split (TPM gets persentase_tpm)
4. **Slip Gaji**: Kasbon shown but NOT auto-deducted (manual)
5. **Piutang**: Auto-mark as LUNAS when sisa_piutang = 0
6. **KasBank**: Track saldo_sebelum & saldo_sesudah per transaction
7. **Soft Delete**: All master data uses deleted_at field
8. **Code Generation**: Auto-generate kode/nomor_transaksi if not provided
