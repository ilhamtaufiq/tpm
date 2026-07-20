import { Platform } from 'react-native';
import { bengkelService } from '../bengkel';
import { keuanganService } from '../keuangan';
import { masterDataService } from '../masterData';
import { mobilService } from '../mobil';
import { jasaAngkutService } from '../jasaAngkut';
import { sdmService } from '../sdm';
import { jasaServisService } from '../jasaServis';
import type { OfflineActionType, OfflineQueueItem } from './types';

type Handler = (item: OfflineQueueItem) => Promise<unknown>;

function withIdempotencyHeaders(clientRequestId: string) {
    return {
        headers: {
            'X-Client-Request-Id': clientRequestId,
            'Idempotency-Key': clientRequestId,
        },
    };
}

/** Attach idempotency headers when service uses raw api — most services don't forward config.
 *  Handlers that need headers wrap payload with _clientRequestId and services ignore extras,
 *  OR we call api directly. Prefer injecting into payload where backend accepts extra fields,
 *  and always keep id on queue for retries.
 */
function injectClientRequestId<T extends Record<string, unknown>>(payload: T, id: string): T & { client_request_id: string } {
    return { ...payload, client_request_id: id };
}

/** Cast payload for strictly typed service methods while keeping client_request_id for axios interceptor. */
function asServicePayload(payload: Record<string, unknown>): any {
    return payload;
}

function buildFormData(item: OfflineQueueItem): FormData {
    const fd = new FormData();
    const upload = item.upload;
    if (!upload) {
        throw new Error('Upload metadata missing');
    }
    const field = upload.fieldName || 'file';
    if (Platform.OS === 'web') {
        throw new Error('Offline image upload not supported on web — re-upload when online');
    }
    // React Native multipart shape
    // @ts-expect-error RN FormData file
    fd.append(field, {
        uri: upload.uri,
        name: upload.name,
        type: upload.type,
    });
    return fd;
}

