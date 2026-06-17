import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { FILE_URL } from '../utils/api';

type RealtimePayload = {
    type?: string;
    event_id?: string;
    scope?: string;
    event?: string;
    action?: string;
    entity?: string;
    entity_id?: number | string | null;
    data?: any;
};

const SCOPE_QUERY_KEYS: Record<string, string[][]> = {
    bengkel: [
        ['transaksi_bengkel'],
        ['transaksi_bengkel_summary'],
        ['recent_activity'],
        ['capital_report'],
        ['laba_rugi_report'],
        ['neraca_report'],
        ['validate_reports'],
        ['spare_parts'],
        ['spare_parts_low_stock'],
        ['spare_parts_stats'],
        ['pembelian_parts'],
        ['pengeluaran'],
        ['piutang_list'],
        ['piutang_summary'],
        ['kas_bank_balances'],
        ['kas_bank_list'],
        ['dashboard_summary'],
    ],
    jasa_angkut: [
        ['muatan'],
        ['muatan_summary'],
        ['recent_activity'],
        ['capital_report'],
        ['laba_rugi_report'],
        ['neraca_report'],
        ['validate_reports'],
        ['muatan_suggestions'],
        ['muatan_supir'],
        ['supir'],
        ['supir_active'],
        ['armada'],
        ['armada_active'],
        ['armada_detail'],
        ['piutang_list'],
        ['piutang_summary'],
        ['hutang_list'],
        ['hutang_summary'],
        ['kas_bank_balances'],
        ['kas_bank_list'],
        ['dashboard_summary'],
    ],
    mobil: [
        ['mobils'],
        ['mobils_summary'],
        ['recent_activity'],
        ['capital_report'],
        ['laba_rugi_report'],
        ['neraca_report'],
        ['validate_reports'],
        ['inventory_summary'],
        ['kas_bank_balances'],
        ['kas_bank_list'],
        ['piutang_list'],
        ['piutang_summary'],
        ['hutang_list'],
        ['hutang_summary'],
        ['dashboard_summary'],
    ],
    finance: [
        ['kas_bank_balances'],
        ['kas_bank_list'],
        ['recent_activity'],
        ['capital_report'],
        ['laba_rugi_report'],
        ['neraca_report'],
        ['validate_reports'],
        ['piutang_list'],
        ['piutang_summary'],
        ['hutang_list'],
        ['hutang_summary'],
        ['dashboard_summary'],
        ['user_cash_history'],
    ],
    master: [
        ['spare_parts'],
        ['spare_parts_low_stock'],
        ['spare_parts_stats'],
        ['capital_report'],
        ['laba_rugi_report'],
        ['neraca_report'],
        ['validate_reports'],
        ['customers'],
        ['supir'],
        ['supir_active'],
        ['armada'],
        ['armada_active'],
    ],
    users: [
        ['users'],
        ['user'],
        ['security'],
        ['capital_report'],
        ['laba_rugi_report'],
        ['neraca_report'],
        ['validate_reports'],
    ],
    settings: [
        ['security'],
        ['settings'],
        ['capital_report'],
        ['laba_rugi_report'],
        ['neraca_report'],
        ['validate_reports'],
    ],
};

const invalidateScope = (queryClient: ReturnType<typeof useQueryClient>, scope?: string) => {
    const keys = scope ? SCOPE_QUERY_KEYS[scope] : undefined;

    if (!keys || keys.length === 0) {
        queryClient.invalidateQueries();
        return;
    }

    for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key as any });
    }
};

const buildNotification = (payload: RealtimePayload) => {
    if (payload.entity === 'kas_bank' && payload.data && typeof payload.data === 'object' && 'referensi_id' in payload.data && payload.data.referensi_id != null) {
        return null;
    }

    const entityMap: Record<string, string> = {
        bengkel: 'Transaksi Bengkel',
        jasa_angkut: 'Muatan',
        mobil: 'Transaksi Mobil',
        finance: 'Kas & Bank',
        master: 'Data Master',
        users: 'Pengguna',
        settings: 'Pengaturan',
    };

    const actionMap: Record<string, string> = {
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

    const entityLabel = payload.entity ? (entityMap[payload.entity] || payload.entity.replace(/_/g, ' ')) : 'Data';
    const actionLabel = payload.action ? (actionMap[payload.action] || payload.action.replace(/_/g, ' ')) : 'diperbarui';
    const ref = typeof payload.entity_id === 'number' || typeof payload.entity_id === 'string'
        ? ` #${payload.entity_id}`
        : '';

    return {
        sourceId: payload.event_id,
        title: `${entityLabel} ${actionLabel}`,
        message: `${entityLabel}${ref} ${actionLabel}.`,
        scope: payload.scope,
        entity: payload.entity,
        action: payload.action,
        entityId: payload.entity_id ?? null,
        timestamp: new Date().toISOString(),
    };
};

const getRealtimeUrl = (token: string) => {
    const baseUrl = (FILE_URL || '').replace(/\/$/, '');
    const wsBase = baseUrl.startsWith('https://')
        ? baseUrl.replace('https://', 'wss://')
        : baseUrl.startsWith('http://')
            ? baseUrl.replace('http://', 'ws://')
            : baseUrl;

    return `${wsBase}/api/v1/realtime/ws?token=${encodeURIComponent(token)}`;
};

export function useRealtimeSync() {
    const queryClient = useQueryClient();
    const token = useAuthStore(state => state.token);
    const isAuthenticated = useAuthStore(state => state.isAuthenticated);
    const role = useAuthStore(state => state.user?.role);
    const pushNotification = useNotificationStore(state => state.pushNotification);
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptRef = useRef(0);

    useEffect(() => {
        if (!isAuthenticated || !token) {
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            socketRef.current?.close();
            socketRef.current = null;
            return;
        }

        let cancelled = false;

        const cleanup = () => {
            cancelled = true;
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            socketRef.current?.close();
            socketRef.current = null;
        };

        const connect = () => {
            if (cancelled) return;

            console.log('[Realtime] Connecting...', { role });
            const socket = new WebSocket(getRealtimeUrl(token));
            socketRef.current = socket;

            socket.onopen = () => {
                console.log('[Realtime] Connected');
                reconnectAttemptRef.current = 0;
            };

            socket.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data) as RealtimePayload;
                    if (payload.type === 'realtime.connected') {
                        console.log('[Realtime] Server handshake received', payload);
                        return;
                    }
                    if (payload.type === 'realtime.error') {
                        console.warn('[Realtime] Server error', payload);
                        return;
                    }
                    if (payload.type === 'realtime.event' || payload.event) {
                        const notification = buildNotification(payload);
                        if (notification) {
                            pushNotification(notification);
                        }
                        invalidateScope(queryClient, payload.scope);
                    }
                } catch (error) {
                    console.warn('[Realtime] Failed to parse message', error);
                }
            };

            socket.onerror = (error) => {
                console.warn('[Realtime] Socket error', error);
                socket.close();
            };

            socket.onclose = (event) => {
                console.log('[Realtime] Closed', { code: event.code, reason: event.reason });
                if (cancelled) return;
                if (event.code === 4401) {
                    console.warn('[Realtime] Unauthorized connection, stopping reconnect');
                    return;
                }

                const delay = Math.min(30000, 1000 * 2 ** reconnectAttemptRef.current);
                reconnectAttemptRef.current += 1;
                reconnectTimerRef.current = setTimeout(connect, delay);
            };
        };

        connect();

        return cleanup;
    }, [isAuthenticated, token, role, queryClient]);
}
