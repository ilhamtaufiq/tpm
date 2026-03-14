import React, { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, RefreshControl, ActivityIndicator, Image, Platform, TextInput } from 'react-native';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
    ChevronLeft,
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
import { formatCurrency, formatDate, formatDateTime, formatNumber, parseNumber } from '../../utils/format';
import { 
    usePendingInvestorDisbursements, 
    useInvestorDisbursementSummary, 
    useProcessInvestorDisbursement, 
    useInvestorDisbursementHistory 
} from '../../hooks/useKeuangan';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { BaseModal } from '../../components/ui/BaseModal';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { printReportHTML } from '../../utils/printReport';

export default function PencairanInvestorScreen() {
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
    const [printing, setPrinting] = useState(false);

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

    const { 
        data: historyData, 
        isLoading: isLoadingHistory, 
        refetch: refetchHistory 
    } = useInvestorDisbursementHistory({ search: search || undefined });

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
        setModalVisible(true);
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
                if (payments[0]?.nominal) {
                    requestData.nominal = parseNumber(payments[0].nominal);
                }
            }

            await disburseMutation.mutateAsync({
                transaksiId: selectedId,
                data: requestData
            });

            setModalVisible(false);
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
                            <td style="border: 1px solid #e5e7eb; padding: 12px;">${item.nama_investor || (item.transaksi?.mobil?.nama_investor || '-')}</td>
                            <td style="border: 1px solid #e5e7eb; padding: 12px;">${item.mobil || (item.transaksi?.mobil?.merek + ' ' + item.transaksi?.mobil?.model || '-')}</td>
                            <td style="border: 1px solid #e5e7eb; padding: 12px; text-align: right;">${formatCurrency(activeTab === 'PENDING' ? item.total_pencairan : item.nominal)}</td>
                            ${activeTab === 'HISTORY' ? `<td style="border: 1px solid #e5e7eb; padding: 12px;">${item.metode_bayar}</td>` : ''}
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
                dateRange: search ? `Pencarian: ${search}` : 'Semua Data' 
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

    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            {/* Premium Header (Design System Stitch UI) */}
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
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Pencairan Investor</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Kelola Kewajiban Dana Investor</Typography>
                        </View>
                    </View>
                    <View className="flex-row items-center">
                        <TouchableOpacity
                            onPress={handleDownloadReport}
                            disabled={printing}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5 mr-2"
                        >
                            {printing ? <ActivityIndicator size="small" color="white" /> : <Download size={20} color="white" />}
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={onRefresh}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                        >
                            <RefreshCw size={20} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Insight Card (Glassmorphism Bento) */}
                <View className="flex-row justify-between mb-2">
                    <View className="flex-1 bg-white/10 p-5 rounded-[32px] border border-white/10 mr-2">
                        <Typography className="text-white/40 text-[10px] uppercase font-bold tracking-[1px] mb-2">Total Pending</Typography>
                        <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">
                            {formatCurrency(summary?.pending_total || 0)}
                        </Typography>
                        <Typography className="text-white/30 text-[10px] mt-1">{summary?.pending_count || 0} Unit Mobil</Typography>
                    </View>
                    
                    <View className="flex-1 bg-white/5 p-5 rounded-[32px] border border-white/5 ml-2">
                        <Typography className="text-white/40 text-[10px] uppercase font-bold tracking-[1px] mb-2">Bulan Ini</Typography>
                        <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">
                            {formatCurrency(summary?.disbursed_total || 0)}
                        </Typography>
                        <Typography className="text-white/30 text-[10px] mt-1">{summary?.disbursed_count || 0} Pencairan</Typography>
                    </View>
                </View>
            </View>

            {/* Tab Navigation */}
            <View className="px-6 -mt-6 z-10">
                <View className="bg-white p-2 rounded-[32px] shadow-xl flex-row items-center border border-gray-50">
                    <TouchableOpacity 
                        onPress={() => setActiveTab('PENDING')}
                        className={`flex-1 flex-row h-14 items-center justify-center rounded-3xl ${activeTab === 'PENDING' ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-transparent'}`}
                    >
                        <CircleDollarSign size={18} color={activeTab === 'PENDING' ? 'white' : '#9CA3AF'} />
                        <Typography className={`ml-2 text-sm font-bold ${activeTab === 'PENDING' ? 'text-white' : 'text-gray-400'}`}>Tunggu Bayar</Typography>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('HISTORY')}
                        className={`flex-1 flex-row h-14 items-center justify-center rounded-3xl ${activeTab === 'HISTORY' ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-transparent'}`}
                    >
                        <History size={18} color={activeTab === 'HISTORY' ? 'white' : '#9CA3AF'} />
                        <Typography className={`ml-2 text-sm font-bold ${activeTab === 'HISTORY' ? 'text-white' : 'text-gray-400'}`}>Riwayat</Typography>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Search Bar Bento Style */}
            <View className="px-6 mt-6 mb-6">
                <View className="bg-gray-50/50 p-2 rounded-[32px] flex-row items-center border border-gray-100">
                    <View className="flex-1 flex-row items-center px-4 h-12 rounded-3xl">
                        <Search size={18} color="#9CA3AF" />
                        <TextInput 
                            placeholder={`Cari di ${activeTab === 'PENDING' ? 'daftar tunggu' : 'riwayat'}...`} 
                            className="flex-1 ml-3 text-sm font-medium"
                            value={search}
                            onChangeText={setSearch}
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

            {/* Disbursement Process Modal */}
            <BaseModal 
                visible={modalVisible} 
                onClose={() => setModalVisible(false)} 
                title="Konfirmasi Pencairan"
            >
                <ScrollView showsVerticalScrollIndicator={false}>
                    <Typography variant="body2" className="text-gray-500 mb-6 font-medium">
                        Anda akan memproses pencairan dana kepada investor. Nominal yang diajukan adalah sisa kewajiban.
                    </Typography>

                    <Card variant="outlined" className="p-5 mb-8 border-primary/20 bg-primary/5 rounded-[32px]">
                        <View className="flex-row items-center mb-3">
                            <View className="w-10 h-10 bg-primary/10 rounded-2xl items-center justify-center mr-3">
                                <Banknote size={20} color="#023C69" />
                            </View>
                            <View>
                                <Typography className="text-primary/60 text-[10px] uppercase font-bold tracking-widest">Sisa Wajib Cair</Typography>
                                {(() => {
                                    const selectedItem = pendingList?.find((i: any) => i.id === selectedId);
                                    return (
                                        <Typography variant="h2" weight="bold" className="text-primary text-2xl tracking-tighter">
                                            {formatCurrency(selectedItem?.total_pencairan || 0)}
                                        </Typography>
                                    );
                                })()}
                            </View>
                        </View>
                    </Card>

                    <View className="mb-6">
                        <Typography variant="caption" weight="bold" className="text-gray-500 mb-3 uppercase tracking-widest">Pilih Metode</Typography>
                        <View className="flex-row space-x-2">
                            {['TUNAI', 'TRANSFER', 'SPLIT'].map((m: any) => (
                                <TouchableOpacity
                                    key={m}
                                    onPress={() => setMetode(m)}
                                    className={`flex-1 flex-row h-12 items-center justify-center rounded-2xl border ${metode === m ? 'bg-primary border-primary shadow-md shadow-primary/30' : 'bg-gray-50 border-gray-200'}`}
                                >
                                    <Typography className={`text-[10px] font-bold ${metode === m ? 'text-white' : 'text-gray-500'}`}>{m}</Typography>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {metode === 'SPLIT' ? (
                        <View className="mb-8">
                            <Typography variant="caption" weight="bold" className="text-gray-500 mb-3 uppercase tracking-widest">Rincian Pembayaran</Typography>
                            {payments.map((p, index) => (
                                <View key={index} className="flex-row items-center mb-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                    <TouchableOpacity 
                                        onPress={() => handleUpdatePayment(index, 'metode', p.metode === 'TUNAI' ? 'TRANSFER' : 'TUNAI')}
                                        className="bg-primary/10 px-3 py-2 rounded-xl border border-primary/10 mr-3 min-w-[80px] items-center"
                                    >
                                        <Typography weight="bold" className="text-primary text-[10px]">{p.metode}</Typography>
                                    </TouchableOpacity>
                                    <View className="flex-1">
                                        <TextInput
                                            placeholder="Nominal"
                                            className="text-sm font-bold text-textMain py-1"
                                            keyboardType="numeric"
                                            value={p.nominal}
                                            onChangeText={(text) => handleUpdatePayment(index, 'nominal', formatNumber(text))}
                                        />
                                    </View>
                                    {payments.length > 1 && (
                                        <TouchableOpacity 
                                            onPress={() => handleRemovePaymentRow(index)}
                                            className="ml-2 w-8 h-8 bg-red-50 rounded-xl items-center justify-center border border-red-100"
                                        >
                                            <Trash2 size={14} color="#EF4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}
                            <TouchableOpacity 
                                onPress={handleAddPaymentRow}
                                className="flex-row items-center justify-center py-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/30"
                            >
                                <Plus size={16} color="#9CA3AF" />
                                <Typography className="ml-2 text-xs font-bold text-gray-400">Tambah Metode Lain</Typography>
                            </TouchableOpacity>
                            
                            <View className="mt-4 flex-row justify-between px-2">
                                <Typography weight="bold" className="text-gray-400 text-xs uppercase">Total Input</Typography>
                                <Typography weight="bold" className="text-primary text-sm">
                                    {formatCurrency(payments.reduce((acc, curr) => acc + parseNumber(curr.nominal), 0))}
                                </Typography>
                            </View>
                        </View>
                    ) : (
                        <Input 
                            label="Nominal"
                            placeholder="Opsional (Isi jika parsial)"
                            keyboardType="numeric"
                            value={payments[0]?.nominal || ''}
                            onChangeText={(text) => handleUpdatePayment(0, 'nominal', formatNumber(text))}
                            startIcon={<CircleDollarSign size={18} color="#9CA3AF" />}
                            containerClassName="mb-6"
                        />
                    )}

                    <Input 
                        label="Tanggal Pencairan"
                        placeholder="YYYY-MM-DD"
                        value={tanggal}
                        onChangeText={(text) => setTanggal(text)}
                        startIcon={<Calendar size={18} color="#9CA3AF" />}
                        containerClassName="mb-6"
                    />

                    <Input 
                        label="Catatan"
                        placeholder="Tambahkan keterangan..."
                        value={catatan}
                        onChangeText={(text) => setCatatan(text)}
                        multiline
                        numberOfLines={3}
                        startIcon={<FileText size={18} color="#9CA3AF" />}
                        style={{ height: 80, textAlignVertical: 'top' }}
                        containerClassName="mb-8"
                    />

                    <View className="flex-row mb-6">
                        <Button 
                            title="Batal" 
                            variant="outline" 
                            className="flex-1 h-12 rounded-2xl mr-3"
                            onPress={() => setModalVisible(false)}
                        />
                        <Button 
                            title={disburseMutation.isPending ? "Memproses..." : "Konfirmasi & Cairkan"}
                            className="flex-[2] h-12 rounded-2xl bg-primary shadow-lg shadow-primary/30"
                            loading={disburseMutation.isPending}
                            onPress={handleProcessDisbursement}
                        />
                    </View>
                </ScrollView>
            </BaseModal>

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