const handlers: Record<OfflineActionType, Handler> = {
    'bengkel.createTransaksi': async (item) =>
        bengkelService.createTransaksi(asServicePayload(injectClientRequestId(item.payload, item.clientRequestId))),
    'bengkel.updateTransaksi': async (item) => {
        const { id, data } = item.payload as { id: number; data: Record<string, unknown> };
        return bengkelService.updateTransaksi(
            id,
            asServicePayload(injectClientRequestId(data || {}, item.clientRequestId))
        );
    },
    'bengkel.updateTransaksiPayment': async (item) => {
        const { id, data } = item.payload as { id: number; data: Record<string, unknown> };
        return bengkelService.updateTransaksiPayment(
            id,
            asServicePayload(injectClientRequestId(data || {}, item.clientRequestId))
        );
    },
    'bengkel.createPembelian': async (item) =>
        bengkelService.createPembelianParts(
            asServicePayload(injectClientRequestId(item.payload, item.clientRequestId))
        ),
    'bengkel.updatePembelian': async (item) => {
        const { id, data } = item.payload as { id: number; data: Record<string, unknown> };
        return bengkelService.updatePembelianParts(
            id,
            asServicePayload(injectClientRequestId(data || {}, item.clientRequestId))
        );
    },
    'bengkel.createPengeluaran': async (item) =>
        bengkelService.createPengeluaran(
            asServicePayload(injectClientRequestId(item.payload, item.clientRequestId))
        ),
    'bengkel.createSparePart': async (item) =>
        bengkelService.createSparePart(
            asServicePayload(injectClientRequestId(item.payload, item.clientRequestId))
        ),
    'bengkel.updateSparePart': async (item) => {
        const { id, data } = item.payload as { id: number; data: Record<string, unknown> };
        return bengkelService.updateSparePart(
            id,
            asServicePayload(injectClientRequestId(data || {}, item.clientRequestId))
        );
    },
    'bengkel.deleteSparePart': async (item) => {
        const { id } = item.payload as { id: number };
        return bengkelService.deleteSparePart(id);
    },
    'bengkel.uploadSparePartImage': async (item) => {
        const { id } = item.payload as { id: number };
        const fd = buildFormData(item);
        return bengkelService.uploadSparePartImage(id, fd);
    },

    'finance.transfer': async (item) =>
        keuanganService.transfer(asServicePayload(injectClientRequestId(item.payload, item.clientRequestId))),
    'finance.createTransaction': async (item) =>
        keuanganService.createTransaction(
            asServicePayload(injectClientRequestId(item.payload, item.clientRequestId))
        ),
    'finance.createPiutang': async (item) =>
        keuanganService.createPiutang(
            asServicePayload(injectClientRequestId(item.payload, item.clientRequestId))
        ),
    'finance.createHutang': async (item) =>
        keuanganService.createHutang(
            asServicePayload(injectClientRequestId(item.payload, item.clientRequestId))
        ),
    'finance.processPayment': async (item) =>
        keuanganService.processPayment(
            asServicePayload(injectClientRequestId(item.payload, item.clientRequestId))
        ),
    'finance.processPaymentSplit': async (item) =>
        keuanganService.processPaymentSplit(
            asServicePayload(injectClientRequestId(item.payload, item.clientRequestId))
        ),
    'finance.processHutangPayment': async (item) =>
        keuanganService.processHutangPayment(
            asServicePayload(injectClientRequestId(item.payload, item.clientRequestId))
        ),
    'finance.processHutangPaymentSplit': async (item) =>
        keuanganService.processHutangPaymentSplit(
            asServicePayload(injectClientRequestId(item.payload, item.clientRequestId))
        ),

    'master.createCustomer': async (item) =>
        masterDataService.createCustomer(
            asServicePayload(injectClientRequestId(item.payload, item.clientRequestId))
        ),
    'master.updateCustomer': async (item) => {
        const { id, data } = item.payload as { id: number; data: Record<string, unknown> };
        return masterDataService.updateCustomer(
            id,
            asServicePayload(injectClientRequestId(data || {}, item.clientRequestId))
        );
    },
    'master.deleteCustomer': async (item) => {
        const { id } = item.payload as { id: number };
        return masterDataService.deleteCustomer(id);
    },
    'master.createSupplier': async (item) =>
        masterDataService.createSupplier(
            asServicePayload(injectClientRequestId(item.payload, item.clientRequestId))
        ),
    'master.updateSupplier': async (item) => {
        const { id, data } = item.payload as { id: number; data: Record<string, unknown> };
        return masterDataService.updateSupplier(
            id,
            asServicePayload(injectClientRequestId(data || {}, item.clientRequestId))
        );
    },
    'master.deleteSupplier': async (item) => {
        const { id } = item.payload as { id: number };
        return masterDataService.deleteSupplier(id);
    },
    'master.createJasaServis': async (item) =>
        jasaServisService.createJasa(
            asServicePayload(injectClientRequestId(item.payload, item.clientRequestId))
        ),
    'master.updateJasaServis': async (item) => {
        const { id, data } = item.payload as { id: number; data: Record<string, unknown> };
        return jasaServisService.updateJasa(
            id,
            asServicePayload(injectClientRequestId(data || {}, item.clientRequestId))
        );
    },
    'master.deleteJasaServis': async (item) => {
        const { id } = item.payload as { id: number };
        return jasaServisService.deleteJasa(id);
    },

    'mobil.create': async (item) =>
        mobilService.createMobil(asServicePayload(injectClientRequestId(item.payload, item.clientRequestId))),
    'mobil.update': async (item) => {
        const { id, data } = item.payload as { id: number; data: Record<string, unknown> };
        return mobilService.updateMobil(
            id,
            asServicePayload(injectClientRequestId(data || {}, item.clientRequestId))
        );
    },
    'mobil.delete': async (item) => {
        const { id } = item.payload as { id: number };
        return mobilService.deleteMobil(id);
    },
    'mobil.addBiaya': async (item) => {
        const { id, data } = item.payload as { id: number; data: Record<string, unknown> };
        if (!id || !data) {
            throw new Error('mobil.addBiaya requires { id, data }');
        }
        return mobilService.addBiaya(
            id,
            asServicePayload(injectClientRequestId(data, item.clientRequestId))
        );
    },
    'mobil.deleteBiaya': async (item) => {
        const { id, biayaId } = item.payload as { id: number; biayaId: number };
        return mobilService.deleteBiaya(id, biayaId);
    },
    'mobil.createPenjualan': async (item) =>
        mobilService.createPenjualan(
            asServicePayload(injectClientRequestId(item.payload, item.clientRequestId))
        ),
    'mobil.uploadMedia': async (item) => {
        const { id, files } = item.payload as {
            id: number;
            files: Array<{ uri: string; name: string; type: string }>;
        };
        if (!files?.length) {
            throw new Error('No files to upload');
        }
        return mobilService.uploadMedia(id, files);
    },
    'mobil.deleteMedia': async (item) => {
        const { id, mediaId } = item.payload as { id: number; mediaId: number };
        return mobilService.deleteMedia(id, mediaId);
    },

    'jasaAngkut.createMuatan': async (item) =>
        jasaAngkutService.createMuatan(
            asServicePayload(injectClientRequestId(item.payload, item.clientRequestId))
        ),
    'jasaAngkut.updateMuatan': async (item) => {
        const { id, data } = item.payload as { id: number; data: Record<string, unknown> };
        return jasaAngkutService.updateMuatan(
            id,
            asServicePayload(injectClientRequestId(data || {}, item.clientRequestId))
        );
    },
    'jasaAngkut.voidMuatan': async (item) => {
        const { id } = item.payload as { id: number };
        return jasaAngkutService.voidMuatan(id);
    },
    'jasaAngkut.createArmada': async (item) =>
        jasaAngkutService.createArmada(
            asServicePayload(injectClientRequestId(item.payload, item.clientRequestId))
        ),
    'jasaAngkut.updateArmada': async (item) => {
        const { id, data } = item.payload as { id: number; data: Record<string, unknown> };
        return jasaAngkutService.updateArmada(
            id,
            asServicePayload(injectClientRequestId(data || {}, item.clientRequestId))
        );
    },
    'jasaAngkut.deleteArmada': async (item) => {
        const { id } = item.payload as { id: number };
        return jasaAngkutService.deleteArmada(id);
    },

    'sdm.createKaryawan': async (item) =>
        sdmService.createKaryawan(
            asServicePayload(injectClientRequestId(item.payload, item.clientRequestId))
        ),
    'sdm.updateKaryawan': async (item) => {
        const { id, data } = item.payload as { id: number; data: Record<string, unknown> };
        return sdmService.updateKaryawan(
            id,
            asServicePayload(injectClientRequestId(data || {}, item.clientRequestId))
        );
    },
    'sdm.bulkClockIn': async (item) => {
        const { karyawanId, dates } = item.payload as {
            karyawanId: number;
            dates: Array<{ date: string; status: any; jam_masuk?: string; jam_keluar?: string }>;
        };
        return sdmService.bulkClockIn(karyawanId, dates);
    },
};

export async function executeOfflineItem(item: OfflineQueueItem): Promise<unknown> {
    const handler = handlers[item.type];
    if (!handler) {
        throw new Error(`No offline handler for ${item.type}`);
    }
    return handler(item);
}

// silence unused import warning if headers helper unused in some builds
void withIdempotencyHeaders;
