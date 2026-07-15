import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type RealtimeNotification = {
    id: string;
    sourceId?: string;
    title: string;
    message: string;
    scope?: string;
    entity?: string;
    action?: string;
    entityId?: number | string | null;
    timestamp: string;
    read: boolean;
};

interface NotificationState {
    items: RealtimeNotification[];
    unreadCount: number;
    pushNotification: (notification: Omit<RealtimeNotification, 'id' | 'read' | 'timestamp'> & { timestamp?: string }) => void;
    markAsRead: (id: string) => void;
    removeNotification: (id: string) => void;
    markAllRead: () => void;
    clear: () => void;
}

export const useNotificationStore = create<NotificationState>()(
    persist(
        (set) => ({
            items: [],
            unreadCount: 0,
            pushNotification: (notification) => {
                set((state) => {
                    const sourceId = notification.sourceId ?? null;
                    if (sourceId && state.items.some(item => item.sourceId === sourceId)) {
                        return {};
                    }

                    const item: RealtimeNotification = {
                        id: sourceId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        sourceId: sourceId || undefined,
                        title: notification.title,
                        message: notification.message,
                        scope: notification.scope,
                        entity: notification.entity,
                        action: notification.action,
                        entityId: notification.entityId ?? null,
                        timestamp: notification.timestamp || new Date().toISOString(),
                        read: false,
                    };

                    return {
                        items: [item, ...state.items].slice(0, 20),
                        unreadCount: state.unreadCount + 1,
                    };
                });
            },
            markAsRead: (id) => set((state) => {
                let unreadCount = state.unreadCount;
                const items = state.items.map(item => {
                    // Match by id or sourceId (push taps pass event_id as sourceId)
                    if ((item.id !== id && item.sourceId !== id) || item.read) return item;
                    unreadCount = Math.max(0, unreadCount - 1);
                    return { ...item, read: true };
                });

                return { items, unreadCount };
            }),
            removeNotification: (id) => set((state) => {
                const target = state.items.find(item => item.id === id);
                const unreadCount = target && !target.read
                    ? Math.max(0, state.unreadCount - 1)
                    : state.unreadCount;

                return {
                    items: state.items.filter(item => item.id !== id),
                    unreadCount,
                };
            }),
            markAllRead: () => set((state) => ({
                items: state.items.map(item => ({ ...item, read: true })),
                unreadCount: 0,
            })),
            clear: () => set({
                items: [],
                unreadCount: 0,
            }),
        }),
        {
            name: 'TPM_NOTIFICATION_STORE',
            storage: createJSONStorage(() => ({
                ...AsyncStorage,
                setItem: async (key: string, value: string) => {
                    try {
                        await AsyncStorage.setItem(key, value);
                    } catch (error: any) {
                        if (error?.message?.includes('quota') || error?.message?.includes('exceeded')) {
                            await AsyncStorage.clear();
                            await AsyncStorage.setItem(key, value);
                        } else {
                            throw error;
                        }
                    }
                },
            })),
        }
    )
);
