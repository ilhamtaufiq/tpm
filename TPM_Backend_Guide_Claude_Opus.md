# PANDUAN BACKEND DEVELOPMENT DENGAN CLAUDE OPUS
## Aplikasi Tiga Putra Motor (TPM)

---

## 📋 OVERVIEW

Panduan ini berisi prompt-prompt lengkap untuk membangun backend aplikasi TPM menggunakan Claude Opus. Setiap section memiliki prompt yang sudah siap pakai dan terstruktur.

**Tech Stack Backend:**
- FastAPI 0.104.1
- SQLAlchemy 2.0.23
- MySQL 8.0
- Python 3.11+
- JWT Authentication
- Alembic (migrations)

---

## 🚀 PHASE 1: PROJECT SETUP & FOUNDATION

### 1.1 Initial Project Structure

**Prompt untuk Claude Opus:**

```
Role: Senior Backend Architect

Task: Setup FastAPI project structure untuk aplikasi Tiga Putra Motor

Requirements:
Buatkan complete project structure dengan:

1. Folder structure yang scalable:
   - app/ (main application)
   - app/api/ (API routes)
   - app/models/ (SQLAlchemy models)
   - app/schemas/ (Pydantic schemas)
   - app/services/ (Business logic)
   - app/database/ (DB config)
   - app/utils/ (Utilities)
   - app/middleware/ (Custom middleware)
   - alembic/ (Migrations)
   - tests/ (Test files)

2. Configuration files:
   - main.py (FastAPI app initialization)
   - config.py (Environment config dengan pydantic-settings)
   - .env.example
   - requirements.txt (dengan versions)
   - alembic.ini

3. Core setup:
   - Database connection dengan connection pooling
   - CORS configuration
   - Logger setup
   - Error handlers (global exception handler)
   - Health check endpoint

4. Development utilities:
   - Docker compose untuk MySQL
   - Makefile untuk common tasks
   - .gitignore

Tech stack versions:
- Python 3.11+
- FastAPI 0.104.1
- SQLAlchemy 2.0.23
- MySQL 8.0
- Pydantic 2.5.0

Best practices:
- Environment-based configuration
- Proper error handling
- Security headers
- Request ID tracking
- SQL query logging (development only)

Output:
Generate semua files dengan complete code, not just structure.
Include comments untuk explain complex parts.
```

### 1.2 Database Configuration & Connection

**Prompt untuk Claude Opus:**

```
Role: Database Engineer

Task: Setup database configuration dan connection management

Context:
- Database: MySQL 8.0
- ORM: SQLAlchemy 2.0.23
- Alembic untuk migrations

Requirements:

1. Database Connection (app/database/connection.py):
   - Connection pooling configuration
   - Async session management
   - Connection retry logic
   - Health check function
   - Proper session cleanup

2. Base Model (app/database/base.py):
   - Base class untuk semua models
   - Common fields (id, created_at, updated_at)
   - Soft delete support (deleted_at field)
   - UUID generation helper

3. Database Config (app/config.py):
   - Environment-based settings:
     * Development
     * Staging
     * Production
   - Database URL construction
   - Connection pool settings
   - Timezone configuration (Asia/Jakarta)

4. Alembic Setup:
   - Configure alembic.ini
   - env.py dengan auto-detect models
   - Migration script template

Database credentials structure:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=tpm_user
DB_PASSWORD=secure_password
DB_NAME=tpm_db
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10
DB_POOL_TIMEOUT=30
```

Performance considerations:
- Connection pooling best practices
- Query optimization tips
- Index recommendations

Security:
- No hardcoded credentials
- SSL connection for production
- Least privilege principle

Output:
Complete implementation dengan error handling dan logging.
```

### 1.3 Authentication System

**Prompt untuk Claude Opus:**

```
Role: Security Engineer

Task: Implement secure authentication system dengan JWT

Requirements:

1. JWT Token Management (app/utils/security.py):
   - Generate access token (15 min expiry)
   - Generate refresh token (7 days expiry)
   - Verify token dengan error handling
   - Password hashing (bcrypt)
   - Password verification
   - Token blacklist support (optional)

2. User Model (app/models/user.py):
   ```python
   Fields:
   - id (UUID primary key)
   - username (unique, indexed)
   - email (unique, indexed)
   - password_hash
   - nama_lengkap
   - role (ENUM: admin, manager, staff)
   - is_active (boolean)
   - last_login (timestamp)
   - created_at, updated_at, deleted_at
   ```

3. Auth Schemas (app/schemas/user.py):
   - UserRegister (input)
   - UserLogin (input)
   - TokenResponse (output)
   - UserResponse (output)
   - Dengan validation rules

4. Auth Service (app/services/auth_service.py):
   - register_user (dengan password validation)
   - login_user (return tokens)
   - refresh_token
   - verify_token
   - get_current_user
   - change_password

5. Auth Routes (app/api/v1/auth.py):
   - POST /auth/register
   - POST /auth/login
   - POST /auth/refresh
   - GET /auth/me (protected)
   - PUT /auth/change-password (protected)

6. Auth Middleware (app/middleware/auth.py):
   - Token verification middleware
   - Role-based access control
   - Dependency injection untuk protected routes

JWT Configuration:
```env
JWT_SECRET_KEY=your-secret-key-min-32-chars
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
```

Security requirements:
- Password strength validation (min 8 chars, upper, lower, number)
- Rate limiting untuk login attempts
- Token rotation
- Secure password hashing (bcrypt rounds: 12)
- SQL injection prevention
- XSS protection

Error handling:
- Invalid credentials (401)
- Token expired (401)
- Invalid token (401)
- User not found (404)
- User already exists (409)

Output:
Complete implementation dengan comprehensive error handling,
logging, dan inline documentation.
```

---

## 🗄️ PHASE 2: DATABASE MODELS & MIGRATIONS

### 2.1 Master Data Models

**Prompt untuk Claude Opus:**

```
Role: Database Architect

Task: Create SQLAlchemy models untuk Master Data (Suppliers & Customers)

Context:
Referensi TPM_App_Documentation.md section 4.1

Requirements:

1. Supplier Model (app/models/supplier.py):
   ```python
   Table: suppliers
   Fields:
   - id (INT, PK, Auto Increment)
   - nama_supplier (VARCHAR 200, NOT NULL, indexed)
   - no_hp (VARCHAR 20)
   - alamat (TEXT)
   - status (ENUM: aktif, nonaktif, DEFAULT aktif)
   - created_at, updated_at (timestamps)
   - deleted_at (soft delete)
   
   Relationships:
   - pembelian_spare_parts (one to many)
   - mobil (one to many)
   
   Methods:
   - __repr__
   - to_dict
   ```

2. Customer Model (app/models/customer.py):
   ```python
   Table: customers
   Fields:
   - id (INT, PK, Auto Increment)
   - nama_customer (VARCHAR 200, NOT NULL, indexed)
   - no_hp (VARCHAR 20)
   - nomor_plat (VARCHAR 20, indexed)
   - alamat (TEXT)
   - status (ENUM: aktif, nonaktif, DEFAULT aktif)
   - created_at, updated_at
   - deleted_at
   
   Relationships:
   - transaksi_penjualan_bengkel (one to many)
   - transaksi_penjualan_mobil (one to many)
   - piutang_usaha (one to many)
   ```

Indexes needed:
- nama_supplier, nama_customer (untuk search)
- nomor_plat (untuk quick lookup)
- status (untuk filtering)
- created_at (untuk sorting)

Model features:
- Soft delete implementation
- Timestamp auto-update
- Custom query methods (active_only, search)
- Validation constraints

Best practices:
- Use declarative base
- Proper type hints
- Relationship lazy loading configuration
- Index optimization

Output:
Complete SQLAlchemy models dengan:
- All fields properly typed
- Relationships defined
- Indexes declared
- Custom methods
- Comprehensive docstrings
```

### 2.2 Bengkel Models

**Prompt untuk Claude Opus:**

```
Role: Database Architect

Task: Create SQLAlchemy models untuk Modul Bengkel

Context:
Referensi TPM_App_Documentation.md section 4.1 (Bengkel tables)

Requirements:

Create 6 related models:

1. SparePartModel (spare_parts):
   - id, nama_spare_part, kode_barang (unique)
   - harga_beli_terakhir, harga_jual
   - stock (INT), stock_minimum (INT)
   - status (ENUM: tersedia, menipis, habis)
   - timestamps
   
   Methods:
   - update_stock(quantity, operation='add'/'subtract')
   - check_stock_status() -> update status based on stock
   - calculate_hpp(quantity)

2. PembelianSparePartModel (pembelian_spare_parts):
   - id, tanggal_pembelian, spare_part_id (FK)
   - kuantitas, harga_beli, harga_jual
   - total_harga_beli (calculated)
   - supplier_id (FK)
   - metode_pembayaran (ENUM: cash, transfer, hutang)
   - nomor_referensi, catatan
   - status_hutang (ENUM: lunas, belum_lunas)
   - timestamps

3. TransaksiPenjualanBengkelModel:
   - id, nomor_transaksi (unique, indexed)
   - tanggal_transaksi (DATETIME)
   - customer_id (FK, nullable)
   - nama_customer (VARCHAR), nomor_plat
   - nama_mekanik
   - subtotal, diskon_persen, diskon_nominal
   - total_akhir, dp_pembayaran, sisa_pembayaran
   - metode_pembayaran
   - total_hpp, laba_kotor (calculated)
   - status_pembayaran (ENUM: lunas, piutang, dp)
   - catatan
   - timestamps

