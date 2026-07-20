import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CloudOff } from 'lucide-react-native';

/** Small badge for list rows that exist only in local offline queue. */
export function PendingSyncBadge({
    show,
    label = 'Belum sync',
}: {
    show?: boolean;
    label?: string;
}) {
    if (!show) return null;
    return (
        <View style={styles.badge}>
            <CloudOff size={10} color="#b45309" />
            <Text style={styles.text}>{label}</Text>
        </View>
    );
}

export function isPendingSyncRow(item: any): boolean {
    return !!(item?._pendingSync || item?._offline || item?._queueId);
}

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#fef3c7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    text: {
        fontSize: 10,
        fontWeight: '700',
        color: '#b45309',
    },
});
