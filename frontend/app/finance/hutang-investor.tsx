import React, { useState, useCallback } from 'react';
import { View, ScrollView, Pressable, StatusBar, RefreshControl, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Header } from '../../components/ui/Header';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Car, User, TrendingUp, Wallet, ChevronRight, Search, RefreshCw } from 'lucide-react-native';
import { formatCurrency, formatDate } from '../../utils/format';
import { useUnsoldInvestorCars, usePendingInvestorDisbursements, useHutangList } from '../../hooks/useKeuangan';
import { Hutang } from '../../services/keuangan';

const formatUnitLabel = (unit?: string) => {
    if (!unit) return '-';
    return unit.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
};

export default function HutangInvestorScreen() {
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    const { data: unsoldCars, isLoading: isLoadingCars, refetch: refetchCars } =
        useUnsoldInvestorCars(search || undefined);
    const { data: pending, isLoading: isLoadingPending, refetch: refetchPending } =
        usePendingInvestorDisbursements(search || undefined);
    const { data: manualHutang, isLoading: isLoadingManual, refetch: refetchManual } = useHutangList({
        sumber: 'LAINNYA',
        unit: 'MODAL',
        limit: 100,
    });

    const manualRows: Hutang[] = manualHutang?.data || [];

    // Hutang investor = dana tertanam di mobil belum terjual + wajib cair + hutang tercatat manual
    const totalDanaTertanam = (unsoldCars || []).reduce((a, c) => a + (c.sisa_bisa_ditarik || 0), 0);
    const totalLabaBelumCair = (pending || []).reduce((a, p) => a + (p.laba_investor || 0), 0);
    const totalWajibCair = (pending || []).reduce((a, p) => a + (p.total_pencairan || 0), 0);
    const totalManual = manualRows.reduce((a, h) => a + Number(h.sisa_hutang || 0), 0);
    const totalHutangInvestor = totalDanaTertanam + totalWajibCair + totalManual;

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetchCars(), refetchPending(), refetchManual()]);
        setRefreshing(false);
    }, [refetchCars, refetchPending, refetchManual]);

    const handleGoBack = () => {
        if (router.canGoBack()) router.back();
        else router.replace('/finance');
    };

    const isLoading = isLoadingCars || isLoadingPending || isLoadingManual;

    return (
        <View className="flex-1 bg-background">
            <StatusBar barStyle="dark-content" />

            <Header
                title="Hutang Investor"
                subtitle="Kewajiban Dana ke Investor"
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
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />}
            >
                <View className="px-6 mt-4">
                    <Card className="p-6 rounded-[32px] border-gray-50 shadow-sm bg-primary">
                        <View className="flex-row items-center mb-2">
                            <TrendingUp size={16} color="rgba(255,255,255,0.7)" />
                            <Typography className="text-white/70 text-[10px] uppercase font-bold tracking-widest ml-2">
                                Total Hutang Investor
                            </Typography>
                        </View>
                        <Typography variant="h2" weight="bold" className="text-white text-3xl tracking-tighter">
                            {formatCurrency(totalHutangInvestor)}
                        </Typography>
                        <Typography className="text-white/50 text-[10px] mt-2">
                            Dana tertanam + wajib cair + hutang tercatat manual
                        </Typography>
                    </Card>

                    <View className="flex-row justify-between mt-4">
                        <View className="flex-1 bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm mr-2">
                            <Typography className="text-textGray/40 text-[10px] uppercase font-bold tracking-[1px] mb-2">
                                Dana Tertanam
                            </Typography>
                            <Typography variant="h2" weight="bold" className="text-sky-700 text-lg tracking-tighter">
                                {formatCurrency(totalDanaTertanam)}
                            </Typography>
                            <Typography className="text-textGray/30 text-[9px] font-bold mt-1 uppercase tracking-wider">
                                {unsoldCars?.length || 0} Unit Belum Terjual
                            </Typography>
                        </View>
                        <View className="flex-1 bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm ml-2">
                            <Typography className="text-textGray/40 text-[10px] uppercase font-bold tracking-[1px] mb-2">
                                Wajib Cair
                            </Typography>
                            <Typography variant="h2" weight="bold" className="text-emerald-600 text-lg tracking-tighter">
                                {formatCurrency(totalWajibCair)}
                            </Typography>
                            <Typography className="text-textGray/30 text-[9px] font-bold mt-1 uppercase tracking-wider">
                                Laba: {formatCurrency(totalLabaBelumCair)}
                            </Typography>
                        </View>
                    </View>
                </View>

                <View className="px-6 mt-4">
                    <View className="bg-white p-2 rounded-[24px] flex-row items-center border border-gray-100 shadow-sm">
                        <View className="flex-1 flex-row items-center px-4 h-12 rounded-2xl bg-gray-50">
                            <Search size={18} color="#9CA3AF" />
                            <TextInput
                                placeholder="Cari nama investor atau unit..."
                                className="flex-1 ml-3 text-sm font-semibold text-textMain"
                                value={search}
                                onChangeText={setSearch}
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>
                    </View>
                </View>

                {/* Dana tertanam di mobil belum terjual */}
                <View className="px-6 mt-6">
                    <View className="flex-row items-center justify-between mb-4 px-1">
                        <Typography variant="h3" weight="bold" className="tracking-tight text-textMain">Dana Tertanam</Typography>
                        <Pressable onPress={() => router.push('/finance/pencairan-investor')} className="flex-row items-center">
                            <Typography variant="caption" className="text-primary font-bold mr-1">Tarik Dana</Typography>
                            <ChevronRight size={14} color="#023C69" />
                        </Pressable>
                    </View>

                    {isLoading && !refreshing ? (
                        <View className="space-y-4">
                            <SkeletonCard />
                            <SkeletonCard />
                        </View>
                    ) : unsoldCars && unsoldCars.length > 0 ? (
                        unsoldCars.map((item) => (
                            <Card key={item.id} className="mb-4 p-5 rounded-[32px] border-gray-50 shadow-sm">
                                <View className="flex-row justify-between items-start mb-3">
                                    <View className="flex-1 mr-3">
                                        <View className="flex-row items-center mb-1">
                                            <Car size={14} color="#023C69" className="mr-1.5" />
                                            <Typography variant="body1" weight="bold" numberOfLines={1}>{item.mobil}</Typography>
                                        </View>
                                        <View className="flex-row items-center">
                                            <User size={12} color="#9CA3AF" className="mr-1.5" />
                                            <Typography variant="caption" className="text-gray-400">{item.nama_investor}</Typography>
                                        </View>
                                    </View>
                                    <View className="bg-sky-50 px-3 py-1.5 rounded-2xl border border-sky-100">
                                        <Typography weight="bold" className="text-sky-700 text-[10px]">BELUM TERJUAL</Typography>
                                    </View>
                                </View>

                                <View className="bg-gray-50/50 rounded-3xl p-4 border border-gray-100/50">
                                    <View className="flex-row justify-between mb-2">
                                        <Typography className="text-gray-400 text-[10px] font-bold">DANA INVESTOR</Typography>
                                        <Typography variant="caption" weight="semibold" className="text-gray-600">{formatCurrency(item.nominal_investor)}</Typography>
                                    </View>
                                    <View className="flex-row justify-between mb-2">
                                        <Typography className="text-gray-400 text-[10px] font-bold">SUDAH DITARIK</Typography>
                                        <Typography variant="caption" weight="bold" className="text-rose-600">-{formatCurrency(item.total_ditarik)}</Typography>
                                    </View>
                                    <View className="h-[1px] bg-gray-200 my-2 border-dashed" />
                                    <View className="flex-row justify-between">
                                        <Typography className="text-textMain text-[11px] font-bold">SISA TERTANAM</Typography>
                                        <Typography variant="body2" weight="bold" className="text-primary">{formatCurrency(item.sisa_bisa_ditarik)}</Typography>
                                    </View>
                                </View>

                                <Typography variant="caption" className="text-gray-400 mt-3">
                                    Masuk: {formatDate(item.tanggal_masuk || '')}
                                </Typography>
                            </Card>
                        ))
                    ) : (
                        <EmptyState
                            title="Tidak Ada Dana Tertanam"
                            description="Tidak ada mobil investor yang belum terjual saat ini."
                            icon={Car}
                        />
                    )}
                </View>

                {/* Kewajiban setelah mobil terjual */}
                <View className="px-6 mt-6">
                    <Typography variant="h3" weight="bold" className="tracking-tight text-textMain mb-4 px-1">
                        Wajib Cair
                    </Typography>

                    {pending && pending.length > 0 ? (
                        pending.map((item) => (
                            <Card key={item.id} className="mb-4 p-5 rounded-[32px] border-gray-50 shadow-sm">
                                <View className="flex-row justify-between items-start mb-3">
                                    <View className="flex-1 mr-3">
                                        <View className="flex-row items-center mb-1">
                                            <Car size={14} color="#023C69" className="mr-1.5" />
                                            <Typography variant="body1" weight="bold" numberOfLines={1}>{item.mobil}</Typography>
                                        </View>
                                        <View className="flex-row items-center">
                                            <User size={12} color="#9CA3AF" className="mr-1.5" />
                                            <Typography variant="caption" className="text-gray-400">{item.nama_investor}</Typography>
                                        </View>
                                    </View>
                                    <Badge label="READY TO PAY" variant="success" />
                                </View>

                                <View className="bg-gray-50/50 rounded-3xl p-4 border border-gray-100/50">
                                    <View className="flex-row justify-between mb-2">
                                        <Typography className="text-gray-400 text-[10px] font-bold">MODAL INVESTOR</Typography>
                                        <Typography variant="caption" weight="semibold" className="text-gray-600">{formatCurrency(item.nominal_investor)}</Typography>
                                    </View>
                                    <View className="flex-row justify-between mb-2">
                                        <Typography className="text-gray-400 text-[10px] font-bold">BAGIAN LABA</Typography>
                                        <Typography variant="caption" weight="bold" className="text-emerald-600">+{formatCurrency(item.laba_investor)}</Typography>
                                    </View>
                                    <View className="h-[1px] bg-gray-200 my-2 border-dashed" />
                                    <View className="flex-row justify-between">
                                        <Typography className="text-textMain text-[11px] font-bold">TOTAL WAJIB CAIR</Typography>
                                        <Typography variant="body2" weight="bold" className="text-primary">{formatCurrency(item.total_pencairan)}</Typography>
                                    </View>
                                </View>

                                <Typography variant="caption" className="text-gray-400 mt-3">
                                    Terjual: {formatDate(item.tanggal_jual)}
                                </Typography>
                            </Card>
                        ))
                    ) : (
                        <EmptyState
                            title="Tidak Ada Kewajiban"
                            description="Tidak ada dana investor menunggu pencairan."
                            icon={Wallet}
                        />
                    )}
                </View>

                {/* Hutang investor yang dicatat manual (unit MODAL) */}
                <View className="px-6 mt-6">
                    <Typography variant="h3" weight="bold" className="tracking-tight text-textMain mb-4 px-1">
                        Hutang Tercatat Manual
                    </Typography>

                    {manualRows.length > 0 ? (
                        manualRows.map((item) => (
                            <Card key={item.id} className="mb-4 p-5 rounded-[32px] border-gray-50 shadow-sm">
                                <View className="flex-row justify-between items-start mb-2">
                                    <View className="flex-1 mr-3">
                                        <Typography variant="body2" weight="bold" numberOfLines={1}>{item.nama_kreditur}</Typography>
                                        <Typography variant="caption" className="text-gray-400">
                                            {item.nomor_hutang} • {formatUnitLabel(item.unit)}
                                        </Typography>
                                    </View>
                                    <Badge
                                        label={item.status === 'LUNAS' ? 'LUNAS' : 'BELUM LUNAS'}
                                        variant={item.status === 'LUNAS' ? 'success' : 'warning'}
                                    />
                                </View>

                                <View className="bg-gray-50/50 rounded-3xl p-4 border border-gray-100/50">
                                    <View className="flex-row justify-between mb-2">
                                        <Typography className="text-gray-400 text-[10px] font-bold">NOMINAL</Typography>
                                        <Typography variant="caption" weight="semibold" className="text-gray-600">{formatCurrency(Number(item.nominal_hutang || 0))}</Typography>
                                    </View>
                                    <View className="flex-row justify-between mb-2">
                                        <Typography className="text-gray-400 text-[10px] font-bold">DIBAYAR</Typography>
                                        <Typography variant="caption" weight="bold" className="text-emerald-600">{formatCurrency(Number(item.total_dibayar || 0))}</Typography>
                                    </View>
                                    <View className="h-[1px] bg-gray-200 my-2 border-dashed" />
                                    <View className="flex-row justify-between">
                                        <Typography className="text-textMain text-[11px] font-bold">SISA HUTANG</Typography>
                                        <Typography variant="body2" weight="bold" className="text-rose-600">{formatCurrency(Number(item.sisa_hutang || 0))}</Typography>
                                    </View>
                                </View>

                                <Typography variant="caption" className="text-gray-400 mt-3">
                                    Tanggal: {formatDate(item.tanggal)}
                                </Typography>
                            </Card>
                        ))
                    ) : (
                        <EmptyState
                            title="Tidak Ada Hutang Manual"
                            description="Hutang investor yang dicatat langsung (unit MODAL) akan tampil di sini."
                            icon={Wallet}
                        />
                    )}
                </View>

                <View className="h-16" />
            </ScrollView>
        </View>
    );
}
