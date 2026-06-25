import React, { useMemo, useState } from 'react';
import { View, ScrollView, Pressable, StatusBar, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import {
    ChevronLeft,
    Package,
    ShoppingCart,
    Car,
    Wrench,
    Truck,
    BarChart3,
    Wallet,
    TrendingUp,
    ChevronRight,
    Scale,
    Search,
    X,
    FileText,
    PieChart,
    Layers,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';

type ReportSize = 'small' | 'large' | 'full';
type GroupId = 'persediaan' | 'mobil' | 'operasional' | 'keuangan';
type CategoryFilter = 'ALL' | GroupId;

interface ReportItem {
    title: string;
    icon: any;
    path: string;
    size: ReportSize;
    desc?: string;
    color: string;
}

interface ReportGroup {
    id: GroupId;
    name: string;
    accent: string;
    reports: ReportItem[];
}

const REPORT_GROUPS: ReportGroup[] = [
    {
        id: 'persediaan',
        name: 'Persediaan',
        accent: '#059669',
        reports: [
            { title: 'Stock Sparepart', icon: Package, path: '/laporan/stock-sparepart', size: 'small', color: '#059669' },
            { title: 'Pembelian Part', icon: ShoppingCart, path: '/laporan/pembelian-sparepart', size: 'small', color: '#0D9488' },
        ],
    },
    {
        id: 'mobil',
        name: 'Unit Mobil',
        accent: '#F97316',
        reports: [
            { title: 'Beli Mobil', icon: Car, path: '/laporan/pembelian-mobil', size: 'small', color: '#F97316' },
            { title: 'Jual Mobil', icon: TrendingUp, path: '/laporan/penjualan-mobil', size: 'small', color: '#EA580C' },
        ],
    },
    {
        id: 'operasional',
        name: 'Operasional & Jasa',
        accent: '#2563EB',
        reports: [
            { title: 'Penjualan Bengkel', icon: Wrench, path: '/laporan/penjualan-bengkel', size: 'large', color: '#023C69', desc: 'Rekap transaksi & penjualan unit bengkel' },
            { title: 'Laporan Jasa Angkut', icon: Truck, path: '/laporan/jasa-angkut', size: 'large', color: '#6366F1', desc: 'Performa muatan & pendapatan jasa angkut' },
        ],
    },
    {
        id: 'keuangan',
        name: 'Keuangan Akhir',
        accent: '#023C69',
        reports: [
            { title: 'Laba Rugi', icon: BarChart3, path: '/laporan/laba-rugi', size: 'full', color: '#023C69', desc: 'Analisa performa keuangan bulanan' },
            { title: 'Perubahan Modal', icon: Wallet, path: '/laporan/perubahan-modal', size: 'full', color: '#7C3AED', desc: 'Mutasi modal & posisi kas' },
            { title: 'Neraca', icon: Scale, path: '/laporan/neraca', size: 'full', color: '#0F766E', desc: 'Posisi keuangan: aktiva, hutang & modal' },
        ],
    },
];

const isGroupVisibleForRole = (groupId: GroupId, role?: string | null) => {
    if (role === 'ADMIN' || role === 'MANAGER') return true;
    if (role === 'BENGKEL') return groupId === 'persediaan' || groupId === 'operasional';
    if (role === 'JASA_ANGKUT') return groupId === 'operasional';
    if (role === 'MOBIL') return groupId === 'mobil';
    return false;
};

const isReportVisibleForRole = (report: ReportItem, role?: string | null) => {
    if (role === 'ADMIN' || role === 'MANAGER') return true;
    const title = report.title.toLowerCase();
    if (role === 'BENGKEL') return title.includes('bengkel') || title.includes('sparepart') || title.includes('pembelian part');
    if (role === 'JASA_ANGKUT') return title.includes('jasa angkut');
    if (role === 'MOBIL') return title.includes('mobil');
    return false;
};

export default function ReportsScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user } = useAuthStore();
    const role = user?.role;

    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');

    const visibleGroups = useMemo(() => {
        return REPORT_GROUPS
            .filter((group) => isGroupVisibleForRole(group.id, role))
            .map((group) => ({
                ...group,
                reports: group.reports.filter((report) => isReportVisibleForRole(report, role)),
            }))
            .filter((group) => group.reports.length > 0);
    }, [role]);

    const filteredGroups = useMemo(() => {
        const q = search.trim().toLowerCase();
        return visibleGroups
            .filter((group) => categoryFilter === 'ALL' || group.id === categoryFilter)
            .map((group) => ({
                ...group,
                reports: group.reports.filter((report) => {
                    if (!q) return true;
                    return [
                        report.title,
                        report.desc,
                        group.name,
                    ].some((value) => String(value || '').toLowerCase().includes(q));
                }),
            }))
            .filter((group) => group.reports.length > 0);
    }, [visibleGroups, categoryFilter, search]);

    const reportStats = useMemo(() => {
        const allReports = visibleGroups.flatMap((g) => g.reports);
        return {
            total: allReports.length,
            keuangan: visibleGroups.find((g) => g.id === 'keuangan')?.reports.length ?? 0,
            operasional: visibleGroups
                .filter((g) => g.id === 'operasional' || g.id === 'persediaan' || g.id === 'mobil')
                .flatMap((g) => g.reports).length,
        };
    }, [visibleGroups]);

    const categoryFilters = useMemo(() => {
        const base = [{ id: 'ALL' as CategoryFilter, label: 'Semua', count: reportStats.total }];
        return base.concat(
            visibleGroups.map((group) => ({
                id: group.id as CategoryFilter,
                label: group.name,
                count: group.reports.length,
            }))
        );
    }, [visibleGroups, reportStats.total]);

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/home');
        }
    };

    const renderSmallCard = (report: ReportItem, group: ReportGroup) => {
        const Icon = report.icon;
        return (
            <Pressable
                key={report.path}
                onPress={() => router.push(report.path as any)}
                className="w-[48%] bg-white p-4 rounded-[24px] mb-4 border border-gray-100 active:scale-[0.98]"
            >
                <View
                    style={{ backgroundColor: `${report.color}12` }}
                    className="w-12 h-12 rounded-2xl items-center justify-center mb-3 border border-gray-50"
                >
                    <Icon size={22} color={report.color} strokeWidth={2.5} />
                </View>
                <Typography weight="bold" className="text-textMain text-sm" numberOfLines={2}>
                    {report.title}
                </Typography>
                <View className="flex-row items-center mt-2">
                    <Typography className="text-gray-400 text-[9px] font-bold uppercase tracking-widest flex-1">
                        Lihat
                    </Typography>
                    <ChevronRight size={14} color={group.accent} />
                </View>
            </Pressable>
        );
    };

    const renderLargeCard = (report: ReportItem) => {
        const Icon = report.icon;
        return (
            <Pressable
                key={report.path}
                onPress={() => router.push(report.path as any)}
                className="w-full bg-white p-5 rounded-[28px] mb-4 border border-gray-100 flex-row items-center active:scale-[0.98]"
            >
                <View
                    style={{ backgroundColor: `${report.color}12` }}
                    className="w-14 h-14 rounded-2xl items-center justify-center mr-4 border border-gray-50"
                >
                    <Icon size={24} color={report.color} strokeWidth={2.5} />
                </View>
                <View className="flex-1">
                    <Typography weight="bold" className="text-textMain text-base">
                        {report.title}
                    </Typography>
                    {report.desc ? (
                        <Typography className="text-textGray text-xs mt-1" numberOfLines={2}>
                            {report.desc}
                        </Typography>
                    ) : null}
                </View>
                <ChevronRight size={20} color="#9CA3AF" />
            </Pressable>
        );
    };

    const renderFullCard = (report: ReportItem) => {
        const Icon = report.icon;
        return (
            <Pressable
                key={report.path}
                onPress={() => router.push(report.path as any)}
                className="w-full rounded-[28px] mb-4 border border-gray-100 overflow-hidden active:scale-[0.98]"
            >
                <View className="bg-white p-5">
                    <View className="flex-row items-start justify-between">
                        <View
                            style={{ backgroundColor: `${report.color}15` }}
                            className="w-14 h-14 rounded-2xl items-center justify-center border border-gray-50"
                        >
                            <Icon size={24} color={report.color} strokeWidth={2.5} />
                        </View>
                        <View className="bg-primary/5 px-3 py-1 rounded-full">
                            <Typography className="text-primary text-[9px] font-bold uppercase tracking-widest">
                                Keuangan
                            </Typography>
                        </View>
                    </View>
                    <Typography weight="bold" className="text-textMain text-lg mt-4">
                        {report.title}
                    </Typography>
                    {report.desc ? (
                        <Typography className="text-textGray text-sm mt-1 leading-relaxed">
                            {report.desc}
                        </Typography>
                    ) : null}
                    <View className="flex-row items-center mt-4 pt-4 border-t border-gray-50">
                        <Typography className="text-primary text-xs font-bold flex-1">Buka Laporan</Typography>
                        <ChevronRight size={18} color="#023C69" />
                    </View>
                </View>
            </Pressable>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />

            <View className="px-6 py-4 flex-row items-center justify-between border-b border-gray-100 bg-white">
                <View className="flex-row items-center">
                    <Pressable onPress={handleGoBack} className="mr-4">
                        <ChevronLeft size={24} color="#1C1C1C" />
                    </Pressable>
                    <View>
                        <Typography variant="h2" weight="bold">Pusat Laporan</Typography>
                        <Typography className="text-gray-400 text-xs mt-0.5">
                            Analisa performa & data bisnis
                        </Typography>
                    </View>
                </View>
            </View>

            <ScrollView
                className="flex-1 px-6 pt-5"
                contentContainerStyle={{ paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 20) }}
                showsVerticalScrollIndicator={false}
            >
                <View className="flex-row gap-3 mb-4">
                    {[
                        { label: 'Laporan', value: String(reportStats.total), icon: FileText, color: '#023C69', bg: 'bg-primary/5' },
                        { label: 'Operasional', value: String(reportStats.operasional), icon: Layers, color: '#2563EB', bg: 'bg-blue-50' },
                        { label: 'Keuangan', value: String(reportStats.keuangan), icon: PieChart, color: '#059669', bg: 'bg-emerald-50' },
                    ].map((stat) => {
                        const StatIcon = stat.icon;
                        return (
                            <View key={stat.label} className={`flex-1 ${stat.bg} rounded-2xl p-3 border border-gray-100`}>
                                <View className="flex-row items-center mb-2">
                                    <StatIcon size={14} color={stat.color} />
                                    <Typography className="text-[9px] font-bold text-gray-500 ml-1.5 uppercase tracking-wide">
                                        {stat.label}
                                    </Typography>
                                </View>
                                <Typography weight="bold" className="text-textMain text-sm">
                                    {stat.value}
                                </Typography>
                            </View>
                        );
                    })}
                </View>

                <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 h-12 mb-3">
                    <Search size={18} color="#9CA3AF" />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Cari laporan..."
                        placeholderTextColor="#9CA3AF"
                        className="flex-1 ml-3 text-sm font-medium text-textMain"
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                    {search.length > 0 && (
                        <Pressable onPress={() => setSearch('')} className="p-1">
                            <X size={16} color="#9CA3AF" />
                        </Pressable>
                    )}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
                    {categoryFilters.map((filter) => {
                        const isActive = categoryFilter === filter.id;
                        return (
                            <Pressable
                                key={filter.id}
                                onPress={() => setCategoryFilter(filter.id)}
                                className={`px-4 py-2 rounded-full border mr-2 ${
                                    isActive
                                        ? 'bg-primary border-primary'
                                        : 'bg-white border-gray-200'
                                }`}
                            >
                                <Typography
                                    variant="caption"
                                    weight="bold"
                                    className={isActive ? 'text-white' : 'text-gray-600'}
                                >
                                    {filter.label} ({filter.count})
                                </Typography>
                            </Pressable>
                        );
                    })}
                </ScrollView>

                {filteredGroups.length === 0 ? (
                    <View className="bg-white border border-gray-100 rounded-[28px] p-8 items-center">
                        <FileText size={32} color="#CBD5E1" />
                        <Typography weight="bold" className="text-textMain mt-4">
                            Laporan tidak ditemukan
                        </Typography>
                        <Typography className="text-textGray text-sm mt-1 text-center">
                            {search
                                ? `Tidak ada hasil untuk "${search}"`
                                : 'Tidak ada laporan tersedia untuk peran Anda.'}
                        </Typography>
                    </View>
                ) : (
                    filteredGroups.map((group) => (
                        <View key={group.id} className="mb-6">
                            <View className="flex-row items-center justify-between mb-3 px-1">
                                <View className="flex-row items-center">
                                    <View
                                        style={{ backgroundColor: group.accent }}
                                        className="w-1.5 h-5 rounded-full mr-3"
                                    />
                                    <Typography variant="h3" weight="bold" className="text-textMain">
                                        {group.name}
                                    </Typography>
                                </View>
                                <Typography className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    {group.reports.length} laporan
                                </Typography>
                            </View>

                            {group.id === 'keuangan' ? (
                                group.reports.map((report) => renderFullCard(report))
                            ) : (
                                <View className="flex-row flex-wrap justify-between">
                                    {group.reports.map((report) => {
                                        if (report.size === 'large') return renderLargeCard(report);
                                        return renderSmallCard(report, group);
                                    })}
                                </View>
                            )}
                        </View>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}