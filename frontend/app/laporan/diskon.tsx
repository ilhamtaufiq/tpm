import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, StatusBar, RefreshControl as RNRefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format } from 'date-fns/format';
import { addDays } from 'date-fns/addDays';
import { subDays } from 'date-fns/subDays';
import { addMonths } from 'date-fns/addMonths';
import { subMonths } from 'date-fns/subMonths';
import { addYears } from 'date-fns/addYears';
import { subYears } from 'date-fns/subYears';
import { startOfMonth } from 'date-fns/startOfMonth';
import { endOfMonth } from 'date-fns/endOfMonth';
import { startOfYear } from 'date-fns/startOfYear';
import { endOfYear } from 'date-fns/endOfYear';
import { id as localeID } from 'date-fns/locale/id';
import Percent from 'lucide-react-native/dist/esm/icons/percent.js';
import Receipt from 'lucide-react-native/dist/esm/icons/receipt.js';
import Hash from 'lucide-react-native/dist/esm/icons/hash.js';
import TrendingDown from 'lucide-react-native/dist/esm/icons/trending-down.js';
import { Typography } from '../../components/ui/Typography';
import { Badge } from '../../components/ui/Badge';
import { bengkelService } from '../../services/bengkel';
import { formatCurrency, tanggalLokal } from '../../utils/format';
import {
    ReportPageHeader,
    ReportStatsBento,
    ReportDateControls,
    ReportSectionHeader,
    ReportFilterType,
} from '../../components/laporan';
import { useUIStore } from '../../store/useUIStore';

// Kategori transaksi bengkel. Kosong = semua kategori.
const KATEGORI_FILTER: { value: string; label: string }[] = [
    { value: '', label: 'Semua' },
    { value: 'umum', label: 'Bengkel' },
    { value: 'jual_beli_mobil', label: 'Jual Beli Mobil' },
    { value: 'jasa_angkut', label: 'Jasa Angkut' },
];

const LABEL_KATEGORI: Record<string, string> = Object.fromEntries(
    KATEGORI_FILTER.filter(k => k.value).map(k => [k.value, k.label]),
);

const STATUS_LABEL: Record<string, string> = {
    LUNAS: 'LUNAS',
    BELUM_LUNAS: 'BELUM LUNAS',
    SEBAGIAN: 'SEBAGIAN',
    INTERNAL: 'INTERNAL',
    BATAL: 'BATAL',
};

