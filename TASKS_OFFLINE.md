# Task List: Offline Support Implementation

Track the progress of adding offline & sync features to TPM Super App.

## Phase 1: Preparation & Environment [DONE]
- [x] Install dependencies (`netinfo`, `persister`, `persist-client`)
- [x] Configure `onlineManager` to listen to connectivity changes
- [x] Verify `AsyncStorage` persistence is working for queries

## Phase 2: React Query Configuration [DONE]
- [x] Initialize `createAsyncStoragePersister`
- [x] Wrap with `persistQueryClient` in `_layout.tsx`
- [x] Configure `staleTime` and `gcTime` for queries to allow background caching

## Phase 3: Offline Data Mutations (Synchronization) [DONE]
- [x] Configure mutations to auto-pause when offline (handled by `onlineManager`)
- [x] Implement auto-resume on reconnect (handled by `onlineManager`)
- [x] Add basic conflict handling (handled by React Query default retry logic)

## Phase 4: UI/UX Feedback [DONE]
- [x] Create `ConnectivityBanner` component
- [x] Show "Syncing..." status in the dashboard/header
- [x] Visual feedback for offline mode

## Phase 5: Testing & Optimization [NOW]
- [ ] Verify persistence across app restart (Cold Start)
- [ ] Check cache size impact on performance
- [ ] Test sync behavior on flaky connections
- [ ] Test scenario: Create data offline, turn on internet, verify sync
- [ ] Test scenario: Read data from cache after cold start (airplane mode)
- [ ] Optimize cache size to avoid slowing down AsyncStorage

---
**Last Updated:** 2026-03-25
**Overall Progress:** 50%
