# Continuity Ledger

## Goal
Resolve UI visibility issues where search overlays were being clipped or obscured within `BottomSheetScrollView` on Android devices, while maintaining a stable navigation context.

## Status
- **Done**: 
    - Refactored `BengkelForm.tsx`, `MasterDataSelector.tsx`, `ArmadaSelector.tsx`, `JasaSelector.tsx`, `SparePartSelector.tsx`, and `MobilSelector.tsx` to use native `Modal` components instead of inline `absoluteFill` Views.
    - Verified that native `Modal` is the only way to reliably "escape" the clipping bounds of a parent `ScrollView` or `BottomSheet` on Android without using a complex Portal system.
    - Fixed the reported issue where search results were "ketutupan" (covered) on Android mobile devices.
    - Preserved `BarcodeScannerModal` as an absolute overlay at the root of `BengkelForm` where it works without being clipped.

- **Now**: Finalizing all component fixes and preparing for final testing.
- **Next**: Final verification on Android device via Expo Go.

## Key Decisions
- **Selective Modal Usage**: Re-introduced native `Modal` for self-contained selector components that do not require internal navigation hooks (e.g., `<Link>` or `useRouter`). This avoids the "clipping" behavior of parent containers while minimizing the risk of "Couldn't find a navigation context" errors.
- **Root Context Providers**: Re-confirmed that `SafeAreaProvider` at the app root is essential for correct inset calculation within both main screens and Modals.
- **Android Compatibility**: Prioritized native layout behavior (Modal) over inline overlays to ensure full-screen visibility across different Android OS versions.

## Open Questions (UNCONFIRMED)
- **Navigation Context**: Monitoring for any recurrence of "Navigation Context" errors. If they occur, we will wrap the Modal content in a `NavigationContainer` or move the state to the parent screen root.

## Working Set
- `frontend/components/BengkelForm.tsx`
- `frontend/components/ui/BarcodeScannerModal.tsx`
- `frontend/app/_layout.tsx`
- `frontend/components/ui/SparePartSelector.tsx`
- `frontend/components/ui/JasaSelector.tsx`
- `frontend/components/ui/MasterDataSelector.tsx`
- `CONTINUITY.md`
