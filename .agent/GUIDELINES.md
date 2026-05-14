# Agent Guidelines & Best Practices

## 1. Accounting Integrity
- **Never force balance**: If Aktiva and Pasiva don't match, find the missing transaction in the `Modal Non-Kas` discovery logic or the `Internal Sync` logic. Do not add hardcoded "adjustments".
- **Cross-Wallet Funding**: Always check if a transaction needs to be funded from `KAS_UTAMA` if the specific unit wallet is insufficient.

## 2. API & Data Flow
- **Pydantic Validation**: Ensure backend schemas match frontend expectations exactly.
- **Enums**: Always use enums from `app.utils.constants` instead of hardcoded strings.

## 3. Frontend UI
- **Currency**: Always use `formatCurrency` for financial values.
- **Feedback**: Provide clear alerts (`showAlert`) for validation errors or successful actions.

## 4. Troubleshooting
- If a report is wrong, check `backend/app/services/reports/base.py` first. This is where the unified financial data is prepared.
- If a balance sheet is unbalanced, check `backend/app/services/reports/neraca_service.py`.