4. DetailTransaksiSparePartModel:
   - id, transaksi_id (FK)
   - spare_part_id (FK)
   - nama_spare_part (untuk historical data)
   - kuantitas, harga_satuan, hpp_satuan
   - subtotal (calculated)
   - On delete: CASCADE

5. DetailTransaksiServiceModel:
   - id, transaksi_id (FK)
   - nama_service
   - harga
   - On delete: CASCADE

6. PengeluaranBengkelModel:
   - id, tanggal, kategori (ENUM)
   - nama_biaya, nama_peminjam (nullable)
   - nominal, metode_pembayaran
   - status_hutang
   - catatan
   - timestamps

Relationships:
- Proper FK constraints
- Cascade deletes where needed
- Lazy loading configuration
- Backref setup

Business Logic Methods:
- generate_nomor_transaksi() -> TPM-YYYYMMDD-XXXX
- calculate_totals() -> update subtotal, total_akhir, laba_kotor
- validate_stock() -> check stock availability
- process_payment() -> handle pelunasan

Indexes:
- nomor_transaksi (unique)
- tanggal_transaksi (for range queries)
- customer_id (for customer history)
- status_pembayaran (for filtering)
- spare_part_id (for inventory queries)

Triggers/Events (via SQLAlchemy events):
- Before insert transaksi: validate stock
- After insert transaksi: update stock spare parts
- After update pembayaran: update piutang

Output:
Complete models dengan:
- All relationships properly defined
- Business logic methods
- Calculated fields as properties
- Events/triggers using SQLAlchemy events
- Comprehensive validation
- Docstrings for all methods
```

### 2.3 Jual Beli Mobil Models

**Prompt untuk Claude Opus:**

```
Role: Database Architect

Task: Create SQLAlchemy models untuk Modul Jual Beli Mobil

Requirements:

Create 5 related models:

1. MobilModel (mobil):
   - id, tanggal_pembelian
   - merk, model, tahun
   - nomor_plat (unique, indexed)
   - nomor_rangka (unique, indexed)
   - nomor_mesin, warna
   - harga_beli, metode_pembayaran_beli
   - supplier_id (FK)
   - total_biaya_lainnya (calculated)
   - total_part_service (calculated)
   - total_modal (calculated)
   - harga_jual_target
   - status (ENUM: tersedia, terjual, proses)
   - catatan
   - timestamps
   
   Properties:
   - total_modal -> harga_beli + biaya_lainnya + part_service
   - margin -> harga_jual_target - total_modal
   - margin_percentage
   
   Methods:
   - add_biaya_lainnya(nama, nominal, metode)
   - add_part_service(transaksi_bengkel_id, metode)
   - mark_as_sold()
   - calculate_totals()

2. MobilPhotoModel (mobil_photos):
   - id, mobil_id (FK)
   - photo_url (VARCHAR 500)
   - is_primary (BOOLEAN)
   - created_at
   - On delete: CASCADE

3. MobilBiayaLainnyaModel:
   - id, mobil_id (FK)
   - nama_biaya, nominal
   - metode_pembayaran (ENUM: cash, transfer)
   - tanggal
   - created_at
   - On delete: CASCADE

4. MobilPartServiceModel:
   - id, mobil_id (FK)
   - transaksi_bengkel_id (FK)
   - metode_pembayaran (ENUM: cash, transfer, piutang_part_jb_mobil)
   - created_at
   - On delete: CASCADE

5. TransaksiPenjualanMobilModel:
   - id, nomor_transaksi (unique)
   - tanggal_penjualan
   - mobil_id (FK)
   - customer_id (FK, nullable)
   - nama_customer, no_hp_customer, alamat_customer
   - harga_jual, dp_pembayaran, sisa_pembayaran
   - metode_pembayaran (ENUM: cash, transfer, piutang_jb_mobil)
   - laba_kotor (calculated)
   - laba_investor (calculated)
   - laba_tpm (calculated)
   - status_pembayaran (ENUM: lunas, cicilan)
   - catatan
   - timestamps
   
   Methods:
   - calculate_profit(investor_percentage=0)
   - process_payment(amount)
   - generate_invoice()

Relationships:
- Mobil -> Photos (one to many)
- Mobil -> BiayaLainnya (one to many)
- Mobil -> PartService (one to many)
- Mobil -> TransaksiPenjualan (one to one)

Business Rules:
- Total modal auto-calculate saat ada perubahan biaya
- Status mobil auto-update saat terjual
- Validate stock (tidak bisa jual mobil yang sudah terjual)
- Calculate profit split (investor vs TPM)

Indexes:
- nomor_plat, nomor_rangka (unique, untuk quick lookup)
- status (untuk filtering available cars)
- tanggal_pembelian (untuk inventory age)

Output:
Complete models dengan semua business logic terintegrasi.
```

### 2.4 Jasa Angkut Models

**Prompt untuk Claude Opus:**

```
Role: Database Architect

Task: Create SQLAlchemy models untuk Modul Jasa Angkut

Requirements:

Create 4 related models:

1. SupirModel (supir):
   - id, nama_supir (indexed)
   - no_hp, alamat
   - status (ENUM: aktif, nonaktif)
   - timestamps, deleted_at
   
   Methods:
   - get_total_muatan(periode)
   - get_total_setoran(periode)
   - get_piutang()

2. MuatanJasaAngkutModel (muatan_jasa_angkut):
   - id, supir_id (FK)
   - tanggal, tujuan
   - jenis_muatan, berat_volume
   - biaya_angkut
   - laba_tpm (50% dari biaya_angkut)
   - total_setoran (equals laba_tpm)
   - metode_pembayaran (ENUM: cash, transfer, piutang_supir)
   - status_pembayaran (ENUM: lunas, piutang)
   - catatan
   - timestamps
   
   Properties:
   - laba_tpm -> biaya_angkut * 0.5
   - total_setoran -> laba_tpm
   
   Methods:
   - calculate_profit() -> set laba_tpm dan total_setoran
   - add_biaya_lainnya(nama, nominal, metode)
   - add_part_service(transaksi_bengkel_id)
   - process_payment(amount)

3. JasaAngkutBiayaLainnyaModel:
   - id, muatan_id (FK)
   - nama_biaya, nominal
   - metode_pembayaran (ENUM: cash, transfer)
   - tanggal
   - created_at
   - On delete: CASCADE
   
   Note: Tidak mempengaruhi saldo setoran

4. JasaAngkutPartServiceModel:
   - id, muatan_id (FK)
   - transaksi_bengkel_id (FK)
   - created_at
   - On delete: CASCADE
   
   Note: Masuk ke laporan laba rugi, mengurangi laba TPM

Relationships:
- Supir -> Muatan (one to many)
- Muatan -> BiayaLainnya (one to many)
- Muatan -> PartService (one to many)

Business Rules:
- Laba TPM always 50% dari biaya angkut
- Biaya lainnya tidak mengurangi setoran
- Part & service masuk ke laba rugi bengkel
- Auto calculate saat input muatan

Indexes:
- supir_id (for driver queries)
- tanggal (for period filtering)
- status_pembayaran (for piutang tracking)

Output:
Complete models dengan profit calculation logic.
```

### 2.5 Karyawan & Absensi Models

**Prompt untuk Claude Opus:**

```
Role: Database Architect

Task: Create SQLAlchemy models untuk Modul Karyawan & Absensi

Requirements:

Create 4 related models:

1. KaryawanModel (karyawan):
   - id, nama_karyawan (indexed)
   - jabatan, gaji_pokok, tunjangan
   - no_hp, alamat
   - tanggal_bergabung
   - status (ENUM: aktif, nonaktif)
   - timestamps, deleted_at
   
   Methods:
   - calculate_gaji(periode) -> based on attendance
   - get_total_kasbon()
   - get_slip_gaji(periode)

2. AbsensiModel (absensi):
   - id, karyawan_id (FK)
   - tanggal (date)
   - status (ENUM: hadir, izin, sakit, alpa)
   - jam_masuk (time), jam_keluar (time)
   - catatan
   - timestamps
   
   Unique constraint: (karyawan_id, tanggal)
   
   Methods:
   - calculate_hours_worked()
   - is_late() -> check jam_masuk > 08:00

3. SlipGajiModel (slip_gaji):
   - id, karyawan_id (FK)
   - periode_bulan (1-12)
   - periode_tahun (YEAR)
   - jumlah_hadir (INT)
   - gaji_pokok, tunjangan
   - total_gaji (calculated)
   - kasbon (informational only, tidak auto kurang)
   - total_gaji_dibayarkan (manual input, NOT total_gaji - kasbon)
   - metode_pembayaran (ENUM: cash, transfer, hutang)
   - status (ENUM: dibayar, belum_dibayar)
   - tanggal_pembayaran
   - catatan
   - timestamps
   
   Unique constraint: (karyawan_id, periode_bulan, periode_tahun)
   
   Properties:
   - total_gaji -> gaji_pokok + tunjangan
   
   Methods:
   - generate_slip() -> based on attendance
   - process_payment(amount, metode)
   - mark_as_paid()

4. KasbonKaryawanModel (kasbon_karyawan):
   - id, karyawan_id (FK)
   - tanggal, nominal
   - keterangan
   - status (ENUM: aktif, lunas)
   - timestamps
   
   Methods:
   - mark_as_paid()

