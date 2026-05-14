# Project Context: TPM (Transport, Penjualan, & Maintenance)

## Overview
TPM is an integrated ERP/Management system for a multi-unit business ecosystem. It handles financial reporting, operational tracking, and human resources for three primary business lines.

## Business Units
1. **Bengkel (Workshop)**: Handles vehicle maintenance, spare part inventory, and service sales.
2. **Jual Beli Mobil (Car Trading)**: Manages used car inventory, purchasing, preparation (repairs), and sales (Cash/Credit/Investor-backed).
3. **Jasa Angkut (Logistics)**: Manages truck armadas, trip costs (fuel, tolls, food), and transportation revenue.

## Core Financial Concept
The system uses a **Unified Ledger** where transactions are tagged to specific units (`BENGKEL`, `JUAL_BELI_MOBIL`, `JASA_ANGKUT`) but can be funded by central corporate accounts (`KAS_UTAMA`, `BANK_UTAMA`).

## Unique Logic
- **Internal Transactions**: Repairs done by the Workshop on the Trading unit's cars are tracked as internal receivables/payables to ensure correct profit/loss per unit without double-counting consolidated revenue.
- **Modal Discovery**: Equity is calculated bottom-up by identifying assets that exist without a recorded purchase transaction (Modal Non-Kas).
