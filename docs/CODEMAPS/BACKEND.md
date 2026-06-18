# Backend Codemap

**Last Updated:** 2026-06-17
**Entry Points:** `backend/app/main.py`, `backend/app/api/router.py`

## Project Structure

```
backend/
  app/
    main.py                 # FastAPI app factory, lifespan, monitoring dashboard, static files
    config.py               # Settings from env vars (Pydantic Settings)
    realtime.py             # WebSocket real-time manager
    api/
      router.py             # Aggregates all v1 routers under /api/v1
      deps.py               # Dependency injection (get_db, get_current_user)
      v1/                   # Route modules (one per business domain)
    middleware/
      cors.py               # CORS setup
      auth.py               # JWT auth middleware
      logging.py            # Request logging + metrics
      error_handler.py      # Global exception handlers
    database/
      base.py               # SQLAlchemy Base, TimestampMixin, SoftDeleteMixin
      connection.py         # DB session factory (SessionLocal, engine)
    models/                 # SQLAlchemy ORM model definitions
    schemas/                # Pydantic v2 request/response schemas
    services/               # Business logic layer
      reports/              # Financial report calculators
    utils/
      constants.py          # Enum definitions (statuses, payment methods, etc.)
      cache.py              # In-memory cache
      helpers.py            # Misc helpers (generate_number, etc.)
      validators.py         # Input validators
      security.py           # Password hashing, JWT encode/decode
      email.py              # SMTP email sender
    static/                 # Static assets (logo)
  alembic/                  # DB migration scripts
  requirements.txt          # Python dependencies
  Dockerfile                # Container build
```

## Architecture

```
HTTP Request
  -> FastAPI Router (api/v1/*.py)
    -> Middleware (auth, logging, cors)
      -> Service Layer (services/*.py)
        -> SQLAlchemy ORM (models/*.py)
          -> MySQL DB
```

## API Structure (`/api/v1/`)

All routes registered in `api/router.py` under `/api/v1/` prefix. Public endpoints mounted separately.

| Module | File | Prefix | Tags |
|--------|------|--------|------|
| auth | `api/v1/auth.py` | - | Auth |
| suppliers | `api/v1/suppliers.py` | - | Suppliers |
| customers | `api/v1/customers.py` | - | Customers |
| spare_parts | `api/v1/spare_parts.py` | - | Spare Parts |
| jasa_servis | `api/v1/jasa_servis.py` | /jasa-servis | Jasa Servis |
| pembelian_parts | `api/v1/pembelian_parts.py` | - | Part Purchases |
| transaksi_bengkel | `api/v1/transaksi_bengkel.py` | - | Workshop Transactions |
| pengeluaran | `api/v1/pengeluaran.py` | - | Expenses |
| mobil | `api/v1/mobil.py` | - | Cars |
| penjualan_mobil | `api/v1/penjualan_mobil.py` | - | Car Sales |
| supir | `api/v1/supir.py` | - | Drivers |
| muatan | `api/v1/muatan.py` | - | Cargo Manifests |
| karyawan | `api/v1/karyawan.py` | - | Employees |
| absensi | `api/v1/absensi.py` | - | Attendance |
| slip_gaji | `api/v1/slip_gaji.py` | - | Salary Slips |
| kasbon | `api/v1/kasbon.py` | - | Employee Advances |
| piutang | `api/v1/piutang.py` | - | Accounts Receivable |
| hutang | `api/v1/hutang.py` | - | Accounts Payable |
| kas_bank | `api/v1/kas_bank.py` | - | Cash & Bank |
| dashboard | `api/v1/dashboard.py` | - | Dashboard |
| laporan | `api/v1/laporan.py` | - | Reports |
| maintenance | `api/v1/maintenance.py` | - | Maintenance |
| armada | `api/v1/armada.py` | - | Fleet |
| assets | `api/v1/assets.py` | - | Assets |
| security | `api/v1/security.py` | - | Security |
| settings | `api/v1/settings.py` | - | Settings |
| user_cash | `api/v1/user_cash.py` | - | User Cash |
| backup | `api/v1/backup.py` | - | Backup |
| trash | `api/v1/trash.py` | /trash | Trash |
| master_data | `api/v1/master_data.py` | - | Master Data |
| realtime | `api/v1/realtime.py` | - | Realtime |
| public_receipt | `api/v1/public_receipt.py` | "" | Public Receipt |
| public_gallery | `api/v1/public_gallery.py` | "" | Public Gallery |

## Key Services (`app/services/`)

