/**
 * Durable offline write queue — serializable action catalog.
 * Handlers live in handlers.ts; UI enqueues via enqueue.ts.
 */

export type OfflineItemStatus = 'pending' | 'syncing' | 'failed' | 'synced';

/** Logical mutation kinds supported by the offline worker. */
export type OfflineActionType =
    // Bengkel
    | 'bengkel.createTransaksi'
    | 'bengkel.updateTransaksi'
    | 'bengkel.updateTransaksiPayment'
    | 'bengkel.createPembelian'
    | 'bengkel.updatePembelian'
    | 'bengkel.createPengeluaran'
    | 'bengkel.createSparePart'
    | 'bengkel.updateSparePart'
    | 'bengkel.deleteSparePart'
    | 'bengkel.uploadSparePartImage'
    // Finance
    | 'finance.transfer'
    | 'finance.createTransaction'
    | 'finance.createPiutang'
    | 'finance.createHutang'
    | 'finance.processPayment'
    | 'finance.processPaymentSplit'
    | 'finance.processHutangPayment'
    | 'finance.processHutangPaymentSplit'
    // Master data
    | 'master.createCustomer'
    | 'master.updateCustomer'
    | 'master.deleteCustomer'
    | 'master.createSupplier'
    | 'master.updateSupplier'
    | 'master.deleteSupplier'
    | 'master.createJasaServis'
    | 'master.updateJasaServis'
    | 'master.deleteJasaServis'
    // Mobil
    | 'mobil.create'
    | 'mobil.update'
    | 'mobil.delete'
    | 'mobil.addBiaya'
    | 'mobil.deleteBiaya'
    | 'mobil.createPenjualan'
    | 'mobil.uploadMedia'
    | 'mobil.deleteMedia'
    // Jasa angkut
    | 'jasaAngkut.createMuatan'
    | 'jasaAngkut.updateMuatan'
    | 'jasaAngkut.voidMuatan'
    | 'jasaAngkut.createArmada'
    | 'jasaAngkut.updateArmada'
    | 'jasaAngkut.deleteArmada'
    // SDM
    | 'sdm.createKaryawan'
    | 'sdm.updateKaryawan'
    | 'sdm.bulkClockIn';

export type OfflinePayload = Record<string, unknown>;

export interface OfflineUploadMeta {
    /** Local file:// URI (or blob URL on web — web uploads usually need online). */
    uri: string;
    name: string;
    type: string;
    /** Optional field name for multipart (default: file). */
    fieldName?: string;
}

export interface OfflineQueueItem {
    id: string;
    /** Idempotency key sent as X-Client-Request-Id on flush. */
    clientRequestId: string;
    type: OfflineActionType;
    /** Human-readable short label for UI. */
    label: string;
    /** Optional longer description. */
    description?: string;
    payload: OfflinePayload;
    /** For multipart actions (images). */
    upload?: OfflineUploadMeta;
    status: OfflineItemStatus;
    createdAt: number;
    updatedAt: number;
    retryCount: number;
    lastError?: string;
    /** Query key roots to invalidate after successful sync. */
    invalidateKeys: string[][];
    /** Soft optimistic entity id for UI badges (e.g. offline-xxx). */
    optimisticId?: string | number;
}

export interface EnqueueOptions {
    type: OfflineActionType;
    payload: OfflinePayload;
    label: string;
    description?: string;
    upload?: OfflineUploadMeta;
    invalidateKeys?: string[][];
    /** If true, skip optimistic cache patch. */
    skipOptimistic?: boolean;
}

