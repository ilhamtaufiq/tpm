import React, { useState, useMemo, useCallback } from 'react';
import { View, ScrollView, Pressable, RefreshControl as RNRefreshControl, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useNavigation } from 'expo-router';
import { ArrowRightLeft, TrendingUp, TrendingDown, Wallet, Info } from 'lucide-react-native';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { formatCurrency } from '../../utils/format';
import { useLabaRugiReport } from '../../hooks/useKeuangan';
import { LabaRugiReport } from '../../types/reports';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';
import {
    ReportPageHeader,
    ReportDateControls,
    ReportFilterType,
    KasArusJenisBreakdown,
} from '../../components/laporan';

export default function ArusKasAkunScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const navigation = useNavigation();
    const [filterType, setFilterType] = useState<ReportFilterType>('monthly');
    const [date, setDate] = useState(new Date());

    const handlePrev = useCallback(() => {
        setDate(prev => {
            if (filterType === 'daily') return subDays(prev, 1);
            if (filterType === 'monthly') return subMonths(prev, 1);
            return subYears(prev, 1);
        });
    }, [filterType]);

    const handleNext = useCallback(() => {
        setDate(prev => {
            if (filterType === 'daily') return addDays(prev, 1);
            if (filterType === 'monthly') return addMonths(prev, 1);
            return addYears(prev, 1);
        });
    }, [filterType]);

    const formattedDate = useMemo(() => {
        if (filterType === 'daily') return format(date, 'd MMMM yyyy', { locale: localeID });
        if (filterType === 'monthly') return format(date, 'MMMM yyyy', { locale: localeID });
        return format(date, 'yyyy', { locale: localeID });
    }, [date, filterType]);

    const reportParams = useMemo(() => {
        const start = filterType === 'daily' ? date : (filterType === 'monthly' ? startOfMonth(date) : startOfYear(date));
        const end = filterType === 'daily' ? date : (filterType === 'monthly' ? endOfMonth(date) : endOfYear(date));
        return {
            tanggal_dari: format(start, 'yyyy-MM-dd'),
            tanggal_sampai: format(end, 'yyyy-MM-dd')
        };
    }, [date, filterType]);

    const { data, isLoading, refetch: fetchData } = useLabaRugiReport(reportParams);
    const reportData = data as LabaRugiReport | undefined;

    const flows = reportData?.kas_per_jenis || [];

    const totals = useMemo(() => {
        let totalMasuk = 0;
        let totalKeluar = 0;
        for (const item of flows) {
            totalMasuk += item.masuk || 0;
            totalKeluar += item.keluar || 0;
        }
        return {
            masuk: totalMasuk,
            keluar: totalKeluar,
            net: totalMasuk - totalKeluar,
        };
    }, [flows]);

    const handleBack = useCallback(() => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            router.replace('/laporan');
        }
    }, [navigation, router]);

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />

            <ReportPageHeader
                title="Arus Kas per Akun"
                subtitle="Mutasi Uang Masuk & Keluar"
                onBack={handleBack}
            />

            <ScrollView
                className="flex-1 px-6 pt-4"
                contentContainerStyle={{ paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 24) }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RNRefreshControl refreshing={isLoading} onRefresh={fetchData} tintColor="#0D9488" />
                }
            >
                <ReportDateControls
                    filterType={filterType}
                    onFilterTypeChange={setFilterType}
                    formattedDate={formattedDate}
                    onPrev={handlePrev}
                    onNext={handleNext}
                />

                {isLoading ? (
                    <View className="py-20 items-center justify-center">
                        <ActivityIndicator size="large" color="#0D9488" />
                        <Typography className="text-gray-400 text-xs font-bold mt-4 uppercase tracking-widest">
                            Memuat Data Arus Kas...
                        </Typography>
                    </View>
                ) : (
                    <>
                        {/* Summary Header Card */}
                        <Card className="mb-6 bg-slate-900 p-6 rounded-[32px] border border-slate-800 shadow-lg">
                            <View className="flex-row justify-between items-center mb-4">
                                <View className="flex-row items-center">
                                    <View className="w-8 h-8 bg-teal-500/20 rounded-xl items-center justify-center mr-3 border border-teal-500/30">
                                        <ArrowRightLeft size={16} color="#2DD4BF" />
                                    </View>
                                    <Typography className="text-slate-300 text-[10px] uppercase font-bold tracking-[2px]">
                                        Total Realisasi Mutasi
                                    </Typography>
                                </View>
                                <View className={`px-3 py-1 rounded-full border ${totals.net >= 0 ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-rose-500/20 border-rose-500/30'}`}>
                                    <Typography className={`text-[10px] font-bold ${totals.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        Net: {totals.net >= 0 ? '+ ' : ''}{formatCurrency(totals.net)}
                                    </Typography>
                                </View>
                            </View>

                            <View className="flex-row justify-between pt-4 border-t border-slate-800">
                                <View className="flex-1">
                                    <Typography className="text-slate-400 text-[9px] uppercase font-bold mb-1.5">Total Uang Masuk</Typography>
                                    <View className="flex-row items-center">
                                        <View className="w-7 h-7 bg-emerald-500/10 rounded-lg items-center justify-center mr-2 border border-emerald-500/20">
                                            <TrendingUp size={14} color="#34D399" />
                                        </View>
                                        <Typography className="text-emerald-400 text-sm font-bold">{formatCurrency(totals.masuk)}</Typography>
                                    </View>
                                </View>
                                <View className="flex-1 ml-4 pl-4 border-l border-slate-800">
                                    <Typography className="text-slate-400 text-[9px] uppercase font-bold mb-1.5">Total Uang Keluar</Typography>
                                    <View className="flex-row items-center">
                                        <View className="w-7 h-7 bg-rose-500/10 rounded-lg items-center justify-center mr-2 border border-rose-500/20">
                                            <TrendingDown size={14} color="#F87171" />
                                        </View>
                                        <Typography className="text-rose-400 text-sm font-bold">{formatCurrency(totals.keluar)}</Typography>
                                    </View>
                                </View>
                            </View>
                        </Card>

                        {/* Breakdown per Account Card */}
                        <Card className="mb-6 overflow-hidden border-0 shadow-sm bg-white rounded-[28px] w-full">
                            <View className="bg-teal-700 px-6 py-4 flex-row items-center justify-between w-full">
                                <View className="flex-row items-center">
                                    <View className="w-8 h-8 rounded-xl bg-white/20 items-center justify-center mr-3 border border-white/10">
                                        <Wallet size={18} color="white" />
                                    </View>
                                    <Typography variant="h4" weight="bold" className="text-white tracking-tight">Rincian Arus Kas per Akun</Typography>
                                </View>
                                <View className="bg-white/10 px-2.5 py-1 rounded-lg border border-white/10">
                                    <Typography weight="bold" className="text-white text-[10px] uppercase tracking-widest">{flows.length} Akun</Typography>
                                </View>
                            </View>

                            <View className="p-6 w-full">
                                <Typography variant="caption" className="text-slate-400 text-[11px] mb-4">
                                    Rincian mutasi fisik arus kas per rekening/dompet selama periode {formattedDate}.
                                </Typography>
                                {flows.length === 0 ? (
                                    <View className="py-8 items-center justify-center">
                                        <Typography className="text-gray-400 font-medium">Tidak ada mutasi kas pada periode ini.</Typography>
                                    </View>
                                ) : (
                                    <KasArusJenisBreakdown flows={flows} />
                                )}
                            </View>
                        </Card>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
