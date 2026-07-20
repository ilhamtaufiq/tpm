import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { WifiOff, CloudUpload, AlertTriangle } from 'lucide-react-native';
import { useOfflineQueueStore, flushOfflineQueue } from '../services/offlineQueue';
import { onlineManager } from '@tanstack/react-query';

function computeOffline(state: NetInfoState): boolean {
    // Connected Wi‑Fi without internet still treated carefully:
    // isInternetReachable === false → offline; null → fall back to isConnected.
    if (!state.isConnected) return true;
    if (state.isInternetReachable === false) return true;
    return false;
}

export const ConnectivityBanner = () => {
    const [isOffline, setIsOffline] = useState(false);
    const offlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Primitive selectors only — returning a new object each time causes infinite re-renders
    const pendingCount = useOfflineQueueStore((s) => {
        let n = 0;
        for (const i of s.items) {
            if (i.status === 'pending' || i.status === 'syncing' || i.status === 'failed') n += 1;
        }
        return n;
    });
    const failedCount = useOfflineQueueStore((s) => {
        let n = 0;
        for (const i of s.items) {
            if (i.status === 'failed') n += 1;
        }
        return n;
    });
    const isFlushing = useOfflineQueueStore((s) => s.isFlushing);
    const setSheetOpen = useOfflineQueueStore((s) => s.setSheetOpen);

    useEffect(() => {
        const apply = (state: NetInfoState) => {
            const offline = computeOffline(state);
            if (offline) {
                if (offlineTimer.current) clearTimeout(offlineTimer.current);
                // 1s debounce to avoid micro-disconnect flicker
                offlineTimer.current = setTimeout(() => setIsOffline(true), 1000);
            } else {
                if (offlineTimer.current) {
                    clearTimeout(offlineTimer.current);
                    offlineTimer.current = null;
                }
                setIsOffline(false);
            }
        };

        NetInfo.fetch().then(apply);
        const unsubscribe = NetInfo.addEventListener(apply);

        return () => {
            unsubscribe();
            if (offlineTimer.current) clearTimeout(offlineTimer.current);
        };
    }, []);

    // Show banner when offline OR when there is a non-empty durable queue
    if (!isOffline && pendingCount === 0) return null;

    const bg = failedCount > 0 ? '#dc2626' : isOffline ? '#f59e0b' : '#0369a1';

    const message = isOffline
        ? pendingCount > 0
            ? `Mode Offline · ${pendingCount} menunggu sync (tap untuk detail)`
            : 'Mode Offline: data dari penyimpanan lokal.'
        : failedCount > 0
          ? `${failedCount} gagal sync · ${pendingCount} antrean (tap untuk retry)`
          : `${pendingCount} transaksi menunggu sync (tap untuk detail)`;

    const Icon = failedCount > 0 ? AlertTriangle : isOffline ? WifiOff : CloudUpload;

    return (
        <Pressable
            onPress={() => setSheetOpen(true)}
            style={[styles.container, { backgroundColor: bg }]}
        >
            <View style={styles.content}>
                {isFlushing ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <Icon size={14} color="#fff" />
                )}
                <Text style={styles.text}>{message}</Text>
                {!isOffline && pendingCount > 0 ? (
                    <Pressable
                        onPress={(e) => {
                            e.stopPropagation?.();
                            if (onlineManager.isOnline()) {
                                void flushOfflineQueue({ silent: false });
                            }
                        }}
                        hitSlop={8}
                        style={styles.syncChip}
                    >
                        <Text style={styles.syncChipText}>Sync</Text>
                    </Pressable>
                ) : null}
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingVertical: 6,
        paddingHorizontal: 16,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    text: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
        flexShrink: 1,
    },
    syncChip: {
        backgroundColor: 'rgba(255,255,255,0.22)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    syncChipText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
});
