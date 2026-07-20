import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ScrollView,
    ActivityIndicator,
    Modal,
    Platform,
} from 'react-native';
import { CloudOff, RefreshCw, Trash2, X, AlertCircle, Clock } from 'lucide-react-native';
import {
    useOfflineQueueStore,
    flushOfflineQueue,
    retryFailedItems,
    retryOne,
} from '../services/offlineQueue';
import { onlineManager } from '@tanstack/react-query';

function statusLabel(status: string) {
    switch (status) {
        case 'pending':
            return 'Menunggu';
        case 'syncing':
            return 'Mengirim…';
        case 'failed':
            return 'Gagal';
        case 'synced':
            return 'Selesai';
        default:
            return status;
    }
}

function statusColor(status: string) {
    switch (status) {
        case 'failed':
            return '#dc2626';
        case 'syncing':
            return '#2563eb';
        case 'pending':
            return '#d97706';
        default:
            return '#6b7280';
    }
}

export function OfflineQueueSheet() {
    const sheetOpen = useOfflineQueueStore((s) => s.sheetOpen);
    const setSheetOpen = useOfflineQueueStore((s) => s.setSheetOpen);
    const items = useOfflineQueueStore((s) => s.items);
    const isFlushing = useOfflineQueueStore((s) => s.isFlushing);
    const removeItem = useOfflineQueueStore((s) => s.removeItem);
    const lastFlushResult = useOfflineQueueStore((s) => s.lastFlushResult);

    const visible = items.filter((i) => i.status !== 'synced');

    const handleSyncAll = async () => {
        if (!onlineManager.isOnline()) return;
        await flushOfflineQueue({ silent: false });
    };

    const handleRetryFailed = async () => {
        if (!onlineManager.isOnline()) return;
        await retryFailedItems();
    };

    return (
        <Modal
            visible={sheetOpen}
            animationType="slide"
            transparent
            onRequestClose={() => setSheetOpen(false)}
        >
            <View style={styles.backdrop}>
                <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheetOpen(false)} />
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <CloudOff size={18} color="#b45309" />
                            <Text style={styles.title}>Antrean Offline</Text>
                        </View>
                        <Pressable onPress={() => setSheetOpen(false)} hitSlop={12}>
                            <X size={22} color="#374151" />
                        </Pressable>
                    </View>

                    <Text style={styles.subtitle}>
                        Data tersimpan di perangkat. Akan dikirim otomatis saat online, atau
                        tekan Sinkronkan.
                    </Text>

                    {lastFlushResult ? (
                        <Text style={styles.flushHint}>
                            Terakhir: {lastFlushResult.ok} sukses, {lastFlushResult.failed} gagal
                        </Text>
                    ) : null}

                    <View style={styles.actions}>
                        <Pressable
                            style={[styles.btn, styles.btnPrimary, isFlushing && styles.btnDisabled]}
                            onPress={handleSyncAll}
                            disabled={isFlushing || !onlineManager.isOnline()}
                        >
                            {isFlushing ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <RefreshCw size={16} color="#fff" />
                            )}
                            <Text style={styles.btnPrimaryText}>Sinkronkan semua</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.btn, styles.btnSecondary]}
                            onPress={handleRetryFailed}
                            disabled={isFlushing || !onlineManager.isOnline()}
                        >
                            <Text style={styles.btnSecondaryText}>Retry gagal</Text>
                        </Pressable>
                    </View>

                    <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 32 }}>
                        {visible.length === 0 ? (
                            <View style={styles.empty}>
                                <Clock size={28} color="#9ca3af" />
                                <Text style={styles.emptyText}>Tidak ada antrean</Text>
                            </View>
                        ) : (
                            visible.map((item) => (
                                <View key={item.id} style={styles.card}>
                                    <View style={styles.cardTop}>
                                        <Text style={styles.cardLabel} numberOfLines={2}>
                                            {item.label}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.badge,
                                                { color: statusColor(item.status) },
                                            ]}
                                        >
                                            {statusLabel(item.status)}
                                        </Text>
                                    </View>
                                    {item.description ? (
                                        <Text style={styles.cardDesc} numberOfLines={2}>
                                            {item.description}
                                        </Text>
                                    ) : null}
                                    <Text style={styles.meta}>
                                        {new Date(item.createdAt).toLocaleString('id-ID')} · retry{' '}
                                        {item.retryCount}
                                    </Text>
                                    {item.lastError ? (
                                        <View style={styles.errorRow}>
                                            <AlertCircle size={12} color="#dc2626" />
                                            <Text style={styles.errorText} numberOfLines={3}>
                                                {item.lastError}
                                            </Text>
                                        </View>
                                    ) : null}
                                    <View style={styles.cardActions}>
                                        {item.status === 'failed' || item.status === 'pending' ? (
                                            <Pressable
                                                onPress={() => retryOne(item.id)}
                                                style={styles.linkBtn}
                                                disabled={isFlushing || !onlineManager.isOnline()}
                                            >
                                                <Text style={styles.linkBtnText}>Coba lagi</Text>
                                            </Pressable>
                                        ) : null}
                                        <Pressable
                                            onPress={() => removeItem(item.id)}
                                            style={styles.linkBtnDanger}
                                        >
                                            <Trash2 size={14} color="#dc2626" />
                                            <Text style={styles.linkBtnDangerText}>Hapus</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            ))
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: Platform.OS === 'web' ? '85vh' as any : '88%',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111827',
    },
    subtitle: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 8,
        lineHeight: 17,
    },
    flushHint: {
        fontSize: 11,
        color: '#9ca3af',
        marginBottom: 8,
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    btn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
    },
    btnPrimary: {
        backgroundColor: '#023C69',
        flex: 1,
        justifyContent: 'center',
    },
    btnPrimaryText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 13,
    },
    btnSecondary: {
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 14,
    },
    btnSecondaryText: {
        color: '#374151',
        fontWeight: '600',
        fontSize: 13,
    },
    btnDisabled: {
        opacity: 0.6,
    },
    list: {
        flexGrow: 0,
    },
    empty: {
        alignItems: 'center',
        paddingVertical: 40,
        gap: 8,
    },
    emptyText: {
        color: '#9ca3af',
        fontSize: 13,
    },
    card: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        backgroundColor: '#fafafa',
    },
    cardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 4,
    },
    cardLabel: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    badge: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    cardDesc: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 4,
    },
    meta: {
        fontSize: 11,
        color: '#9ca3af',
    },
    errorRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 6,
        alignItems: 'flex-start',
    },
    errorText: {
        flex: 1,
        fontSize: 11,
        color: '#dc2626',
    },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 16,
        marginTop: 10,
    },
    linkBtn: {
        paddingVertical: 4,
    },
    linkBtnText: {
        color: '#2563eb',
        fontWeight: '600',
        fontSize: 13,
    },
    linkBtnDanger: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
    },
    linkBtnDangerText: {
        color: '#dc2626',
        fontWeight: '600',
        fontSize: 13,
    },
});