Relationships:
- Karyawan -> Absensi (one to many)
- Karyawan -> SlipGaji (one to many)
- Karyawan -> Kasbon (one to many)

Business Rules:
- Total gaji calculated from attendance (hadir days)
- Formula: (gaji_pokok / total_days) * jumlah_hadir + tunjangan
- Kasbon shown but NOT auto-deducted
- Manager manually input total_gaji_dibayarkan
- Slip gaji generated per periode

Indexes:
- karyawan_id (for employee queries)
- tanggal (for date range)
- periode (for payroll period)
- status (for filtering)

Validation:
- tanggal_pembayaran only if status = dibayar
- total_gaji_dibayarkan <= total_gaji
- periode_bulan between 1-12

Output:
Complete models dengan payroll calculation logic.
```

### 2.6 Piutang & Kas Bank Models

**Prompt untuk Claude Opus:**

```
Role: Database Architect

Task: Create SQLAlchemy models untuk Piutang & Kas Bank tracking

Requirements:

Create 3 models:

1. PiutangUsahaModel (piutang_usaha):
   - id, customer_id (FK)
   - sumber (ENUM: bengkel, jual_beli_mobil)
   - transaksi_id (INT) -> reference to source transaction
   - nominal_piutang (original amount)
   - sisa_piutang (remaining)
   - status (ENUM: aktif, lunas)
   - timestamps
   
   Properties:
   - amount_paid -> nominal_piutang - sisa_piutang
   - payment_percentage
   
   Methods:
   - process_payment(amount) -> update sisa_piutang
   - mark_as_paid() -> status = lunas, sisa = 0
   - get_payment_history()

2. PembayaranPiutangModel (pembayaran_piutang):
   - id, piutang_id (FK)
   - tanggal_pembayaran
   - nominal_bayar
   - metode_pembayaran (ENUM: cash, transfer)
   - catatan
   - created_at
   - On delete: CASCADE
   
   Events:
   - After insert -> update piutang sisa_piutang

3. KasBankModel (kas_bank):
   - id, tanggal
   - jenis (ENUM: cash, bank_bca)
   - tipe_transaksi (ENUM: masuk, keluar)
   - nominal
   - sumber (VARCHAR 200) -> e.g., "bengkel", "jual_beli_mobil"
   - referensi_id (INT) -> ID of source transaction
   - keterangan (TEXT)
   - saldo_sebelum, saldo_sesudah
   - created_at
   
   Indexes:
   - (jenis, tanggal) -> for balance queries
   - sumber -> for source filtering
   - tanggal -> for period reports
   
   Methods (Class level):
   - get_current_balance(jenis='cash') -> current balance
   - record_transaction(jenis, tipe, nominal, sumber, ref_id, ket)
   - get_transactions(jenis, date_from, date_to)
   - reconcile(jenis) -> compare with actual

Relationships:
- PiutangUsaha -> Customer (many to one)
- PiutangUsaha -> PembayaranPiutang (one to many)

Business Rules:
- Every financial transaction must be recorded in kas_bank
- Saldo calculated before each transaction
- Cannot delete kas_bank records (audit trail)
- Piutang auto-marked lunas when sisa = 0
- Prevent negative saldo (validation)

Transaction Flow Examples:

1. Transaksi Bengkel (Lunas Cash):
   - Record in transaksi_penjualan_bengkel
   - Record in kas_bank (masuk, cash, nominal=total_akhir)

2. Transaksi Bengkel (Piutang):
   - Record in transaksi_penjualan_bengkel
   - Create piutang_usaha record
   - When paid: record in pembayaran_piutang + kas_bank

3. Pembelian Part (Cash):
   - Record in pembelian_spare_parts
   - Record in kas_bank (keluar, cash, nominal=total)

Validation:
- sisa_piutang cannot be negative
- sisa_piutang cannot exceed nominal_piutang
- saldo_sesudah = saldo_sebelum +/- nominal

Output:
Complete models dengan transaction recording logic.
```

### 2.7 Database Migrations

**Prompt untuk Claude Opus:**

```
Role: Database Engineer

Task: Create Alembic migration scripts untuk semua tables

Context:
Semua models sudah dibuat di phase 2.1 - 2.6

Requirements:

Generate migration scripts in proper order (resolve dependencies):

Migration 1: users table
Migration 2: master data (suppliers, customers)
Migration 3: spare_parts, pembelian_spare_parts
Migration 4: transaksi_penjualan_bengkel & details
Migration 5: pengeluaran_bengkel
Migration 6: mobil & related tables
Migration 7: transaksi_penjualan_mobil
Migration 8: supir & muatan_jasa_angkut
Migration 9: karyawan, absensi, slip_gaji, kasbon
Migration 10: piutang_usaha & kas_bank

Each migration must include:
1. Create table with all fields
2. Add indexes
3. Add foreign keys
4. Add constraints (unique, check)
5. Create ENUM types (if needed for MySQL)
6. Upgrade function
7. Downgrade function (rollback)

Additional requirements:
- Add comments to tables and columns (for documentation)
- Set proper charset (utf8mb4) and collation
- Set default timezone (Asia/Jakarta)
- Add triggers for auto-update timestamps

Example structure needed:
```python
def upgrade():
    # Create table
    op.create_table(
        'table_name',
        # columns...
    )
    
    # Create indexes
    op.create_index(...)
    
    # Add foreign keys
    op.create_foreign_key(...)

def downgrade():
    # Drop in reverse order
    op.drop_table('table_name')
```

MySQL specific considerations:
- Use InnoDB engine
- Set proper charset/collation
- Handle ENUM type creation
- Large TEXT fields storage optimization

Output:
Complete Alembic migration scripts dengan proper dependencies.
```

---

## 🔧 PHASE 3: BUSINESS LOGIC & SERVICES

### 3.1 Master Data Services

**Prompt untuk Claude Opus:**

```
Role: Senior Backend Developer

Task: Implement service layer untuk Master Data (Suppliers & Customers)

Context:
- Models: SupplierModel, CustomerModel (already created)
- Pydantic schemas needed for validation

Requirements:

1. Create Pydantic Schemas (app/schemas/master.py):

SupplierSchemas:
- SupplierCreate (input validation)
  * nama_supplier: required, min 3, max 200
  * no_hp: optional, phone format validation
  * alamat: optional

- SupplierUpdate (partial update)
  * all fields optional

- SupplierResponse (output)
  * include all fields + timestamps
  * exclude deleted_at if null

- SupplierList (for listing)
  * with pagination metadata

CustomerSchemas:
- CustomerCreate, CustomerUpdate, CustomerResponse, CustomerList
  * similar structure to Supplier
  * Additional: nomor_plat validation (uppercase)

2. Supplier Service (app/services/supplier_service.py):

Methods:
- create_supplier(data: SupplierCreate) -> Supplier
  * Validate duplicate nama_supplier
  * Create record
  * Return with response schema
  * Error handling

- get_supplier(supplier_id: int) -> Supplier
  * Check if exists
  * Check if not deleted
  * Return supplier
  * Raise 404 if not found

- get_suppliers(
    skip: int = 0,
    limit: int = 20,
    search: str = None,
    status: str = None,
    sort_by: str = "created_at",
    sort_order: str = "desc"
  ) -> Dict[str, Any]
  * Filtering by status
  * Search by nama_supplier (LIKE)
  * Pagination
  * Sorting
  * Return: {data: [...], total: N, page: X, size: Y}

- update_supplier(supplier_id: int, data: SupplierUpdate) -> Supplier
  * Validate exists
  * Update fields (only provided fields)
  * Validate duplicate nama if changing
  * Return updated supplier

- delete_supplier(supplier_id: int) -> bool
  * Soft delete (set deleted_at)
  * Check if has related records (pembelian)
  * Warn if has active references
  * Return success status

- activate_supplier(supplier_id: int) -> Supplier
  * Change status to aktif
  * Return supplier

- deactivate_supplier(supplier_id: int) -> Supplier
  * Change status to nonaktif
  * Check if has pending transactions
  * Return supplier

- search_suppliers(query: str, limit: int = 10) -> List[Supplier]
  * For autocomplete/dropdown
  * Search by nama, no_hp
  * Return limited results

3. Customer Service (app/services/customer_service.py):
Similar structure as SupplierService plus:

Additional methods:
- get_customer_history(customer_id: int, source: str = None)
  * Get transaction history (bengkel & mobil)
  * Optional filter by source
  * Return combined history

- get_customer_piutang(customer_id: int) -> Dict
  * Get all active piutang
  * Calculate total piutang
  * Return summary

- search_by_plat(nomor_plat: str) -> Customer
  * Quick search by plat number
  * For transaction forms

Error Handling:
- DuplicateError (409)
- NotFoundError (404)
- ValidationError (422)
- DatabaseError (500)

Logging:
- Log all CRUD operations
- Log search queries (for analytics)
- Log errors with context

Transaction Management:
- Use database session properly
- Rollback on errors
- Commit on success

Output:
Complete service implementations dengan:
- Comprehensive error handling
- Proper logging
- Transaction management
- Docstrings for all methods
- Type hints
```

### 3.2 Bengkel Services

**Prompt untuk Claude Opus:**

```
Role: Senior Backend Developer

Task: Implement service layer untuk Modul Bengkel