| Service | File | Responsibility |
|---------|------|----------------|
| auth_service | `services/auth_service.py` | Login, OTP, password reset, impersonation |
| transaksi_bengkel_service | `services/transaksi_bengkel_service.py` | Workshop SPK lifecycle, parts allocation |
| spare_part_service | `services/spare_part_service.py` | Stock management, low stock alerts |
| pembelian_part_service | `services/pembelian_part_service.py` | Purchase orders, receiving |
| mobil_service | `services/mobil_service.py` | Car inventory, cost capitalization |
| penjualan_mobil_service | `services/penjualan_mobil_service.py` | Car sales, margin calc, investor profit split |
| muatan_service | `services/muatan_service.py` | Cargo manifests, trip tracking |
| supir_service | `services/supir_service.py` | Driver management, default fleet assignment |
| armada_service | `services/armada_service.py` | Fleet vehicles, maintenance scheduling |
| karyawan_service | `services/karyawan_service.py` | Employee records |
| absensi_service | `services/absensi_service.py` | Daily attendance recording |
| slip_gaji_service | `services/slip_gaji_service.py` | Salary calculation, kasbon deductions |
| kasbon_service | `services/kasbon_service.py` | Employee advance/loan tracking |
| piutang_service | `services/piutang_service.py` | AR management, payment recording |
| hutang_service | `services/hutang_service.py` | AP management, payment recording |
| kas_bank_service | `services/kas_bank_service.py` | Cash/bank account mutations, transfers |
| kas_bank_integration | `services/kas_bank_integration.py` | Cross-service accounting integration |
| user_cash_service | `services/user_cash_service.py` | Cashier session open/close/reconciliation |
| pengeluaran_service | `services/pengeluaran_service.py` | Expense recording |
| jasa_servis_service | `services/jasa_servis_service.py` | Service catalog management |
| customer_service | `services/customer_service.py` | Customer records |
| supplier_service | `services/supplier_service.py` | Supplier records |
| asset_service | `services/asset_service.py` | Fixed asset management |
| backup_service | `services/backup_service.py` | DB backup/restore |
| trash_service | `services/trash_service.py` | Soft-deleted record management |
| maintenance_service | `services/maintenance_service.py` | System maintenance operations |
| push_notification_service | `services/push_notification_service.py` | Expo push notification dispatch |

### Report Services (`services/reports/`)

| Service | File | Report |
|---------|------|--------|
| laba_rugi_service | `services/reports/laba_rugi_service.py` | Profit & Loss statement |
| neraca_service | `services/reports/neraca_service.py` | Balance sheet |
| modal_service | `services/reports/modal_service.py` | Changes in equity |
| base | `services/reports/base.py` | Shared report helpers |

## Database Models (`app/models/`)

### Base Mixins (`database/base.py`)
- **Base** -- DeclarativeBase for all models
- **TimestampMixin** -- `created_at`, `updated_at` (auto-managed via func.now())
- **SoftDeleteMixin** -- `deleted_at` (nullable), `is_deleted` hybrid property

### bengkel.py (Workshop Domain)

| Model | Table | Key Fields |
|-------|-------|------------|
| SparePart | `spare_parts` | kode, nama, kode_part, kategori, stok, stok_minimum, harga_beli, harga_jual |
| JasaServis | `jasa_servis` | nama, kategori, harga, deskripsi |
| TransaksiPenjualanBengkel | `transaksi_penjualan_bengkel` | nomor_transaksi, customer_id, status (ANTRE/PROSES/SELESAI/BATAL), total_harga, total_bayar |
| DetailTransaksiSpareParts | `detail_transaksi_spare_parts` | transaksi_id, spare_part_id, kuantitas, harga_jual |
| DetailTransaksiJasa | `detail_transaksi_jasa` | transaksi_id, jasa_servis_id, harga |
| PembelianSparePart | `pembelian_spare_part` | nomor_pembelian, supplier_id, total, status |
| DetailPembelianSparePart | `detail_pembelian_spare_part` | pembelian_id, spare_part_id, kuantitas, harga_beli |
| PengeluaranBengkel | `pengeluaran_bengkel` | kategori (enum ExpenseCategory), jumlah, deskripsi, mobil_id (nullable) |

### mobil.py (Car Trading Domain)

| Model | Table | Key Fields |
|-------|-------|------------|
| Mobil | `mobil` | kode, merek, model, tahun, warna, nomor_plat, harga_beli, harga_jual, status (TERSEDIA/BOOKED/TERJUAL), tipe_kepemilikan (TPM/INVESTOR), persentase_investor, nominal_investor |
| BiayaMobil | `biaya_mobil` | mobil_id, kategori, jumlah, keterangan |
| InvestorMobil | `investor_mobil` | mobil_id, investor_id, porsi_modal, persentase |

### jasa_angkut.py (Transportation Domain)

| Model | Table | Key Fields |
|-------|-------|------------|
| Supir | `supir` | kode, nama, nik, nomor_sim, jenis_sim, is_active, armada_default_id |
| ArmadaJasaAngkut | `armada_jasa_angkut` | kode, nopol, merk, kapasitas, jenis, status (TERSEDIA/SERVICE/DIPAKAI) |
| MuatanJasaAngkut | `muatan_jasa_angkut` | nomor_muatan, supir_id, armada_id, tujuan, tgl_berangkat, status (PROSES/SELESAI/BATAL), total_tagihan |

### karyawan.py (HR Domain)

