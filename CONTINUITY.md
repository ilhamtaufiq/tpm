# Continuity Ledger

- Goal: Display vehicle license plate number below the fleet name in the "available fleet pills" within `MuatanForm.tsx`.
- Constraints/Assumptions:
  - Working in `frontend/components/jasa-angkut/MuatanForm.tsx`.
  - The fleet data object should contain a plate number field (e.g., `plat_nomor`, `no_plat`, etc.).
- Key decisions:
- State:
  - Done: 
    - Added license plate number display below fleet name in available fleet pills.
    - Modified load type (jenis muatan) to have individual ritase fields.
    - Implemented automatic total ritase calculation.
    - Removed the redundant "Total Ritase" UI field.
    - Optimized layout for load and ritase fields (narrower ritase input).
  - Now: Finished changes.
  - Next:
- Open questions (UNCONFIRMED if needed):
- Working set (files/ids/commands):
  - `frontend/components/jasa-angkut/MuatanForm.tsx`
