import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, RefreshControl, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
    ChevronLeft,
    Plus,
    Search,
    Truck,
    Clock,
    CheckCircle2,
    Users,
    Wallet,
    ArrowUpRight,
    MapPin,
    ArrowRight,
    RefreshCw,
    Edit
} from 'lucide-react-native';
import { useRouter, router } from 'expo-router';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { formatCurrency, formatDate } from '../../utils/format';
import { Muatan, jasaAngkutService } from '../../services/jasaAngkut';
import { MuatanForm } from '../../components/jasa-angkut/MuatanForm';
import { useMuatanList, useMuatanSummary } from '../../hooks/useJasaAngkut';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { BaseModal } from '../../components/ui/BaseModal';
import { getErrorMessage } from '../../utils/error';

export default function JasaAngkutScreen() {

    // API Hooks
    const { data: muatanData, isLoading, refetch } = useMuatanList({ limit: 10 });
    const { data: summaryData } = useMuatanSummary();

    const [refreshing, setRefreshing] = useState(false);
    const [selectedTrip, setSelectedTrip] = useState<Muatan | null>(null);
    const [view, setView] = useState<'form' | 'detail'>('form');

    // Dialog State
    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
        type: 'alert' | 'confirm';
        onConfirm?: () => void;
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info',
        type: 'alert'
    });
    const [actionLoading, setActionLoading] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [sheetIndex, setSheetIndex] = useState(-1);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentItemId, setPaymentItemId] = useState<number | null>(null);
    const [editData, setEditData] = useState<Muatan | null>(null);

    const recentTrips = muatanData?.data || [];
    const backendStats = summaryData || {};
    const stats = {
        total: backendStats.total_transaksi || 0,
        lunas: (backendStats.total_transaksi || 0) - (backendStats.hutang_supir_count || 0),
        pending: backendStats.hutang_supir_count || 0,
        revenue: backendStats.total_pendapatan || 0,
        profit: backendStats.laba_tpm || 0
    };

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/home');
        }
    };

    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['75%', '90%'], []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    const handleFormSuccess = () => {
        handleCloseSheet();
        refetch();
    };

    const handlePresentModal = (type: 'form' | 'detail', item?: Muatan) => {
        setView(type);
        if (type === 'form') setEditData(null); // Reset edit data when manually opening form
        if (item) setSelectedTrip(item);

        if (Platform.OS === 'web') {
            if (type === 'form') setIsFormOpen(true);
            else setIsDetailOpen(true);
        } else {
            bottomSheetRef.current?.expand();
        }
    };

    const handleCloseSheet = useCallback(() => {
        if (Platform.OS === 'web') {
            setIsFormOpen(false);
            setIsDetailOpen(false);
        } else {
            bottomSheetRef.current?.close();
        }
        setIsPaymentModalOpen(false);
        setSelectedTrip(null);
        setPaymentItemId(null);
        setEditData(null);
    }, []);

    const handleEdit = (item: Muatan) => {
        setEditData(item);
        if (Platform.OS === 'web') {
            setIsDetailOpen(false);
            setTimeout(() => setIsFormOpen(true), 100);
        } else {
            // For mobile bottom sheet, we just switch view state
            setView('form');
            // Ensure sheet is open
            bottomSheetRef.current?.expand();
        }
    };

    const handleMarkPaid = (id: number) => {
        setPaymentItemId(id);
        setIsPaymentModalOpen(true);
    };

    const processPayment = async (id: number, metode: string) => {
        try {
            setActionLoading(true);
            await jasaAngkutService.markPaid(id, metode);
            handleCloseSheet();
            refetch();

            setActionLoading(false);
            setDialogConfig({
                visible: true,
                title: "Sukses",
                message: `Transaksi berhasil dilunasi via ${metode.toUpperCase()}`,
                variant: 'success',
                type: 'alert'
            });
        } catch (error) {
            console.error("Gagal melunasi:", error);
            setActionLoading(false);
            setDialogConfig({
                visible: true,
                title: "Gagal",
                message: getErrorMessage(error, "Gagal memperbarui status pembayaran"),
                variant: 'error',
                type: 'alert'
            });
        }
    };

    const handleDeleteTrip = (id: number) => {
        setDialogConfig({
            visible: true,
            title: "Hapus Muatan",
            message: "Apakah Anda yakin ingin menghapus data muatan ini? Data yang dihapus tidak dapat dikembalikan.",
            variant: 'error',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    setActionLoading(true);
                    await jasaAngkutService.deleteMuatan(id);
                    handleCloseSheet();
                    refetch();
                    closeDialog();
                } catch (error) {
                    console.error("Gagal menghapus:", error);
                    setTimeout(() => {
                        setDialogConfig({
                            visible: true,
                            title: "Error",
                            message: getErrorMessage(error, "Gagal menghapus data muatan"),
                            variant: 'error',
                            type: 'alert'
                        });
                    }, 500);
                } finally {
                    setActionLoading(false);
                }
            }
        });
    };

    const closeDialog = () => {
        setDialogConfig(prev => ({ ...prev, visible: false }));
    };

    function renderDetailContent(trip: Muatan) {
        const ScrollContainer = Platform.OS === 'web' ? ScrollView : BottomSheetScrollView;

        return (
            <ScrollContainer style={{ flex: 1 }}>
                <View className="p-8">
                    <View className="flex-row justify-between items-start mb-6">
                        <View>
                            <Typography variant="h2" weight="bold" className="text-2xl tracking-tighter">{trip.tujuan}</Typography>
                            <Typography variant="body2" className="text-textGray mt-1">
                                #{trip.nomor_transaksi}
                            </Typography>
                        </View>
                        <Badge
                            label={trip.status_bayar.toUpperCase()}
                            variant={trip.status_bayar === 'Lunas' ? 'success' : 'warning'}
                        />
                    </View>

                    <Card variant="outlined" className="p-6 border-gray-100 mb-6 bg-gray-50/50 rounded-[32px]">
                        <Typography variant="caption" weight="bold" className="mb-4 text-primary uppercase tracking-widest">Informasi Rute</Typography>
                        <View className="flex-row items-center mb-4">
                            <View className="w-10 h-10 bg-primary/10 rounded-xl items-center justify-center mr-4">
                                <MapPin size={20} color="#10B981" />
                            </View>
                            <View>
                                <Typography variant="caption" className="text-textGray">Titik Asal</Typography>
                                <Typography weight="bold" className="text-textMain">{trip.asal}</Typography>
                            </View>
                        </View>
                        <View className="w-[1px] h-6 bg-gray-200 ml-5 my-1" />
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 bg-secondary/10 rounded-xl items-center justify-center mr-4">
                                <MapPin size={20} color="#3B82F6" />
                            </View>
                            <View>
                                <Typography variant="caption" className="text-textGray">Tujuan Akhir</Typography>
                                <Typography weight="bold" className="text-textMain">{trip.tujuan}</Typography>
                            </View>
                        </View>
                        <View className="mt-4 pt-4 border-t border-gray-100 flex-row justify-between">
                            <View>
                                <Typography variant="caption" className="text-textGray">Nama Supir</Typography>
                                <Typography weight="bold" className="text-textMain">{trip.supir_nama || trip.supir?.nama || trip.supir_nama_manual || '-'}</Typography>
                            </View>
                            <View className="items-end">
                                <Typography variant="caption" className="text-textGray">Tanggal Input</Typography>
                                <Typography weight="bold" className="text-textMain">{formatDate(trip.tanggal)}</Typography>
                            </View>
                        </View>
                    </Card>

                    <Card variant="outlined" className="p-6 border-gray-100 mb-8 rounded-[32px]">
                        <Typography variant="caption" weight="bold" className="mb-4 text-slate-500 uppercase tracking-widest">Analisa Laba Rugi</Typography>
                        <View className="flex-row justify-between mb-3">
                            <Typography variant="body2" className="text-textGray">Pendapatan Kotor</Typography>
                            <Typography weight="bold" className="text-textMain">{formatCurrency(trip.pendapatan_kotor)}</Typography>
                        </View>
                        <View className="flex-row justify-between mb-3">
                            <Typography variant="body2" className="text-textGray">Bengkel (Integrasi)</Typography>
                            <Typography weight="bold" className="text-rose-500">
                                -{formatCurrency(
                                    (trip.biaya_tambahan || [])
                                        .filter((b: any) => b.kategori === 'Perawatan Bengkel')
                                        .reduce((acc: number, curr: any) => acc + Number(curr.jumlah), 0)
                                )}
                            </Typography>
                        </View>
                        <View className="flex-row justify-between mb-3">
                            <Typography variant="body2" className="text-textGray">Biaya Operasional</Typography>
                            <Typography weight="bold" className="text-rose-500">
                                -{formatCurrency(
                                    ((trip.biaya_tambahan && trip.biaya_tambahan.length > 0)
                                        ? (trip.biaya_tambahan || [])
                                            .filter((b: any) => b.kategori === 'Operasional')
                                            .reduce((acc: number, curr: any) => acc + Number(curr.jumlah), 0)
                                        : (Number(trip.biaya_bbm || 0) + Number(trip.biaya_tol || 0) + Number(trip.biaya_makan || 0) + Number(trip.biaya_parkir || 0) + Number(trip.biaya_lainnya || 0))
                                    )
                                )}
                            </Typography>
                        </View>
                        <View className="h-[1px] bg-gray-100 my-4" />
                        <View className="flex-row justify-between mb-3 bg-primary/5 p-3 rounded-xl">
                            <Typography variant="body2" weight="bold" className="text-primary">Laba TPM ({trip.persentase_tpm}%)</Typography>
                            <Typography weight="bold" className="text-primary">{formatCurrency(trip.laba_tpm)}</Typography>
                        </View>
                        <View className="flex-row justify-between p-3">
                            <Typography variant="body2" className="text-textGray">Jatah Mandor/Supir</Typography>
                            <Typography weight="bold" className="text-blue-600">{formatCurrency(trip.laba_supir)}</Typography>
                        </View>
                    </Card>

                    <View className="space-y-4">
                        <Button
                            variant="outline"
                            title="Edit Muatan"
                            onPress={() => handleEdit(trip)}
                            className="rounded-2xl h-14"
                            icon={<Edit size={20} color="#00AA13" />}
                        />
                        {trip.status_bayar !== 'Lunas' && (
                            <Button
                                title="Konfirmasi Pelunasan"
                                onPress={() => handleMarkPaid(trip.id)}
                                className="rounded-2xl h-14"
                            />
                        )}
                        {trip.status_bayar !== 'Lunas' && (
                            <Button
                                variant="outline-danger"
                                title="Hapus Data Muatan"
                                onPress={() => handleDeleteTrip(trip.id)}
                                className="rounded-2xl h-14"
                            />
                        )}
                        <Button
                            variant="ghost"
                            title="Tutup Panel"
                            onPress={handleCloseSheet}
                            className="rounded-2xl h-12"
                        />
                    </View>
                </View>
            </ScrollContainer>
        );
    }

    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            {/* Premium Header (Design System) */}
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
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Jasa Angkut</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Manajemen Ritase & Logistik</Typography>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={() => router.push('/jasa-angkut/supir')}
                        className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                    >
                        <Users size={22} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Main Insight Card (Glassmorphism) */}
                <View className="bg-white/10 p-6 rounded-[32px] border border-white/10">
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="bg-emerald-500/20 px-3 py-1.5 rounded-full border border-emerald-500/20">
                            <Typography className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Profit TPM</Typography>
                        </View>
                        <Typography className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Stats Bulan Ini</Typography>
                    </View>
                    <View className="flex-row items-center justify-between">
                        <View>
                            <Typography variant="h1" weight="bold" className="text-white text-3xl tracking-tighter">
                                {formatCurrency(stats.profit)}
                            </Typography>
                            <Typography className="text-white/40 text-xs mt-1">Estimasi Laba Masuk</Typography>
                        </View>
                        <View className="bg-white/10 p-4 rounded-2xl border border-white/10">
                            <ArrowUpRight size={24} color="white" />
                        </View>
                    </View>

                    {/* Bento Stats Inside Header */}
                    <View className="h-[1px] bg-white/10 my-6" />
                    <View className="flex-row justify-between">
                        <View className="flex-1">
                            <Typography className="text-white/30 text-[9px] uppercase font-bold mb-1 tracking-widest">Total Trip</Typography>
                            <Typography weight="bold" className="text-white text-lg">{stats.total}</Typography>
                        </View>
                        <View className="flex-1 items-center border-x border-white/5">
                            <Typography className="text-white/30 text-[9px] uppercase font-bold mb-1 tracking-widest">Revenue</Typography>
                            <Typography weight="bold" className="text-white text-lg">{formatCurrency(stats.revenue)}</Typography>
                        </View>
                        <View className="flex-1 items-end">
                            <Typography className="text-white/30 text-[9px] uppercase font-bold mb-1 tracking-widest">Pending</Typography>
                            <Typography weight="bold" className="text-amber-400 text-lg">{stats.pending}</Typography>
                        </View>
                    </View>
                </View>
            </View>

            {/* Floating Search & Filter Overlay */}
            {(!isFormOpen && !isDetailOpen && sheetIndex === -1) && (
                <View className="px-6 -mt-8 z-10">
                    <View className="bg-white p-2 rounded-3xl shadow-xl flex-row items-center border border-gray-50">
                        <View className="flex-1 flex-row items-center px-4 bg-gray-50 h-12 rounded-2xl border border-gray-100">
                            <Search size={18} color="#9CA3AF" />
                            <Typography className="ml-3 text-sm text-gray-400 font-medium">Cari riwayat ritase...</Typography>
                        </View>
                        <TouchableOpacity className="ml-2 w-12 h-12 bg-primary/10 rounded-2xl items-center justify-center">
                            <RefreshCw size={20} color="#00AA13" />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <ScrollView
                className="flex-1 px-6 pt-10"
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00AA13" />}
            >
                {/* Section Title */}
                <View className="flex-row justify-between items-center mb-6">
                    <View>
                        <Typography variant="h3" weight="bold" className="tracking-tight">Riwayat Ritase</Typography>
                        <Typography variant="caption" className="text-textGray mt-0.5">Aktivitas pemuatan terakhir</Typography>
                    </View>
                    <Badge variant="neutral" label="TERBARU" />
                </View>

                {/* Trip List */}
                {isLoading ? (
                    <View className="space-y-6">
                        <SkeletonCard className="rounded-[32px] h-32" />
                        <SkeletonCard className="rounded-[32px] h-32" />
                        <SkeletonCard className="rounded-[32px] h-32" />
                    </View>
                ) : recentTrips.length === 0 ? (
                    <View className="mt-10">
                        <EmptyState
                            title="Belum ada data"
                            description="Mulai catat transaksi muatan pertama Anda hari ini."
                            icon={Truck}
                        />
                    </View>
                ) : (
                    recentTrips.map((trip: any) => (
                        <TouchableOpacity
                            key={trip.id}
                            onPress={() => handlePresentModal('detail', trip)}
                            activeOpacity={0.9}
                            className="bg-white p-5 rounded-[32px] mb-6 border border-gray-50 shadow-sm flex-row items-center"
                        >
                            {/* Visual ID Slot */}
                            <View className="w-16 h-16 bg-emerald-50 rounded-[20px] items-center justify-center mr-4 border border-emerald-100/50">
                                <Truck size={28} color="#10B981" strokeWidth={2} />
                            </View>

                            <View className="flex-1">
                                {/* Main Info + Status */}
                                <View className="flex-row items-center justify-between mb-2">
                                    <View className="flex-1 mr-2">
                                        <Typography variant="body1" weight="bold" className="text-textMain tracking-tight" numberOfLines={1}>
                                            {trip.tujuan}
                                        </Typography>
                                    </View>
                                    <View className={trip.status_bayar === 'Lunas' ? "bg-emerald-50 px-2 py-1 rounded-lg" : "bg-amber-50 px-2 py-1 rounded-lg"}>
                                        <Typography weight="bold" className={trip.status_bayar === 'Lunas' ? "text-emerald-600 text-[9px]" : "text-amber-600 text-[9px]"}>
                                            {trip.status_bayar.toUpperCase()}
                                        </Typography>
                                    </View>
                                </View>

                                {/* Trip Details */}
                                <Typography variant="caption" className="text-textGray mb-3">
                                    {trip.supir_nama} • {trip.asal} <ArrowRight size={10} color="#9CA3AF" /> {trip.tujuan}
                                </Typography>

                                {/* Footer Row */}
                                <View className="flex-row items-center justify-between pt-3 border-t border-gray-50">
                                    <View className="flex-row items-center">
                                        <Clock size={12} color="#9CA3AF" />
                                        <Typography className="text-textGray/60 text-[10px] ml-1.5 font-bold uppercase tracking-widest">
                                            {formatDate(trip.tanggal)}
                                        </Typography>
                                    </View>
                                    <Typography weight="bold" className="text-primary text-sm">
                                        {formatCurrency(trip.pendapatan_kotor)}
                                    </Typography>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
                <View className="h-32" />
            </ScrollView>

            {/* Floating Action Button */}
            <TouchableOpacity
                onPress={() => handlePresentModal('form')}
                activeOpacity={0.8}
                className="absolute bottom-10 right-6 w-16 h-16 bg-primary rounded-full items-center justify-center shadow-2xl shadow-primary border-4 border-white/20"
            >
                <Plus size={32} color="white" strokeWidth={3} />
            </TouchableOpacity>

            {/* Bottom Sheet UI */}
            {Platform.OS === 'web' ? (
                <>
                    <Modal visible={isFormOpen} transparent animationType="slide" onRequestClose={handleCloseSheet}>
                        <View className="flex-1 justify-end bg-black/40">
                            <TouchableOpacity className="absolute inset-0" onPress={handleCloseSheet} />
                            <View className="bg-white rounded-t-[48px] w-full max-w-[640px] h-[90%] self-center p-0 overflow-hidden shadow-2xl relative">
                                <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                                <MuatanForm onSuccess={handleFormSuccess} initialData={editData} />
                            </View>
                        </View>
                    </Modal>

                    <Modal visible={isDetailOpen} transparent animationType="slide" onRequestClose={handleCloseSheet}>
                        <View className="flex-1 justify-end bg-black/40">
                            <TouchableOpacity className="absolute inset-0" onPress={handleCloseSheet} />
                            <View className="bg-white rounded-t-[48px] w-full max-w-[640px] h-[90%] self-center p-0 overflow-hidden shadow-2xl relative">
                                <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                                {selectedTrip && renderDetailContent(selectedTrip)}
                            </View>
                        </View>
                    </Modal>
                </>
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
                    <View style={{ flex: 1 }}>
                        {view === 'form' ? (
                            <MuatanForm onSuccess={handleFormSuccess} initialData={editData} />
                        ) : selectedTrip ? (
                            renderDetailContent(selectedTrip)
                        ) : null}
                    </View>
                </BottomSheet>
            )}

            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                type={dialogConfig.type}
                onClose={closeDialog}
                onConfirm={dialogConfig.onConfirm}
                loading={actionLoading}
            />

            {/* Payment Method Selection Modal */}
            <BaseModal
                visible={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                showCloseButton={false}
            >
                <View className="w-20 h-20 bg-emerald-50 border border-emerald-100 rounded-[32px] items-center justify-center self-center mb-6">
                    <Wallet size={32} color="#10B981" />
                </View>
                <Typography variant="h2" weight="bold" className="text-center mb-2 text-2xl tracking-tighter">Konfirmasi Pelunasan</Typography>
                <Typography className="text-center text-gray-500 mb-8 leading-relaxed font-medium">
                    Pilih metode pembayaran untuk mencatat pelunasan muatan ini ke Kas & Bank:
                </Typography>

                <View style={{ gap: 12 }}>
                    <Button
                        title="Bayar via Tunai"
                        variant="primary"
                        loading={actionLoading}
                        onPress={() => { if (paymentItemId) processPayment(paymentItemId, 'tunai'); }}
                        className="h-14 shadow-lg shadow-primary/20"
                    />
                    <Button
                        title="Bayar via Transfer"
                        variant="outline"
                        loading={actionLoading}
                        onPress={() => { if (paymentItemId) processPayment(paymentItemId, 'transfer'); }}
                        className="h-14"
                    />
                    <Button
                        title="Nanti Saja"
                        variant="ghost"
                        disabled={actionLoading}
                        onPress={() => setIsPaymentModalOpen(false)}
                        className="h-12"
                    />
                </View>
            </BaseModal>
        </View>
    );
}
