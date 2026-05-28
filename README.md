# TPM Super App (Truk Prima Manunggal)

A comprehensive ERP solution for managing automotive sales, truck workshop services, and transportation logistics. Built with a robust FastAPI backend and a high-performance React Native (Expo) frontend.

## 🚀 Project Overview

TPM Super App is designed to streamline business operations across three primary units:
1.  **Jual Beli Mobil:** Inventory management, sales tracking, and investor profit sharing.
2.  **Unit Bengkel:** Service management, spare parts inventory, and transactional billing.
3.  **Unit Jasa Angkut:** Logistics and shipment tracking with dynamic cost management and driver coordination.

---

## 🛠️ Tech Stack

### Backend
- **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Database:** MySQL with [SQLAlchemy](https://www.sqlalchemy.org/) ORM
- **Migrations:** [Alembic](https://alembic.sqlalchemy.org/)
- **Validation:** [Pydantic v2](https://docs.pydantic.dev/latest/)
- **Authentication:** JWT (JSON Web Tokens)

### Frontend
- **Framework:** [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/)
- **Navigation:** [Expo Router](https://docs.expo.dev/router/introduction/) (File-based routing)
- **Styling:** [NativeWind](https://www.nativewind.dev/) (Tailwind CSS for React Native)
- **State Management:** [TanStack Query](https://tanstack.com/query/latest) (React Query)
- **UI Components:** Custom premium design system based on Lucide icons and Bottom Sheet.

---

## 📦 Features & Modules

### 🏎️ Jual Beli Mobil
- Inventory tracking for available and sold units.
- Detailed cost tracking for each unit (purchase price, repairs, preparation).
- Automated profit-sharing calculation between TPM and Investors.
- Sales forms with integrated workshop prep costs.

### 🛠️ Unit Bengkel
- Workshop transaction management (Service + Spareparts).
- **QR & Barcode Scanner:** Instant spare part lookup and addition to sales forms.
- **Visual Generators:** Generate QR codes and Barcodes for every spare part label.
- Real-time stock management with automated inventory tracking.
- Expense tracking for workshop operations.
- Integration with Jasa Angkut for internal maintenance tasks.

### 🚚 Unit Jasa Angkut (Logistics)
- Managing shipments (Muatan) with origin/destination tracking.
- Dynamic operational cost entry (BBM, Tol, Makan, etc.).
- Driver profit calculation and tracking.
- Automated receivable (Piutang) generation for unpaid shipments.

### 💰 Keuangan (Finance)
- **Mutasi Kas & Bank:** Centralized ledger for Cash and Bank BCA accounts.
- **Piutang Usaha:** Tracking customer debts from all business units.
- **Payroll (Slip Gaji):** Weekly payroll generation for employees with automated kasbon (cash advance) deductions.
- **Dashboard:** Executive summaries for income, expenses, and current cash position.

### 📊 Laporan (Reporting)
- **Laba Rugi (P&L):** Detailed profit and loss reports per business unit.
- **Perubahan Modal:** Reconciliation of initial capital, profits, and current equity.

---

## ⚙️ Local Development Setup

The recommended development setup for this repository is **native local development without Docker**:

- Backend runs in a Python virtual environment.
- Backend development uses **Python 3.11** for compatibility with the pinned dependency set.
- Database runs as a local MySQL service.
- Frontend runs with Expo / npm.

The instructions below are written for **Lubuntu / Ubuntu-based Linux**.

If you prefer an automated setup, run the repository helper script from the project root:

```bash
chmod +x setup-local-lubuntu.sh
./setup-local-lubuntu.sh
```

You can override the default local database password when running it:

```bash
DB_PASSWORD='your-local-password' ./setup-local-lubuntu.sh
```

After the first setup, you can start backend and frontend together with:

```bash
chmod +x start-local.sh
./start-local.sh
```

`start-local.sh` starts the backend plus the frontend **web** development server.

### 1. Install system prerequisites

```bash
sudo apt update
sudo apt install -y \
  git curl build-essential pkg-config \
  python3 python3-pip \
  default-libmysqlclient-dev \
  mysql-server
```

You also need **Node.js + npm** for the frontend. Using `nvm` is recommended so the Node version is easy to manage:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

The setup script also installs `uv`, which manages the project's Python 3.11 runtime even if the operating system default Python is newer.

Verify the main tools:

```bash
python3 --version
node --version
npm --version
mysql --version
```

### 2. Prepare local MySQL

Start MySQL and create the development database:

```bash
sudo systemctl enable --now mysql
sudo mysql
```

Then run this inside the MySQL shell:

```sql
CREATE DATABASE tpm_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tpm_dev'@'localhost' IDENTIFIED BY 'change-me-local';
GRANT ALL PRIVILEGES ON tpm_db.* TO 'tpm_dev'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

For local development on Lubuntu / Ubuntu, using a dedicated MySQL user is preferred over using `root`. Configure `backend/.env` like this:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=tpm_db
DB_USER=tpm_dev
DB_PASSWORD=change-me-local
UPLOAD_DIR=local_uploads
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8081,http://127.0.0.1:3000,http://127.0.0.1:8081
```

You may choose a different local password; just keep `backend/.env` in sync.

### 3. Set up the backend

```bash
cd backend
uv python install 3.11
uv venv --python 3.11 venv
source venv/bin/activate
uv pip install --python venv/bin/python -r requirements.txt
cp .env.example .env
alembic upgrade head
python seed_users.py
uvicorn app.main:app --reload
```

Backend URLs:

- API base: `http://localhost:8000/api/v1`
- API docs: `http://localhost:8000/docs`

Seed users created by `seed_users.py`:

| Username | Password |
| --- | --- |
| `admin` | `password123` |
| `manager` | `password123` |
| `staff` | `password123` |

### 4. Set up the frontend

Open a second terminal from the repository root:

```bash
cd frontend
npm install
npm start
```

Useful frontend commands:

```bash
npm run web      # run in browser
npm run android  # run Android native build if Android tooling is installed
```

When opened from `localhost` in the browser, the frontend automatically targets the local backend at `http://localhost:8000`.

### 5. Optional tools

These are only needed for specific workflows:

- **Expo Go** on a phone, for quick mobile testing.
- **Android Studio / Android SDK**, if you want emulator or native Android builds.
- **Electron desktop tooling**, only if you are working on the Windows desktop packaging flow in `desktop-template/`.

### Notes

- Do **not** use Docker for the standard local development workflow described above.
- Do not create the backend virtual environment with the system default Python if it is newer than 3.11; on Ubuntu 26.04, Python 3.14 can fail with the currently pinned backend dependencies.
- Local development should use `UPLOAD_DIR=local_uploads`; the tracked `backend/uploads` path is a deployment symlink that points to `/var/www/...`.
- The repository still contains deployment-oriented Docker files, but they are not required for daily development on a local machine.
- If you test the app from a physical phone, review `frontend/utils/api.ts`: mobile fallback behavior may need adjustment so the device points to your computer's LAN IP instead of the production domain.

---

## 📂 Project Structure

```text
tpm/
├── backend/            # FastAPI Project
│   ├── app/
│   │   ├── api/        # Endpoint routers
│   │   ├── models/     # SQLAlchemy models
│   │   ├── schemas/    # Pydantic validation schemas
│   │   ├── services/   # Business logic (Services)
│   │   └── database/   # DB connection & session
│   └── alembic/        # Migration scripts
├── frontend/           # React Native / Expo Project
│   ├── app/            # Screens (Expo Router)
│   ├── components/     # Reusable UI components
│   ├── services/       # API integration layers
│   ├── hooks/          # Custom React hooks (React Query)
│   └── utils/          # Helpers & formatters
└── README.md           # You are here
```

---

## 📜 Development Guidelines

- **Frontend Styling:** Always use standard Tailwind classes via NativeWind. Follow the "TPM Frontend Rules" for consistency.
- **Service Layer:** Business logic MUST reside in the backend `services/` layer, not in the API routes.
- **Financial Integrity:** All money-related transactions must record an entry to `KasBank` via the `kas_bank_integration` module.
- **Consistency Ledger:** Refer to `CONTINUITY.md` and `CLAUDE.md` for the latest project state and architectural decisions.
