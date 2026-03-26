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
- **Database:** SQLite/PostgreSQL with [SQLAlchemy](https://www.sqlalchemy.org/) ORM
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

## ⚙️ Setup Instructions

### Backend Setup
1.  Navigate to the backend directory: `cd backend`
2.  Create a virtual environment: `python -m venv venv`
3.  Activate the environment:
    - Windows: `.\venv\Scripts\activate`
    - Mac/Linux: `source venv/bin/activate`
4.  Install dependencies: `pip install -r requirements.txt`
5.  Set up environment variables: Copy `.env.example` to `.env` and configure accordingly.
6.  Run database migrations: `alembic upgrade head`
7.  Start the server: `python main.py` or use the provided scripts.

### Frontend Setup
1.  Navigate to the frontend directory: `cd frontend`
2.  Install dependencies: `npm install`
3.  Start the Expo development server: `npx expo start`
4.  Download the **Expo Go** app on your mobile device or use an emulator to view the app.

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
