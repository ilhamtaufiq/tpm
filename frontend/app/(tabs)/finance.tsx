import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, ScrollView, Pressable, RefreshControl, ActivityIndicator, Image, StatusBar, Text } from 'react-native';
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/useAuthStore';
import { getFileUrl } from '../../utils/image';
import { Header } from '../../components/ui/Header';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { RefreshCw, TrendingUp, TrendingDown, Wallet, ArrowRightLeft, CircleDollarSign, BarChart3, ChevronRight, AlertTriangle, Users, ArrowUpCircle, ArrowDownCircle, Landmark, ChevronLeft, Calendar } from 'lucide-react-native';
import { formatCurrency } from '../../utils/format';
import { keuanganService, PiutangSummary, KasBankAllBalances } from '../../services/keuangan';
import { useDashboardSummary, usePiutangSummary, useHutangSummary, useInvestorDisbursementSummary } from '../../hooks/useKeuangan';
import { SkeletonStats, SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';
import { format, subDays, addDays, subMonths, addMonths, subYears, addYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

type FinanceFilterType = 'all' | 'daily' | 'monthly' | 'yearly';

export default function FinanceTab() {
    const insets = useSafeAreaInsets();
    const [refreshing, setRefreshing] = useState(false);
    const [filterType, setFilterType] = useState<FinanceFilterType>('monthly');
    const [date, setDate] = useState(new Date());
    const { user } = useAuthStore();
    const router = useRouter();
    const { quickAction } = useLocalSearchParams<{ quickAction?: string }>();
    const quickActionLockRef = React.useRef<string | null>(null);

    const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';

    useEffect(() => {
        if (quickAction !== 'mutasi' && quickAction !== 'expenses') return;
        if (quickActionLockRef.current === quickAction) return;

        quickActionLockRef.current = quickAction;
        router.push(quickAction === 'mutasi' ? '/finance/mutasi' : '/finance/expenses');
    }, [quickAction, router]);

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
        if (filterType === 'all') return 'Semua Periode Data';
        if (filterType === 'daily') return format(date, 'd MMMM yyyy', { locale: localeID });
        if (filterType === 'monthly') return format(date, 'MMMM yyyy', { locale: localeID });
        return format(date, 'yyyy', { locale: localeID });
    }, [date, filterType]);

    const dashboardParams = useMemo(() => {
        if (filterType === 'all') {
            return {
                tanggal_dari: '2020-01-01',
                tanggal_sampai: format(new Date(), 'yyyy-MM-dd')
            };
        }
        const start = filterType === 'daily' ? date : (filterType === 'monthly' ? startOfMonth(date) : startOfYear(date));
        const end = filterType === 'daily' ? date : (filterType === 'monthly' ? endOfMonth(date) : endOfYear(date));
        return {
            tanggal_dari: format(start, 'yyyy-MM-dd'),
            tanggal_sampai: format(end, 'yyyy-MM-dd')
        };
    }, [date, filterType]);

    if (!isAdmin) {
        return <Redirect href="/(tabs)/home" />;
    }

    // API Hooks - Conditional query enabling based on auth state
    const { data: dashboard, isLoading: isLoadingDashboard, refetch: refetchDashboard } = useDashboardSummary(dashboardParams);
    const { data: piutangSummary, isLoading: isLoadingPiutang, refetch: refetchPiutang } = usePiutangSummary(undefined);
    const { data: hutangSummary, isLoading: isLoadingHutang, refetch: refetchHutang } = useHutangSummary();
    const { data: investorSummary, refetch: refetchInvestor } = useInvestorDisbursementSummary(undefined);

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/home');
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetchDashboard(), refetchPiutang(), refetchHutang(), refetchInvestor()]);
        setRefreshing(false);
    }, [refetchDashboard, refetchPiutang, refetchHutang, refetchInvestor]);

    // Calculate totals
    const totalPendapatan = dashboard ? (
        (dashboard.bengkel?.total_penjualan || 0) +
        (dashboard.mobil?.total_penjualan || 0) +
        (dashboard.jasa_angkut?.total_pendapatan || 0)
    ) : 0;

    const totalPengeluaranOpsGaji = dashboard?.pengeluaran.total || 0;
    const commonOverhead = dashboard?.pengeluaran.breakdown.umum || 0;
    const totalLabaBersih = dashboard?.laba_operasional ?? 0;
    const totalPengeluaranLabaRugi = totalPendapatan - totalLabaBersih;

    // Aggregate sub-accounts for summary cards
    const aggregateCash = dashboard?.kas_bank ? (
        (dashboard.kas_bank.kas_utama?.saldo || 0) +
        (dashboard.kas_bank.kas_unit_bengkel?.saldo || 0) +
        (dashboard.kas_bank.kas_unit_jasa_angkut?.saldo || 0) +
        (dashboard.kas_bank.kas_unit_mobil?.saldo || 0)
    ) : 0;

    const aggregateBank = dashboard?.kas_bank ? (
        (dashboard.kas_bank.bank_bca?.saldo || 0) +
        (dashboard.kas_bank.bank_utama?.saldo || 0) +
        (dashboard.kas_bank.bank_mandiri?.saldo || 0) +
        (dashboard.kas_bank.bank_bri?.saldo || 0) +
        (dashboard.kas_bank.bank_lainnya?.saldo || 0)
    ) : 0;

    const aggregateCashIn = dashboard?.kas_bank ? (
        (dashboard.kas_bank.kas_utama?.total_masuk_bulan_ini || 0) +
        (dashboard.kas_bank.kas_unit_bengkel?.total_masuk_bulan_ini || 0) +
        (dashboard.kas_bank.kas_unit_jasa_angkut?.total_masuk_bulan_ini || 0) +
        (dashboard.kas_bank.kas_unit_mobil?.total_masuk_bulan_ini || 0)
    ) : 0;

    const aggregateBankIn = dashboard?.kas_bank ? (
        (dashboard.kas_bank.bank_bca?.total_masuk_bulan_ini || 0) +
        (dashboard.kas_bank.bank_utama?.total_masuk_bulan_ini || 0) +
        (dashboard.kas_bank.bank_mandiri?.total_masuk_bulan_ini || 0) +
        (dashboard.kas_bank.bank_bri?.total_masuk_bulan_ini || 0) +
        (dashboard.kas_bank.bank_lainnya?.total_masuk_bulan_ini || 0)
    ) : 0;

    const aggregateCashOut = dashboard?.kas_bank ? (
        (dashboard.kas_bank.kas_utama?.total_keluar_bulan_ini || 0) +
        (dashboard.kas_bank.kas_unit_bengkel?.total_keluar_bulan_ini || 0) +
        (dashboard.kas_bank.kas_unit_jasa_angkut?.total_keluar_bulan_ini || 0) +
        (dashboard.kas_bank.kas_unit_mobil?.total_keluar_bulan_ini || 0)
    ) : 0;

    const aggregateBankOut = dashboard?.kas_bank ? (
        (dashboard.kas_bank.bank_bca?.total_keluar_bulan_ini || 0) +
        (dashboard.kas_bank.bank_utama?.total_keluar_bulan_ini || 0) +
        (dashboard.kas_bank.bank_mandiri?.total_keluar_bulan_ini || 0) +
        (dashboard.kas_bank.bank_bri?.total_keluar_bulan_ini || 0) +
        (dashboard.kas_bank.bank_lainnya?.total_keluar_bulan_ini || 0)
    ) : 0;

    const totalKasMasukReal = aggregateCashIn + aggregateBankIn;
    const totalKasKeluarReal = aggregateCashOut + aggregateBankOut;

    return (
        <View className="flex-1 bg-background overflow-hidden">
            <StatusBar barStyle="dark-content" />

            {/* Background Image (User Custom) */}
            {user?.home_background && (
                <Image 
                    source={{ uri: getFileUrl(user.home_background) as string }} 
                    className="absolute inset-0 w-full h-full opacity-10" 
                    resizeMode="cover"
                />
            )}
            <Header
                title="Finance Hub"
                subtitle="Ringkasan Keuangan Seluruh Unit"
                showBackButton
                onBackButtonPress={handleGoBack}
                rightElement={
                    <Pressable
                        onPress={onRefresh}
                        className="w-11 h-11 bg-gray-50 rounded-2xl items-center justify-center border border-gray-100 active:bg-gray-100"
                    >
                        <RefreshCw size={20} color="#1F2937" />
                    </Pressable>
                }
            />

            <ScrollView
                className="flex-1 px-6 pt-6"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 32) }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />}
            >
                {/* Period Filter Bar */}
                <View className="bg-white border border-gray-100 rounded-3xl p-4 mb-6 shadow-sm">
                    <View className="flex-row bg-gray-50 p-1 rounded-2xl mb-3">
                        {[
                            { key: 'daily', label: 'Hari' },
                            { key: 'monthly', label: 'Bulan' },
                            { key: 'yearly', label: 'Tahun' },
                            { key: 'all', label: 'Semua' },
                        ].map((item) => {
                            const isActive = filterType === item.key;
                            return (
                                <Pressable
                                    key={item.key}
                                    onPress={() => setFilterType(item.key as FinanceFilterType)}
                                    className={`flex-1 py-2 items-center rounded-xl ${isActive ? 'bg-white border border-gray-100' : ''}`}
                                >
                                    <Typography
                                        variant="caption"
                                        weight="bold"
                                        className={isActive ? 'text-primary' : 'text-gray-400'}
                                    >
                                        {item.label}
                                    </Typography>
                                </Pressable>
                            );
                        })}
                    </View>

                    {filterType !== 'all' ? (
                        <View className="flex-row justify-between items-center px-1">
                            <Pressable
                                onPress={handlePrev}
                                className="w-9 h-9 bg-gray-50 rounded-full items-center justify-center border border-gray-100 active:bg-gray-100"
                            >
                                <ChevronLeft size={18} color="#1C1C1C" />
                            </Pressable>

                            <View className="flex-row items-center">
                                <Calendar size={15} color="#023C69" />
                                <Typography variant="body2" weight="bold" className="text-textMain ml-2 capitalize">
                                    {formattedDate}
                                </Typography>
                            </View>

                            <Pressable
                                onPress={handleNext}
                                className="w-9 h-9 bg-gray-50 rounded-full items-center justify-center border border-gray-100 active:bg-gray-100"
                            >
                                <ChevronRight size={18} color="#1C1C1C" />
                            </Pressable>
                        </View>
                    ) : (
                        <View className="items-center py-1">
                            <Typography variant="caption" weight="bold" className="text-gray-400">
                                Akumulasi Seluruh Data Terdaftar
                            </Typography>
                        </View>
                    )}
                </View>

                {/* Main Profit Card (Standard Bento Style) */}
                <View className="bg-white p-6 rounded-[32px] border border-gray-50 shadow-sm mb-6">
                    <View className="flex-row justify-between items-center mb-1">
                        <Typography className="text-textGray/40 text-[10px] uppercase font-bold tracking-[2px]">Estimasi Laba Bersih Operasional</Typography>
                        <View className="bg-primary/10 px-2 py-0.5 rounded-full">
                            <Typography className="text-primary text-[9px] font-bold">Laba Rugi</Typography>
                        </View>
                    </View>
                    <Typography variant="h1" weight="bold" className="text-textMain text-3xl mb-6 tracking-tighter">
                        {formatCurrency(totalLabaBersih)}
                    </Typography>

                    <View className="flex-row justify-between pt-5 border-t border-gray-50">
                        <View className="flex-1">
                            <Typography className="text-textGray/40 text-[9px] uppercase font-bold mb-1">Pendapatan Omset</Typography>
                            <View className="flex-row items-center">
                                <View className="w-6 h-6 bg-emerald-50 rounded-lg items-center justify-center mr-2">
                                    <TrendingUp size={12} color="#10B981" />
                                </View>
                                <Typography className="text-textMain text-xs font-bold">{formatCurrency(totalPendapatan)}</Typography>
                            </View>
                        </View>
                        <View className="flex-1 ml-4 pl-4 border-l border-gray-50">
                            <Typography className="text-textGray/40 text-[9px] uppercase font-bold mb-1">Pengeluaran (HPP & Ops)</Typography>
                            <View className="flex-row items-center">
                                <View className="w-6 h-6 bg-rose-50 rounded-lg items-center justify-center mr-2">
                                    <TrendingDown size={12} color="#EF4444" />
                                </View>
                                <Typography className="text-textMain text-xs font-bold">{formatCurrency(totalPengeluaranLabaRugi)}</Typography>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Physical Cashflow Realization Banner (Bento Dark Style) */}
                <View className="bg-slate-900 p-6 rounded-[32px] shadow-lg mb-10 border border-slate-800">
                    <View className="flex-row justify-between items-center mb-4">
                        <View className="flex-row items-center">
                            <View className="w-8 h-8 bg-sky-500/10 rounded-xl items-center justify-center mr-3 border border-sky-500/20">
                                <ArrowRightLeft size={16} color="#38BDF8" />
                            </View>
                            <Text style={{ color: '#CBD5E1', fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>
                                Realisasi Arus Kas
                            </Text>
                        </View>
                        <View className={`px-3 py-1 rounded-full border ${(totalKasMasukReal - totalKasKeluarReal) >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
                            <Text style={{ color: (totalKasMasukReal - totalKasKeluarReal) >= 0 ? '#34D399' : '#F87171', fontSize: 10, fontWeight: '700' }}>
                                Net: {(totalKasMasukReal - totalKasKeluarReal) >= 0 ? '+ ' : ''}{formatCurrency(totalKasMasukReal - totalKasKeluarReal)}
                            </Text>
                        </View>
                    </View>

                    <View className="flex-row justify-between pt-4 border-t border-slate-800">
                        <View className="flex-1">
                            <Text style={{ color: '#94A3B8', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 }}>
                                Uang Masuk Fisik
                            </Text>
                            <View className="flex-row items-center">
                                <View className="w-7 h-7 bg-emerald-500/10 rounded-lg items-center justify-center mr-2 border border-emerald-500/20">
                                    <TrendingUp size={14} color="#34D399" />
                                </View>
                                <Text style={{ color: '#34D399', fontSize: 14, fontWeight: '700' }}>
                                    {formatCurrency(totalKasMasukReal)}
                                </Text>
                            </View>
                        </View>
                        <View className="flex-1 ml-4 pl-4 border-l border-slate-800">
                            <Text style={{ color: '#94A3B8', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 }}>
                                Uang Keluar Fisik
                            </Text>
                            <View className="flex-row items-center">
                                <View className="w-7 h-7 bg-rose-500/10 rounded-lg items-center justify-center mr-2 border border-rose-500/20">
                                    <TrendingDown size={14} color="#F87171" />
                                </View>
                                <Text style={{ color: '#F87171', fontSize: 14, fontWeight: '700' }}>
                                    {formatCurrency(totalKasKeluarReal)}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View className="mt-4 pt-3 border-t border-slate-800/80 flex-row items-center">
                        <AlertTriangle size={13} color="#94A3B8" />
                        <Text style={{ color: '#94A3B8', fontSize: 9, fontWeight: '500', marginLeft: 8, flex: 1 }}>
                            Pencairan Kasbon masuk Arus Kas Keluar & Piutang SDM (tidak memotong Laba Rugi).
                        </Text>
                    </View>
                </View>

                {/* Wallet Cards */}
                <View className="mb-6">
                    <Typography variant="h3" weight="bold" className="mb-4 tracking-tight px-1">Saldo Kas & Bank</Typography>

                    {/* Cash & Bank Row */}
                    <View className="flex-row justify-between mb-3">
                        <View className="w-[48%] bg-white p-4 rounded-[24px] border border-gray-50 shadow-sm">
                            <View className="flex-row items-center mb-3">
                                <View className="w-9 h-9 bg-emerald-50 rounded-xl items-center justify-center mr-2.5">
                                    <Wallet size={18} color="#10B981" />
                                </View>
                                <Typography className="text-textGray text-[10px] uppercase font-bold tracking-wider">Cash</Typography>
                            </View>
                            <Typography weight="bold" className="text-emerald-600 text-base tracking-tight" numberOfLines={1} adjustsFontSizeToFit>
                                {formatCurrency(aggregateCash)}
                            </Typography>
                            
                            {/* Detailed Cash Breakdown */}
                            <View className="mt-2 space-y-1">
                                <View className="flex-row justify-between">
                                    <Typography className="text-textGray/40 text-[8px] uppercase font-bold">Pusat</Typography>
                                    <Typography className="text-textMain text-[8px] font-bold">{formatCurrency(dashboard?.kas_bank?.kas_utama?.saldo || 0)}</Typography>
                                </View>
                                <View className="flex-row justify-between">
                                    <Typography className="text-textGray/40 text-[8px] uppercase font-bold">Bengkel</Typography>
                                    <Typography className="text-textMain text-[8px] font-bold">{formatCurrency(dashboard?.kas_bank?.kas_unit_bengkel?.saldo || 0)}</Typography>
                                </View>
                                <View className="flex-row justify-between">
                                    <Typography className="text-textGray/40 text-[8px] uppercase font-bold">Mobil / Jasa Angkut</Typography>
                                    <Typography className="text-textMain text-[8px] font-bold">{formatCurrency((dashboard?.kas_bank?.kas_unit_mobil?.saldo || 0) + (dashboard?.kas_bank?.kas_unit_jasa_angkut?.saldo || 0))}</Typography>
                                </View>
                            </View>

                            <View className="flex-row items-center mt-2 pt-2 border-t border-gray-50">
                                <TrendingUp size={10} color="#10B981" />
                                <Typography className="text-emerald-500 text-[9px] font-bold ml-1">
                                    {formatCurrency(aggregateCashIn)}
                                </Typography>
                            </View>
                        </View>

                        <View className="w-[48%] bg-white p-4 rounded-[24px] border border-gray-50 shadow-sm">
                            <View className="flex-row items-center mb-3">
                                <View className="w-9 h-9 bg-blue-50 rounded-xl items-center justify-center mr-2.5">
                                    <ArrowRightLeft size={18} color="#3B82F6" />
                                </View>
                                <Typography className="text-textGray text-[10px] uppercase font-bold tracking-wider">Bank</Typography>
                            </View>
                            <Typography weight="bold" className="text-blue-600 text-base tracking-tight" numberOfLines={1} adjustsFontSizeToFit>
                                {formatCurrency(aggregateBank)}
                            </Typography>

                            {/* Detailed Bank Breakdown */}
                            <View className="mt-2 space-y-1">
                                <View className="flex-row justify-between">
                                    <Typography className="text-textGray/40 text-[8px] uppercase font-bold">BCA</Typography>
                                    <Typography className="text-textMain text-[8px] font-bold">{formatCurrency(dashboard?.kas_bank?.bank_utama?.saldo || 0)}</Typography>
                                </View>
                            </View>

                            <View className="flex-row items-center mt-2 pt-2 border-t border-gray-50">
                                <TrendingUp size={10} color="#3B82F6" />
                                <Typography className="text-blue-500 text-[9px] font-bold ml-1">
                                    {formatCurrency(aggregateBankIn)}
                                </Typography>
                            </View>
                        </View>
                    </View>

                    {/* Total Saldo (Full Width) */}
                    <View className="w-full bg-gradient-to-br from-primary/5 to-emerald-50 p-5 rounded-[24px] border border-primary/10 shadow-sm mb-3">
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 bg-primary/10 rounded-xl items-center justify-center mr-3">
                                    <BarChart3 size={20} color="#023C69" />
                                </View>
                                <View>
                                    <Typography className="text-textGray text-[10px] uppercase font-bold tracking-wider">Total Kas & Bank</Typography>
                                    <Typography weight="bold" className="text-primary text-xl tracking-tight">
                                        {formatCurrency(dashboard?.kas_bank?.total_saldo || 0)}
                                    </Typography>
                                </View>
                            </View>
                        </View>
                    </View>



                    {/* Piutang & Hutang Row */}
                    <View className="flex-row justify-between">
                        <Pressable
                            onPress={() => router.push('/finance/piutang')}
                            className="w-[48%] bg-white p-4 rounded-[24px] border border-gray-50 shadow-sm"
                        >
                            <View className="flex-row items-center mb-3">
                                <View className="w-9 h-9 bg-amber-50 rounded-xl items-center justify-center mr-2.5">
                                    <CircleDollarSign size={18} color="#F59E0B" />
                                </View>
                                <Typography className="text-textGray text-[10px] uppercase font-bold tracking-wider">Piutang</Typography>
                            </View>
                            <Typography weight="bold" className="text-amber-600 text-sm tracking-tight" numberOfLines={1} adjustsFontSizeToFit>
                                {formatCurrency(piutangSummary?.total_sisa || 0)}
                            </Typography>
                            <View className="flex-row items-center mt-2 pt-2 border-t border-gray-50">
                                <Typography className="text-rose-500 text-[9px] font-bold">
                                    {piutangSummary?.jumlah_belum_lunas || 0} akun
                                </Typography>
                            </View>
                        </Pressable>

                        <Pressable
                            onPress={() => router.push('/finance/hutang')}
                            className="w-[48%] bg-white p-4 rounded-[24px] border border-gray-50 shadow-sm"
                        >
                            <View className="flex-row items-center mb-3">
                                <View className="w-9 h-9 bg-rose-50 rounded-xl items-center justify-center mr-2.5">
                                    <CircleDollarSign size={18} color="#E11D48" />
                                </View>
                                <Typography className="text-textGray text-[10px] uppercase font-bold tracking-wider">Hutang</Typography>
                            </View>
                            <Typography weight="bold" className="text-rose-600 text-sm tracking-tight" numberOfLines={1} adjustsFontSizeToFit>
                                {formatCurrency(hutangSummary?.total_sisa || dashboard?.hutang?.total_sisa || 0)}
                            </Typography>
                            <View className="flex-row items-center mt-2 pt-2 border-t border-gray-50">
                                <Typography className="text-rose-500 text-[9px] font-bold">
                                    {hutangSummary?.jumlah_belum_lunas || dashboard?.hutang?.jumlah_belum_lunas || 0} akun
                                </Typography>
                            </View>
                        </Pressable>
                    </View>
                </View>

                {/* Piutang Alert Overlay */}
                {piutangSummary && piutangSummary.jumlah_overdue > 0 && (
                    <Pressable
                        onPress={() => router.push('/finance/piutang')}
                        className="bg-rose-50 p-5 rounded-[32px] mb-4 border border-rose-100/50 flex-row items-center"
                    >
                        <View className="w-12 h-12 bg-rose-500 rounded-2xl items-center justify-center mr-4 shadow-lg shadow-rose-500/20">
                            <AlertTriangle size={24} color="white" />
                        </View>
                        <View className="flex-1">
                            <Typography variant="body1" weight="bold" className="text-rose-900 tracking-tight">
                                {piutangSummary.jumlah_overdue} Jatuh Tempo!
                            </Typography>
                            <Typography className="text-rose-600/70 text-xs">Ketuk untuk tindak lanjuti segera</Typography>
                        </View>
                        <View className="w-10 h-10 bg-rose-100 rounded-xl items-center justify-center">
                            <ChevronRight size={20} color="#EF4444" />
                        </View>
                    </Pressable>
                )}

                {/* Investor Payout Alert */}
                {investorSummary && investorSummary.pending_count > 0 && (
                    <Pressable
                        onPress={() => router.push('/finance/pencairan-investor')}
                        className="bg-amber-50 p-5 rounded-[32px] mb-8 border border-amber-100/50 flex-row items-center"
                    >
                        <View className="w-12 h-12 bg-amber-500 rounded-2xl items-center justify-center mr-4 shadow-lg shadow-amber-500/20">
                            <CircleDollarSign size={24} color="white" />
                        </View>
                        <View className="flex-1">
                            <Typography variant="body1" weight="bold" className="text-amber-900 tracking-tight">
                                {investorSummary.pending_count} Pencairan Investor
                            </Typography>
                            <Typography className="text-amber-600/70 text-xs">Total: {formatCurrency(investorSummary.pending_total)}</Typography>
                        </View>
                        <View className="w-10 h-10 bg-amber-100 rounded-xl items-center justify-center">
                            <ChevronRight size={20} color="#F59E0B" />
                        </View>
                    </Pressable>
                )}

                {/* Circular Glass Quick Actions */}
                <View className="mb-10">
                    <Typography variant="h3" weight="bold" className="mb-6 tracking-tight px-1">Aksi Cepat</Typography>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-2 px-2">
                        {[
                            { label: 'Mutasi', icon: ArrowRightLeft, color: '#3B82F6', path: '/finance/mutasi' },
                            { label: 'Keluar', icon: ArrowUpCircle, color: '#EF4444', path: '/finance/expenses' },
                            { label: 'Cash User', icon: Users, color: '#06b6d4', path: '/finance/user-cash' },


                            { label: 'Piutang', icon: CircleDollarSign, color: '#F59E0B', path: '/finance/piutang' },
                            { label: 'Hutang', icon: ArrowDownCircle, color: '#E11D48', path: '/finance/hutang' },
                            { label: 'Investor', icon: TrendingUp, color: '#8B5CF6', path: '/finance/pencairan-investor' },
                            { label: 'Hutang Investor', icon: Landmark, color: '#7C3AED', path: '/finance/hutang-investor' },
                            { label: 'Report', icon: BarChart3, color: '#10B981', path: '/laporan' },
                        ].map((action, idx) => (
                            <Pressable
                                key={idx}
                                className="mr-6 items-center"
                                onPress={() => router.push(action.path as any)}
                            >
                                <View style={{ backgroundColor: `${action.color}10` }} className="w-16 h-16 rounded-[24px] items-center justify-center mb-3 border border-white shadow-sm">
                                    <action.icon size={26} color={action.color} />
                                </View>
                                <Typography className="text-textMain text-[10px] font-bold uppercase tracking-wider">{action.label}</Typography>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>

                {/* Unit Business Breakdown (Card Pattern 3) */}
                <View className="mb-10">
                    <Typography variant="h3" weight="bold" className="mb-6 tracking-tight px-1">Ringkasan Unit Bisnis</Typography>

                    {/* Bengkel */}
                    <Pressable
                        onPress={() => router.push('/bengkel')}
                        className="bg-white p-5 rounded-[32px] mb-6 border border-gray-50 shadow-sm flex-row items-center"
                    >
                        <View className="w-16 h-16 bg-amber-50 rounded-[20px] items-center justify-center mr-4 border border-amber-100/50">
                            <Typography weight="bold" className="text-amber-600 text-lg">B</Typography>
                        </View>
                        <View className="flex-1">
                            <View className="flex-row items-center justify-between mb-1">
                                <Typography variant="body1" weight="bold" className="text-textMain tracking-tight">Bengkel & POS</Typography>
                                <Typography weight="bold" className="text-primary text-sm">
                                    {formatCurrency(dashboard?.bengkel?.laba_bersih || dashboard?.bengkel?.laba_kotor || 0)}
                                </Typography>
                            </View>
                            <View className="flex-row items-center justify-between">
                                <Typography className="text-textGray text-[10px] uppercase font-bold tracking-widest">
                                    {dashboard?.bengkel?.total_transaksi || 0} TRX • Out: {formatCurrency(dashboard?.bengkel?.total_pengeluaran || 0)}
                                </Typography>
                                <View className="bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100/50">
                                    <Typography className="text-emerald-700 text-[9px] font-bold">{formatCurrency(dashboard?.bengkel?.saldo_cash || 0)}</Typography>
                                </View>
                            </View>
                        </View>
                    </Pressable>

                    {/* Jual Beli Mobil */}
                    <Pressable
                        onPress={() => router.push('/mobil')}
                        className="bg-white p-5 rounded-[32px] mb-6 border border-gray-50 shadow-sm flex-row items-center"
                    >
                        <View className="w-16 h-16 bg-blue-50 rounded-[20px] items-center justify-center mr-4 border border-blue-100/50">
                            <Typography weight="bold" className="text-blue-600 text-lg">M</Typography>
                        </View>
                        <View className="flex-1">
                            <View className="flex-row items-center justify-between mb-1">
                                <Typography variant="body1" weight="bold" className="text-textMain tracking-tight">Jual Beli Mobil</Typography>
                                <Typography weight="bold" className="text-primary text-sm">
                                    {formatCurrency(dashboard?.mobil?.laba_bersih || dashboard?.mobil?.laba_tpm || 0)}
                                </Typography>
                            </View>
                            <View className="flex-row items-center justify-between">
                                <Typography className="text-textGray text-[10px] uppercase font-bold tracking-widest">
                                    {dashboard?.mobil?.total_transaksi || 0} TRX • Out: {formatCurrency(dashboard?.mobil?.total_pengeluaran || 0)}
                                </Typography>
                                <View className="bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100/50">
                                    <Typography className="text-emerald-700 text-[9px] font-bold">{formatCurrency(dashboard?.mobil?.saldo_cash || 0)}</Typography>
                                </View>
                            </View>
                            {((dashboard?.mobil?.investor_dana_tertanam || 0) > 0 || (dashboard?.mobil?.investor_total_ditarik || 0) > 0) && (
                                <View className="mt-2 pt-2 border-t border-gray-50 flex-row justify-between items-center">
                                    <Typography className="text-purple-600 text-[9px] font-bold uppercase">
                                        Modal Investor: {formatCurrency(dashboard?.mobil?.investor_sisa_hutang || 0)}
                                    </Typography>
                                    <Typography className="text-textGray/60 text-[9px]">
                                        Ditarik: {formatCurrency(dashboard?.mobil?.investor_total_ditarik || 0)}
                                    </Typography>
                                </View>
                            )}
                        </View>
                    </Pressable>

                    {/* Jasa Angkut */}
                    <Pressable
                        onPress={() => router.push('/jasa-angkut')}
                        className="bg-white p-5 rounded-[32px] mb-6 border border-gray-50 shadow-sm flex-row items-center"
                    >
                        <View className="w-16 h-16 bg-emerald-50 rounded-[20px] items-center justify-center mr-4 border border-emerald-100/50">
                            <Typography weight="bold" className="text-emerald-600 text-lg">A</Typography>
                        </View>
                        <View className="flex-1">
                            <View className="flex-row items-center justify-between mb-1">
                                <Typography variant="body1" weight="bold" className="text-textMain tracking-tight">Jasa Angkut</Typography>
                                <Typography weight="bold" className="text-primary text-sm">
                                    {formatCurrency(dashboard?.jasa_angkut?.laba_bersih || dashboard?.jasa_angkut?.laba_tpm || 0)}
                                </Typography>
                            </View>
                            <View className="flex-row items-center justify-between">
                                <Typography className="text-textGray text-[10px] uppercase font-bold tracking-widest">
                                    {dashboard?.jasa_angkut?.total_transaksi || 0} TRX • Out: {formatCurrency(dashboard?.jasa_angkut?.total_pengeluaran || 0)}
                                </Typography>
                                <View className="bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100/50">
                                    <Typography className="text-emerald-700 text-[9px] font-bold">{formatCurrency(dashboard?.jasa_angkut?.saldo_cash || 0)}</Typography>
                                </View>
                            </View>
                        </View>
                    </Pressable>
                </View>
                <View style={{ height: getCustomTabBarBottomPadding(insets.bottom, 16) }} />
            </ScrollView>
        </View>
    );
}