| Model | Table | Key Fields |
|-------|-------|------------|
| Karyawan | `karyawan` | kode, nama, nik, jabatan, gaji_pokok, tunjangan, status (AKTIF/KELUAR) |
| Absensi | `absensi` | karyawan_id, tanggal, status_hadir (HADIR/IZIN/SAKTI/ALPA/DINAS) |
| SlipGaji | `slip_gaji` | karyawan_id, periode, gaji_pokok, tunjangan, potongan, total_kasbon, total_diterima, status (DRAFT/DIBAYAR) |

### keuangan.py (Finance Domain)

| Model | Table | Key Fields |
|-------|-------|------------|
| PiutangUsaha | `piutang_usaha` | nomor_piutang, sumber (BENGKEL/JASA_ANGKUT/MOBIL), nominal_piutang, total_dibayar, sisa_piutang, status (BELUM_LUNAS/LUNAS/DIHAPUS), tanggal_jatuh_tempo |
| HutangUsaha | `hutang_usaha` | nomor_hutang, sumber, nominal_hutang, total_dibayar, sisa_hutang, status |
| KasBank | `kas_bank` | tanggal, jenis (MASUK/KELUAR/TRANSFER), kategori, jumlah, sumber, akun_id, referensi_id, catatan |
| AkunKasBank | `akun_kas_bank` | kode, nama, jenis (KAS/BANK), saldo_normal (DEBIT/KREDIT) |
| UserCash | `user_cash` | user_id, saldo_awal, saldo_akhir, status (BUKA/TUTUP), tanggl_buka, tanggl_tutup |
| Coa (ChartOfAccounts) | `coa` | kode, nama, tipe (AKTIVA/PASIVA/MODAL/PENDAPATAN/BIAYA), induk_id, saldo_normal |
| JurnalUmum | `jurnal_umum` | nomor_jurnal, tanggal, keterangan, total_debit, total_kredit |

### Other Models

| Model | Table | Key Fields |
|-------|-------|------------|
| User | `users` | username, email, full_name, role (enum UserRole), is_active, last_login, profile_picture |
| Customer | `customers` | nama, telepon, alamat |
| Supplier | `suppliers` | kode, nama, telepon, alamat, saldo_hutang |
| SystemSetting | `system_settings` | key, value, kategori |

## Key Enums (`utils/constants.py`)

| Enum | Values |
|------|--------|
| UserRole | ADMIN, MANAGER, KASIR, MEKANIK, STAFF, VIEWER, BENGKEL, JASA_ANGKUT, MOBIL |
| WorkshopStatus | ANTRE, PROSES, SELESAI, BATAL |
| PaymentStatus | LUNAS, BELUM_LUNAS, ANGSURAN |
| PaymentMethod | TUNAI, TRANSFER, QRIS, GIRO, KARTU_KREDIT, DEBIT |
| PiutangStatus | BELUM_LUNAS, LUNAS, DIHAPUS |
| PiutangSource | BENGKEL, JASA_ANGKUT, MOBIL, INTERNAL |
| HutangStatus | BELUM_LUNAS, LUNAS, DIHAPUS |
| KasBankType | MASUK, KELUAR, TRANSFER |
| KasBankSource | BENGKEL, JASA_ANGKUT, MOBIL, PUSAT, OPERASIONAL |
| EmployeeStatus | AKTIF, KELUAR |
| AttendanceStatus | HADIR, IZIN, SAKIT, ALPA, DINAS |
| CarStatus | TERSEDIA, BOOKED, TERJUAL |
| OwnershipType | TPM, INVESTOR |
| ExpenseCategory | (workshop expense categories) |
| MuatanStatus | PROSES, SELESAI, BATAL |
| TransactionType | PEMBELIAN, PENJUALAN, RETUR, ADJUSTMENT |
| AssetCategory | (fixed asset categories) |
| AssetStatus | (asset lifecycle status) |

## Middleware

| Middleware | File | Behavior |
|------------|------|----------|
| CORS | `middleware/cors.py` | Allow all origins in debug, restricted in production |
| Auth | `middleware/auth.py` | JWT bearer token validation, role-based access |
| Logging | `middleware/logging.py` | Request/response logging, metrics collection (total_reqs, avg_latency) |
| Error Handler | `middleware/error_handler.py` | Global exception -> JSON response, validation error formatting |

## Data Flow (Financial)

```
Transaction (Bengkel/Mobil/Angkut)
  -> Service layer (kalkulasi + jurnal entry)
    -> KasBankService.create_mutation (debit/credit)
      -> Update PiutangUsaha / HutangUsaha balance
        -> CoA journal entry (double-entry)
          -> Report services (neraca, laba_rugi, modal)
```

## External Dependencies

| Package | Purpose |
|---------|---------|
| fastapi | Web framework |
| sqlalchemy | ORM (2.x style with Mapped/mapped_column) |
| alembic | DB migrations |
| pydantic v2 | Request/response validation |
| python-jose | JWT encode/decode |
| passlib + bcrypt | Password hashing |
| mysql-connector-python | MySQL driver |
| python-multipart | File uploads |
| aiosmtplib | Async email |
| pytz | Timezone handling |

## Related Areas

- [Frontend Codemap](FRONTEND.md)
- [Root INDEX](INDEX.md)
