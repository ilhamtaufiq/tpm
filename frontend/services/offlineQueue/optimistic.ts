import type { QueryClient } from '@tanstack/react-query';
import type { OfflineQueueItem } from './types';

/**
 * Best-effort optimistic patches so offline writes appear in local lists
 * with `_offline: true` / `_pendingSync: true` flags for badges.
 */
export function applyOptimisticPatch(queryClient: QueryClient, item: OfflineQueueItem): void {
    const flag = {
        _offline: true,
        _pendingSync: true,
        _queueId: item.id,
        client_request_id: item.clientRequestId,
    };

    switch (item.type) {
        case 'bengkel.createTransaksi': {
            const row = {
                id: item.optimisticId,
                nomor_transaksi: `OFF-${String(item.optimisticId).slice(-6)}`,
                tanggal: (item.payload.tanggal as string) || new Date().toISOString().slice(0, 10),
                customer_nama: (item.payload.customer_nama as string) || 'Offline',
                plat_nomor: (item.payload.plat_nomor as string) || '-',
                total_biaya: (item.payload.total_biaya as number) ?? 0,
                status_pengerjaan: (item.payload.status_pengerjaan as string) || 'ANTRE',
                status_bayar: (item.payload.status_bayar as string) || 'BELUM_LUNAS',
                ...flag,
                ...pickKnown(item.payload, [
                    'customer_id',
                    'mekanik_id',
                    'tipe_motor',
                    'kategori',
                    'total_jasa',
                    'total_part',
                    'catatan',
                ]),
            };
            prependToListQueries(queryClient, 'transaksi_bengkel', row);
            break;
        }
        case 'bengkel.createPembelian': {
            const row = {
                id: item.optimisticId,
                nomor_transaksi: `OFF-P-${String(item.optimisticId).slice(-6)}`,
                tanggal: (item.payload.tanggal as string) || new Date().toISOString().slice(0, 10),
                total_biaya: (item.payload.total_biaya as number) ?? 0,
                status_bayar: (item.payload.status_bayar as string) || 'BELUM_LUNAS',
                ...flag,
            };
            prependToListQueries(queryClient, 'pembelian_parts', row);
            break;
        }
        case 'bengkel.createPengeluaran': {
            const row = {
                id: item.optimisticId,
                tanggal: (item.payload.tanggal as string) || new Date().toISOString().slice(0, 10),
                jumlah: (item.payload.jumlah as number) ?? 0,
                deskripsi: (item.payload.deskripsi as string) || item.label,
                kategori: (item.payload.kategori as string) || 'LAINNYA',
                ...flag,
            };
            prependToListQueries(queryClient, 'pengeluaran', row);
            break;
        }
        case 'bengkel.createSparePart': {
            const row = {
                id: item.optimisticId,
                kode: (item.payload.kode as string) || `OFF-${item.optimisticId}`,
                nama: (item.payload.nama as string) || 'Barang offline',
                harga_beli: (item.payload.harga_beli as number) ?? 0,
                harga_jual: (item.payload.harga_jual as number) ?? 0,
                stok: (item.payload.stok as number) ?? 0,
                stok_minimum: (item.payload.stok_minimum as number) ?? 0,
                ...flag,
            };
            prependInfiniteOrList(queryClient, 'spare_parts', row);
            break;
        }
        case 'finance.createPiutang': {
            const row = {
                id: item.optimisticId,
                nama_debitur: (item.payload.nama_debitur as string) || 'Offline',
                nominal_piutang: (item.payload.nominal_piutang as number) ?? 0,
                tanggal: (item.payload.tanggal as string) || new Date().toISOString().slice(0, 10),
                sisa_piutang: (item.payload.nominal_piutang as number) ?? 0,
                ...flag,
            };
            prependToListQueries(queryClient, 'piutang_list', row);
            break;
        }
        case 'finance.createHutang': {
            const row = {
                id: item.optimisticId,
                nama_kreditur: (item.payload.nama_kreditur as string) || 'Offline',
                nominal_hutang: (item.payload.nominal_hutang as number) ?? 0,
                tanggal: (item.payload.tanggal as string) || new Date().toISOString().slice(0, 10),
                sisa_hutang: (item.payload.nominal_hutang as number) ?? 0,
                ...flag,
            };
            prependToListQueries(queryClient, 'hutang_list', row);
            break;
        }
        case 'master.createCustomer': {
            const row = {
                id: item.optimisticId,
                kode: (item.payload.kode as string) || `OFF-C`,
                nama: (item.payload.nama as string) || 'Customer offline',
                tipe: (item.payload.tipe as string) || 'Perorangan',
                ...flag,
            };
            prependToListQueries(queryClient, 'customers', row);
            break;
        }
        case 'master.createSupplier': {
            const row = {
                id: item.optimisticId,
                kode: (item.payload.kode as string) || `OFF-S`,
                nama: (item.payload.nama as string) || 'Supplier offline',
                ...flag,
            };
            prependToListQueries(queryClient, 'suppliers', row);
            break;
        }
        case 'mobil.create': {
            const row = {
                id: item.optimisticId,
                plat_nomor: (item.payload.plat_nomor as string) || 'OFFLINE',
                merek: (item.payload.merek as string) || '',
                tipe: (item.payload.tipe as string) || '',
                status: (item.payload.status as string) || 'TERSEDIA',
                ...flag,
            };
            prependToListQueries(queryClient, 'mobils', row);
            break;
        }
        case 'jasaAngkut.createMuatan': {
            const row = {
                id: item.optimisticId,
                nomor_muatan: `OFF-M-${String(item.optimisticId).slice(-6)}`,
                tanggal: (item.payload.tanggal as string) || new Date().toISOString().slice(0, 10),
                status: (item.payload.status as string) || 'DRAFT',
                ...flag,
            };
            prependToListQueries(queryClient, 'muatan', row);
            break;
        }
        case 'sdm.createKaryawan': {
            const row = {
                id: item.optimisticId,
                kode: (item.payload.kode as string) || 'OFF-K',
                nama: (item.payload.nama as string) || 'Karyawan offline',
                jabatan: (item.payload.jabatan as string) || '-',
                status: (item.payload.status as string) || 'AKTIF',
                ...flag,
            };
            prependToListQueries(queryClient, 'karyawan', row);
            break;
        }
        default:
            // Updates/deletes/payments: no list prepend — rely on invalidate after sync
            break;
    }
}

