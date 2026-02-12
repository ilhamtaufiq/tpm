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
    X,
    AlertCircle,
    Banknote,
    Truck,
    Car
} from 'lucide-react-native';
import { useRouter, router, useFocusEffect } from 'expo-router';
import BottomSheet from '@gorhom/bottom-sheet';
import { BengkelForm } from '../../components/BengkelForm';
import { useTransaksiBengkelList, useTransaksiBengkelSummary, useUpdateTransaksiBengkelStatus, useUpdateTransaksiBengkelPayment } from '../../hooks/useBengkel';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDistanceToNow } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { printReceipt, saveReceiptPDF, PrintReceiptData } from '../../utils/printReceipt';
import { printSettingsService, PrintSettings } from '../../utils/printSettings';
import { formatCurrency, formatNumber, parseNumber } from '../../utils/format';
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
    const updatePaymentMutation = useUpdateTransaksiBengkelPayment();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = React.useState<any | null>(null);
    const [view, setView] = React.useState<'form' | 'detail'>('form');
    const [settlementModal, setSettlementModal] = useState(false);
    const [settlementAmount, setSettlementAmount] = useState('');
    const [settlementMethod, setSettlementMethod] = useState('Tunai');
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
                transactionNumber: item.nomor_transaksi || item.id.toString(),
                antrian: item.nomor_antrian || '-',
                date: new Date(item.created_at || new Date()),
                customerName: item.nama_customer || 'Umum',
                cashierName: item.kasir_nama || '-',
                mechanicName: item.mekanik_nama || '-',
                status: item.status_bayar || 'Belum Bayar',
                vehiclePlate: item.nomor_plat,
                vehicleType: item.jenis_kendaraan,
                services: (item.detail_services || []).map((s: any) => ({
                    description: s.nama_jasa,
                    quantity: 1,
                    unitPrice: Number(s.harga),
                    subtotal: Number(s.harga)
                })),
                parts: (item.detail_parts || []).map((p: any) => ({
                    description: p.spare_part_nama || 'Sparepart',
                    quantity: p.qty,
                    unitPrice: Number(p.subtotal) / p.qty,
                    subtotal: Number(p.subtotal)
                })),
                subtotal: item.subtotal || item.total_biaya || item.grand_total,
                discount: item.diskon || 0,
                total: item.grand_total,
                paid: item.jumlah_bayar,
                change: item.kembalian,
                paymentMethod: item.metode_bayar || '-',
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
                transactionNumber: item.nomor_transaksi || item.id.toString(),
                antrian: item.nomor_antrian || '-',
                date: new Date(item.created_at || new Date()),
                customerName: item.nama_customer || 'Umum',
                cashierName: item.kasir_nama || '-',
                mechanicName: item.mekanik_nama || '-',
                status: item.status_bayar || 'Belum Bayar',
                vehiclePlate: item.nomor_plat,
                vehicleType: item.jenis_kendaraan,
                services: (item.detail_services || []).map((s: any) => ({
                    description: s.nama_jasa,
                    quantity: 1,
                    unitPrice: Number(s.harga),
                    subtotal: Number(s.harga)
                })),
                parts: (item.detail_parts || []).map((p: any) => ({
                    description: p.spare_part_nama || 'Sparepart',
                    quantity: p.qty,
                    unitPrice: Number(p.subtotal) / p.qty,
                    subtotal: Number(p.subtotal)
                })),
                subtotal: item.total_biaya || item.grand_total,
                total: item.grand_total,
                paymentMethod: item.metode_bayar || '-',
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

    const handleSettlement = async () => {
        if (!selectedItem || !settlementAmount) return;

        try {
            const amountNum = Number(parseNumber(settlementAmount));
            if (amountNum <= 0) {
                setDialogConfig({
                    visible: true,
                    title: 'Validasi',
                    message: 'Jumlah pembayaran harus lebih dari 0',
                    variant: 'warning',
                    type: 'alert'
                });
                return;
            }

            await updatePaymentMutation.mutateAsync({
                id: selectedItem.id,
                data: {
                    jumlah_bayar: amountNum,
                    metode_bayar: settlementMethod.toLowerCase()
                }
            });

            setSettlementModal(false);
            setSettlementAmount('');
            setDialogConfig({
                visible: true,
                title: 'Sukses',
                message: 'Pembayaran pelunasan berhasil dicatat',
                variant: 'success',
                type: 'alert'
            });
            handleClosePress();
        } catch (error) {
            setDialogConfig({
                visible: true,
                title: 'Gagal',
                message: getErrorMessage(error, 'Gagal mencatat pembayaran'),
                variant: 'error',
                type: 'alert'
            });
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

                    {/* Category Info */}
                    {selectedItem.kategori && selectedItem.kategori !== 'umum' && (
                        <View className={`flex-row items-center mb-4 px-4 py-2.5 rounded-2xl border ${selectedItem.kategori === 'jasa_angkut'
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-blue-50 border-blue-200'
                            }`}>
                            {selectedItem.kategori === 'jasa_angkut' ? (
                                <Truck size={16} color="#10B981" />
                            ) : (
                                <Car size={16} color="#3B82F6" />
                            )}
                            <Typography weight="bold" className={`ml-2 text-xs ${selectedItem.kategori === 'jasa_angkut' ? 'text-emerald-700' : 'text-blue-700'
                                }`}>
                                {selectedItem.kategori === 'jasa_angkut' ? 'Jasa Angkut' : 'Jual Beli Mobil'}
                            </Typography>
                            {selectedItem.muatan_id && (
                                <Typography className="text-emerald-500 text-[10px] ml-2">
                                    Muatan #{selectedItem.muatan_id}
                                </Typography>
                            )}
                            {selectedItem.mobil_id && (
                                <Typography className="text-blue-500 text-[10px] ml-2">
                                    Mobil #{selectedItem.mobil_id}
                                </Typography>
                            )}
                        </View>
                    )}

                    <Card variant="outlined" className="p-6 border-gray-100 mb-8 bg-gray-50/50 rounded-[32px]">
                        <Typography variant="caption" weight="bold" className="mb-4 text-primary uppercase tracking-widest">Rincian Order</Typography>

                        {/* Services List */}
                        {(selectedItem.detail_services || []).map((s: any, idx: number) => (
                            <View key={`svc-${idx}`} className="flex-row justify-between mb-2">
                                <Typography variant="body2" className="flex-1 text-textMain">{s.nama_jasa}</Typography>
                                <Typography variant="body2" weight="bold" className="text-textMain">{formatCurrency(s.harga)}</Typography>
                            </View>
                        ))}

                        {/* Parts List */}
                        {(selectedItem.detail_parts || []).map((p: any, idx: number) => (
                            <View key={`part-${idx}`} className="flex-row justify-between mb-2">
                                <Typography variant="body2" className="flex-1 text-textGray">
                                    {p.spare_part_nama || 'Sparepart'} <Typography variant="caption" className="text-textGray/60">x{p.qty}</Typography>
                                </Typography>
                                <Typography variant="body2" weight="medium" className="text-textGray">
                                    {formatCurrency(p.subtotal)}
                                </Typography>
                            </View>
                        ))}

                        <View className="h-[1px] bg-gray-200 my-4" />

                        <View className="space-y-1 mb-2">
                            <View className="flex-row justify-between items-center">
                                <Typography variant="caption" className="text-textGray">Subtotal</Typography>
                                <Typography variant="caption" weight="semibold">{formatCurrency(selectedItem.subtotal || 0)}</Typography>
                            </View>
                            {selectedItem.diskon > 0 ? (
                                <View className="flex-row justify-between items-center">
                                    <Typography variant="caption" className="text-rose-500">Diskon</Typography>
                                    <Typography variant="caption" weight="semibold" className="text-rose-500">-{formatCurrency(selectedItem.diskon)}</Typography>
                                </View>
                            ) : null}
                            <View className="flex-row justify-between items-center">
                                <Typography variant="caption" className="text-textGray">Sudah Dibayar</Typography>
                                <Typography variant="caption" weight="semibold">{formatCurrency(selectedItem.jumlah_bayar || 0)}</Typography>
                            </View>
                        </View>

                        {(!selectedItem.detail_services?.length && !selectedItem.detail_parts?.length) ? (
                            <Typography variant="body2" className="mb-4 text-gray-400 italic">Tidak ada item rincian</Typography>
                        ) : null}

                        {selectedItem.catatan ? (
                            <View className="mt-4 pt-4 border-t border-gray-100">
                                <Typography variant="caption" className="text-gray-400 mb-1">Catatan:</Typography>
                                <Typography variant="body2" className="italic text-textMain">{selectedItem.catatan}</Typography>
                            </View>
                        ) : null}

                        <View className="h-[1px] bg-gray-200 my-4" />
                        <View className="flex-row justify-between items-center">
                            <View>
                                <Typography weight="bold" className="text-lg">Total Pembayaran</Typography>
                                {selectedItem.grand_total > (selectedItem.jumlah_bayar || 0) ? (
                                    <Typography variant="caption" className="text-rose-600 font-bold">
                                        Sisa: {formatCurrency(selectedItem.grand_total - (selectedItem.jumlah_bayar || 0))}
                                    </Typography>
                                ) : null}
                            </View>
                            <Typography variant="h2" weight="bold" className="text-primary">
                                {formatCurrency(selectedItem.grand_total || 0)}
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
                                    icon={<Printer size={20} color="#023C69" />}
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

                        {/* Settlement Button for Unpaid Orders */}
                        {selectedItem.status_bayar !== 'lunas' ? (
                            <Button
                                variant="secondary"
                                title="Pelunasan Piutang"
                                onPress={() => {
                                    setSettlementAmount(formatNumber((selectedItem.grand_total - (selectedItem.jumlah_bayar || 0)).toString()));
                                    setSettlementModal(true);
                                }}
                                icon={<Banknote size={20} color="white" />}
                                className="rounded-2xl h-14"
                            />
                        ) : null}

                        <Button
                            variant="outline-danger"
                            title="Batalkan Order"
                            onPress={handleClosePress}
                            className="rounded-2xl h-14"
                        />
                    </View>
                </View>
            ) : null}

            {/* Settlement Modal */}
            <Modal visible={settlementModal} transparent animationType="fade">
                <View className="flex-1 justify-center items-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <Card className="w-full p-6 rounded-[32px]">
                        <Typography variant="h3" weight="bold" className="mb-2">Pelunasan Piutang</Typography>
                        <Typography variant="caption" className="text-textGray mb-6">Mencatat pembayaran tagihan yang tertunda</Typography>

                        <View className="bg-primary/5 p-4 rounded-2xl mb-6">
                            <View className="flex-row justify-between mb-2">
                                <Typography variant="caption" className="text-textGray">Total Tagihan</Typography>
                                <Typography variant="caption" weight="bold">{formatCurrency(selectedItem?.grand_total || 0)}</Typography>
                            </View>
                            <View className="flex-row justify-between mb-2">
                                <Typography variant="caption" className="text-textGray">Sudah Dibayar</Typography>
                                <Typography variant="caption" weight="bold" className="text-emerald-600">{formatCurrency(selectedItem?.jumlah_bayar || 0)}</Typography>
                            </View>
                            <View className="h-[1px] bg-primary/10 my-2" />
                            <View className="flex-row justify-between">
                                <Typography variant="body2" weight="bold">Sisa Tagihan</Typography>
                                <Typography variant="body2" weight="bold" className="text-rose-600">{formatCurrency((selectedItem?.grand_total || 0) - (selectedItem?.jumlah_bayar || 0))}</Typography>
                            </View>
                        </View>

                        <Typography variant="caption" weight="bold" className="text-textMain mb-2 ml-1">Metode Pembayaran</Typography>
                        <View className="flex-row space-x-2 mb-6">
                            {['Tunai', 'Transfer'].map((m) => (
                                <TouchableOpacity
                                    key={m}
                                    onPress={() => setSettlementMethod(m)}
                                    className={`flex-1 py-3 rounded-xl border ${settlementMethod === m ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-100'}`}
                                >
                                    <Typography className={`text-center font-bold ${settlementMethod === m ? 'text-white' : 'text-textGray'}`}>{m}</Typography>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Typography variant="caption" weight="bold" className="text-textMain mb-2 ml-1">Jumlah Bayar (Rp)</Typography>
                        <TextInput
                            className="bg-gray-50 p-4 rounded-2xl border border-gray-100 font-bold text-lg text-primary mb-8"
                            keyboardType="numeric"
                            value={settlementAmount}
                            onChangeText={(val) => setSettlementAmount(formatNumber(val))}
                            placeholder="0"
                        />

                        <View className="flex-row space-x-3">
                            <Button
                                variant="outline"
                                title="Batal"
                                onPress={() => setSettlementModal(false)}
                                className="flex-1"
                            />
                            <Button
                                title="Simpan"
                                onPress={handleSettlement}
                                className="flex-1"
                                loading={updatePaymentMutation.isPending}
                            />
                        </View>
                    </Card>
                </View>
            </Modal>
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
                            <Filter size={20} color="#023C69" />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <ScrollView
                className="flex-1 px-6 pt-10"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RNRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />
                }
            >
                {/* Section Header */}
                <View className="flex-row justify-between items-center mb-6">
                    <View>
                        <Typography variant="h3" weight="bold" className="text-textMain tracking-tight">Antrian Hari Ini</Typography>
                        <Typography variant="caption" className="text-textGray">Monitoring pengerjaan bengkel</Typography>
                    </View>
                </View>

                {/* Unpaid Info Pills */}
                {summary && summary.piutang_count > 0 ? (
                    <View className="flex-row space-x-2 mb-6">
                        <View className="bg-rose-50 px-4 py-2.5 rounded-2xl border border-rose-100 flex-row items-center shadow-sm">
                            <AlertCircle size={16} color="#E11D48" />
                            <Typography variant="caption" weight="bold" className="text-rose-600 ml-2">
                                {summary.piutang_count} Order Belum Lunas
                            </Typography>
                        </View>
                        <View className="bg-rose-50 px-4 py-2.5 rounded-2xl border border-rose-100 flex-row items-center shadow-sm">
                            <Typography variant="caption" weight="bold" className="text-rose-600">
                                Total: {formatCurrency(summary.piutang_nilai)}
                            </Typography>
                        </View>
                    </View>
                ) : null}

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
                                    <View className="flex-row items-center space-x-2">
                                        {/* Category Badge */}
                                        {item.kategori === 'jasa_angkut' && (
                                            <View className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 flex-row items-center">
                                                <Truck size={8} color="#10B981" />
                                                <Typography weight="bold" className="text-emerald-600 text-[7px] uppercase tracking-tighter ml-0.5">ANGKUT</Typography>
                                            </View>
                                        )}
                                        {item.kategori === 'jual_beli_mobil' && (
                                            <View className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 flex-row items-center">
                                                <Car size={8} color="#3B82F6" />
                                                <Typography weight="bold" className="text-blue-600 text-[7px] uppercase tracking-tighter ml-0.5">MOBIL</Typography>
                                            </View>
                                        )}
                                        {item.status_bayar !== 'lunas' ? (
                                            <View className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-100">
                                                <Typography weight="bold" className="text-rose-500 text-[7px] uppercase tracking-tighter">BELUM LUNAS</Typography>
                                            </View>
                                        ) : null}
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
                                            {formatCurrency(item.grand_total)}
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
