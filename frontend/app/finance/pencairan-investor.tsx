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
} from 'lucide-react-native';
import { useRouter, router } from 'expo-router';
import { formatCurrency, formatDate, formatNumber, parseNumber } from '../../utils/format';
import { 
    usePendingInvestorDisbursements, 
    useInvestorDisbursementSummary, 
    useProcessInvestorDisbursement 
} from '../../hooks/useKeuangan';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { BaseModal } from '../../components/ui/BaseModal';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

export default function PencairanInvestorScreen() {
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    // Form states
    const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
    const [metode, setMetode] = useState<'TUNAI' | 'TRANSFER'>('TRANSFER');
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

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetchList(), refetchSummary()]);
        setRefreshing(false);
    }, [refetchList, refetchSummary]);

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
            await disburseMutation.mutateAsync({
                transaksiId: selectedId,
                data: {
                    metode_bayar: metode,
                    tanggal,
                    catatan,
                }
            });

            setModalVisible(false);
            showAlert('Sukses', 'Dana investor berhasil dicairkan dan tercatat di KasBank.', 'success');
            setSelectedId(null);
        } catch (error: any) {
            const errorMessage = error?.response?.data?.detail || error?.message || 'Gagal memproses pencairan';
            showAlert('Gagal', errorMessage, 'error');
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
                    <TouchableOpacity
                        onPress={onRefresh}
                        className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                    >
                        <RefreshCw size={20} color="white" />
                    </TouchableOpacity>
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

            {/* Search Bar Bento Style */}
            <View className="px-6 -mt-6 z-10 mb-6">
                <View className="bg-white p-2 rounded-[32px] shadow-xl flex-row items-center border border-gray-50">
                    <View className="flex-1 flex-row items-center px-4 bg-gray-50 h-14 rounded-3xl border border-gray-100">
                        <Search size={18} color="#9CA3AF" />
                        <TextInput 
                            placeholder="Cari nama investor..." 
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
                
                <View className="h-10" />
            </ScrollView>

            {/* Disbursement Process Modal */}
            <BaseModal 
                visible={modalVisible} 
                onClose={() => setModalVisible(false)} 
                title="Konfirmasi Pencairan"
            >
                <View>
                    <Typography variant="body2" className="text-gray-500 mb-6">
                        Pastikan Anda telah menyiapkan dana untuk dibayarkan kepada investor. Aksi ini akan mengurangi saldo kas perusahaan.
                    </Typography>

                    <Card variant="outlined" className="p-5 mb-8 border-primary/10 bg-primary/5 rounded-[32px]">
                        <View className="flex-row items-center mb-3">
                            <View className="w-10 h-10 bg-primary/10 rounded-2xl items-center justify-center mr-3">
                                <Banknote size={20} color="#023C69" />
                            </View>
                            <View>
                                <Typography className="text-primary/60 text-[10px] uppercase font-bold tracking-widest">Nominal Pencairan</Typography>
                                <Typography variant="h2" weight="bold" className="text-primary text-2xl tracking-tighter">
                                    {formatCurrency(pendingList?.find((i: any) => i.id === selectedId)?.total_pencairan || 0)}
                                </Typography>
                            </View>
                        </View>
                    </Card>

                    <View className="mb-6">
                        <Typography variant="caption" weight="bold" className="text-gray-500 mb-3 uppercase tracking-widest">Metode Pembayaran</Typography>
                        <View className="flex-row space-x-3">
                            {['TUNAI', 'TRANSFER'].map((m: any) => (
                                <TouchableOpacity
                                    key={m}
                                    onPress={() => setMetode(m)}
                                    className={`flex-1 flex-row h-14 items-center justify-center rounded-2xl border ${metode === m ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-200'}`}
                                >
                                    {m === 'TUNAI' ? <Wallet size={16} color={metode === m ? 'white' : '#6B7281'} /> : <ArrowUpRight size={16} color={metode === m ? 'white' : '#6B7281'} />}
                                    <Typography className={`ml-2 text-xs font-bold ${metode === m ? 'text-white' : 'text-gray-500'}`}>{m}</Typography>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

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

                    <View className="flex-row space-x-3">
                        <Button 
                            title="Batal" 
                            variant="outline" 
                            className="flex-1 h-14 rounded-3xl"
                            onPress={() => setModalVisible(false)}
                        />
                        <Button 
                            title={disburseMutation.isPending ? "Memproses..." : "Konfirmasi & Cairkan"}
                            className="flex-[2] h-14 rounded-3xl shadow-lg shadow-primary/30"
                            loading={disburseMutation.isPending}
                            onPress={handleProcessDisbursement}
                        />
                    </View>
                </View>
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
