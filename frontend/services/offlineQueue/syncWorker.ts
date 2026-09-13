import type { QueryClient } from '@tanstack/react-query';
import { onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import {
    OFFLINE_QUEUE_MAX_RETRIES,
    useOfflineQueueStore,
} from './store';
import { executeOfflineItem } from './handlers';
import { removeOptimisticByQueueId } from './optimistic';
import { appAlert } from '../../utils/appAlert';

let queryClientRef: QueryClient | null = null;
let unsubNet: (() => void) | null = null;
let appStateSub: NativeEventSubscription | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

export function startOfflineSyncWorker(queryClient: QueryClient) {
    queryClientRef = queryClient;
    if (started) return;
    started = true;

    try {
        // Debounced flush on connectivity regain (onlineManager owned by app/_layout)
        unsubNet = NetInfo.addEventListener((state) => {
            if (state.isConnected) {
                scheduleFlush(600);
            }
        });

        const unsubOnline = onlineManager.subscribe((online) => {
            if (online) scheduleFlush(400);
        });

        appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
            if (next === 'active' && onlineManager.isOnline()) {
                scheduleFlush(800);
            }
        });

        if (onlineManager.isOnline()) {
            scheduleFlush(1500);
        }

        (startOfflineSyncWorker as any)._unsubOnline = unsubOnline;
    } catch (e) {
        console.warn('[OfflineSync] worker start failed', e);
        started = false;
    }
}

export function stopOfflineSyncWorker() {
    unsubNet?.();
    unsubNet = null;
    appStateSub?.remove();
    appStateSub = null;
    const unsubOnline = (startOfflineSyncWorker as any)._unsubOnline as (() => void) | undefined;
    unsubOnline?.();
    if (flushTimer) clearTimeout(flushTimer);
    started = false;
}

/**
 * Errors that retrying can never fix: unsupported on this platform, malformed
 * item, or a payload the server will reject identically every time.
 */
function isPermanentError(err: any): boolean {
    if (err?.permanent === true) return true;
    const message = typeof err?.message === 'string' ? err.message : '';
    return (
        message.includes('not supported on web') ||
        message.includes('Upload metadata missing') ||
        err?.name === 'OfflineQueuePermanentError'
    );
}

function scheduleFlush(delayMs: number) {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
        void flushOfflineQueue();
    }, delayMs);
}

export async function flushOfflineQueue(options?: {
    onlyIds?: string[];
    silent?: boolean;
}): Promise<{ ok: number; failed: number }> {
    const qc = queryClientRef;
    if (!qc) return { ok: 0, failed: 0 };
    if (!onlineManager.isOnline()) return { ok: 0, failed: 0 };

    const store = useOfflineQueueStore.getState();
    if (store.isFlushing) return { ok: 0, failed: 0 };

    // Claim the flag before anything can await — otherwise a debounced flush and
    // a user-triggered "Retry" both pass the guard and run concurrently.
    store.setFlushing(true);

    let work = store
        .getPending()
        .filter((it) => it.retryCount < OFFLINE_QUEUE_MAX_RETRIES)
        // FIFO: oldest first
        .sort((a, b) => a.createdAt - b.createdAt);

    if (options?.onlyIds?.length) {
        work = work.filter((it) => options.onlyIds!.includes(it.id));
    }

    if (work.length === 0) {
        useOfflineQueueStore.getState().setFlushing(false);
        return { ok: 0, failed: 0 };
    }

    let ok = 0;
    let failed = 0;

    try {
        for (const item of work) {
            // Re-check connectivity mid-loop
            if (!onlineManager.isOnline()) break;

            useOfflineQueueStore.getState().markStatus(item.id, 'syncing');
            try {
                await executeOfflineItem(item);
                ok += 1;
                removeOptimisticByQueueId(qc, item.id);
                for (const key of item.invalidateKeys) {
                    await qc.invalidateQueries({ queryKey: key });
                }
                // Drop synced items from durable store
                useOfflineQueueStore.getState().removeItem(item.id);
            } catch (err: any) {
                failed += 1;
                const message =
                    err?.response?.data?.detail ||
                    err?.message ||
                    'Gagal sinkronisasi';
                const msgStr =
                    typeof message === 'string' ? message : JSON.stringify(message);

                const status = err?.response?.status as number | undefined;

                if (status === 401 || status === 403) {
                    // Session problem, not a data problem. Everything left in the
                    // queue is still valid — leave it pending and stop. The next
                    // flush after re-login retries it automatically.
                    for (const rest of work.slice(work.indexOf(item))) {
                        useOfflineQueueStore.getState().updateItem(rest.id, { lastError: msgStr });
                    }
                    break;
                }

                if (isPermanentError(err)) {
                    // Retrying cannot help — park it without burning the retry budget.
                    useOfflineQueueStore.getState().markStatus(item.id, 'failed', msgStr);
                } else if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
                    // 4xx (except 408/429) → permanent fail, don't infinite retry
                    useOfflineQueueStore.getState().markStatus(item.id, 'failed', msgStr);
                } else {
                    useOfflineQueueStore.getState().incrementRetry(item.id, msgStr);
                    const after = useOfflineQueueStore
                        .getState()
                        .items.find((i) => i.id === item.id);
                    if (after && after.retryCount >= OFFLINE_QUEUE_MAX_RETRIES) {
                        useOfflineQueueStore
                            .getState()
                            .markStatus(item.id, 'failed', `Max retry: ${msgStr}`);
                    }
                }
            }
        }
    } finally {
        useOfflineQueueStore.getState().setFlushing(false);
        useOfflineQueueStore.getState().setLastFlush({ ok, failed });
    }

    if (!options?.silent && (ok > 0 || failed > 0)) {
        if (failed === 0 && ok > 0) {
            appAlert(
                'Sinkronisasi Selesai',
                `${ok} transaksi offline berhasil dikirim ke server.`,
                { variant: 'success' }
            );
        } else if (failed > 0) {
            appAlert(
                'Sinkronisasi Sebagian',
                `${ok} berhasil, ${failed} gagal. Buka banner offline untuk retry.`,
                { variant: 'warning' }
            );
        }
    }

    return { ok, failed };
}

export function retryFailedItems() {
    const failed = useOfflineQueueStore.getState().getFailed();
    for (const it of failed) {
        useOfflineQueueStore.getState().markStatus(it.id, 'pending');
        useOfflineQueueStore.getState().updateItem(it.id, { retryCount: 0, lastError: undefined });
    }
    return flushOfflineQueue();
}

export function retryOne(id: string) {
    useOfflineQueueStore.getState().markStatus(id, 'pending');
    useOfflineQueueStore.getState().updateItem(id, { retryCount: 0, lastError: undefined });
    return flushOfflineQueue({ onlyIds: [id], silent: true });
}
