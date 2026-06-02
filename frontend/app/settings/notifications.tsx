import React, { useMemo } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, CheckCheck, Trash2, Bell } from 'lucide-react-native';
import { router } from 'expo-router';

import { Header } from '../../components/ui/Header';
import { Typography } from '../../components/ui/Typography';
import { useNotificationStore } from '../../store/useNotificationStore';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';

const ENTITY_LABELS: Record<string, string> = {
    bengkel: 'Transaksi Bengkel',
    jasa_angkut: 'Muatan',
    mobil: 'Transaksi Mobil',
    finance: 'Kas & Bank',
    master: 'Data Master',
    users: 'Pengguna',
    settings: 'Pengaturan',
};

const ACTION_LABELS: Record<string, string> = {
    created: 'baru dicatat',
    updated: 'diperbarui',
    deleted: 'dihapus',
    voided: 'dibatalkan',
    status_updated: 'status berubah',
    payment_updated: 'pembayaran diperbarui',
    paid: 'dibayar',
    paid_split: 'pembayaran split berhasil',
    transfer: 'transfer berhasil',
    adjusted: 'penyesuaian saldo disimpan',
    stock_updated: 'stok berubah',
    price_updated: 'harga berubah',
    image_uploaded: 'foto diperbarui',
    media_uploaded: 'media diperbarui',
    media_deleted: 'media dihapus',
    biaya_added: 'biaya ditambahkan',
    biaya_deleted: 'biaya dihapus',
    part_service_added: 'part/service ditambahkan',
    part_service_deleted: 'part/service dihapus',
};

const formatLabel = (value?: string, fallback = 'Data') => {
    if (!value) return fallback;
    return value
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

const getNotificationMeta = (item: typeof notifications[number]) => {
    const entityLabel = item.entity ? (ENTITY_LABELS[item.entity] || formatLabel(item.entity)) : 'Data';
    const actionLabel = item.action ? (ACTION_LABELS[item.action] || formatLabel(item.action, 'diperbarui')) : 'diperbarui';
    const refLabel = item.entityId ? `Ref #${item.entityId}` : 'Tanpa referensi';
    const scopeLabel = item.scope ? formatLabel(item.scope) : 'Umum';

    return { entityLabel, actionLabel, refLabel, scopeLabel };
};

export default function NotificationsScreen() {
    const insets = useSafeAreaInsets();
    const notifications = useNotificationStore(state => state.items);
    const unreadCount = useNotificationStore(state => state.unreadCount);
    const markAsRead = useNotificationStore(state => state.markAsRead);
    const markAllRead = useNotificationStore(state => state.markAllRead);
    const removeNotification = useNotificationStore(state => state.removeNotification);
    const clear = useNotificationStore(state => state.clear);

    const list = useMemo(() => notifications, [notifications]);

    const openHistory = (item: typeof notifications[number]) => {
        markAsRead(item.id);
        router.push({
            pathname: '/(tabs)/history',
            params: {
                focus_id: item.entityId ? String(item.entityId) : '',
                focus_entity: item.entity || '',
            },
        } as any);
    };

    return (
        <View className="flex-1 bg-background">
            <Header
                title="Notifikasi"
                subtitle="Informasi transaksi terbaru"
                showBackButton
                showProfile={false}
                rightElement={(
                    <Pressable
                        onPress={markAllRead}
                        className="w-11 h-11 bg-gray-50 rounded-2xl items-center justify-center border border-gray-100 active:bg-gray-100"
                    >
                        <CheckCheck size={20} color="#374151" />
                    </Pressable>
                )}
            />

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 40) }}>
                <View className="flex-row items-center justify-between mb-4">
                    <View>
                        <Typography weight="bold" className="text-text text-lg">Riwayat Notifikasi</Typography>
                        <Typography variant="caption" className="text-text/40">
                            {unreadCount} belum dibaca
                        </Typography>
                    </View>
                    <Pressable
                        onPress={clear}
                        className="h-10 px-4 rounded-2xl bg-gray-50 border border-gray-100 items-center justify-center active:bg-gray-100"
                    >
                        <Typography className="text-xs font-bold text-gray-700">Bersihkan</Typography>
                    </Pressable>
                </View>

                {list.length === 0 ? (
                    <View className="bg-white border border-gray-100 rounded-3xl p-6 items-center">
                        <View className="w-14 h-14 rounded-2xl bg-gray-50 items-center justify-center mb-3">
                            <Bell size={24} color="#9CA3AF" />
                        </View>
                        <Typography weight="bold" className="text-text mb-1">Belum ada notifikasi</Typography>
                        <Typography variant="caption" className="text-text/40 text-center">
                            Semua informasi transaksi baru akan tampil di halaman ini.
                        </Typography>
                    </View>
                ) : (
                    <View className="gap-3">
                        {list.map((item) => {
                            const meta = getNotificationMeta(item);
                            return (
                            <Pressable
                                key={item.id}
                                onPress={() => openHistory(item)}
                                className={`rounded-[28px] border p-4 ${item.read ? 'bg-white border-gray-100' : 'bg-indigo-50 border-indigo-100'}`}
                            >
                                <View className="flex-row items-start justify-between gap-3">
                                    <View className="flex-1">
                                        <Typography weight="bold" className="text-text text-sm" numberOfLines={1}>
                                            {item.title}
                                        </Typography>
                                        <Typography variant="caption" className="text-text/60 mt-1" numberOfLines={3}>
                                            {item.message}
                                        </Typography>
                                        <View className="flex-row flex-wrap gap-2 mt-3">
                                            <View className="px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200">
                                                <Typography className="text-[10px] font-bold text-gray-700">
                                                    {meta.entityLabel}
                                                </Typography>
                                            </View>
                                            <View className="px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100">
                                                <Typography className="text-[10px] font-bold text-indigo-700">
                                                    {meta.actionLabel}
                                                </Typography>
                                            </View>
                                            <View className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100">
                                                <Typography className="text-[10px] font-bold text-amber-700">
                                                    {meta.scopeLabel}
                                                </Typography>
                                            </View>
                                        </View>
                                        <Typography variant="caption" className="text-text/40 mt-2">
                                            {meta.refLabel}
                                        </Typography>
                                        <Typography variant="caption" className="text-text/30 mt-2">
                                            {new Date(item.timestamp).toLocaleString('id-ID', {
                                                day: '2-digit',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </Typography>
                                    </View>

                                    <View className="flex-row items-center gap-2">
                                        {!item.read && <View className="w-2.5 h-2.5 rounded-full bg-red-500" />}
                                        <Pressable
                                            onPress={() => removeNotification(item.id)}
                                            className="w-9 h-9 rounded-full bg-white border border-gray-100 items-center justify-center active:bg-red-50"
                                        >
                                            <Trash2 size={16} color="#EF4444" />
                                        </Pressable>
                                    </View>
                                </View>
                            </Pressable>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
