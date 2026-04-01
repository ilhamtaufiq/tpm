import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Pressable, RefreshControl, ActivityIndicator, Image, StatusBar } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { getFileUrl } from '../../utils/image';
import { Header } from '../../components/ui/Header';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { RefreshCw, TrendingUp, TrendingDown, Wallet, ArrowRightLeft, CircleDollarSign, BarChart3, ChevronRight, AlertTriangle, Users, ArrowUp } from 'lucide-react-native';
import { useRouter, router, Redirect } from 'expo-router';
import { formatCurrency } from '../../utils/format';
import { keuanganService, PiutangSummary, KasBankAllBalances } from '../../services/keuangan';
import { useDashboardSummary, usePiutangSummary, useHutangSummary, useInvestorDisbursementSummary } from '../../hooks/useKeuangan';
import { SkeletonStats, SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

export default function FinanceTab() {
    const [refreshing, setRefreshing] = useState(false);
    const { user } = useAuthStore();

    if (!(user?.role === 'ADMIN' || user?.role === 'MANAGER')) {
        return <Redirect href="/(tabs)/home" />;
    }

    // API Hooks - Enable auto-refresh every 60 seconds
    const { data: dashboard, isLoading: isLoadingDashboard, refetch: refetchDashboard } = useDashboardSummary(undefined, { refetchInterval: 60000 });
    const { data: piutangSummary, isLoading: isLoadingPiutang, refetch: refetchPiutang } = usePiutangSummary(undefined, { refetchInterval: 60000 });
    const { data: hutangSummary, isLoading: isLoadingHutang, refetch: refetchHutang } = useHutangSummary();
    const { data: investorSummary, refetch: refetchInvestor } = useInvestorDisbursementSummary(undefined, { refetchInterval: 60000 });

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
        dashboard.bengkel.total_penjualan +
        dashboard.mobil.total_penjualan +
        dashboard.jasa_angkut.total_pendapatan
    ) : 0;

    const totalPengeluaran = dashboard?.pengeluaran.total || 0;

    const totalLabaBersih = dashboard ? (
        (dashboard.bengkel?.laba_kotor || 0) +
        (dashboard.mobil?.laba_tpm || 0) +
        (dashboard.jasa_angkut?.laba_tpm || 0) -
        totalPengeluaran
    ) : 0;

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
                        className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                    >
                        <RefreshCw size={20} color="white" />
                    </Pressable>
                }
            />

            <ScrollView
                className="flex-1 px-6 pt-6"
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />}
            >
                {/* Main Profit Card (Standard Bento Style) */}
                <View className="bg-white p-6 rounded-[32px] border border-gray-50 shadow-sm mb-10">
                    <Typography className="text-textGray/40 text-[10px] uppercase font-bold tracking-[2px] mb-1">Estimasi Laba Bersih</Typography>
                    <Typography variant="h1" weight="bold" className="text-textMain text-3xl mb-6 tracking-tighter">
                        {formatCurrency(totalLabaBersih)}
                    </Typography>

                    <View className="flex-row justify-between pt-5 border-t border-gray-50">
                        <View className="flex-1">
                            <Typography className="text-textGray/30 text-[9px] uppercase font-bold mb-1">Pemasukan</Typography>
                            <View className="flex-row items-center">
                                <View className="w-6 h-6 bg-emerald-50 rounded-lg items-center justify-center mr-2">
                                    <TrendingUp size={12} color="#10B981" />
                                </View>
                                <Typography className="text-textMain text-xs font-bold">{formatCurrency(totalPendapatan)}</Typography>
                            </View>
                        </View>
                        <View className="flex-1 ml-4 pl-4 border-l border-gray-50">
                            <Typography className="text-textGray/30 text-[9px] uppercase font-bold mb-1">Pengeluaran</Typography>
                            <View className="flex-row items-center">
                                <View className="w-6 h-6 bg-rose-50 rounded-lg items-center justify-center mr-2">
                                    <TrendingDown size={12} color="#EF4444" />
                                </View>
                                <Typography className="text-textMain text-xs font-bold">{formatCurrency(totalPengeluaran)}</Typography>
                            </View>
                        </View>
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
                                <Typography className="text-textGray text-[10px] uppercase font-bold tracking-wider">Bank BCA</Typography>
                            </View>
                            <Typography weight="bold" className="text-blue-600 text-base tracking-tight" numberOfLines={1} adjustsFontSizeToFit>
                                {formatCurrency(aggregateBank)}
                            </Typography>
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
                            { label: 'Mutasi', icon: Wallet, color: '#3B82F6', path: '/finance/mutasi' },
                            { label: 'Keluar', icon: ArrowUp, color: '#EF4444', path: '/finance/expenses' },
                            { label: 'Cash User', icon: Users, color: '#06b6d4', path: '/finance/user-cash' },


                            { label: 'Piutang', icon: CircleDollarSign, color: '#F59E0B', path: '/finance/piutang' },
                            { label: 'Hutang', icon: CircleDollarSign, color: '#E11D48', path: '/finance/hutang' },
                            { label: 'Investor', icon: TrendingUp, color: '#8B5CF6', path: '/finance/pencairan-investor' },
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
                                    {formatCurrency(dashboard?.bengkel?.laba_kotor || 0)}
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
                                    {formatCurrency(dashboard?.mobil?.laba_tpm || 0)}
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
                                    {formatCurrency(dashboard?.jasa_angkut?.laba_tpm || 0)}
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
                <View className="h-40" />
            </ScrollView>
        </View>
    );
}
