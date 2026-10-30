import React from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Header } from '../../components/ui/Header';
import { Typography } from '../../components/ui/Typography';
import { usePembatalanList } from '../../hooks/usePembatalan';
import { formatCurrency, formatDateTime } from '../../utils/format';

const JENIS_LABEL: Record<string, string> = {
    PENGELUARAN: 'Biaya Operasional',
    PIUTANG: 'Kasbon/Piutang',
    TRANSFER: 'Transfer Kas',
};

export default function PembatalanRiwayatScreen() {
    const { data, isLoading, isRefetching, refetch } = usePembatalanList();
    const items = data ?? [];

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
            <Header title="Riwayat Pembatalan" showBackButton onBackButtonPress={() => router.back()} />
            <FlatList
                data={items}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
                ListEmptyComponent={
                    <Typography className="text-textGray text-center mt-10">
                        {isLoading ? 'Memuat...' : 'Belum ada transaksi yang dibatalkan'}
                    </Typography>
                }
                renderItem={({ item }) => (
                    <View className="bg-surface rounded-[24px] p-5 mb-4 border border-border">
                        <View className="flex-row justify-between items-center mb-2">
                            <Typography className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">
                                {JENIS_LABEL[item.jenis] ?? item.jenis}
                            </Typography>
                            <Typography className="text-[10px] text-textGray">{formatDateTime(item.dibatalkan_at)}</Typography>
                        </View>
                        <Typography weight="bold" className="text-textMain">{item.ringkasan}</Typography>
                        <Typography className="text-textGray text-xs mt-1">
                            No. {item.nomor_dokumen} • {formatCurrency(Number(item.nominal))}
                        </Typography>
                        <View className="mt-3 bg-background rounded-2xl p-3">
                            <Typography className="text-[10px] font-bold text-textGray uppercase mb-1">Alasan</Typography>
                            <Typography className="text-sm text-textMain">{item.alasan}</Typography>
                        </View>
                        {item.kas_nomor ? (
                            <Typography className="text-[10px] text-textGray mt-2">Jurnal balik: {item.kas_nomor}</Typography>
                        ) : null}
                    </View>
                )}
            />
        </SafeAreaView>
    );
}
