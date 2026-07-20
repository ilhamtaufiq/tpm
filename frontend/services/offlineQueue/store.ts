import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OfflineQueueItem, OfflineItemStatus } from './types';

const STORAGE_KEY = 'TPM_OFFLINE_WRITE_QUEUE_V1';
const MAX_ITEMS = 200;
const MAX_RETRIES = 8;

interface OfflineQueueState {
    items: OfflineQueueItem[];
    isFlushing: boolean;
    lastFlushAt: number | null;
    lastFlushResult: { ok: number; failed: number } | null;
    sheetOpen: boolean;
    hasHydrated: boolean;

    setHasHydrated: (v: boolean) => void;
    setSheetOpen: (open: boolean) => void;
    setFlushing: (v: boolean) => void;
    setLastFlush: (result: { ok: number; failed: number }) => void;

    addItem: (item: OfflineQueueItem) => void;
    updateItem: (id: string, patch: Partial<OfflineQueueItem>) => void;
    removeItem: (id: string) => void;
    removeSynced: () => void;
    markStatus: (id: string, status: OfflineItemStatus, lastError?: string) => void;
    incrementRetry: (id: string, lastError: string) => void;
    getPending: () => OfflineQueueItem[];
    getFailed: () => OfflineQueueItem[];
    pendingCount: () => number;
    failedCount: () => number;
    clearAll: () => void;
}

export const useOfflineQueueStore = create<OfflineQueueState>()(
    persist(
        (set, get) => ({
            items: [],
            isFlushing: false,
            lastFlushAt: null,
            lastFlushResult: null,
            sheetOpen: false,
            hasHydrated: false,

            setHasHydrated: (v) => set({ hasHydrated: v }),
            setSheetOpen: (open) => set({ sheetOpen: open }),
            setFlushing: (v) => set({ isFlushing: v }),
            setLastFlush: (result) =>
                set({ lastFlushAt: Date.now(), lastFlushResult: result }),

            addItem: (item) =>
                set((s) => {
                    const next = [item, ...s.items].slice(0, MAX_ITEMS);
                    return { items: next };
                }),

            updateItem: (id, patch) =>
                set((s) => ({
                    items: s.items.map((it) =>
                        it.id === id ? { ...it, ...patch, updatedAt: Date.now() } : it
                    ),
                })),

            removeItem: (id) =>
                set((s) => ({ items: s.items.filter((it) => it.id !== id) })),

            removeSynced: () =>
                set((s) => ({ items: s.items.filter((it) => it.status !== 'synced') })),

            markStatus: (id, status, lastError) =>
                set((s) => ({
                    items: s.items.map((it) =>
                        it.id === id
                            ? {
                                  ...it,
                                  status,
                                  lastError: lastError ?? (status === 'failed' ? it.lastError : undefined),
                                  updatedAt: Date.now(),
                              }
                            : it
                    ),
                })),

            incrementRetry: (id, lastError) =>
                set((s) => ({
                    items: s.items.map((it) =>
                        it.id === id
                            ? {
                                  ...it,
                                  retryCount: it.retryCount + 1,
                                  status: 'failed' as const,
                                  lastError,
                                  updatedAt: Date.now(),
                              }
                            : it
                    ),
                })),

            getPending: () =>
                get().items.filter((it) => it.status === 'pending' || it.status === 'failed'),

            getFailed: () => get().items.filter((it) => it.status === 'failed'),

            pendingCount: () =>
                get().items.filter(
                    (it) => it.status === 'pending' || it.status === 'syncing' || it.status === 'failed'
                ).length,

            failedCount: () => get().items.filter((it) => it.status === 'failed').length,

            clearAll: () => set({ items: [] }),
        }),
        {
            name: STORAGE_KEY,
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (s) => ({
                items: s.items.filter((it) => it.status !== 'synced'),
            }),
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true);
            },
        }
    )
);

export const OFFLINE_QUEUE_MAX_RETRIES = MAX_RETRIES;

export function createClientRequestId(): string {
    return `tpm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createQueueItemId(): string {
    return `oq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
