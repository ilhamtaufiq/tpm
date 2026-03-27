# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.1] - 2026-03-27

### Added
- **Global Scanning Ecosystem:** Replicated barcode scanner across `PurchaseScreen`, `SparePartMasterScreen`, `SparePartSelector`, and `BengkelScreen`.
- **Premium Scanner UI:** Added a sleek, animated laser-effect scan overlay in `BarcodeScannerModal` for a high-end experience.
- **Empty State Feedback:** Added informative messages in `MuatanForm` when no fleet or drivers are ready.

### Fixed
- **Resource Readiness Bug:** Fixed a logic error where Armada and Drivers remained "busy" even after completing a trip. Added proactive cache invalidation (Invalidate Queries) after trip status updates.
- **TypeScript & Lint Stabilization:** Resolved various implicit 'any' types and other TypeScript errors across `MuatanForm` and Workshop modules.
- **Typos:** Fixed variables and props in `PurchaseScreen` and `SparePartSelector`.

## [2.1.0] - 2026-03-26

### Added
- **Barcode/QR Scanner:** New instant scanning feature in `BengkelForm` for adding spare parts.
- **Auto-Matching:** Scanned items are automatically matched by their code and added to the transaction list.
- **Expo Camera Integration:** High-performance scanning with support for multiple formats (QR, EAN-13, Code 128, etc.).
- **Code Generators:** Added QR and Barcode visual generators for spare part labels in inventory screens.

### Changed
- Refined `BengkelForm` UI to include modern scanning buttons and better interaction flow.
- Improved inventory management with direct detail views and code generation.

## [1.0.0] - 2026-02-01
- Initial release of TPM Super App.
- Core modules: Jual Beli Mobil, Unit Bengkel, Jasa Angkut.
- Financial management and reporting systems.
