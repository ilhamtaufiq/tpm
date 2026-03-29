# Continuity Ledger

## Goal
Optimize `SparePartMasterScreen` by removing the "scan tambah stok" feature and clean up the UI by removing the "Online/Syncing" banner, showing only the "Offline" banner when connectivity is lost.

## Status
- **Done**: 
    - Removed redundant stock scanning feature from `sparepart.tsx`.
    - Cleaned up state, handlers, and modals in `sparepart.tsx`.
- **Now**: 
    - Removing "Internet Tersambung" (Online/Syncing) banner from `ConnectivityBanner.tsx`.
- **Next**: 
    - Final UI check to ensure only the Offline banner appears when necessary.

## Key Decisions
- **Selective Connectivity Banner**: Decided to hide the "Syncing/Online" banner to reduce UI noise, keeping only the critical "Offline" status indicator.
- **Feature Removal**: Removed "scan tambah stok" to avoid redundancy with Inventory module.

## Open Questions (UNCONFIRMED)
- None at this time.

## Working Set
- `frontend/components/ConnectivityBanner.tsx`
- `frontend/app/master-data/sparepart.tsx`
- `CONTINUITY.md`