export default function DiskonReportScreen() {
    const themeColors = useUIStore((s) => s.themeColors);
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [filterType, setFilterType] = useState<ReportFilterType>('monthly');
    const [date, setDate] = useState(new Date());
    const [kategori, setKategori] = useState('');
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [data, setData] = useState<any>(null);

    const range = useMemo(() => {
        if (filterType === 'daily') {
            const d = format(date, 'yyyy-MM-dd');
            return { dari: d, sampai: d };
        }
        if (filterType === 'monthly') {
            return { dari: format(startOfMonth(date), 'yyyy-MM-dd'), sampai: format(endOfMonth(date), 'yyyy-MM-dd') };
        }
        return { dari: format(startOfYear(date), 'yyyy-MM-dd'), sampai: format(endOfYear(date), 'yyyy-MM-dd') };
    }, [filterType, date]);

    const formattedDate = useMemo(() => {
        if (filterType === 'daily') return format(date, 'dd MMMM yyyy', { locale: localeID });
        if (filterType === 'monthly') return format(date, 'MMMM yyyy', { locale: localeID });
        return format(date, 'yyyy', { locale: localeID });
    }, [filterType, date]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await bengkelService.getLaporanDiskon({
                tanggal_dari: range.dari,
                tanggal_sampai: range.sampai,
                kategori: kategori || undefined,
            });
            setData(res);
        } catch (error) {
            console.error('Error fetching discount report:', error);
            setData(null);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [range, kategori]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handlePrev = () => {
        if (filterType === 'daily') setDate(d => subDays(d, 1));
        else if (filterType === 'monthly') setDate(d => subMonths(d, 1));
        else setDate(d => subYears(d, 1));
    };
    const handleNext = () => {
        if (filterType === 'daily') setDate(d => addDays(d, 1));
        else if (filterType === 'monthly') setDate(d => addMonths(d, 1));
        else setDate(d => addYears(d, 1));
    };

    const rows = useMemo(() => {
        const list: any[] = data?.rows || [];
        const q = search.trim().toLowerCase();
        if (!q) return list;
        return list.filter(r =>
            `${r.nomor_transaksi} ${r.nama} ${r.nomor_plat || ''}`.toLowerCase().includes(q),
        );
    }, [data, search]);

    const summary = data?.summary || { jumlah_transaksi: 0, total_diskon: 0, total_subtotal: 0, persen_rata: 0, rata_per_transaksi: 0 };

    const stats = [
        { label: 'Total Diskon', value: formatCurrency(summary.total_diskon), icon: TrendingDown, color: '#F43F5E', bg: 'bg-rose-50', sub: `${summary.persen_rata}% dari subtotal` },
        { label: 'Transaksi', value: String(summary.jumlah_transaksi), icon: Receipt, color: themeColors.primary, bg: 'bg-primary/10', sub: 'yang memakai diskon' },
        { label: 'Rata-rata', value: formatCurrency(summary.rata_per_transaksi), icon: Percent, color: '#D97706', bg: 'bg-amber-50', sub: 'per transaksi' },
    ];

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <ReportPageHeader
                title="Diskon"
                onBack={() => { if (router.canGoBack()) router.back(); }}
            />
            <ScrollView
                className="flex-1 px-4 pt-4"
                contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
                refreshControl={
                    <RNRefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => { setIsRefreshing(true); fetchData(); }}
                    />
                }
            >
                <ReportDateControls
                    filterType={filterType}
                    onFilterTypeChange={setFilterType}
                    formattedDate={formattedDate}
                    onPrev={handlePrev}
                    onNext={handleNext}
                    search={search}
                    onSearchChange={setSearch}
                    searchPlaceholder="Cari no. transaksi, nama, plat..."
                />

                <View className="flex-row flex-wrap gap-2 mb-4">
                    {KATEGORI_FILTER.map(k => {
                        const aktif = kategori === k.value;
                        return (
                            <Pressable
                                key={k.value || 'semua'}
                                onPress={() => setKategori(k.value)}
                                className={`px-3 py-2 rounded-full border ${aktif ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
                            >
                                <Typography weight="bold" className={`text-xs ${aktif ? 'text-white' : 'text-textGray'}`}>{k.label}</Typography>
                            </Pressable>
                        );
                    })}
                </View>

                {isLoading && !data ? (
                    <ActivityIndicator color={themeColors.primary} style={{ marginVertical: 32 }} />
                ) : (
                    <>
                        <ReportStatsBento stats={stats as any} />

                        {data?.per_kategori?.length > 0 && (
                            <>
                                <ReportSectionHeader title="Per Kategori" />
                                <View className="bg-surface rounded-3xl p-4 mb-4 border border-border">
                                    {data.per_kategori.map((k: any) => (
                                        <View key={k.kategori} className="flex-row items-center justify-between py-2">
                                            <View>
                                                <Typography weight="bold" className="text-textMain text-sm">{LABEL_KATEGORI[k.kategori] || k.kategori}</Typography>
                                                <Typography className="text-textGray text-xs">{k.jumlah_transaksi} transaksi • {k.persen_rata}% rata-rata</Typography>
                                            </View>
                                            <Typography weight="bold" className="text-rose-500 text-sm">-{formatCurrency(k.total_diskon)}</Typography>
                                        </View>
                                    ))}
                                </View>
                            </>
                        )}

                        <ReportSectionHeader title={`Transaksi Berdiskon (${rows.length})`} />
                        {rows.length === 0 ? (
                            <View className="bg-surface/50 p-8 rounded-3xl items-center">
                                <Hash size={28} color={themeColors.textGray} />
                                <Typography className="text-textGray text-sm mt-2">Tidak ada transaksi berdiskon pada periode ini.</Typography>
                            </View>
                        ) : (
                            rows.map((r: any) => (
                                <View key={r.id} className="bg-surface rounded-3xl p-4 mb-3 border border-border">
                                    <View className="flex-row justify-between items-start">
                                        <View className="flex-1 pr-3">
                                            <Typography weight="bold" className="text-textMain text-sm" numberOfLines={1}>{r.nama}</Typography>
                                            <Typography className="text-textGray text-xs mt-0.5">
                                                {r.nomor_transaksi} • {r.tanggal ? format(tanggalLokal(r.tanggal), 'dd MMM yyyy', { locale: localeID }) : '-'}
                                            </Typography>
                                        </View>
                                        <Badge label={STATUS_LABEL[r.status_bayar] || r.status_bayar || '-'} variant="neutral" />
                                    </View>
                                    <View className="flex-row flex-wrap items-center mt-2 gap-2">
                                        <Badge label={LABEL_KATEGORI[r.kategori] || r.kategori} variant="info" />
                                        <Typography className="text-textGray text-xs">Subtotal {formatCurrency(r.subtotal)}</Typography>
                                    </View>
                                    <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-border">
                                        <Typography weight="bold" className="text-rose-500 text-sm">
                                            Diskon -{formatCurrency(r.diskon)} ({r.persen}%)
                                        </Typography>
                                        <Typography weight="bold" className="text-textMain text-sm">{formatCurrency(r.grand_total)}</Typography>
                                    </View>
                                </View>
                            ))
                        )}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