export const DEFAULT_INVALIDATE: Partial<Record<OfflineActionType, string[][]>> = {
    'bengkel.createTransaksi': [
        ['transaksi_bengkel'],
        ['transaksi_bengkel_summary'],
        ['piutang_list'],
        ['piutang_summary'],
        ['kas_bank_balances'],
        ['kas_bank_list'],
        ['laba_rugi_report'],
        ['dashboard_summary'],
    ],
    'bengkel.updateTransaksi': [
        ['transaksi_bengkel'],
        ['transaksi_bengkel_summary'],
        ['transaksi_bengkel_detail'],
        ['piutang_list'],
        ['piutang_summary'],
        ['kas_bank_balances'],
        ['kas_bank_list'],
        ['laba_rugi_report'],
    ],
    'bengkel.updateTransaksiPayment': [
        ['transaksi_bengkel'],
        ['transaksi_bengkel_summary'],
        ['transaksi_bengkel_detail'],
        ['piutang'],
        ['piutang_list'],
        ['piutang_summary'],
        ['laba_rugi_report'],
        ['kas_bank_balances'],
    ],
    'bengkel.createPembelian': [
        ['pembelian_parts'],
        ['spare_parts'],
        ['hutang_list'],
        ['hutang_summary'],
        ['kas_bank_balances'],
        ['kas_bank_list'],
    ],
    'bengkel.updatePembelian': [
        ['pembelian_parts'],
        ['spare_parts'],
        ['hutang_list'],
        ['kas_bank_balances'],
    ],
    'bengkel.createPengeluaran': [
        ['pengeluaran'],
        ['kas_bank_balances'],
        ['kas_bank_list'],
        ['dashboard_summary'],
    ],
    'bengkel.createSparePart': [['spare_parts'], ['spare_parts_stats'], ['spare_parts_low_stock']],
    'bengkel.updateSparePart': [['spare_parts'], ['spare_parts_stats'], ['spare_parts_low_stock']],
    'bengkel.deleteSparePart': [['spare_parts'], ['spare_parts_stats'], ['spare_parts_low_stock']],
    'bengkel.uploadSparePartImage': [['spare_parts']],
    'finance.transfer': [
        ['kas_bank_list'],
        ['kas_bank_balances'],
        ['dashboard_summary'],
        ['transaksi_bengkel_summary'],
    ],
    'finance.createTransaction': [
        ['kas_bank_list'],
        ['kas_bank_balances'],
        ['dashboard_summary'],
        ['recent_activity'],
    ],
    'finance.createPiutang': [
        ['piutang_list'],
        ['piutang_summary'],
        ['kas_bank_list'],
        ['kas_bank_balances'],
        ['dashboard_summary'],
    ],
    'finance.createHutang': [
        ['hutang_list'],
        ['hutang_summary'],
        ['kas_bank_list'],
        ['kas_bank_balances'],
        ['dashboard_summary'],
    ],
    'finance.processPayment': [
        ['piutang_list'],
        ['piutang_summary'],
        ['kas_bank_list'],
        ['kas_bank_balances'],
        ['dashboard_summary'],
    ],
    'finance.processPaymentSplit': [
        ['piutang_list'],
        ['piutang_summary'],
        ['kas_bank_list'],
        ['kas_bank_balances'],
        ['dashboard_summary'],
        ['mobil_detail'],
        ['penjualan_mobil_list'],
        ['mobil_list'],
    ],
    'finance.processHutangPayment': [
        ['hutang_list'],
        ['hutang_summary'],
        ['kas_bank_list'],
        ['kas_bank_balances'],
        ['dashboard_summary'],
    ],
    'finance.processHutangPaymentSplit': [
        ['hutang_list'],
        ['hutang_summary'],
        ['kas_bank_list'],
        ['kas_bank_balances'],
        ['dashboard_summary'],
    ],
    'master.createCustomer': [['customers']],
    'master.updateCustomer': [['customers']],
    'master.deleteCustomer': [['customers']],
    'master.createSupplier': [['suppliers']],
    'master.updateSupplier': [['suppliers']],
    'master.deleteSupplier': [['suppliers']],
    'master.createJasaServis': [['jasa-servis']],
    'master.updateJasaServis': [['jasa-servis']],
    'master.deleteJasaServis': [['jasa-servis']],
    'mobil.create': [['mobils'], ['mobils_summary'], ['inventory_summary'], ['dashboard_summary']],
    'mobil.update': [['mobils'], ['mobils_summary'], ['mobil_detail']],
    'mobil.delete': [['mobils'], ['mobils_summary'], ['inventory_summary']],
    'mobil.addBiaya': [['mobil_detail'], ['mobils']],
    'mobil.deleteBiaya': [['mobil_detail'], ['mobils']],
    'mobil.createPenjualan': [
        ['penjualan_mobil_list'],
        ['mobils'],
        ['mobils_summary'],
        ['piutang_list'],
        ['kas_bank_balances'],
    ],
    'mobil.uploadMedia': [['mobil_detail']],
    'mobil.deleteMedia': [['mobil_detail']],
    'jasaAngkut.createMuatan': [
        ['muatan'],
        ['muatan_summary'],
        ['dashboard_summary'],
        ['kas_bank_balances'],
    ],
    'jasaAngkut.updateMuatan': [['muatan'], ['muatan_summary']],
    'jasaAngkut.voidMuatan': [['muatan'], ['muatan_summary'], ['kas_bank_balances']],
    'jasaAngkut.createArmada': [['armada'], ['armada_active']],
    'jasaAngkut.updateArmada': [['armada'], ['armada_active'], ['armada_detail']],
    'jasaAngkut.deleteArmada': [['armada'], ['armada_active']],
    'sdm.createKaryawan': [['karyawan'], ['karyawan_stats']],
    'sdm.updateKaryawan': [['karyawan'], ['karyawan_stats']],
    'sdm.bulkClockIn': [['absensi'], ['daily_attendance']],
};

/** Query roots safe to persist for offline read (exclude heavy reports). */
export const PERSIST_QUERY_ROOTS = new Set([
    'transaksi_bengkel',
    'transaksi_bengkel_summary',
    'transaksi_bengkel_detail',
    'spare_parts',
    'spare_parts_low_stock',
    'spare_parts_stats',
    'pembelian_parts',
    'pengeluaran',
    'customers',
    'suppliers',
    'jasa-servis',
    'mobils',
    'mobils_summary',
    'mobil_detail',
    'inventory_summary',
    'penjualan_mobil_list',
    'muatan',
    'muatan_summary',
    'supir',
    'supir_active',
    'armada',
    'armada_active',
    'armada_detail',
    'piutang_list',
    'piutang_summary',
    'hutang_list',
    'hutang_summary',
    'kas_bank_balances',
    'kas_bank_list',
    'dashboard_summary',
    'recent_activity',
    'karyawan',
    'karyawan_stats',
    'absensi',
    'daily_attendance',
    'security_status',
    'print_settings',
    'navigation',
]);
