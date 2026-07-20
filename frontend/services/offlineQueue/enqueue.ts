import type { QueryClient } from '@tanstack/react-query';
import { onlineManager } from '@tanstack/react-query';
import {
    createClientRequestId,
    createQueueItemId,
    useOfflineQueueStore,
} from './store';
import { DEFAULT_INVALIDATE, type EnqueueOptions, type OfflineQueueItem } from './types';
import { applyOptimisticPatch } from './optimistic';

export type OfflineAwareResult<T> =
    | { mode: 'online'; data: T }
    | { mode: 'offline'; queueItem: OfflineQueueItem };

/**
 * If online → run onlineFn.
 * If offline → durable enqueue + optimistic patch, never claim success without persist.
 */
export async function offlineAwareWrite<T>(
    queryClient: QueryClient,
    options: EnqueueOptions & {
        onlineFn: () => Promise<T>;
        /** Force offline path (tests). */
        forceOffline?: boolean;
    }
): Promise<OfflineAwareResult<T>> {
    const isOnline = options.forceOffline ? false : onlineManager.isOnline();

    if (isOnline) {
        const data = await options.onlineFn();
        return { mode: 'online', data };
    }

    const queueItem = enqueueOfflineAction(queryClient, options);
    return { mode: 'offline', queueItem };
}

export function enqueueOfflineAction(
    queryClient: QueryClient,
    options: EnqueueOptions
): OfflineQueueItem {
    const now = Date.now();
    const id = createQueueItemId();
    const clientRequestId = createClientRequestId();
    const optimisticId = -Math.abs(now % 1_000_000_000);

    const invalidateKeys =
        options.invalidateKeys || DEFAULT_INVALIDATE[options.type] || [];

    const item: OfflineQueueItem = {
        id,
        clientRequestId,
        type: options.type,
        label: options.label,
        description: options.description,
        payload: options.payload,
        upload: options.upload,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        retryCount: 0,
        invalidateKeys: invalidateKeys.map((k) => [...k]),
        optimisticId,
    };

    useOfflineQueueStore.getState().addItem(item);

    if (!options.skipOptimistic) {
        try {
            applyOptimisticPatch(queryClient, item);
        } catch (e) {
            console.warn('[OfflineQueue] optimistic patch failed', e);
        }
    }

    return item;
}

export function isAppOnline(): boolean {
    return onlineManager.isOnline();
}
