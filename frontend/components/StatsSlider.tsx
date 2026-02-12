import React from 'react';
import { View, ScrollView, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Typography } from './ui/Typography';
import { useLowStockParts, useTransaksiBengkelSummary } from '../hooks/useBengkel';
import { useMuatanSummary } from '../hooks/useJasaAngkut';
import { useInventorySummary, usePenjualanSummary } from '../hooks/useMobil';
import { formatCurrency } from '../utils/format';
import { AlertCircle, Wrench, Truck, CarFront } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const SLIDE_WIDTH = width - 48;

export const StatsSlider = () => {
    const { data: lowStock } = useLowStockParts();
    const { data: bengkelStats } = useTransaksiBengkelSummary();
    const { data: logistikStats } = useMuatanSummary();
    const { data: carInventory } = useInventorySummary();
    const { data: carSales } = usePenjualanSummary();

    const lowStockCount = lowStock?.length || 0;

    const SLIDES = [
        {
            id: 'mobil',
            title: 'Jual Beli Mobil',
            subtitle: `${carInventory?.total_units || 0} unit tersedia di showroom`,
            value: `${carSales?.total_units_sold || 0} Terjual`,
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
            subtitle: 'Total pendapatan hari ini',
            value: formatCurrency(bengkelStats?.total_pendapatan || 0),
            icon: Wrench,
            color: '#023C69', // Gojek Green
            path: '/laporan/bengkel',
        },
        {
            id: 'logistik',
            title: 'Stats Jasa Angkut',
            subtitle: 'Total muatan diproses',
            value: `${logistikStats?.total_muatan || 0} Trip`,
            icon: Truck,
            color: '#00ADEF', // Gopay Blue
            path: '/laporan/jasa-angkut',
        },
    ];

    return (
        <View className="mt-8">
            <View className="px-6 flex-row justify-between items-center mb-4">
                <Typography variant="h3" weight="bold">Ringkasan Bisnis</Typography>
                <TouchableOpacity>
                    <Typography variant="caption" weight="bold" className="text-primary">Detail</Typography>
                </TouchableOpacity>
            </View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={SLIDE_WIDTH + 16}
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: 24 }}
            >
                {SLIDES.map((slide) => {
                    const Icon = slide.icon;
                    return (
                        <TouchableOpacity
                            key={slide.id}
                            activeOpacity={0.9}
                            style={{ width: SLIDE_WIDTH, height: 160, backgroundColor: slide.color }}
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
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
};
