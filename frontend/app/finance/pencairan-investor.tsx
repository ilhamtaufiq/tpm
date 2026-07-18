import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, ScrollView, Pressable, StatusBar, RefreshControl, ActivityIndicator, Image, Platform, TextInput, Modal, StyleSheet } from 'react-native';
import { appConfirm } from '../../utils/appAlert';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
    Search,
    RefreshCw,
    CircleDollarSign,
    Wallet,
    ArrowUpRight,
    Car,
    User,
    Calendar,
    FileText,
    Banknote,
    CheckCircle2,
    Plus,
    Trash2,
    History,
    Download
} from 'lucide-react-native';
import { useRouter, router } from 'expo-router';
import { Header } from '../../components/ui/Header';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency, formatDate, formatDateTime, formatNumber, parseNumber } from '../../utils/format';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';
import { 
    usePendingInvestorDisbursements, 
    useInvestorDisbursementSummary, 
    useProcessInvestorDisbursement, 
    useReverseInvestorDisbursement,
    useInvestorDisbursementHistory 
} from '../../hooks/useKeuangan';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { printReportHTML } from '../../utils/printReport';

const escapeHtml = (str: any) => String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");

export default function PencairanInvestorScreen() {
    const insets = useSafeAreaInsets();
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
    const [printing, setPrinting] = useState(false);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const paymentSheetRef = useRef<BottomSheet>(null);
    const paymentSnapPoints = useMemo(() => ['70%', '85%'], []);

    // Form states
    const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
    const [metode, setMetode] = useState<'TUNAI' | 'TRANSFER' | 'SPLIT'>('TRANSFER');
    const [payments, setPayments] = useState<{ metode: 'TUNAI' | 'TRANSFER', nominal: string }[]>([
        { metode: 'TUNAI', nominal: '' }
    ]);
    const [catatan, setCatatan] = useState('');

    // API Hooks
    const { 
        data: pendingList, 
        isLoading: isLoadingList, 
        refetch: refetchList 
    } = usePendingInvestorDisbursements(search || undefined);

    const { 
        data: summary, 
        isLoading: isLoadingSummary, 
        refetch: refetchSummary 
    } = useInvestorDisbursementSummary();

    const disburseMutation = useProcessInvestorDisbursement();
    const reverseMutation = useReverseInvestorDisbursement();

    const { 
        data: historyData, 
        isLoading: isLoadingHistory, 
        refetch: refetchHistory 
    } = useInvestorDisbursementHistory({ search: search || undefined });

    const renderBackdrop = useCallback(
        (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
        []
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetchList(), refetchSummary(), refetchHistory()]);
        setRefreshing(false);
    }, [refetchList, refetchSummary, refetchHistory]);

    // Alert State
    const [alertState, setAlertState] = useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info',
    });

    const showAlert = (title: string, message: string, variant: 'success' | 'error' | 'warning' | 'info' = 'info') => {
        setAlertState({ visible: true, title, message, variant });
    };

    const handleOpenModal = (item: any) => {
        setSelectedId(item.id);
        setCatatan(`Pencairan dana investor ${item.nama_investor} - ${item.mobil}`);
        
        if (Platform.OS === 'web') {
            setModalVisible(true);
            setIsSheetOpen(true);
        } else {
            paymentSheetRef.current?.expand();
            setIsSheetOpen(true);
        }
    };

    const handleProcessDisbursement = async () => {
        if (!selectedId) return;

        try {
            const requestData: any = {
                tanggal,
                catatan,
            };

            if (metode === 'SPLIT') {
                requestData.payments = payments.map(p => ({
                    metode: p.metode,
                    nominal: parseNumber(p.nominal)
                }));
            } else {
                requestData.metode_bayar = metode;
                const nominalVal = parseNumber(payments[0]?.nominal);
                if (nominalVal > 0) {
                    requestData.nominal = nominalVal;
                }
            }

            await disburseMutation.mutateAsync({
                transaksiId: selectedId,
                data: requestData
            });

            if (Platform.OS === 'web') {
                setModalVisible(false);
                setIsSheetOpen(false);
            } else {
                paymentSheetRef.current?.close();
                setIsSheetOpen(false);
            }

            showAlert('Sukses', 'Dana investor berhasil dicairkan dan tercatat di KasBank.', 'success');
            setSelectedId(null);
            // Reset split payments
            setPayments([{ metode: 'TUNAI', nominal: '' }]);
            setMetode('TRANSFER');
        } catch (error: any) {
            const errorMessage = error?.response?.data?.detail || error?.message || 'Gagal memproses pencairan';
            showAlert('Gagal', errorMessage, 'error');
        }
    };

    const handleReverseDisbursement = (item: any) => {
        const transaksiId = item?.transaksi?.id || item?.transaksi_id;
        if (!transaksiId) {
            showAlert('Gagal', 'Transaksi terkait tidak ditemukan untuk reversal.', 'error');
            return;
        }

        const transaksiLabel = item?.transaksi?.nomor_transaksi || item?.transaksi?.mobil_info || 'transaksi investor';
        const executeReverse = async () => {
            try {
                await reverseMutation.mutateAsync({
                    transaksiId,
                    data: {
                        alasan: `Reversal pencairan investor ${transaksiLabel}`,
                    },
                });

                await Promise.all([refetchList(), refetchSummary(), refetchHistory()]);
                showAlert('Sukses', 'Pencairan investor berhasil direversal.', 'success');
            } catch (error: any) {
                const errorMessage = error?.response?.data?.detail || error?.message || 'Gagal melakukan reversal pencairan';
                showAlert('Gagal', errorMessage, 'error');
            }
        };

        appConfirm(
            'Reversal Pencairan Investor',
            `Batalkan pencairan untuk ${transaksiLabel}? Saldo kas dan status pencairan akan dikembalikan sesuai reversal.`,
            executeReverse,
            { confirmText: 'Reversal', variant: 'warning' }
        );
    };

    const handleAddPaymentRow = () => {
        setPayments([...payments, { metode: 'TRANSFER', nominal: '' }]);
    };

    const handleRemovePaymentRow = (index: number) => {
        if (payments.length > 1) {
            setPayments(payments.filter((_, i) => i !== index));
        }
    };

    const handleUpdatePayment = (index: number, field: string, value: any) => {
        const newPayments = [...payments];
        newPayments[index] = { ...newPayments[index], [field]: value };
        setPayments(newPayments);
    };

    const handleDownloadReport = async () => {
        setPrinting(true);
        try {
            const content = activeTab === 'PENDING' ? pendingList : historyData;
            const title = activeTab === 'PENDING' ? 'Laporan Dana Investor Pending' : 'Riwayat Pencairan Dana Investor';
            
            let htmlContent = `
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th style="border: 1px solid #e5e7eb; padding: 12px; text-align: left;">${activeTab === 'PENDING' ? 'Tgl Jual' : 'Tgl Cair'}</th>
                            <th style="border: 1px solid #e5e7eb; padding: 12px; text-align: left;">Investor</th>
                            <th style="border: 1px solid #e5e7eb; padding: 12px; text-align: left;">Unit Mobil</th>
                            <th style="border: 1px solid #e5e7eb; padding: 12px; text-align: right;">${activeTab === 'PENDING' ? 'Total Dana' : 'Nominal'}</th>
                            ${activeTab === 'HISTORY' ? '<th style="border: 1px solid #e5e7eb; padding: 12px; text-align: left;">Metode</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
            `;

            if (content && content.length > 0) {
                content.forEach((item: any) => {
                    htmlContent += `
                        <tr>
                            <td style="border: 1px solid #e5e7eb; padding: 12px;">${formatDate(activeTab === 'PENDING' ? item.tanggal_jual : item.tanggal)}</td>
                            <td style="border: 1px solid #e5e7eb; padding: 12px;">${escapeHtml(item.nama_investor || (item.transaksi?.mobil?.nama_investor || '-'))}</td>
                            <td style="border: 1px solid #e5e7eb; padding: 12px;">${escapeHtml(item.mobil || (item.transaksi?.mobil?.merek + ' ' + item.transaksi?.mobil?.model || '-'))}</td>
                            <td style="border: 1px solid #e5e7eb; padding: 12px; text-align: right;">${formatCurrency(activeTab === 'PENDING' ? item.total_pencairan : item.nominal)}</td>
                            ${activeTab === 'HISTORY' ? `<td style="border: 1px solid #e5e7eb; padding: 12px;">${escapeHtml(item.metode_bayar)}</td>` : ''}
                        </tr>
                    `;
                });
            } else {
                htmlContent += `<tr><td colspan="${activeTab === 'HISTORY' ? 5 : 4}" style="border: 1px solid #e5e7eb; padding: 12px; text-align: center;">Tidak ada data</td></tr>`;
            }

            htmlContent += `
                    </tbody>
                </table>
            `;

            await printReportHTML(htmlContent, { 
                title,
                dateRange: search ? `Pencarian: ${escapeHtml(search)}` : 'Semua Data'
            });
        } catch (error) {
            showAlert('Gagal', 'Terjadi kesalahan saat mengunduh laporan', 'error');
        } finally {
            setPrinting(false);
        }
    };

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/finance');
        }
    };

    const renderProcessDisbursementContent = () => {
        const selectedItem = pendingList?.find((i: any) => i.id === selectedId);
        const totalInput = payments.reduce((acc, curr) => acc + parseNumber(curr.nominal), 0);

        return (
            <View className="px-8 py-4">
                <Typography variant="h2" weight="bold" className="text-2xl tracking-tighter mb-2">Konfirmasi Pencairan</Typography>
                <Typography variant="body2" className="text-gray-500 mb-6 font-medium">
                    Anda akan memproses pencairan dana kepada investor. Nominal yang diajukan adalah sisa kewajiban.
                </Typography>

                <Card variant="outlined" className="p-6 mb-8 border-primary/20 bg-primary/5 rounded-[32px]">
                    <View className="flex-row items-center mb-3">
                        <View className="w-12 h-12 bg-primary/10 rounded-2xl items-center justify-center mr-4">
                            <Banknote size={24} color="#023C69" />
                        </View>
                        <View>
                            <Typography className="text-primary/60 text-[10px] uppercase font-bold tracking-widest mb-1">Sisa Wajib Cair</Typography>
                            <Typography variant="h2" weight="bold" className="text-primary text-2xl tracking-tighter">
                                {formatCurrency(selectedItem?.total_pencairan || 0)}
                            </Typography>
                        </View>
                    </View>
                    {totalInput > 0 && metode === 'SPLIT' && (
                        <View className="mt-4 pt-4 border-t border-primary/10 flex-row justify-between items-center">
                            <Typography variant="caption" weight="bold" className="text-primary/60 uppercase tracking-widest">Total Input</Typography>
                            <Typography variant="body1" weight="bold" className="text-primary">
                                {formatCurrency(totalInput)}
                            </Typography>
                        </View>
                    )}
                </Card>

                <View className="mb-8">
                    <Typography variant="caption" weight="bold" className="text-gray-500 mb-4 uppercase tracking-[2px] text-[10px]">Pilih Metode Pembayaran</Typography>
                    <View className="flex-row space-x-2 gap-2">
                        {['TUNAI', 'TRANSFER', 'SPLIT'].map((m: any) => (
                            <Pressable
                                key={m}
                                onPress={() => setMetode(m)}
                                className={`flex-1 h-14 items-center justify-center rounded-2xl border ${metode === m ? 'bg-primary border-primary shadow-lg shadow-primary/30' : 'bg-gray-50 border-gray-200'}`}
                            >
                                <Typography className={`text-xs font-bold ${metode === m ? 'text-white' : 'text-gray-500'}`}>{m}</Typography>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {metode === 'SPLIT' ? (
                    <View className="mb-8">
                        <View className="flex-row justify-between items-center mb-4 px-1">
                            <Typography variant="caption" weight="bold" className="text-gray-500 uppercase tracking-[2px] text-[10px]">Rincian Split Payment</Typography>
                            <Pressable 
                                onPress={handleAddPaymentRow}
                                className="bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/10 flex-row items-center"
                            >
                                <Plus size={14} color="#023C69" />
                                <Typography weight="bold" className="text-primary text-[10px] ml-1 uppercase">Tambah</Typography>
                            </Pressable>
                        </View>

                        {payments.map((p, index) => (
                            <Card key={index} variant="outlined" className="p-5 mb-4 border-gray-100 rounded-[24px]">
                                <View className="flex-row items-center justify-between mb-4">
                                    <View className="bg-gray-100 px-2 py-1 rounded-lg">
                                        <Typography weight="bold" className="text-gray-500 text-[9px] uppercase tracking-widest">Entry #{index + 1}</Typography>
                                    </View>
                                    {payments.length > 1 && (
                                        <Pressable 
                                            onPress={() => handleRemovePaymentRow(index)}
                                            className="w-8 h-8 bg-red-50 rounded-xl items-center justify-center"
                                        >
                                            <Trash2 size={16} color="#EF4444" />
                                        </Pressable>
                                    )}
                                </View>

                                <View className="flex-row space-x-2 gap-2 mb-4">
                                    {['TUNAI', 'TRANSFER'].map((m) => (
                                        <Pressable
                                            key={m}
                                            onPress={() => handleUpdatePayment(index, 'metode', m as 'TUNAI' | 'TRANSFER')}
                                            className={`flex-1 py-3 items-center rounded-xl border ${p.metode === m ? 'bg-primary border-primary shadow-md shadow-primary/20' : 'bg-gray-50 border-gray-100'}`}
                                        >
                                            <Typography variant="caption" weight="bold" className={p.metode === m ? 'text-white' : 'text-gray-400'}>{m}</Typography>
                                        </Pressable>
                                    ))}
                                </View>

                                <Input
                                    label="Nominal (Rp)"
                                    placeholder="0"
                                    keyboardType="numeric"
                                    value={p.nominal}
                                    onChangeText={(text) => handleUpdatePayment(index, 'nominal', formatNumber(text))}
                                    containerClassName="mb-0"
                                />
                            </Card>
                        ))}
                    </View>
                ) : (
                    <Input 
                        label="Nominal Pencairan"
                        placeholder="Opsional (Isi jika bayar parsial)"
                        keyboardType="numeric"
                        value={payments[0]?.nominal || ''}
                        onChangeText={(text) => handleUpdatePayment(0, 'nominal', formatNumber(text))}
                        startIcon={<CircleDollarSign size={18} color="#9CA3AF" />}
                        containerClassName="mb-6"
                    />
                )}

                <View className="flex-row gap-4 mb-6">
                    <View className="flex-1">
                        <Input 
                            label="Tanggal Cair"
                            placeholder="YYYY-MM-DD"
                            value={tanggal}
                            onChangeText={(text) => setTanggal(text)}
                            startIcon={<Calendar size={18} color="#9CA3AF" />}
                            containerClassName="mb-0"
                        />
                    </View>
                </View>

                <Input 
                    label="Catatan Pencairan"
                    placeholder="Tambahkan keterangan transaksi..."
                    value={catatan}
                    onChangeText={(text) => setCatatan(text)}
                    multiline
                    numberOfLines={2}
                    startIcon={<FileText size={18} color="#9CA3AF" />}
                    style={{ height: 60, textAlignVertical: 'top' }}
                    containerClassName="mb-8"
                />

                <View className="flex-row gap-3 mb-10">
                    <Button 
                        title="Batal" 
                        variant="outline" 
                        className="flex-1 h-14 rounded-2xl"
                        onPress={() => {
                            if (Platform.OS === 'web') {
                                setModalVisible(false);
                                setIsSheetOpen(false);
                            } else {
                                paymentSheetRef.current?.close();
                                setIsSheetOpen(false);
                            }
                        }}
                    />
                    <Button 
                        title={disburseMutation.isPending ? "Memproses..." : "Konfirmasi & Cairkan"}
                        className="flex-[2] h-14 rounded-2xl bg-primary shadow-xl shadow-primary/30"
                        loading={disburseMutation.isPending}
                        onPress={handleProcessDisbursement}
                    />
                </View>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-background">
            <StatusBar barStyle="dark-content" />

            {/* Global Header Integration */}
            <Header
                title="Pencairan Investor"
                subtitle="Kelola Kewajiban Dana Investor"
                showBackButton
                onBackButtonPress={handleGoBack}
                rightElement={
                    <View className="flex-row items-center">
                        <Pressable
                            onPress={handleDownloadReport}
                            disabled={printing}
                            className="w-11 h-11 bg-gray-50 rounded-2xl items-center justify-center border border-gray-100 active:bg-gray-100 mr-2"
                        >
                            {printing ? <ActivityIndicator size="small" color="#1F2937" /> : <Download size={20} color="#1F2937" />}
                        </Pressable>
                        <Pressable
                            onPress={onRefresh}
                            className="w-11 h-11 bg-gray-50 rounded-2xl items-center justify-center border border-gray-100 active:bg-gray-100"
                        >
                            <RefreshCw size={20} color="#1F2937" />
                        </Pressable>
                    </View>
                }
            />

            {/* Insight Card (Bento Light Style) */}
            <View className="flex-row justify-between mt-4 px-6">
                <View className="flex-1 bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm mr-2">
                    <Typography className="text-textGray/40 text-[10px] uppercase font-bold tracking-[1px] mb-2">Total Pending</Typography>
                    <Typography variant="h2" weight="bold" className="text-rose-600 text-lg tracking-tighter">
                        {formatCurrency(summary?.pending_total || 0)}
                    </Typography>
                    <Typography className="text-textGray/30 text-[9px] font-bold mt-1 uppercase tracking-wider">{summary?.pending_count || 0} Unit Mobil</Typography>
                </View>
                
                <View className="flex-1 bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm ml-2">
                    <Typography className="text-textGray/40 text-[10px] uppercase font-bold tracking-[1px] mb-2">Bulan Ini</Typography>
                    <Typography variant="h2" weight="bold" className="text-emerald-600 text-lg tracking-tighter">
                        {formatCurrency(summary?.disbursed_total || 0)}
                    </Typography>
                    <Typography className="text-textGray/30 text-[9px] font-bold mt-1 uppercase tracking-wider">{summary?.disbursed_count || 0} Pencairan</Typography>
                </View>
            </View>

            {/* Tab Navigation */}
            <View className="px-6 mt-4 z-10">
                <View className="bg-white p-2 rounded-[24px] shadow-sm flex-row items-center border border-gray-100">
                    <Pressable 
                        onPress={() => setActiveTab('PENDING')}
                        className={`flex-1 flex-row h-12 items-center justify-center rounded-2xl ${activeTab === 'PENDING' ? 'bg-primary shadow-sm' : 'bg-transparent'}`}
                    >
                        <CircleDollarSign size={18} color={activeTab === 'PENDING' ? 'white' : '#9CA3AF'} />
                        <Typography className={`ml-2 text-sm font-bold ${activeTab === 'PENDING' ? 'text-white' : 'text-gray-400'}`}>Tunggu Bayar</Typography>
                    </Pressable>
                    <Pressable 
                        onPress={() => setActiveTab('HISTORY')}
                        className={`flex-1 flex-row h-12 items-center justify-center rounded-2xl ${activeTab === 'HISTORY' ? 'bg-primary shadow-sm' : 'bg-transparent'}`}
                    >
                        <History size={18} color={activeTab === 'HISTORY' ? 'white' : '#9CA3AF'} />
                        <Typography className={`ml-2 text-sm font-bold ${activeTab === 'HISTORY' ? 'text-white' : 'text-gray-400'}`}>Riwayat</Typography>
                    </Pressable>
                </View>
            </View>

            {/* Search Bar Bento Style */}
            <View className="px-6 mt-4">
                <View className="bg-white p-2 rounded-[24px] flex-row items-center border border-gray-100 shadow-sm">
                    <View className="flex-1 flex-row items-center px-4 h-12 rounded-2xl bg-gray-50">
                        <Search size={18} color="#9CA3AF" />
                        <TextInput 
                            placeholder={`Cari di ${activeTab === 'PENDING' ? 'daftar tunggu' : 'riwayat'}...`} 
                            className="flex-1 ml-3 text-sm font-semibold text-textMain"
                            value={search}
                            onChangeText={setSearch}
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>
                </View>
            </View>

            <ScrollView
                className="flex-1 px-6"
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />}
            >
                {activeTab === 'PENDING' ? (
                    <>
                        <View className="flex-row items-center justify-between mb-4 px-1">
                            <Typography variant="h3" weight="bold" className="tracking-tight text-textMain">Daftar Tunggu</Typography>
                            {pendingList && pendingList.length > 0 && (
                                <Typography variant="caption" className="text-primary font-bold">{pendingList.length} Transaksi</Typography>
                            )}
                        </View>

                        {isLoadingList && !refreshing ? (
                            <View className="space-y-4">
                                <SkeletonCard />
                                <SkeletonCard />
                                <SkeletonCard />
                            </View>
                        ) : pendingList && pendingList.length > 0 ? (
                            pendingList.map((item: any) => (
                                <Card key={item.id} className="mb-4 p-5 rounded-[32px] border-gray-50 shadow-sm">
                                    <View className="flex-row justify-between items-start mb-4">
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
                                        <View className="bg-emerald-50 px-3 py-1.5 rounded-2xl border border-emerald-100">
                                            <Typography weight="bold" className="text-emerald-700 text-[10px]">READY TO PAY</Typography>
                                        </View>
                                    </View>

                                    <View className="bg-gray-50/50 rounded-3xl p-4 mb-4 border border-gray-100/50">
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
                                            <Typography className="text-textMain text-[11px] font-bold">TOTAL PENCAIRAN</Typography>
                                            <Typography variant="body2" weight="bold" className="text-primary">{formatCurrency(item.total_pencairan)}</Typography>
                                        </View>
                                    </View>

                                    <View className="flex-row items-center justify-between">
                                        <View className="flex-row items-center">
                                            <Calendar size={12} color="#9CA3AF" />
                                            <Typography variant="caption" className="text-gray-400 ml-1.5">Terjual: {formatDate(item.tanggal_jual)}</Typography>
                                        </View>
                                        <Button 
                                            title="Cairkan" 
                                            onPress={() => handleOpenModal(item)}
                                            size="sm"
                                            className="px-6 rounded-2xl shadow-sm"
                                        />
                                    </View>
                                </Card>
                            ))
                        ) : (
                            <EmptyState 
                                title="Semua Pencairan Terpenuhi" 
                                description="Tidak ada dana investor yang menunggu pencairan saat ini."
                                icon={CheckCircle2}
                            />
                        )}
                    </>
                ) : (
                    <>
                        <View className="flex-row items-center justify-between mb-4 px-1">
                            <Typography variant="h3" weight="bold" className="tracking-tight text-textMain">Riwayat Pencairan</Typography>
                            {historyData && historyData.length > 0 && (
                                <Typography variant="caption" className="text-primary font-bold">{historyData.length} Data</Typography>
                            )}
                        </View>

                        {isLoadingHistory && !refreshing ? (
                            <View className="space-y-4">
                                <SkeletonCard />
                                <SkeletonCard />
                                <SkeletonCard />
                            </View>
                        ) : historyData && historyData.length > 0 ? (
                            historyData.map((item: any) => (
                                <Card key={item.id} className="mb-4 p-5 rounded-[32px] border-gray-50 shadow-sm">
                                    <View className="flex-row justify-between items-start mb-3">
                                        <View className="flex-1 mr-3">
                                            <Typography variant="body2" weight="bold" className="text-primary">{formatCurrency(item.nominal)}</Typography>
                                            <View className="flex-row items-center mt-1">
                                                <Badge label={item.metode_bayar} variant={item.metode_bayar === 'TUNAI' ? 'warning' : 'info'} />
                                                {(item.catatan || '').toUpperCase().includes('[REVERSED]') && (
                                                    <View className="ml-2">
                                                        <Badge label="REVERSED" variant="error" />
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                        <Typography variant="caption" className="text-gray-400">{formatDateTime(item.created_at || item.tanggal)}</Typography>
                                    </View>
                                    
                                    <Typography variant="caption" className="text-gray-500 mb-2" numberOfLines={1}>
                                        {item.catatan || 'Tidak ada catatan'}
                                    </Typography>
                                    
                                    <View className="h-[1px] bg-gray-100 my-2" />
                                    
                                    <View className="flex-row items-center">
                                        <Car size={12} color="#9CA3AF" className="mr-1.5" />
                                        <Typography variant="caption" className="text-gray-400">Ref: {item.transaksi?.nomor_transaksi || '-'}</Typography>
                                    </View>

                                    {!!(item.transaksi?.id || item.transaksi_id) && (
                                        <View className="mt-4 flex-row justify-end">
                                            <Button
                                                title={reverseMutation.isPending ? 'Memproses...' : 'Reversal'}
                                                onPress={() => handleReverseDisbursement(item)}
                                                variant="outline"
                                                size="sm"
                                                disabled={reverseMutation.isPending}
                                                className="rounded-full px-4"
                                            />
                                        </View>
                                    )}
                                </Card>
                            ))
                        ) : (
                            <EmptyState 
                                title="Belum Ada Riwayat" 
                                description="Riwayat pencairan dana investor akan tampil di sini."
                                icon={History}
                            />
                        )}
                    </>
                )}
                
                <View className="h-10" />
            </ScrollView>

            {/* Disbursement Process UI Upgraded to Premium Style */}
            {Platform.OS === 'web' ? (
                <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => {
                    setModalVisible(false);
                    setIsSheetOpen(false);
                }}>
                    <View className="flex-1 justify-end bg-black/40">
                        <Pressable className="absolute inset-0" onPress={() => {
                            setModalVisible(false);
                            setIsSheetOpen(false);
                        }} />
                        <View className="bg-white rounded-t-[48px] w-full max-w-[640px] h-[85%] self-center p-0 overflow-hidden shadow-2xl relative">
                            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                {renderProcessDisbursementContent()}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            ) : (
                <BottomSheet
                    ref={paymentSheetRef}
                    index={-1}
                    snapPoints={paymentSnapPoints}
                    enablePanDownToClose
                    enableContentPanningGesture
                    keyboardBehavior="interactive"
                    keyboardBlurBehavior="restore"
                    android_keyboardInputMode="adjustResize"
                    backgroundStyle={{ borderRadius: 48, backgroundColor: 'white' }}
                    topInset={insets.top}
                    onChange={(index) => setIsSheetOpen(index !== -1)}
                >
                    <BottomSheetScrollView
                        contentContainerStyle={{ paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 48) }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator
                    >
                        {renderProcessDisbursementContent()}
                    </BottomSheetScrollView>
                </BottomSheet>
            )}

            <AlertDialog 
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                variant={alertState.variant}
                onClose={() => setAlertState(prev => ({ ...prev, visible: false }))}
            />
        </View>
    );
}
