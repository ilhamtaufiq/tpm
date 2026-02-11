import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, Platform, Modal, TextInput, RefreshControl as RNRefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
    ChevronLeft,
    Plus,
    Search,
    Filter,
    Wrench,
    Clock,
    CheckCircle2,
    Package,
    Receipt,
    ArrowRight,
    Printer,
    Download,
    X
} from 'lucide-react-native';
import { useRouter, router, useFocusEffect } from 'expo-router';
import BottomSheet from '@gorhom/bottom-sheet';
import { BengkelForm } from '../../components/BengkelForm';
import { useTransaksiBengkelList, useTransaksiBengkelSummary, useUpdateTransaksiBengkelStatus } from '../../hooks/useBengkel';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDistanceToNow } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { printReceipt, saveReceiptPDF, PrintReceiptData } from '../../utils/printReceipt';
import { printSettingsService, PrintSettings } from '../../utils/printSettings';
import { formatCurrency } from '../../utils/format';
import { AlertDialog as AlertDialogComponent } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';

export default function BengkelScreen() {

    // API Hooks - Auto refresh every 5s and on Focus
    const { data: queueData, isLoading, refetch } = useTransaksiBengkelList(undefined, {
        refetchInterval: 5000
    });
    const { data: summary, refetch: refetchSummary } = useTransaksiBengkelSummary({
        refetchInterval: 5000
    });

    useFocusEffect(
        React.useCallback(() => {
            refetch();
            refetchSummary();
        }, [])
    );

    const updateStatsMutation = useUpdateTransaksiBengkelStatus();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = React.useState<any | null>(null);
    const [view, setView] = React.useState<'form' | 'detail'>('form');
    const [refreshing, setRefreshing] = React.useState(false);
    const [sheetIndex, setSheetIndex] = React.useState(-1);
    const [printSettings, setPrintSettings] = React.useState<PrintSettings | null>(null);
    const [printing, setPrinting] = React.useState(false);
    const [dialogConfig, setDialogConfig] = React.useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
        type: 'alert' | 'confirm';
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info',
        type: 'alert'
    });

    const queue = queueData?.data || [];

    // Filtered queue based on search query
    const filteredQueue = useMemo(() => {
        if (!searchQuery.trim()) return queue;
        const q = searchQuery.toLowerCase().trim();
        return queue.filter((item: any) => {
            const plate = (item.nomor_plat || '').toLowerCase();
            const customer = (item.nama_customer || '').toLowerCase();
            const vehicle = (item.jenis_kendaraan || '').toLowerCase();
            const status = (item.status_pengerjaan || '').toLowerCase();
            return plate.includes(q) || customer.includes(q) || vehicle.includes(q) || status.includes(q);
        });
    }, [queue, searchQuery]);

    // Load print settings
    React.useEffect(() => {
        loadPrintSettings();
    }, []);

    const loadPrintSettings = async () => {
        try {
            const settings = await printSettingsService.getSettings();
            setPrintSettings(settings);
        } catch (error) {
            console.error('Failed to load print settings:', error);
        }
    };

    const handlePrintReceipt = async (item: any) => {
        if (!printSettings) {
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: 'Pengaturan cetak belum dimuat',
                variant: 'error',
                type: 'alert'
            });
            return;
        }

        try {
            setPrinting(true);

            const receiptData: PrintReceiptData = {
                type: 'bengkel',
                transactionNumber: item.id.toString(),
                date: new Date(item.created_at || new Date()),
                customerName: item.nama_customer || 'Umum',
                vehiclePlate: item.nomor_plat,
                vehicleType: item.jenis_kendaraan,
                items: [
                    ...(item.detail_services || []).map((s: any) => ({
                        description: s.nama_jasa,
                        quantity: 1,
                        unitPrice: Number(s.harga),
                        subtotal: Number(s.harga)
                    })),
                    ...(item.detail_parts || []).map((p: any) => ({
                        description: p.spare_part_nama || 'Sparepart',
                        quantity: p.qty,
                        unitPrice: Number(p.subtotal) / p.qty,
                        subtotal: Number(p.subtotal)
                    }))
                ],
                subtotal: item.grand_total,
                total: item.grand_total,
                paymentMethod: item.metode_bayar,
                notes: item.catatan
            };

            await printReceipt(receiptData, printSettings);

            setPrinting(false); // Ensure loading is off before showing dialog
            setDialogConfig({
                visible: true,
                title: 'Sukses',
                message: 'Struk berhasil dicetak',
                variant: 'success',
                type: 'alert'
            });
        } catch (error) {
            setPrinting(false); // Ensure loading is off before showing dialog
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: getErrorMessage(error, 'Gagal mencetak struk'),
                variant: 'error',
                type: 'alert'
            });
        }
    };

    const handleSavePDF = async (item: any) => {
        if (!printSettings) {
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: 'Pengaturan cetak belum dimuat',
                variant: 'error',
                type: 'alert'
            });
            return;
        }

        try {
            setPrinting(true);

            const receiptData: PrintReceiptData = {
                type: 'bengkel',
                transactionNumber: item.id.toString(),
                date: new Date(item.created_at || new Date()),
                customerName: item.nama_customer || 'Umum',
                vehiclePlate: item.nomor_plat,
                vehicleType: item.jenis_kendaraan,
                items: [
                    ...(item.detail_services || []).map((s: any) => ({
                        description: s.nama_jasa,
                        quantity: 1,
                        unitPrice: Number(s.harga),
                        subtotal: Number(s.harga)
                    })),
                    ...(item.detail_parts || []).map((p: any) => ({
                        description: p.spare_part_nama || 'Sparepart',
                        quantity: p.qty,
                        unitPrice: Number(p.subtotal) / p.qty,
                        subtotal: Number(p.subtotal)
                    }))
                ],
                subtotal: item.grand_total,
                total: item.grand_total,
                paymentMethod: item.metode_bayar,
                notes: item.catatan
            };

            await saveReceiptPDF(receiptData, printSettings);

            setPrinting(false); // Ensure loading is off before showing dialog
            setDialogConfig({
                visible: true,
                title: 'Sukses',
                message: 'Struk berhasil disimpan sebagai PDF',
                variant: 'success',
                type: 'alert'
            });
        } catch (error) {
            setPrinting(false); // Ensure loading is off before showing dialog
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: getErrorMessage(error, 'Gagal menyimpan PDF'),
                variant: 'error',
                type: 'alert'
            });
        }
    };

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/home');
        }
    };

    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['75%', '90%'], []);

    const handlePresentModalPress = (type: 'form' | 'detail', item?: any) => {
        setView(type);
        if (item) setSelectedItem(item);
        setSheetIndex(0);
    };

    const handleClosePress = useCallback(() => {
        setSheetIndex(-1);
        setSelectedItem(null);
    }, []);

    const updateStatus = async (id: number, newStatus: string) => {
        try {
            await updateStatsMutation.mutateAsync({ id, status: newStatus });
            handleClosePress();
        } catch (error) {
            console.error('Failed to update status:', error);
        }
    };

    const renderBottomSheetContent = () => (
        <View style={{ flex: 1 }}>
            {view === 'form' ? (
                <BengkelForm onSuccess={handleClosePress} />
            ) : selectedItem ? (
                <View className="p-8">
                    <View className="flex-row justify-between items-start mb-6">
                        <View>
                            <Typography variant="h2" weight="bold" className="text-2xl tracking-tighter">{selectedItem.nomor_plat}</Typography>
                            <Typography variant="body2" className="text-textGray mt-1">{selectedItem.jenis_kendaraan}</Typography>
                        </View>
                        <Badge
                            label={selectedItem.status_pengerjaan.toUpperCase()}
                            variant={
                                selectedItem.status_pengerjaan === 'proses' ? 'info' :
                                    selectedItem.status_pengerjaan === 'selesai' ? 'success' :
                                        selectedItem.status_pengerjaan === 'batal' ? 'error' : 'warning'
                            }
                        />
                    </View>

                    <Card variant="outlined" className="p-6 border-gray-100 mb-8 bg-gray-50/50 rounded-[32px]">
                        <Typography variant="caption" weight="bold" className="mb-4 text-primary uppercase tracking-widest">Rincian Order</Typography>

                        {/* Services List */}
                        {(selectedItem.detail_services || []).map((s: any, idx: number) => (
                            <View key={`svc-${idx}`} className="flex-row justify-between mb-2">
                                <Typography variant="body2" className="flex-1 text-textMain">{s.nama_jasa}</Typography>
                                <Typography variant="body2" weight="bold" className="text-textMain">Rp {Number(s.harga).toLocaleString('id-ID')}</Typography>
                            </View>
                        ))}

                        {/* Parts List */}
                        {(selectedItem.detail_parts || []).map((p: any, idx: number) => (
                            <View key={`part-${idx}`} className="flex-row justify-between mb-2">
                                <Typography variant="body2" className="flex-1 text-textGray">
                                    {p.spare_part_nama || 'Sparepart'} <Typography variant="caption" className="text-textGray/60">x{p.qty}</Typography>
                                </Typography>
                                <Typography variant="body2" weight="medium" className="text-textGray">
                                    Rp {Number(p.subtotal).toLocaleString('id-ID')}
                                </Typography>
                            </View>
                        ))}

                        {(!selectedItem.detail_services?.length && !selectedItem.detail_parts?.length) && (
                            <Typography variant="body2" className="mb-4 text-gray-400 italic">Tidak ada item rincian</Typography>
                        )}

                        {selectedItem.catatan && (
                            <View className="mt-4 pt-4 border-t border-gray-100">
                                <Typography variant="caption" className="text-gray-400 mb-1">Catatan:</Typography>
                                <Typography variant="body2" className="italic text-textMain">{selectedItem.catatan}</Typography>
                            </View>
                        )}

                        <View className="h-[1px] bg-gray-200 my-4" />
                        <View className="flex-row justify-between items-center">
                            <Typography weight="bold" className="text-lg">Total Pembayaran</Typography>
                            <Typography variant="h2" weight="bold" className="text-primary">
                                Rp {(selectedItem.grand_total || 0).toLocaleString('id-ID')}
                            </Typography>
                        </View>
                    </Card>

                    <View className="space-y-4">
                        {selectedItem.status_pengerjaan === 'antre' && (
                            <Button
                                title="Mulai Pengerjaan"
                                onPress={() => updateStatus(selectedItem.id, 'proses')}
                                loading={updateStatsMutation.isPending}
                                className="rounded-2xl h-14"
                            />
                        )}
                        {selectedItem.status_pengerjaan === 'proses' && (
                            <Button
                                title="Selesaikan & Checkout"
                                onPress={() => updateStatus(selectedItem.id, 'selesai')}
                                loading={updateStatsMutation.isPending}
                                className="rounded-2xl h-14"
                            />
                        )}

                        {/* Print Buttons */}
                        {selectedItem.status_pengerjaan === 'selesai' && (
                            <>
                                <Button
                                    variant="outline"
                                    title="Cetak Struk"
                                    onPress={() => handlePrintReceipt(selectedItem)}
                                    loading={printing}
                                    icon={<Printer size={20} color="#00AA13" />}
                                    className="rounded-2xl h-14"
                                />
                                <Button
                                    variant="outline-neutral"
                                    title="Simpan PDF"
                                    onPress={() => handleSavePDF(selectedItem)}
                                    loading={printing}
                                    icon={<Download size={20} color="#6B7280" />}
                                    className="rounded-2xl h-14"
                                />
                            </>
                        )}

                        <Button
                            variant="outline-danger"
                            title="Batalkan Order"
                            onPress={handleClosePress}
                            className="rounded-2xl h-14"
                        />
                    </View>
                </View>
            ) : null}
        </View>
    );

    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            {/* Header Section (Design System) */}
            <View className="bg-primary pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <TouchableOpacity
                            onPress={handleGoBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </TouchableOpacity>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Bengkel & POS</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Manajemen Antrian & Inventori</Typography>
                        </View>
                    </View>
                    <TouchableOpacity
                        className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                        onPress={() => router.push('/laporan')}
                    >
                        <Receipt size={22} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Bento Quick Actions (Home Style) */}
                <View className="flex-row justify-between mb-8">
                    <TouchableOpacity
                        onPress={() => router.push('/bengkel/inventory')}
                        activeOpacity={0.9}
                        className="flex-1 bg-white/10 p-5 rounded-[32px] border border-white/10 flex-row items-center mr-2"
                    >
                        <View className="bg-amber-400 w-10 h-10 rounded-2xl items-center justify-center mr-3 shadow-lg shadow-amber-400/20">
                            <Package size={20} color="white" />
                        </View>
                        <View>
                            <Typography weight="bold" className="text-white text-sm">Stok Part</Typography>
                            <Typography className="text-white/40 text-[10px] uppercase font-bold">Inventori</Typography>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.push('/bengkel/expenses')}
                        activeOpacity={0.9}
                        className="flex-1 bg-white/10 p-5 rounded-[32px] border border-white/10 flex-row items-center"
                    >
                        <View className="bg-rose-400 w-10 h-10 rounded-2xl items-center justify-center mr-3 shadow-lg shadow-rose-400/20">
                            <Receipt size={20} color="white" />
                        </View>
                        <View>
                            <Typography weight="bold" className="text-white text-sm">Biaya Ops</Typography>
                            <Typography className="text-white/40 text-[10px] uppercase font-bold">Pengeluaran</Typography>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Bento Stats (Glass Style) */}
                <View className="flex-row justify-between">
                    {[
                        { label: 'Antre', key: 'antre', color: '#F59E0B' },
                        { label: 'Proses', key: 'proses', color: '#3B82F6' },
                        { label: 'Selesai', key: 'selesai', color: '#10B981' },
                    ].map((stat, idx) => {
                        const count = summary ? summary[stat.key] : 0;
                        return (
                            <View
                                key={stat.key}
                                className={`flex-1 bg-white/10 p-4 rounded-[24px] border border-white/5 ${idx < 2 ? 'mr-2' : ''}`}
                            >
                                <Typography className="text-white/40 text-[10px] uppercase font-bold mb-1">{stat.label}</Typography>
                                <View className="flex-row items-baseline">
                                    <Typography weight="bold" className="text-white text-xl">{count || 0}</Typography>
                                    <Typography className="text-white/30 text-[10px] ml-1 font-bold">UNIT</Typography>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* Filter Search Overlay */}
            {sheetIndex === -1 && (
                <View className="px-6 -mt-6 z-1">
                    <View className="bg-white p-2 rounded-3xl shadow-xl flex-row items-center border border-gray-50">
                        <View className="flex-1 flex-row items-center px-4 bg-gray-50 h-12 rounded-2xl border border-gray-100">
                            <Search size={18} color="#9CA3AF" />
                            <TextInput
                                className="flex-1 ml-3 text-sm font-medium text-textMain"
                                placeholder="Cari antrian (Plat, Customer)..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholderTextColor="#9CA3AF"
                                autoCorrect={false}
                                autoCapitalize="none"
                                returnKeyType="search"
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')} className="ml-1">
                                    <X size={18} color="#9CA3AF" />
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity className="ml-2 w-12 h-12 bg-primary/10 rounded-2xl items-center justify-center">
                            <Filter size={20} color="#00AA13" />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <ScrollView
                className="flex-1 px-6 pt-10"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RNRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00AA13" />
                }
            >
                {/* Section Header */}
                <View className="flex-row justify-between items-center mb-6">
                    <View>
                        <Typography variant="h3" weight="bold" className="text-textMain tracking-tight">Antrian Hari Ini</Typography>
                        <Typography variant="caption" className="text-textGray">Monitoring pengerjaan bengkel</Typography>
                    </View>
                </View>

                {/* Queue List */}
                {isLoading ? (
                    <View className="space-y-4">
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                    </View>
                ) : queue.length === 0 ? (
                    <EmptyState
                        title="Antrian Masih Kosong"
                        description="Klik tombol '+' di bawah untuk menambah antrian baru."
                        icon={Wrench}
                    />
                ) : filteredQueue.length === 0 ? (
                    <EmptyState
                        title="Tidak Ditemukan"
                        description={`Tidak ada antrian yang cocok dengan "${searchQuery}"`}
                        icon={Search}
                    />
                ) : (
                    filteredQueue.map((item: any) => (
                        <TouchableOpacity
                            key={item.id}
                            onPress={() => handlePresentModalPress('detail', item)}
                            activeOpacity={0.9}
                            className="bg-white p-5 rounded-[32px] mb-6 border border-gray-50 shadow-sm flex-row items-center"
                        >
                            <View className="w-16 h-16 bg-emerald-50 rounded-[20px] items-center justify-center mr-4 border border-emerald-100/50">
                                <Typography weight="bold" className="text-primary text-[10px] uppercase tracking-tighter">
                                    {item.nomor_plat?.split(' ')[0] || '-'}
                                </Typography>
                                <Typography weight="bold" className="text-primary/40 text-[8px] mt-0.5">
                                    KENDARAAN
                                </Typography>
                            </View>

                            <View className="flex-1">
                                <View className="flex-row items-center justify-between mb-2">
                                    <Typography variant="body1" weight="bold" className="text-textMain text-lg tracking-tight">
                                        {item.nomor_plat}
                                    </Typography>
                                    <View className={`px-2.5 py-1 rounded-full ${item.status_pengerjaan === 'proses' ? 'bg-blue-50' :
                                        item.status_pengerjaan === 'selesai' ? 'bg-emerald-50' : 'bg-amber-50'
                                        }`}>
                                        <Typography variant="caption" weight="bold" className={`uppercase text-[8px] tracking-widest ${item.status_pengerjaan === 'proses' ? 'text-blue-500' :
                                            item.status_pengerjaan === 'selesai' ? 'text-emerald-500' : 'text-amber-500'
                                            }`}>
                                            {item.status_pengerjaan}
                                        </Typography>
                                    </View>
                                </View>

                                <Typography variant="caption" className="text-textGray font-medium">
                                    {item.jenis_kendaraan} • {item.nama_customer || 'Umum'}
                                </Typography>

                                <View className="flex-row items-center mt-3 pt-3 border-t border-gray-50/50">
                                    <Clock size={12} color="#9CA3AF" />
                                    <Typography variant="caption" className="ml-1.5 text-textGray/60 font-medium">
                                        {item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: localeID }) : '-'}
                                    </Typography>
                                    {item.grand_total > 0 && (
                                        <Typography weight="bold" className="text-primary text-xs ml-auto">
                                            Rp {Number(item.grand_total).toLocaleString('id-ID')}
                                        </Typography>
                                    )}
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
                <View className="h-32" />
            </ScrollView>

            {/* Floating Action Button (Design System) */}
            <TouchableOpacity
                onPress={() => handlePresentModalPress('form')}
                activeOpacity={0.8}
                className="absolute bottom-10 right-6 w-16 h-16 bg-primary rounded-full items-center justify-center shadow-2xl shadow-primary/30 border-4 border-white/20"
            >
                <Plus size={32} color="white" strokeWidth={3} />
            </TouchableOpacity>

            {/* Bottom Sheet UI */}
            {Platform.OS === 'web' ? (
                <Modal visible={sheetIndex !== -1} transparent animationType="slide" onRequestClose={handleClosePress}>
                    <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                        <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={handleClosePress} activeOpacity={1} />
                        <View className="bg-white rounded-t-[48px] shadow-2xl overflow-hidden" style={{ width: '100%', maxWidth: 640, height: '85%', alignSelf: 'center' }}>
                            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                            {renderBottomSheetContent()}
                        </View>
                    </View>
                </Modal>
            ) : (
                <BottomSheet
                    ref={bottomSheetRef}
                    index={sheetIndex}
                    snapPoints={snapPoints}
                    enablePanDownToClose
                    backgroundStyle={{ borderRadius: 48, backgroundColor: 'white' }}
                    handleIndicatorStyle={{ backgroundColor: '#E5E7EB', width: 48, height: 6 }}
                    onChange={setSheetIndex}
                >
                    {renderBottomSheetContent()}
                </BottomSheet>
            )}

            <AlertDialogComponent
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                type={dialogConfig.type}
                onClose={() => setDialogConfig(prev => ({ ...prev, visible: false }))}
                loading={printing}
            />
        </View>
    );
}