Context:
Complex business logic untuk transaksi bengkel, stock management

Requirements:

1. Pydantic Schemas (app/schemas/bengkel.py):

SparePartSchemas:
- SparePartCreate, SparePartUpdate, SparePartResponse
- Additional: stock validation (>= 0)

PembelianPartSchemas:
- PembelianCreate:
  * spare_part_id, kuantitas, harga_beli, harga_jual
  * supplier_id, metode_pembayaran
  * Validation: kuantitas > 0, harga > 0
- PembelianResponse

TransaksiPenjualanSchemas:
- TransaksiPenjualanCreate:
  ```python
  customer_id: Optional[int]
  nama_customer: Optional[str]
  nomor_plat: Optional[str]
  nama_mekanik: str
  items: List[TransaksiItem]  # spare parts
  services: List[ServiceItem]  # jasa service
  diskon_persen: Optional[float] = 0
  diskon_nominal: Optional[Decimal] = 0
  metode_pembayaran: str
  dp_pembayaran: Optional[Decimal] = 0
  ```
  
- TransaksiItem:
  ```python
  spare_part_id: int
  kuantitas: int
  harga_satuan: Decimal  # bisa custom, default dari spare_part
  ```
  
- ServiceItem:
  ```python
  nama_service: str
  harga: Decimal
  ```

- TransaksiPenjualanResponse (with full details)
- TransaksiPenjualanList

PengeluaranSchemas:
- PengeluaranCreate, PengeluaranUpdate, PengeluaranResponse

2. SparePartService (app/services/spare_part_service.py):

Methods:
- Standard CRUD (create, get, update, delete, list)

- update_stock(spare_part_id, quantity, operation='add'/'subtract')
  * Update stock field
  * Recalculate status (tersedia/menipis/habis)
  * Log stock movement
  * Raise error if insufficient stock

- get_low_stock_items(threshold: int = None) -> List
  * Return items below stock_minimum
  * For alerts/notifications

- get_stock_value() -> Decimal
  * Calculate total inventory value
  * Sum(stock * harga_beli_terakhir)

- search_for_transaction(query: str, limit: int = 20)
  * Search by nama or kode_barang
  * Return with stock info
  * For transaction form dropdown

3. PembelianPartService (app/services/pembelian_part_service.py):

- create_pembelian(data: PembelianCreate) -> Pembelian
  ```python
  Process:
  1. Validate spare_part exists
  2. Create pembelian record
  3. Update spare_part:
     - stock += kuantitas
     - harga_beli_terakhir = harga_beli
     - harga_jual = harga_jual (if changed)
     - status = recalculate
  4. Record in kas_bank (if cash/transfer)
  5. Create hutang record (if hutang)
  6. Commit transaction
  ```
  
  Error handling:
  - Rollback on any error
  - Log error details

- get_pembelian_list(filters) -> List
  * Filter by date range, supplier, metode_pembayaran
  * Include spare_part details
  * Include supplier details
  * Pagination

- get_pembelian_summary(date_from, date_to) -> Dict
  * Total pembelian by metode_pembayaran
  * Total quantity by spare_part
  * Total value

4. TransaksiPenjualanService (app/services/transaksi_bengkel_service.py):

- create_transaksi(data: TransaksiPenjualanCreate) -> Transaksi
  ```python
  Process:
  1. Generate nomor_transaksi (format: TPM-YYYYMMDD-XXXX)
  2. Validate stock for all items
  3. Calculate totals:
     - subtotal = sum(items) + sum(services)
     - diskon = calculate from persen or nominal
     - total_akhir = subtotal - diskon
     - total_hpp = sum(item.hpp_satuan * item.kuantitas)
     - laba_kotor = total_akhir - total_hpp
  4. Create transaksi record
  5. Create detail_spare_parts records
  6. Create detail_services records
  7. Update stock for each item (subtract)
  8. Process payment:
     - If lunas: record in kas_bank
     - If piutang: create piutang_usaha record
     - If dp: record dp in kas_bank + create piutang for sisa
  9. Generate invoice data
  10. Commit transaction
  ```
  
  Validation:
  - Stock availability
  - Customer exists (if customer_id provided)
  - Valid payment method
  - Valid diskon (not exceed subtotal)
  
  Error handling:
  - Rollback stock if error
  - Rollback payment records
  - Clear generated data

- get_transaksi(transaksi_id: int) -> Dict
  * Include full details (items, services)
  * Include customer info
  * Include payment info

- get_transaksi_list(filters) -> List
  * Filter by date, customer, mekanik, status_pembayaran
  * Include summary info
  * Pagination

- update_status_pembayaran(transaksi_id: int, payment_data)
  * Process pelunasan
  * Update piutang
  * Record payment in kas_bank
  * Update status to lunas

- get_riwayat_customer(customer_id: int) -> List
  * Get all transactions
  * Include summary

- generate_invoice(transaksi_id: int) -> Dict
  * Generate invoice data
  * Format for PDF generation
  * Include company info, customer info, items

5. PengeluaranService (app/services/pengeluaran_service.py):

- create_pengeluaran(data: PengeluaranCreate)
  ```python
  Process:
  1. Create pengeluaran record
  2. Record in kas_bank (keluar)
  3. If hutang: create hutang record (separate tracking)
  4. Commit transaction
  ```

- get_pengeluaran_by_kategori(kategori, date_from, date_to)
  * Filter by kategori
  * Calculate total
  * Group by kategori

- get_total_pengeluaran(date_from, date_to) -> Dict
  * Total by kategori
  * Grand total
  * Breakdown by metode_pembayaran

Transaction Management:
- All operations use database transactions
- Rollback on any error
- Proper session management

Logging:
- Log all transactions
- Log stock movements
- Log payment records
- Log errors with full context

Output:
Complete service implementations dengan complex business logic
dan comprehensive error handling.
```

### 3.3 Jual Beli Mobil Services

**Prompt untuk Claude Opus:**

```
Role: Senior Backend Developer

Task: Implement service layer untuk Modul Jual Beli Mobil

Requirements:

1. Pydantic Schemas (app/schemas/mobil.py):

MobilSchemas:
- MobilCreate:
  ```python
  tanggal_pembelian, merk, model, tahun
  nomor_plat, nomor_rangka, nomor_mesin, warna
  harga_beli, metode_pembayaran_beli
  supplier_id
  photos: List[str]  # base64 or URLs
  harga_jual_target: Optional[Decimal]
  ```

- MobilUpdate (partial)
- MobilResponse (with calculated fields)
- MobilDetail (include biaya_lainnya, part_service, photos)

BiayaLainnyaCreate:
- nama_biaya, nominal, metode_pembayaran

PartServiceLink:
- transaksi_bengkel_id, metode_pembayaran

TransaksiPenjualanMobilSchemas:
- TransaksiMobilCreate:
  ```python
  mobil_id, customer_id (optional)
  nama_customer, no_hp_customer, alamat_customer
  harga_jual, dp_pembayaran
  metode_pembayaran
  laba_investor_percentage: Optional[float] = 0
  ```

2. MobilService (app/services/mobil_service.py):

- create_mobil(data: MobilCreate) -> Mobil
  ```python
  Process:
  1. Validate unique nomor_plat, nomor_rangka
  2. Create mobil record
  3. Upload photos (if provided)
  4. Create mobil_photos records
  5. Record pembelian in kas_bank (keluar)
  6. Set status = tersedia
  7. Commit transaction
  ```

- get_mobil(mobil_id: int) -> Dict
  * Full details with:
    - Photos
    - Biaya lainnya list
    - Part & service list
    - Calculated total_modal
    - Potential profit (if harga_jual_target set)

- get_mobil_list(filters) -> List
  * Filter by status, merk, tahun
  * Sort by date, price, status
  * Include primary photo
  * Include total_modal

