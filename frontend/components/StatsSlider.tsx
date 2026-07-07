import React from 'react';
import { View, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Typography } from './ui/Typography';
import { useLowStockParts, useTransaksiBengkelSummary } from '../hooks/useBengkel';
import { useMuatanSummary } from '../hooks/useJasaAngkut';
import { useInventorySummary, usePenjualanSummary } from '../hooks/useMobil';
import { useDashboardSummary } from '../hooks/useKeuangan';
import { formatCurrency } from '../utils/format';
import { useUIStore } from '../store/useUIStore';
import { AlertCircle, Wrench, Truck, CarFront, Wallet } from 'lucide-react-native';

export const StatsSlider = () => {
    const { width } = useWindowDimensions();
    const slideWidth = Math.min(width - 48, width >= 1024 ? 420 : width >= 640 ? 360 : width - 48);
    const { data: lowStock } = useLowStockParts();
    const { data: bengkelStats } = useTransaksiBengkelSummary();
    const { data: logistikStats } = useMuatanSummary();
    const { data: carInventory } = useInventorySummary();
    const { data: carSales } = usePenjualanSummary();
    const { data: dashboard } = useDashboardSummary();
    const { themeColors } = useUIStore();

    const lowStockCount = lowStock?.length || 0;

    const SLIDES = [
        {
            id: 'mobil',
            title: 'Jual Beli Mobil',
            subtitle: `${carInventory?.total_units || carInventory?.total_mobil || 0} unit tersedia`,
            value: `${carSales?.total_transaksi || 0} Terjual`,
            icon: CarFront,
            color: '#F59E0B', // Amber/Orange
            path: '/laporan/mobil',
        },
        {
            id: 'stock',
            title: 'Stok Menipis',
            subtitle: lowStockCount > 0 ? `${lowStockCount} item segera habis!` : 'Stok aman terkendali',
            value: lowStockCount > 0 ? 'Cek Inventori' : 'Semua OK',
            icon: AlertCircle,
            color: '#EE2737', // Gojek Red-ish
            path: '/master-data/sparepart',
        },
        {
            id: 'bengkel',
            title: 'Performa Bengkel',
            subtitle: 'Total transaksi periode ini',
            value: `${bengkelStats?.total_transaksi || 0} Transaksi`,
            icon: Wrench,
            color: themeColors.primary,
            path: '/laporan/bengkel',
        },
        {
            id: 'logistik',
            title: 'Stats Jasa Angkut',
            subtitle: 'Total pendapatan kotor',
            value: formatCurrency(logistikStats?.total_pendapatan || 0),
            icon: Truck,
            color: '#00ADEF', // Gopay Blue
            path: '/laporan/jasa-angkut',
        },
        {
            id: 'finance',
            title: 'Piutang & Kasbon',
            subtitle: `${dashboard?.piutang?.jumlah_overdue || 0} Tagihan Overdue`,
            value: formatCurrency(dashboard?.piutang?.total_sisa || 0),
            icon: Wallet,
            color: '#10B981', // Emerald
            path: '/laporan/piutang',
        },
    ];

    return (
        <View className="mt-8">
            <View className="px-6 flex-row justify-between items-center mb-4">
                <Typography variant="h3" weight="bold">Ringkasan Bisnis</Typography>
                <Pressable>
                    <Typography variant="caption" weight="bold" className="text-primary">Detail</Typography>
                </Pressable>
            </View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={slideWidth + 16}
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: 24 }}
            >
                {SLIDES.map((slide) => {
                    const Icon = slide.icon;
                    return (
                        <Pressable
                            key={slide.id}
                            style={({ pressed }) => ({
                                width: slideWidth,
                                height: 160,
                                backgroundColor: slide.color,
                                opacity: pressed ? 0.9 : 1
                            })}
                            className="mr-4 rounded-3xl overflow-hidden justify-between p-6 border border-white/10"
                        >
                            <View className="flex-row justify-between items-start">
                                <View className="flex-1 mr-2">
                                    <View className="bg-white/20 self-start px-2 py-0.5 rounded-lg mb-2">
                                        <Typography className="text-white text-[10px] font-bold uppercase tracking-wider">{slide.title}</Typography>
                                    </View>
                                    <Typography variant="h3" weight="bold" className="text-white mb-1" numberOfLines={1}>
                                        {slide.value}
                                    </Typography>
                                </View>
                                <View className="bg-white/20 p-3 rounded-2xl">
                                    <Icon size={24} color="white" strokeWidth={2.5} />
                                </View>
                            </View>

                            <View className="flex-row items-center justify-between">
                                <Typography className="text-white/80 text-xs font-medium">{slide.subtitle}</Typography>
                                <View className="bg-white/10 px-3 py-1.5 rounded-xl">
                                    <Typography className="text-white text-[10px] font-bold">LIHAT</Typography>
                                </View>
                            </View>

                            {/* Abstract background shape */}
                            <View className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
};
