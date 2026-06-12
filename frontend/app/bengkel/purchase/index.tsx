import React, { useState, useMemo, useCallback } from 'react';
import {
    View,
    ScrollView,
    Pressable,
    TextInput,
    StatusBar,
    RefreshControl as RNRefreshControl,
    ActivityIndicator,
    Modal
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../../../components/ui/Typography';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import {
    ChevronLeft,
    Search,
    Plus,
    Package,
    ClipboardList,
    ShoppingCart,
    Clock,
    X,
    Calendar,
    User
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { usePembelianPartsList } from '../../../hooks/useBengkel';
import { formatCurrency } from '../../../utils/format';
import { getCustomTabBarBottomPadding } from '../../../components/ui/CustomTabBar';

export default function PurchaseIndexScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    const [selectedPurchase, setSelectedPurchase] = useState<any>(null);

    // Fetch purchases
    const { data: purchasesData, isLoading, refetch } = usePembelianPartsList({
        limit: 100
    });

    useFocusEffect(
        useCallback(() => {
            refetch();
        }, [refetch])
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    const purchases = useMemo(() => {
        const list = Array.isArray(purchasesData) ? purchasesData : purchasesData?.data || [];
        if (!searchQuery.trim()) return list;
        const q = searchQuery.toLowerCase().trim();
        return list.filter((item: any) => {
            const supplierName = (item.supplier?.nama || item.supplier_nama || '').toLowerCase();
            const invoiceNo = (item.nomor_faktur || '').toLowerCase();
            const trxNo = (item.nomor_transaksi || '').toLowerCase();
            return supplierName.includes(q) || invoiceNo.includes(q) || trxNo.includes(q);
        });
    }, [purchasesData, searchQuery]);

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/bengkel');
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View className="px-6 py-4 flex-row items-center justify-between border-b border-gray-100 bg-white">
                <View className="flex-row items-center">
                    <Pressable onPress={handleBack} className="mr-4">
                        <ChevronLeft size={24} color="#1C1C1C" />
                    </Pressable>
                    <View>
                        <Typography variant="h2" weight="bold">Riwayat Restock</Typography>
                        <Typography className="text-gray-400 text-xs mt-0.5">Daftar pembelian & stok masuk</Typography>
                    </View>
                </View>
                <Pressable
                    onPress={() => router.push('/bengkel/purchase/create')}
                    className="bg-primary px-4 py-2 rounded-xl flex-row items-center active:opacity-90"
                >
                    <Plus size={16} color="white" />
                    <Typography weight="bold" className="text-white text-xs ml-1">Tambah</Typography>
                </Pressable>
            </View>

            {/* Search Box */}
            <View className="p-6 bg-white border-b border-gray-50">
                <View className="flex-row items-center px-4 bg-gray-50 h-12 rounded-2xl border border-gray-100">
                    <Search size={18} color="#9CA3AF" />
                    <TextInput
                        placeholder="Cari supplier, nomor faktur, atau nota..."
                        className="flex-1 ml-3 text-sm font-medium text-textMain"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                </View>
            </View>

            {/* Main Content */}
            <ScrollView
                className="flex-1 px-6 pt-6"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RNRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />
                }
            >
                {isLoading ? (
                    <View className="py-20 items-center">
                        <ActivityIndicator size="large" color="#023C69" />
                        <Typography className="text-textGray/40 text-xs mt-4 font-bold tracking-widest">MEMUAT DATA...</Typography>
                    </View>
                ) : purchases.length === 0 ? (
                    <View className="items-center justify-center py-20 bg-white rounded-[40px] border border-dashed border-gray-100">
                        <View className="w-24 h-24 bg-gray-50 rounded-full items-center justify-center mb-6 opacity-30">
                            <ShoppingCart size={40} color="#9CA3AF" />
                        </View>
                        <Typography className="text-textGray font-bold uppercase tracking-[6px]">Belum Ada Data</Typography>
                        <Typography variant="caption" className="text-textGray/40 mt-2">Tidak ditemukan transaksi pembelian</Typography>
                    </View>
                ) : (
                    purchases.map((item: any) => (
                        <Pressable
                            key={item.id}
                            onPress={() => setSelectedPurchase(item)}
                            className="bg-white p-5 rounded-[32px] mb-4 border border-gray-50 shadow-sm active:scale-[0.98] transition-transform"
                        >
                            <View className="flex-row items-center mb-4">
                                <View className="w-14 h-14 bg-blue-50 rounded-2xl items-center justify-center mr-4">
                                    <Package size={24} color="#3B82F6" />
                                </View>
                                <View className="flex-1">
                                    <View className="flex-row items-center justify-between">
                                        <Typography variant="body1" weight="bold" className="text-textMain">
                                            {item.supplier?.nama || item.supplier_nama || 'Supplier Umum'}
                                        </Typography>
                                        <View className={`px-2.5 py-1 rounded-full ${item.status_bayar?.toUpperCase() === 'LUNAS' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                            <Typography className={`text-[8px] font-bold uppercase ${item.status_bayar?.toUpperCase() === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {item.status_bayar || 'UNPAID'}
                                            </Typography>
                                        </View>
                                    </View>
                                    <Typography variant="caption" className="text-textGray/60 mt-0.5" numberOfLines={1}>
                                        {format(new Date(item.tanggal), 'dd MMMM yyyy', { locale: localeID })} • {item.nomor_transaksi}
                                    </Typography>
                                </View>
                            </View>

                            <View className="flex-row justify-between items-end pt-4 border-t border-gray-50/50">
                                <View>
                                    <View className="flex-row items-center mb-1">
                                        <ClipboardList size={12} color="#9CA3AF" className="mr-1.5" />
                                        <Typography variant="caption" className="text-textGray font-medium">Items: {item.detail?.length || 0} Barang</Typography>
                                    </View>
                                    <Typography variant="caption" className="text-primary/60 font-bold uppercase text-[9px] tracking-widest">
                                        INV: {item.nomor_faktur || '-'}
                                    </Typography>
                                </View>
                                <View className="items-end">
                                    <Typography className="text-textGray/40 text-[9px] uppercase font-bold mb-0.5">Grand Total</Typography>
                                    <Typography variant="h3" weight="bold" className="text-primary tracking-tighter">
                                        {formatCurrency(item.total_biaya || item.grand_total || 0)}
                                    </Typography>
                                </View>
                            </View>
                        </Pressable>
                    ))
                )}
                <View style={{ height: getCustomTabBarBottomPadding(insets.bottom, 24) }} />
            </ScrollView>

            {/* Detail Modal */}
            <Modal
                visible={!!selectedPurchase}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectedPurchase(null)}
            >
                <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(15, 23, 42, 0.38)' }}>
                    <Pressable className="absolute inset-0" onPress={() => setSelectedPurchase(null)} />
                    <View className="bg-white rounded-t-[32px] px-6 pt-4 pb-10" style={{ maxHeight: '85%' }}>
                        <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center mb-6" />

                        <View className="flex-row items-center justify-between mb-6">
                            <View>
                                <Typography variant="h3" weight="bold">Detail Transaksi</Typography>
                                <Typography className="text-gray-400 text-xs mt-0.5">Nota: {selectedPurchase?.nomor_transaksi || '-'}</Typography>
                            </View>
                            <Pressable
                                onPress={() => setSelectedPurchase(null)}
                                className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
                            >
                                <X size={20} color="#475569" />
                            </Pressable>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Summary Card */}
                            <Card variant="outlined" className="p-5 border-gray-100 bg-gray-50/30 mb-6">
                                <View className="space-y-4">
                                    <View className="flex-row items-center">
                                        <User size={18} color="#64748B" />
                                        <View className="ml-3">
                                            <Typography variant="caption" className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Supplier</Typography>
                                            <Typography weight="bold" className="text-textMain">{selectedPurchase?.supplier?.nama || selectedPurchase?.supplier_nama || 'Supplier Umum'}</Typography>
                                        </View>
                                    </View>

                                    <View className="flex-row items-center">
                                        <Calendar size={18} color="#64748B" />
                                        <View className="ml-3">
                                            <Typography variant="caption" className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Tanggal & Faktur</Typography>
                                            <Typography weight="bold" className="text-textMain">
                                                {selectedPurchase?.tanggal ? format(new Date(selectedPurchase.tanggal), 'dd MMMM yyyy', { locale: localeID }) : '-'}
                                                {selectedPurchase?.nomor_faktur ? ` • ${selectedPurchase.nomor_faktur}` : ''}
                                            </Typography>
                                        </View>
                                    </View>

                                    <View className="flex-row items-center">
                                        <Clock size={18} color="#64748B" />
                                        <View className="ml-3">
                                            <Typography variant="caption" className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Status Pembayaran</Typography>
                                            <View className="flex-row items-center mt-0.5">
                                                <Badge
                                                    label={selectedPurchase?.status_bayar || 'UNPAID'}
                                                    variant={selectedPurchase?.status_bayar?.toUpperCase() === 'LUNAS' ? 'success' : 'error'}
                                                />
                                                <Typography className="text-textGray/60 text-xs ml-2">
                                                    Via: {selectedPurchase?.metode_bayar || '-'}
                                                </Typography>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </Card>

                            {/* Items List */}
                            <Typography weight="bold" className="text-primary text-xs uppercase mb-3 px-1 tracking-widest">Daftar Barang ({selectedPurchase?.detail?.length || 0})</Typography>
                            {selectedPurchase?.detail?.map((detail: any, index: number) => (
                                <View key={index} className="flex-row items-center p-4 bg-white border border-gray-100 rounded-2xl mb-2">
                                    <View className="w-10 h-10 bg-blue-50 rounded-xl items-center justify-center mr-3">
                                        <Package size={20} color="#3B82F6" />
                                    </View>
                                    <View className="flex-1 mr-2">
                                        <Typography weight="bold" className="text-sm text-textMain" numberOfLines={1}>{detail.spare_part?.nama || detail.spare_part_nama || '-'}</Typography>
                                        <Typography variant="caption" className="text-gray-400">{formatCurrency(detail.harga_satuan || 0)} x {detail.qty}</Typography>
                                    </View>
                                    <Typography weight="bold" className="text-primary text-sm">
                                        {formatCurrency((detail.harga_satuan || 0) * (detail.qty || 0))}
                                    </Typography>
                                </View>
                            ))}

                            {/* Footer Info */}
                            {selectedPurchase?.catatan && (
                                <View className="mt-4 p-4 bg-amber-50/30 border border-amber-100/50 rounded-2xl">
                                    <Typography variant="caption" className="text-amber-700 font-bold uppercase text-[9px] mb-1">Catatan</Typography>
                                    <Typography className="text-amber-800 text-xs leading-relaxed">{selectedPurchase.catatan}</Typography>
                                </View>
                            )}

                            {/* Totals */}
                            <View className="mt-8 p-6 bg-primary rounded-[32px]">
                                <View className="flex-row justify-between items-center">
                                    <Typography className="text-white/60 font-bold uppercase text-xs tracking-widest">Total Pembelian</Typography>
                                    <Typography variant="h2" weight="bold" className="text-white tracking-tighter">
                                        {formatCurrency(selectedPurchase?.total_biaya || selectedPurchase?.grand_total || 0)}
                                    </Typography>
                                </View>
                            </View>
                        </ScrollView>

                        <Button
                            title="Tutup"
                            variant="outline"
                            className="mt-6 border-gray-200"
                            onPress={() => setSelectedPurchase(null)}
                        />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