- update_mobil(mobil_id: int, data: MobilUpdate)
  * Update fields
  * Recalculate total_modal
  * Validate if terjual (can't update much)

- add_biaya_lainnya(mobil_id: int, data: BiayaLainnyaCreate)
  ```python
  Process:
  1. Create biaya record
  2. Update mobil.total_biaya_lainnya
  3. Recalculate total_modal
  4. Record in kas_bank (keluar, manual)
  5. Commit
  ```

- link_part_service(mobil_id: int, data: PartServiceLink)
  ```python
  Process:
  1. Validate transaksi_bengkel exists
  2. Create link record
  3. Update mobil.total_part_service
  4. Recalculate total_modal
  5. If metode = piutang_part_jb_mobil:
     - Create special piutang record
  6. Commit
  ```

- upload_photos(mobil_id: int, photos: List[UploadFile])
  * Save to storage (local/S3)
  * Create photo records
  * Set first as primary if no primary exists

- delete_photo(photo_id: int)
  * Delete from storage
  * Delete record
  * If primary, set another as primary

- mark_as_sold(mobil_id: int)
  * Set status = terjual
  * Prevent further modifications

3. TransaksiPenjualanMobilService (app/services/penjualan_mobil_service.py):

- create_transaksi(data: TransaksiMobilCreate) -> Transaksi
  ```python
  Process:
  1. Validate mobil exists & tersedia
  2. Generate nomor_transaksi
  3. Get mobil.total_modal
  4. Calculate:
     - laba_kotor = harga_jual - total_modal
     - laba_investor = laba_kotor * (investor_percentage / 100)
     - laba_tpm = laba_kotor - laba_investor
     - sisa_pembayaran = harga_jual - dp_pembayaran
  5. Create transaksi record
  6. Update mobil status = terjual
  7. Process payment:
     - Record dp in kas_bank (masuk)
     - If sisa > 0: create piutang_usaha
  8. If laba_investor > 0:
     - Create investor record (separate tracking)
  9. Commit transaction
  
  Return: Complete transaction details + invoice data
  ```

- process_payment(transaksi_id: int, payment_data)
  * Similar to bengkel pelunasan
  * Update piutang
  * Record in kas_bank

- calculate_profit(mobil_id: int, harga_jual: Decimal, 
                  investor_pct: float = 0) -> Dict
  * Preview calculation before transaction
  * Return: {
      laba_kotor,
      laba_investor,
      laba_tpm,
      margin_percentage
    }

- get_transaksi(transaksi_id: int) -> Dict
  * Full details including mobil info

- get_sales_summary(date_from, date_to) -> Dict
  * Total sales
  * Total profit (TPM + Investor)
  * Average margin
  * By metode_pembayaran

- generate_invoice(transaksi_id: int)
  * Format for PDF
  * Include mobil details
  * Include profit split (if applicable)

Transaction & Error Handling:
- Use database transactions
- Rollback all changes on error
- Validate at each step
- Comprehensive logging

Output:
Complete service with profit calculation and complex transaction management.
```

### 3.4 Jasa Angkut Services

**Prompt untuk Claude Opus:**

```
Role: Senior Backend Developer

Task: Implement service layer untuk Modul Jasa Angkut

Requirements:

1. Pydantic Schemas (app/schemas/jasa_angkut.py):

SupirSchemas:
- SupirCreate, SupirUpdate, SupirResponse

MuatanSchemas:
- MuatanCreate:
  ```python
  supir_id, tanggal, tujuan
  jenis_muatan, berat_volume
  biaya_angkut
  metode_pembayaran
  ```
  Note: laba_tpm and total_setoran auto-calculated

- MuatanResponse (with calculated fields)
- MuatanDetail (include biaya_lainnya, part_service)

2. SupirService (app/services/supir_service.py):

- Standard CRUD methods

- get_supir_summary(supir_id: int, date_from, date_to) -> Dict
  ```python
  Return:
  - total_muatan (count)
  - total_biaya_angkut
  - total_laba_tpm
  - total_setoran
  - total_piutang
  - total_biaya_lainnya
  - total_part_service
  ```

- get_active_supir() -> List
  * For dropdown in forms

3. MuatanService (app/services/muatan_service.py):

- create_muatan(data: MuatanCreate) -> Muatan
  ```python
  Process:
  1. Validate supir exists & aktif
  2. Calculate:
     - laba_tpm = biaya_angkut * 0.5
     - total_setoran = laba_tpm (same value)
  3. Create muatan record
  4. Process payment:
     - If cash/transfer: record in kas_bank (masuk, setoran)
     - If piutang_supir: create piutang record
  5. Set status_pembayaran
  6. Commit transaction
  
  Important: Biaya lainnya dan part_service ditambahkan SETELAH
  muatan created, dan tidak mempengaruhi total_setoran
  ```

- add_biaya_lainnya(muatan_id: int, data: BiayaCreate)
  ```python
  Process:
  1. Create biaya record
  2. Record in kas_bank (keluar)
  3. Note: TIDAK mengurangi setoran
  4. Commit
  ```

- link_part_service(muatan_id: int, data: PartServiceLink)
  ```python
  Process:
  1. Validate transaksi_bengkel exists
  2. Create link record
  3. Note: Cost masuk ke laporan laba rugi bengkel
  4. TIDAK ada opsi cash/tf karena auto-recorded
  5. Commit
  ```

- process_payment(muatan_id: int, payment_data)
  * Process pelunasan piutang supir
  * Update status_pembayaran
  * Record in kas_bank

- get_muatan_by_supir(supir_id: int, filters) -> List
  * Filter by date, status_pembayaran
  * Include summary totals

- get_muatan_summary(date_from, date_to) -> Dict
  ```python
  Return:
  - per_supir: [
      {
        supir_id, nama_supir,
        total_muatan, total_setoran,
        total_piutang
      }
    ]
  - grand_total_setoran
  - grand_total_piutang
  ```

Business Rules:
- Laba TPM always exactly 50%
- Setoran equals laba_tpm
- Biaya lainnya recorded separately (not deducted from setoran)
- Part & service affects laba rugi, not setoran

Output:
Service implementation dengan 50% profit calculation logic.
```

### 3.5 Karyawan Services

**Prompt untuk Claude Opus:**

```
Role: Senior Backend Developer

Task: Implement service layer untuk Modul Karyawan & Absensi

Requirements:

1. Pydantic Schemas (app/schemas/karyawan.py):

KaryawanSchemas:
- KaryawanCreate, KaryawanUpdate, KaryawanResponse

AbsensiSchemas:
- AbsensiCreate:
  ```python
  karyawan_id, tanggal
  status: Literal['hadir', 'izin', 'sakit', 'alpa']
  jam_masuk: Optional[time]
  jam_keluar: Optional[time]
  ```
- AbsensiResponse
- AbsensiBulkCreate (for multiple employees)

SlipGajiSchemas:
- SlipGajiCreate:
  ```python
  karyawan_id, periode_bulan, periode_tahun
  # Others auto-calculated from absensi
  ```
- SlipGajiUpdate:
  ```python
  total_gaji_dibayarkan  # manual input
  metode_pembayaran
  ```
- SlipGajiResponse

2. KaryawanService (app/services/karyawan_service.py):

- Standard CRUD

- get_karyawan_with_summary(karyawan_id: int) -> Dict
  ```python
  Return:
  - karyawan details
  - total_kasbon (active)
  - current_month_attendance (count by status)
  ```

3. AbsensiService (app/services/absensi_service.py):

- create_absensi(data: AbsensiCreate) -> Absensi
  * Validate unique (karyawan_id, tanggal)
  * Validate tanggal not future
  * Create record

- create_bulk_absensi(data: List[AbsensiCreate])
  * For daily attendance entry
  * Batch insert
  * Transaction management

- update_absensi(absensi_id: int, data: AbsensiUpdate)
  * Update status, times, catatan

- get_absensi_by_karyawan(karyawan_id, date_from, date_to)
  * Get attendance records
  * Calculate summary

- get_monthly_summary(karyawan_id, bulan, tahun) -> Dict
  ```python
  Return:
  - total_days (in month)
  - hadir_count
  - izin_count
  - sakit_count
  - alpa_count
  - attendance_percentage
  ```

4. SlipGajiService (app/services/slip_gaji_service.py):

- generate_slip(karyawan_id: int, bulan: int, tahun: int) -> SlipGaji
  ```python
  Process:
  1. Get karyawan (gaji_pokok, tunjangan)
  2. Get attendance summary for periode
  3. Calculate total_gaji:
     - Get total days in month
     - gaji_harian = gaji_pokok / total_days
     - gaji_from_attendance = gaji_harian * hadir_count
     - total_gaji = gaji_from_attendance + tunjangan
  4. Get total_kasbon (active)
  5. Create slip_gaji record:
     - jumlah_hadir
     - gaji_pokok
     - tunjangan
     - total_gaji (calculated)
     - kasbon (for info, NOT deducted)
     - total_gaji_dibayarkan (initially same as total_gaji)
     - status = belum_dibayar
  6. Return slip
  ```

- generate_all_slips(bulan: int, tahun: int) -> List[SlipGaji]
  * Generate for all active karyawan
  * Batch generation
  * Transaction management

- update_payment(slip_id: int, data: SlipGajiUpdate)
  ```python
  Process:
  1. Update total_gaji_dibayarkan (manual input)
  2. Update metode_pembayaran
  3. Set status = dibayar
  4. Set tanggal_pembayaran = now
  5. Record in kas_bank (keluar)
  6. If method = hutang: create hutang record
  7. Note: Kasbon is separate, manager decides payment amount
  8. Commit
  ```

- get_slip_by_periode(bulan, tahun) -> List[SlipGaji]
  * Get all slips for periode
  * Include karyawan details

- get_unpaid_slips() -> List[SlipGaji]
  * Filter status = belum_dibayar

5. KasbonService (app/services/kasbon_service.py):

- create_kasbon(data: KasbonCreate)
  * Create kasbon record
  * Status = aktif
  * Record in kas_bank? (depends on business rule)

- mark_as_paid(kasbon_id: int)
  * Update status = lunas
  * Record payment

- get_total_kasbon_karyawan(karyawan_id: int) -> Decimal
  * Sum active kasbon

Important Business Rules:
1. Total gaji based on attendance (proportional)
2. Tunjangan always added (not affected by attendance)
3. Kasbon shown in slip but NOT auto-deducted
4. Manager manually inputs total_gaji_dibayarkan
5. Slip generation should be done monthly

Validation:
- Cannot generate slip if already exists for periode
- Cannot pay if already paid
- total_gaji_dibayarkan cannot exceed total_gaji
- periode_bulan between 1-12

Output:
Complete service with payroll calculation logic.
```

---

## 📊 PHASE 4: LAPORAN (REPORTS) SERVICES

### 4.1 Laporan Laba Rugi Service

**Prompt untuk Claude Opus:**

```
Role: Senior Backend Developer

Task: Implement Laporan Laba Rugi TPM (Income Statement)

Context:
Referensi format dari TPM_App_Documentation.md section 3.6.8

Requirements:

Create comprehensive service (app/services/laporan_laba_rugi_service.py):

- generate_laba_rugi(bulan: int, tahun: int) -> Dict
  ```python
  Process & Calculations:
  
  1. BENGKEL Section:
     a. Penjualan Spare Part & Service:
        - Query transaksi_penjualan_bengkel
        - Filter by periode (bulan, tahun)
        - Sum(total_akhir) where status_pembayaran != 'cancelled'
     
     b. HPP Spare Part Terjual:
        - Query detail_transaksi_spare_parts
        - Join with transaksi (filter periode)
        - Sum(hpp_satuan * kuantitas)
     
     c. Laba Kotor Bengkel:
        - = Penjualan - HPP
     
     d. Biaya Operasional:
        - Query pengeluaran_bengkel
        - Filter kategori = 'biaya_operasional'
        - Filter periode
        - Sum(nominal)
     
     e. Biaya Gaji:
        - Query slip_gaji
        - Filter periode
        - Sum(total_gaji) -- use total_gaji, not dibayarkan
     
     f. Laba/Rugi Bersih Bengkel:
        - = Laba Kotor - Biaya Operasional - Biaya Gaji
  
  2. JASA ANGKUT Section:
     a. Penghasilan Jasa Angkut (50% Laba TPM):
        - Query muatan_jasa_angkut
        - Filter periode
        - Sum(laba_tpm)  -- already 50%
     
     b. Biaya Lainnya:
        - Query jasa_angkut_biaya_lainnya
        - Join with muatan (filter periode)
        - Sum(nominal)
     
     c. Biaya Spare Part & Service:
        - Query jasa_angkut_part_service
        - Join with transaksi_bengkel
        - Filter periode
        - Sum(transaksi.total_akhir)
     
     d. Laba Bersih Jasa Angkut:
        - = Penghasilan - Biaya Lainnya - Biaya Part Service
  
  3. JUAL BELI MOBIL Section:
     a. Laba Jual Beli Mobil:
        - Query transaksi_penjualan_mobil
        - Filter periode
        - Sum(laba_kotor)
     
     b. Laba Investor Jual Beli Mobil:
        - Sum(laba_investor) from same query
     
     c. Laba TPM Jual Beli Mobil:
        - Sum(laba_tpm) from same query
  
  4. TOTAL LABA KESELURUHAN:
     - = Laba Bengkel + Laba Jasa Angkut + Laba TPM JB Mobil
  
  5. PENGELUARAN:
     - Query pengeluaran_bengkel
     - Filter kategori = 'biaya_lainnya'
     - Filter periode
     - Sum(nominal)
  
  6. LABA BERSIH/BULAN:
     - = Total Laba Keseluruhan - Pengeluaran
  
  7. PRIVE/PENGAMBILAN LABA:
     - Query pengeluaran_bengkel
     - Filter kategori = 'prive'
     - Filter periode
     - Sum(nominal)
  
  8. SISA LABA BERSIH/BULAN:
     - = Laba Bersih - Prive
  
  9. PEMASUKAN:
     - Query for:
       * Pendapatan lainnya (kategori)
       * DP jual mobil (transaksi_penjualan_mobil.dp_pembayaran)
     - Sum totals
  
  Final Return Structure:
  {
    "periode": {"bulan": X, "tahun": Y},
    "bengkel": {
      "penjualan_spare_part_service": Decimal,
      "hpp_spare_part_terjual": Decimal,
      "laba_kotor_bengkel": Decimal,
      "biaya_operasional": Decimal,
      "biaya_gaji": Decimal,
      "laba_rugi_bersih_bengkel": Decimal
    },
    "jasa_angkut": {
      "penghasilan_jasa_angkut": Decimal,
      "biaya_lainnya": Decimal,
      "biaya_spare_part_service": Decimal,
      "laba_bersih_jasa_angkut": Decimal
    },
    "jual_beli_mobil": {
      "laba_jual_beli_mobil": Decimal,
      "laba_investor": Decimal,
      "laba_tpm": Decimal
    },
    "total_laba_keseluruhan": Decimal,
    "pengeluaran_biaya_lainnya": Decimal,
    "laba_bersih_bulan": Decimal,
    "prive": Decimal,
    "sisa_laba_bersih_bulan": Decimal,
    "pemasukan": {
      "pendapatan_lainnya": Decimal,
      "dp_jual_mobil": Decimal,
      "total": Decimal
    }
  }
  ```

Additional Methods:
- get_comparison(bulan1, tahun1, bulan2, tahun2) -> Dict
  * Compare two periods
  * Calculate growth percentages
  * Highlight significant changes

- get_yearly_summary(tahun: int) -> Dict
  * Generate for all 12 months
  * Calculate yearly totals
  * Monthly trends

Performance Optimization:
- Use efficient SQL queries (joins, aggregations)
- Consider caching for historical periods
- Index optimization on date fields

Output:
Complete implementation dengan complex aggregation queries.
```

### 4.2 Laporan Perubahan Modal Service

**Prompt untuk Claude Opus:**

```
Role: Senior Backend Developer

Task: Implement Laporan Sisa Laba & Modal di Tangan TPM

Context:
Referensi format dari TPM_App_Documentation.md section 3.6.9

Requirements:

Create service (app/services/laporan_modal_service.py):

- generate_laporan_modal(bulan: int, tahun: int) -> Dict
  ```python
  Calculations:
  
  1. LABA & MODAL AWAL:
     a. HPP/Modal Part & Layanan Bengkel:
        - Query spare_parts
        - Sum(stock * harga_beli_terakhir)
        - This is current inventory value
     
     b. HPP/Modal Jual Beli Mobil:
        - Query mobil where status = 'tersedia'
        - Sum(total_modal)
        - Cars in inventory
     
     c. Subtotal Modal Awal:
        - = (a) + (b)
  
  2. SISA LABA & PENDAPATAN LAINNYA:
     - From laba_rugi.sisa_laba_bersih_bulan
     - Plus pemasukan
  
  3. LABA & MODAL (before deductions):
     - = Modal Awal + Sisa Laba
  
  4. UANG DILUAR (Piutang):
     a. Piutang Lainnya:
        - Query piutang_usaha where sumber = custom tracking
        - Sum(sisa_piutang) where status = 'aktif'
     
     b. Piutang JB Mobil:
        - Query piutang_usaha where sumber = 'jual_beli_mobil'
        - Sum(sisa_piutang) where status = 'aktif'
     
     c. Piutang Part JB Mobil:
        - Query mobil_part_service
        - Where metode = 'piutang_part_jb_mobil'
        - Track outstanding amounts
     
     d. Piutang Supir Jasa Angkut:
        - Query muatan_jasa_angkut
        - Where status_pembayaran = 'piutang'
        - Sum(total_setoran) -- outstanding
     
     e. Piutang Karyawan (Kasbon):
        - Query kasbon_karyawan
        - Where status = 'aktif'
        - Sum(nominal)
     
     f. Piutang Usaha (Bengkel):
        - Query piutang_usaha where sumber = 'bengkel'
        - Sum(sisa_piutang) where status = 'aktif'
     
     Total Uang Diluar = Sum (a-f)
  
  5. PENGURANG LABA & MODAL (Cash Outflows):
     a. Total Pembelian Part Cash:
        - Query pembelian_spare_parts
        - Filter periode, metode = 'cash'
        - Sum(total_harga_beli)
     
     b. Total Pembelian Mobil Cash:
        - Query mobil
        - Filter periode, metode = 'cash'
        - Sum(harga_beli)
     
     c. Total Pengembalian Modal Investor JB Mobil:
        - Query investor_returns (if tracked separately)
        - Filter periode
        - Sum(nominal)
     
     Total Pengurang = Sum (a-c)
  
  6. LABA & MODAL (after deductions):
     - = Laba & Modal (step 3) - Total Pengurang
  
  7. SISA LABA & MODAL DI TANGAN AKHIR:
     a. Get current balance from kas_bank:
        - UANG CASH: 
          * Query kas_bank where jenis = 'cash'
          * Get latest saldo_sesudah
        
        - UANG DI BANK BCA:
          * Query kas_bank where jenis = 'bank_bca'
          * Get latest saldo_sesudah
        
        - Total di Tangan = Cash + Bank
     
     b. UANG DI BANK REAL:
        - Manual input (parameter)
        - For reconciliation
     
     c. SELISIH:
        - = Total di Tangan - Uang Bank Real
        - nominal (calculated)
        - keterangan (manual input via parameter)
  
  Return Structure:
  {
    "periode": {"bulan": X, "tahun": Y},
    "laba_modal_awal": {
      "hpp_modal_part_bengkel": Decimal,
      "hpp_modal_jb_mobil": Decimal,
      "subtotal": Decimal
    },
    "sisa_laba_pendapatan": Decimal,
    "laba_modal_sebelum_pengurang": Decimal,
    "uang_diluar": {
      "piutang_lainnya": Decimal,
      "piutang_jb_mobil": Decimal,
      "piutang_part_jb_mobil": Decimal,
      "piutang_supir_jasa_angkut": Decimal,
      "piutang_karyawan": Decimal,
      "piutang_usaha": Decimal,
      "total": Decimal
    },
    "pengurang_laba_modal": {
      "total_pembelian_part_cash": Decimal,
      "total_pembelian_mobil_cash": Decimal,
      "total_pengembalian_modal_investor": Decimal,
      "total": Decimal
    },
    "laba_modal_setelah_pengurang": Decimal,
    "sisa_laba_modal_di_tangan": {
      "uang_cash": Decimal,
      "uang_bank_bca": Decimal,
      "total_di_tangan": Decimal,
      "uang_bank_real": Decimal,  # manual input
      "selisih": {
        "nominal": Decimal,
        "keterangan": str  # manual input
      }
    }
  }
  ```

- record_selisih(bulan, tahun, bank_real, keterangan)
  * Save reconciliation data
  * Track discrepancies

- get_historical_modal(tahun: int) -> List
  * Get all months in year
  * Show modal progression

Output:
Complete implementation dengan reconciliation logic.
```

### 4.3 Additional Report Services

**Prompt untuk Claude Opus:**

```
Role: Senior Backend Developer

Task: Implement additional report services

Requirements:

Create app/services/laporan_service.py with multiple report methods:

1. get_stock_spare_part_report(
    search: str = None,
    status: str = None,
    sort_by: str = "nama_spare_part"
   ) -> List[Dict]
   ```python
   Query spare_parts with:
   - Filter by status (tersedia/menipis/habis)
   - Search by nama or kode
   - Calculate total nilai stock (stock * harga_beli)
   - Sort options
   
   Return:
   [
     {
       kode_barang, nama_spare_part,
       stock, stock_minimum,
       harga_beli_terakhir, harga_jual,
       total_nilai_stock,
       status
     }
   ]
   ```

2. get_pembelian_spare_part_report(date_from, date_to, supplier_id=None)
   ```python
   Query pembelian_spare_parts:
   - Filter by date range
   - Optional filter by supplier
   - Include spare_part details
   - Include supplier name
   - Group by metode_pembayaran
   
   Return:
   {
     data: [...],
     summary: {
       total_pembelian: Decimal,
       by_metode: {
         cash: Decimal,
         transfer: Decimal,
         hutang: Decimal
       },
       by_supplier: {...}
     }
   }
   ```

3. get_pembelian_mobil_report(date_from, date_to)
   * Similar to pembelian part
   * Include total_modal breakdown

4. get_penjualan_bengkel_report(date_from, date_to, filters: Dict)
   ```python
   Query transaksi_penjualan_bengkel:
   - Filter by date, customer, mekanik, status
   - Include total penjualan, hpp, laba
   - Group by time periods (daily/weekly/monthly)
   
   Return:
   {
     data: [...],
     summary: {
       total_penjualan: Decimal,
       total_hpp: Decimal,
       total_laba: Decimal,
       margin_percentage: float,
       by_mekanik: {...},
       by_payment_method: {...}
     }
   }
   ```

5. get_penjualan_mobil_report(date_from, date_to)
   * Include profit breakdown (TPM vs Investor)
   * Include mobil details

6. get_muatan_jasa_angkut_report(date_from, date_to, supir_id=None)
   ```python
   Query muatan_jasa_angkut:
   - Per supir summary
   - Total setoran
   - Outstanding piutang
   
   Return:
   {
     per_supir: [
       {
         supir: {...},
         total_muatan: int,
         total_biaya_angkut: Decimal,
         total_laba_tpm: Decimal,
         total_setoran: Decimal,
         total_piutang: Decimal
       }
     ],
     grand_total: {...}
   }
   ```

7. get_keuangan_report(bulan, tahun) -> Dict
   ```python
   Combine:
   - Laba Rugi data
   - Modal data
   - Pemasukan & pengeluaran summary
   - Cash flow summary
   
   High-level overview for management
   ```

8. get_dashboard_summary() -> Dict
   ```python
   Current month summary:
   - Total penjualan bengkel
   - Total penjualan mobil
   - Total piutang
   - Stock value
   - Low stock alerts
   - Recent transactions
   - Top customers
   - Top selling parts
   ```

Export Features:
- All reports should support export to Excel
- Use openpyxl for Excel generation
- Include formatting (headers, totals, charts if applicable)

Caching Strategy:
- Cache historical reports (completed periods)
- Invalidate cache on data changes
- Use Redis if available

Output:
Complete report services dengan aggregation dan export capabilities.
```

---

## 🔗 PHASE 5: API ROUTES

### 5.1 API Routes Structure

**Prompt untuk Claude Opus:**

```
Role: API Developer

Task: Create complete API routes untuk semua modules

Context:
- Services sudah implement semua business logic
- Need clean, RESTful API design
- Include proper documentation

Requirements:

Create API routes untuk semua modules (app/api/v1/):

Structure each route file dengan:
1. Import dependencies
2. Router initialization
3. Endpoint definitions dengan:
   - Proper HTTP methods
   - Path parameters
   - Query parameters
   - Request body schemas
   - Response schemas
   - Status codes
   - Error handling
   - Documentation (docstrings)
   - Authentication dependencies

Standard Response Format:
```python
{
  "success": bool,
  "data": Any,
  "message": str,
  "errors": Optional[List]
}
```

Pagination Format:
```python
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": int,
    "page": int,
    "size": int,
    "pages": int
  }
}
```

Generate routes for:

1. app/api/v1/auth.py - Authentication routes
2. app/api/v1/suppliers.py - Supplier CRUD
3. app/api/v1/customers.py - Customer CRUD + history
4. app/api/v1/spare_parts.py - Spare parts CRUD + stock
5. app/api/v1/pembelian_parts.py - Purchase parts
6. app/api/v1/transaksi_bengkel.py - Workshop transactions
7. app/api/v1/pengeluaran.py - Expenses
8. app/api/v1/mobil.py - Car inventory + photos
9. app/api/v1/transaksi_mobil.py - Car sales
10. app/api/v1/supir.py - Drivers
11. app/api/v1/muatan.py - Transport loads
12. app/api/v1/karyawan.py - Employees
13. app/api/v1/absensi.py - Attendance
14. app/api/v1/slip_gaji.py - Payroll
15. app/api/v1/laporan.py - All reports
16. app/api/v1/dashboard.py - Dashboard data
17. app/api/v1/piutang.py - Receivables management
18. app/api/v1/kas_bank.py - Cash & bank transactions

For each route file, include:
- All CRUD endpoints (if applicable)
- Search/filter endpoints
- Summary/statistics endpoints
- Related data endpoints
- Proper authentication
- Role-based access control
- Input validation
- Error handling

Example template for one entity (suppliers):
```python
from fastapi import APIRouter, Depends, Query, status
from typing import List, Optional
from app.schemas.master import (
    SupplierCreate, SupplierUpdate, 
    SupplierResponse, SupplierList
)
from app.services.supplier_service import SupplierService
from app.api.deps import get_current_user, get_db

router = APIRouter(prefix="/suppliers", tags=["suppliers"])

@router.get("/", response_model=SupplierList)
async def get_suppliers(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get list of suppliers with filters and pagination"""
    # Implementation...

@router.post("/", response_model=SupplierResponse, 
             status_code=status.HTTP_201_CREATED)
async def create_supplier(
    data: SupplierCreate,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create new supplier"""
    # Implementation...

# ... more endpoints
```

API Router Setup (app/api/router.py):
```python
from fastapi import APIRouter
from app.api.v1 import (
    auth, suppliers, customers, spare_parts,
    # ... import all route modules
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(suppliers.router)
# ... include all routers
```

Dependencies (app/api/deps.py):
- get_db() -> database session
- get_current_user() -> authenticated user
- require_role(roles: List[str]) -> role-based access
- paginate() -> pagination helper

Error Handling:
- Custom exception handlers
- Consistent error responses
- Proper HTTP status codes

Documentation:
- OpenAPI/Swagger auto-generated
- Clear endpoint descriptions
- Request/response examples
- Authentication requirements

Output:
Complete API routes untuk semua 18 modules dengan:
- RESTful design
- Comprehensive documentation
- Error handling
- Authentication & authorization
```

---

## 📦 PHASE 6: FINAL INTEGRATION & UTILITIES

### 6.1 Utilities & Helpers

**Prompt untuk Claude Opus:**

```
Role: Senior Backend Developer

Task: Create utility functions dan helpers

Requirements:

Create utility modules (app/utils/):

1. app/utils/pdf_generator.py
   ```python
   Functions:
   - generate_invoice_bengkel(transaksi_id) -> bytes
     * Generate PDF invoice untuk transaksi bengkel
     * Include company logo, details, items, totals
     * Format professional
   
   - generate_invoice_mobil(transaksi_id) -> bytes
     * Similar for car sales
     * Include car details, photos
   
   - generate_slip_gaji(slip_id) -> bytes
     * Generate payslip PDF
     * Include attendance summary
   
   - generate_laporan_laba_rugi(data: Dict) -> bytes
     * Generate formatted report
   
   Use: reportlab library
   ```

2. app/utils/excel_generator.py
   ```python
   Functions:
   - export_stock_report(data) -> bytes
   - export_penjualan_report(data) -> bytes
   - export_keuangan_report(data) -> bytes
   
   Features:
   - Proper headers
   - Formatting (currency, dates)
   - Totals & summaries
   - Charts (if applicable)
   
   Use: openpyxl library
   ```

3. app/utils/helpers.py
   ```python
   Functions:
   - generate_nomor_transaksi(prefix: str, date: date) -> str
     * Format: TPM-YYYYMMDD-XXXX
     * Auto-increment counter
   
   - format_currency(amount: Decimal) -> str
     * Format: Rp 1.000.000
   
   - format_date_indonesia(date: date) -> str
     * Format: 1 Januari 2026
   
   - calculate_working_days(date_from, date_to) -> int
     * Exclude weekends & holidays
   
   - validate_nomor_plat(plat: str) -> bool
     * Indonesian plate format
   
   - validate_phone_number(phone: str) -> bool
     * Indonesian format
   
   - sanitize_filename(filename: str) -> str
     * Remove unsafe characters
   
   - generate_unique_filename(original: str) -> str
     * Add timestamp/uuid
   ```

4. app/utils/email.py (optional)
   ```python
   Functions:
   - send_email(to, subject, body, attachments)
   - send_invoice_email(customer_email, invoice_pdf)
   - send_payment_reminder(customer_email, piutang_data)
   ```

5. app/utils/validators.py
   ```python
   Custom Pydantic validators:
   - validate_currency (positive, max decimals)
   - validate_percentage (0-100)
   - validate_stock (non-negative)
   - validate_date_range
   - validate_nomor_plat
   - validate_phone_indonesia
   ```

6. app/utils/constants.py
   ```python
   Application constants:
   - PAYMENT_METHODS
   - TRANSACTION_STATUS
   - EMPLOYEE_STATUS
   - ROLES
   - etc.
   ```

Output:
Complete utility modules untuk support main application.
```

### 6.2 Middleware & Error Handling

**Prompt untuk Claude Opus:**

```
Role: Backend Engineer

Task: Create middleware and global error handling

Requirements:

1. app/middleware/error_handler.py
   ```python
   Custom Exception Classes:
   - AppException (base)
   - NotFoundException (404)
   - ValidationException (422)
   - DuplicateException (409)
   - UnauthorizedException (401)
   - ForbiddenException (403)
   - BusinessLogicException (400)
   
   Global Exception Handler:
   - Catch all exceptions
   - Log errors
   - Return formatted response
   - Different handling for dev vs prod
   - Include request ID in logs
   ```

2. app/middleware/auth.py
   ```python
   Functions:
   - verify_token(token: str) -> User
   - get_current_user(token: str = Depends(oauth2_scheme))
   - require_role(required_roles: List[str])
   
   Middleware:
   - Token validation
   - User session management
   - Rate limiting (optional)
   ```

3. app/middleware/logging.py
   ```python
   Request/Response Logging:
   - Log all requests (method, path, IP)
   - Log response status
   - Log execution time
   - Log errors with full traceback
   - Structured logging (JSON format)
   - Rotate logs daily
   ```

4. app/middleware/cors.py
   ```python
   CORS Configuration:
   - Allow origins (from config)
   - Allow methods
   - Allow headers
   - Allow credentials
   ```

Output:
Complete middleware setup untuk production-ready app.
```

### 6.3 Testing

**Prompt untuk Claude Opus:**

```
Role: QA Engineer

Task: Create test suite untuk backend

Requirements:

Create comprehensive tests (tests/):

1. tests/conftest.py
   ```python
   Pytest fixtures:
   - test_db (separate test database)
   - test_client (FastAPI test client)
   - sample_data (fixtures for testing)
   - authenticated_client
   ```

2. Unit Tests (tests/services/):
   - test_supplier_service.py
   - test_customer_service.py
   - test_spare_part_service.py
   - test_transaksi_bengkel_service.py
   - test_mobil_service.py
   - test_muatan_service.py
   - test_karyawan_service.py
   - test_laporan_service.py
   
   Each test file should include:
   - Test CRUD operations
   - Test business logic
   - Test validations
   - Test error cases
   - Test edge cases

3. Integration Tests (tests/api/):
   - test_auth_endpoints.py
   - test_bengkel_endpoints.py
   - test_mobil_endpoints.py
   - etc.
   
   Test:
   - API endpoints
   - Authentication
   - Authorization
   - Request/response formats
   - Error responses

4. Test Coverage:
   - Aim for 80%+ coverage
   - Focus on business logic
   - Test critical paths

Example test structure:
```python
def test_create_supplier(test_db):
    """Test supplier creation"""
    data = SupplierCreate(
        nama_supplier="Test Supplier",
        no_hp="081234567890"
    )
    supplier = create_supplier(test_db, data)
    assert supplier.nama_supplier == "Test Supplier"

def test_create_duplicate_supplier(test_db):
    """Test duplicate supplier prevention"""
    # Create first
    data = SupplierCreate(nama_supplier="Test")
    create_supplier(test_db, data)
    
    # Try duplicate
    with pytest.raises(DuplicateException):
        create_supplier(test_db, data)
```

Output:
Complete test suite dengan good coverage.
```

---

## 🚀 PHASE 7: DEPLOYMENT PREPARATION

### 7.1 Docker & Environment

**Prompt untuk Claude Opus:**

```
Role: DevOps Engineer

Task: Create deployment configuration

Requirements:

1. Dockerfile
   ```dockerfile
   Multi-stage build:
   - Build stage (install dependencies)
   - Production stage (slim image)
   - Use Python 3.11-slim base image
   - Install only production dependencies
   - Set proper user (non-root)
   - Health check
   ```

2. docker-compose.yml
   ```yaml
   Services:
   - app (FastAPI application)
   - db (MySQL 8.0)
   - redis (for caching, optional)
   
   Features:
   - Volume mounts
   - Networks
   - Environment variables
   - Restart policies
   ```

3. .env.example
   ```
   Complete environment variables template:
   - Database config
   - JWT secrets
   - API keys (if any)
   - CORS origins
   - File storage path
   - Email config (if applicable)
   - Logging config
   ```

4. requirements.txt (production)
   ```
   Pin exact versions
   Include only production dependencies
   ```

5. requirements-dev.txt
   ```
   Include development tools:
   - pytest
   - black (formatter)
   - flake8 (linter)
   - mypy (type checker)
   ```

6. Makefile
   ```makefile
   Common commands:
   - make install
   - make migrate
   - make run
   - make test
   - make lint
   - make format
   - make docker-build
   - make docker-up
   ```

7. alembic.ini (production config)
   ```
   Configure for production
   SQL logging off
   ```

8. Health Check Endpoint
   ```python
   @app.get("/health")
   async def health_check():
       # Check database connection
       # Check redis connection
       # Return status
   ```

Output:
Production-ready deployment configuration.
```

### 7.2 Documentation

**Prompt untuk Claude Opus:**

```
Role: Technical Writer

Task: Create API documentation

Requirements:

1. README.md
   ```markdown
   Include:
   - Project overview
   - Features
   - Tech stack
   - Installation instructions
   - Running the application
   - Running tests
   - API documentation link
   - Environment variables
   - Contributing guidelines
   ```

2. API Documentation (via Swagger/OpenAPI)
   ```python
   Enhance auto-generated docs:
   - Add descriptions to all endpoints
   - Add request/response examples
   - Add authentication info
   - Add error code explanations
   - Group by modules
   ```

3. CHANGELOG.md
   ```markdown
   Track version changes:
   - Version numbers
   - Release dates
   - New features
   - Bug fixes
   - Breaking changes
   ```

4. Database Schema Documentation
   ```
   - Entity Relationship Diagram
   - Table descriptions
   - Field descriptions
   - Relationships explanation
   ```

Output:
Complete documentation untuk backend application.
```

---

## 📋 BACKEND CHECKLIST

### Development Checklist

Phase 1: Setup ✓
- [ ] Project structure
- [ ] Database configuration
- [ ] Authentication system
- [ ] Base models

Phase 2: Models ✓
- [ ] Master data models
- [ ] Bengkel models
- [ ] Mobil models
- [ ] Jasa Angkut models
- [ ] Karyawan models
- [ ] Piutang & Kas Bank models
- [ ] Database migrations

Phase 3: Services ✓
- [ ] Master data services
- [ ] Bengkel services
- [ ] Mobil services
- [ ] Jasa Angkut services
- [ ] Karyawan services
- [ ] Laporan services

Phase 4: Reports ✓
- [ ] Laba Rugi service
- [ ] Perubahan Modal service
- [ ] Stock reports
- [ ] Sales reports
- [ ] Dashboard summary

Phase 5: API Routes ✓
- [ ] All 18 route modules
- [ ] Authentication & authorization
- [ ] Error handling
- [ ] Documentation

Phase 6: Integration ✓
- [ ] Utilities & helpers
- [ ] Middleware
- [ ] Testing
- [ ] PDF/Excel generation

Phase 7: Deployment ✓
- [ ] Docker configuration
- [ ] Environment setup
- [ ] Documentation
- [ ] Health checks

---

## 🎯 SUMMARY

Backend lengkap dengan:
- ✅ 23+ database tables
- ✅ 100+ API endpoints
- ✅ Complex business logic (profit calculation, stock management)
- ✅ Comprehensive reporting
- ✅ Authentication & authorization
- ✅ Error handling & logging
- ✅ Testing
- ✅ Production-ready deployment
- ✅ Complete documentation

**Estimated Timeline dengan Claude Opus:**
- Phase 1-2: 2-3 hari (setup + models)
- Phase 3-4: 3-4 hari (services + reports)
- Phase 5: 2 hari (API routes)
- Phase 6-7: 2 hari (integration + deployment)

**Total: 9-11 hari** untuk complete backend! 🚀
