1: # Continuity Ledger
2: 
3: - Goal: Fix server-client timezone discrepancy (WIB time vs Server UTC time).
4: - Constraints/Assumptions:
5:     - User location: Indonesia (WIB/UTC+7).
6:     - Server time currently in UTC.
7:     - Transactions show as "7 hours ago" because the server saves timestamps in UTC but the frontend reads them as local time (WIB).
8:     - Backend/Database running in Docker on VPS.
9: - Key decisions:
10:     - Set `TZ=Asia/Jakarta` in both backend and db containers in `docker-compose.yml`.
11:     - Update SQL engine to set session timezone for MySQL if necessary.
12: - State:
13:     - Done:
14:         - Investigated models and timestamp handling (uses `func.now()`).
15:         - Identified timezone mismatch (UTC vs WIB).
16:     - Now: Proposing changes to `docker-compose.yml` and backend engine.
17:     - Next: Apply changes and verify.
18: - Open questions (UNCONFIRMED):
19:     - Does the MySQL server support 'Asia/Jakarta' timezone name or do we need offset '+07:00'?
20: - Working set (files/ids/commands):
21:     - `docker-compose.yml`
22:     - `backend/app/database/connection.py`
23:     - `backend/app/database/base.py`
24: 
