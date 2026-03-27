import React from 'react';
import { View, ScrollView, Pressable, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { ChevronLeft, Package, ShoppingCart, Car, Wrench, Truck, BarChart3, Wallet, TrendingUp, ArrowUpRight, Scale } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useUIStore } from '../../store/useUIStore';

interface ReportItem {
    title: string;
    icon: any;
    path: string;
    size: 'small' | 'large' | 'full';
    desc?: string;
}

interface ReportGroup {
    name: string;
    accent: string;
    reports: ReportItem[];
}

// Categories for Bento Layout
export default function ReportsScreen() {
    const router = useRouter();
    const { themeColors } = useUIStore();

    // Categories for Bento Layout
    const GROUPS: ReportGroup[] = [
        {
            name: "Persediaan",
            accent: themeColors.primary,
            reports: [
                { title: "Stock Sparepart", icon: Package, path: "/laporan/stock-sparepart", size: 'small' },
                { title: "Pembelian Part", icon: ShoppingCart, path: "/laporan/pembelian-sparepart", size: 'small' },
            ]
        },
        {
            name: "Unit Mobil",
            accent: themeColors.primary,
            reports: [
                { title: "Beli Mobil", icon: Car, path: "/laporan/pembelian-mobil", size: 'small' },
                { title: "Jual Mobil", icon: TrendingUp, path: "/laporan/penjualan-mobil", size: 'small' },
            ]
        },
        {
            name: "Operasional & Jasa",
            accent: themeColors.primary,
            reports: [
                { title: "Penjualan Bengkel", icon: Wrench, path: "/laporan/penjualan-bengkel", size: 'large' },
                { title: "Laporan Jasa Angkut", icon: Truck, path: "/laporan/jasa-angkut", size: 'large' },
            ]
        },
        {
            name: "Keuangan Akhir",
            accent: themeColors.secondary,
            reports: [
                { title: "Laba Rugi", icon: BarChart3, path: "/laporan/laba-rugi", size: 'full', desc: 'Analisa performa keuangan bulanan' },
                { title: "Perubahan Modal", icon: Wallet, path: "/laporan/perubahan-modal", size: 'full', desc: 'Mutasi modal & posisi kas' },
                { title: "Neraca", icon: Scale, path: "/laporan/neraca", size: 'full', desc: 'Posisi keuangan: Aktiva, Hutang & Modal' },
            ]
        }
    ];

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/home');
        }
    };

    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            {/* Premium Header (Design System) */}
            <View className="bg-primary pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <Pressable
                            onPress={handleGoBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </Pressable>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Pusat Laporan</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Analisa Performa & Data Bisnis</Typography>
                        </View>
                    </View>
                </View>

                {/* Adaptive Insight Card (Glassmorphism) */}
                <View className="bg-white/10 p-5 rounded-[32px] border border-white/10 flex-row items-center justify-between">
                    <View className="flex-row items-center">
                        <View className="w-12 h-12 bg-white/20 rounded-2xl items-center justify-center mr-4">
                            <BarChart3 size={24} color="white" />
                        </View>
                        <View>
                            <Typography className="text-white/40 text-[10px] uppercase font-bold tracking-widest mb-1">Status Laporan</Typography>
                            <Typography variant="h3" weight="bold" className="text-white text-lg">Semua Data Ter-update</Typography>
                        </View>
                    </View>
                    <View className="bg-emerald-400 px-3 py-1.5 rounded-full border border-white/20">
                        <Typography className="text-white uppercase text-[8px] font-bold tracking-tighter">LIVE</Typography>
                    </View>
                </View>
            </View>

            <ScrollView
                className="flex-1 px-6 pt-10"
                showsVerticalScrollIndicator={false}
            >
                {GROUPS.map((group, gIdx) => (
                    <View key={gIdx} className="mb-10">
                        {/* Section Header */}
                        <View className="flex-row items-center mb-6 px-1">
                            <View style={{ backgroundColor: group.accent }} className="w-1.5 h-6 rounded-full mr-3" />
                            <Typography variant="h3" weight="bold" className="text-text tracking-tight">{group.name}</Typography>
                        </View>

                        <View className="flex-row flex-wrap justify-between">
                            {group.reports.map((report, rIdx) => {
                                const isFull = report.size === 'full';
                                return (
                                    <Pressable
                                        key={rIdx}
                                        className={isFull ? "w-full bg-surface p-6 rounded-[32px] mb-6 border border-gray-50 shadow-sm" : "w-[48%] bg-surface p-5 rounded-[32px] mb-6 border border-gray-50 shadow-sm"}
                                        onPress={() => router.push(report.path as any)}
                                        activeOpacity={0.9}
                                    >
                                        <View className="flex-row items-center justify-between mb-5">
                                            <View
                                                style={{ backgroundColor: `${group.accent}10` }}
                                                className="w-14 h-14 rounded-[20px] items-center justify-center border border-gray-50/50"
                                            >
                                                <report.icon size={24} color={group.accent} strokeWidth={2.5} />
                                            </View>
                                            {isFull && (
                                                <View className="bg-gray-50 w-10 h-10 rounded-xl items-center justify-center">
                                                    <ArrowUpRight size={18} color="#9CA3AF" />
                                                </View>
                                            )}
                                        </View>

                                        <Typography variant={isFull ? "h3" : "body1"} weight="bold" className="text-text tracking-tight">
                                            {report.title}
                                        </Typography>

                                        {isFull ? (
                                            <Typography variant="caption" className="text-textGray mt-2 leading-relaxed">
                                                {report.desc}
                                            </Typography>
                                        ) : (
                                            <Typography variant="caption" className="text-textGray/60 mt-2 font-bold uppercase text-[9px] tracking-widest">
                                                Lihat Laporan
                                            </Typography>
                                        )}
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                ))}
                <View className="h-20" />
            </ScrollView>
        </View>
    );
}