function pickKnown(obj: Record<string, unknown>, keys: string[]) {
    const out: Record<string, unknown> = {};
    for (const k of keys) {
        if (obj[k] !== undefined) out[k] = obj[k];
    }
    return out;
}

function prependToListQueries(queryClient: QueryClient, rootKey: string, row: Record<string, unknown>) {
    const cache = queryClient.getQueryCache().findAll({ queryKey: [rootKey] });
    for (const q of cache) {
        const data = q.state.data as any;
        if (!data) continue;
        if (Array.isArray(data)) {
            queryClient.setQueryData(q.queryKey, [row, ...data]);
        } else if (Array.isArray(data.data)) {
            queryClient.setQueryData(q.queryKey, {
                ...data,
                data: [row, ...data.data],
                total: typeof data.total === 'number' ? data.total + 1 : data.total,
            });
        } else if (Array.isArray(data.items)) {
            queryClient.setQueryData(q.queryKey, {
                ...data,
                items: [row, ...data.items],
            });
        }
    }
}

function prependInfiniteOrList(queryClient: QueryClient, rootKey: string, row: Record<string, unknown>) {
    const cache = queryClient.getQueryCache().findAll({ queryKey: [rootKey] });
    for (const q of cache) {
        const data = q.state.data as any;
        if (!data) continue;
        // infinite query shape
        if (data.pages && Array.isArray(data.pages)) {
            const pages = [...data.pages];
            if (pages[0]) {
                const first = pages[0];
                if (Array.isArray(first)) {
                    pages[0] = [row, ...first];
                } else if (Array.isArray(first.data)) {
                    pages[0] = {
                        ...first,
                        data: [row, ...first.data],
                        total: typeof first.total === 'number' ? first.total + 1 : first.total,
                    };
                }
            }
            queryClient.setQueryData(q.queryKey, { ...data, pages });
            continue;
        }
        prependToListQueries(queryClient, rootKey, row);
    }
}

/** Remove optimistic rows after successful sync or cancel. */
export function removeOptimisticByQueueId(queryClient: QueryClient, queueId: string) {
    const cache = queryClient.getQueryCache().getAll();
    for (const q of cache) {
        const data = q.state.data as any;
        if (!data) continue;
        if (Array.isArray(data)) {
            queryClient.setQueryData(
                q.queryKey,
                data.filter((r: any) => r?._queueId !== queueId)
            );
        } else if (Array.isArray(data?.data)) {
            queryClient.setQueryData(q.queryKey, {
                ...data,
                data: data.data.filter((r: any) => r?._queueId !== queueId),
            });
        } else if (data?.pages) {
            const pages = data.pages.map((page: any) => {
                if (Array.isArray(page)) {
                    return page.filter((r: any) => r?._queueId !== queueId);
                }
                if (Array.isArray(page?.data)) {
                    return {
                        ...page,
                        data: page.data.filter((r: any) => r?._queueId !== queueId),
                    };
                }
                return page;
            });
            queryClient.setQueryData(q.queryKey, { ...data, pages });
        }
    }
}
