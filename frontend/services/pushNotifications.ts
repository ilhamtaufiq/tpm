import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

import { authService } from './auth';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';

type PushPayload = Record<string, any>;

const ANDROID_CHANNEL_ID = 'default';

if (Platform.OS !== 'web') {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
}

const getProjectId = () => {
    return (
        Constants.expoConfig?.extra?.eas?.projectId
        || Constants.easConfig?.projectId
        || Constants.expoConfig?.extra?.projectId
        || null
    );
};

const toStringValue = (value: unknown) => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
};

const buildRouteFromPayload = (payload: PushPayload) => {
    const entityId = payload.entity_id ?? payload.focus_id ?? null;
    const entity = toStringValue(payload.entity ?? payload.focus_entity);

    if (entityId !== null && entityId !== undefined && `${entityId}` !== '') {
        return {
            pathname: '/(tabs)/history',
            params: {
                focus_id: String(entityId),
                focus_entity: entity,
            },
        } as const;
    }

    return '/settings/notifications' as const;
};

const syncIncomingNotification = (notification: Notifications.Notification, markAsRead = false) => {
    const content = notification.request.content;
    const payload = (content.data ?? {}) as PushPayload;
    const sourceId = toStringValue(payload.event_id);
    const title = content.title || toStringValue(payload.title) || 'Notifikasi';
    const message = content.body || toStringValue(payload.message) || '';
    const entityId = payload.entity_id ?? payload.focus_id ?? null;

    useNotificationStore.getState().pushNotification({
        sourceId: sourceId || undefined,
        title,
        message,
        scope: toStringValue(payload.scope) || undefined,
        entity: toStringValue(payload.entity || payload.focus_entity) || undefined,
        action: toStringValue(payload.action) || undefined,
        entityId,
        timestamp: new Date().toISOString(),
    });

    if (markAsRead && sourceId) {
        useNotificationStore.getState().markAsRead(sourceId);
    }

    return payload;
};

const registerForPushNotificationsAsync = async () => {
    if (Platform.OS === 'web') {
        return null;
    }

    if (!Device.isDevice) {
        console.log('[Push] Skipping registration on non-physical device');
        return null;
    }

    const existingPermissions: any = await Notifications.getPermissionsAsync();
    let finalStatus = existingPermissions.status;

    if (finalStatus !== 'granted') {
        const requestedPermissions: any = await Notifications.requestPermissionsAsync();
        finalStatus = requestedPermissions.status;
    }

    if (finalStatus !== 'granted') {
        console.log('[Push] Permission denied');
        return null;
    }

    const projectId = getProjectId();
    if (!projectId) {
        console.warn('[Push] Missing Expo projectId in app config');
        return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
};

export function usePushNotifications() {
    const isAuthenticated = useAuthStore(state => state.isAuthenticated);
    const token = useAuthStore(state => state.token);
    const user = useAuthStore(state => state.user);
    const updateUser = useAuthStore(state => state.updateUser);
    const lastRegisteredTokenRef = useRef<string | null>(null);
    const lastUserIdRef = useRef<number | null>(null);

    useEffect(() => {
        if (lastUserIdRef.current !== user?.id) {
            lastRegisteredTokenRef.current = null;
            lastUserIdRef.current = user?.id ?? null;
        }
    }, [user?.id]);

    useEffect(() => {
        if (Platform.OS !== 'android') {
            return;
        }

        void Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#023C69',
        });
    }, []);

    useEffect(() => {
        let cancelled = false;

        const syncPushToken = async () => {
            if (Platform.OS === 'web' || !isAuthenticated || !token) {
                return;
            }

            const currentUserToken = user?.expo_push_token?.trim() || null;

            try {
                const deviceToken = await registerForPushNotificationsAsync();
                if (!deviceToken || cancelled) {
                    return;
                }

                if (currentUserToken === deviceToken) {
                    lastRegisteredTokenRef.current = deviceToken;
                    return;
                }

                const updatedUser = await authService.registerPushToken(deviceToken, Platform.OS);
                if (!cancelled) {
                    lastRegisteredTokenRef.current = deviceToken;
                    if (updatedUser) {
                        updateUser(updatedUser);
                    }
                }
            } catch (error) {
                console.warn('[Push] Failed to register token', error);
            }
        };

        void syncPushToken();

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, token, user?.expo_push_token, updateUser]);

    useEffect(() => {
        if (Platform.OS === 'web') {
            return;
        }

        const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
            syncIncomingNotification(notification, false);
        });

        const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
            const payload = syncIncomingNotification(response.notification, true);
            const route = buildRouteFromPayload(payload);
            router.push(route as any);
        });

        void Notifications.getLastNotificationResponseAsync().then((response) => {
            if (!response) {
                return;
            }

            const payload = syncIncomingNotification(response.notification, true);
            const route = buildRouteFromPayload(payload);
            router.push(route as any);
        });

        return () => {
            receivedSubscription.remove();
            responseSubscription.remove();
        };
    }, []);
}
