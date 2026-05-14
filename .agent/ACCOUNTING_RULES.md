# Accounting Rules & Financial Logic

This document defines the specific accounting behaviors of the TPM system to ensure consistency across AI sessions.

## 1. Neraca (Balance Sheet) Logic
The Balance Sheet follows the identity: `Assets = Liabilities + Equity`.

### Modal Non-Kas (Injected Capital)
- Calculated by "discovering" assets (Stock, Fixed Assets) that do not have matching cash/debt purchase transactions.
- **Rule**: `Piutang Karyawan (Kasbon)` and `Piutang Lainnya` MUST be EXCLUDED from this discovery. They are operational or cash-based, not capital injections.
- **Rule**: Unit-specific operational receivables (Bengkel, JA, Mobil) are EXCLUDED (they are revenue-based).

### Internal Elimination
- Workshop revenue from internal car repairs is eliminated in the consolidated profit calculation if the car is still in stock.
- Once sold, the internal revenue is realized as consolidated cash.

## 2. Kasbon (Employee Loans)
- **Reporting Unit**: Usually `LAINNYA` (Central) or the specific unit where the employee works.
- **Fund Source**: Always explicitly routed to `KAS_UTAMA` or `BANK_UTAMA` if the unit's local drawer is empty.
- **Classification**: Current Asset (Receivable), never Equity.

## 3. Account Mapping (KasBankJenis)
- `KAS_UTAMA`: Primary cash box.
- `BANK_UTAMA`: Primary bank account.
- `KAS_UNIT_BENGKEL`: Local cash drawer for Workshop (sales only).
- `KAS_UNIT_MOBIL`: Local cash drawer for Car Trading.
- `KAS_UNIT_JASA_ANGKUT`: Local cash drawer for Logistics.
